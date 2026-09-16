import {createHash} from 'node:crypto';
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {
  assertFrozenBuildContract,
  assertSubmissionManifest,
  selectFinalSubmission,
  type BuildContract,
  type QualificationCriterionResult,
  type QualificationOverall,
  type SubmissionManifest,
} from '@rekt-ink/protocol/challenge';
import {
  ACCEPTANCE_MANIFEST_REFERENCE_KIND,
  bindAcceptanceManifestToContract,
  digestAcceptanceManifest,
  type AcceptanceManifest,
} from '@rekt-ink/protocol/acceptance-manifest';
import {
  buildTestArenaQualification,
  TEST_ARENA_EXECUTION_PROFILE_VERSION,
  type TestArenaObservation,
} from '@rekt-ink/protocol/test-arena-execution';
import type {Actor} from './authorization.js';
import {canonicalizeJson} from './canonical-json.js';
import {
  readChallengeSnapshot,
  recordChallengeQualification,
  type ChallengeQualificationRow,
  type ChallengeSnapshot,
} from './challenge-store.js';
import {appendHistoryEvent} from './events.js';
import type {InkubatorDatabase} from './database.js';
import {readSessionToken, resolveSessionActor} from './session.js';

export const TEST_ARENA_AUTOMATED_EVIDENCE_EVENT = 'challenge.acceptance.automated_evidence_recorded';
export const TEST_ARENA_HUMAN_EVIDENCE_EVENT = 'challenge.acceptance.human_observation_recorded';

// The module digest is a digest of the frozen implementation contract. The
// registry refuses to execute an identity whose id/version/digest tuple is not
// exactly this tuple. Adding or changing a module therefore requires a new
// content digest and a new frozen acceptance binding.
const ARTIFACT_DIGEST_MATCH_MODULE_SPEC =
  'rekt-inkubator:test-arena-module:artifact-digest-match:1.0.0:compare selected submission artifact_digest to config.expected_artifact_digest; require zero fixture references; return PASS or FAIL; no network; no participant-code execution';
export const TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_ID = 'artifact-digest-match';
export const TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_VERSION = '1.0.0';
export const TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_DIGEST = createHash('sha256')
  .update(ARTIFACT_DIGEST_MATCH_MODULE_SPEC, 'utf8')
  .digest('hex');

type AutomatedBinding = Extract<AcceptanceManifest['bindings'][number], {mode: 'AUTOMATED'}>;
type HumanBinding = Extract<AcceptanceManifest['bindings'][number], {mode: 'HUMAN_OBSERVATION'}>;

interface TrustedExecutorInput {
  submission: SubmissionManifest;
  config: Record<string, unknown>;
}

interface TrustedExecutorOutput {
  result: QualificationCriterionResult;
}

interface TrustedExecutor {
  module_id: string;
  module_version: string;
  module_digest: string;
  execute(input: TrustedExecutorInput): TrustedExecutorOutput;
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value: unknown, label: string): Record<string, unknown> {
  invariant(isObject(value), `${label} must be an object`);
  return value;
}

function assertString(value: unknown, label: string): asserts value is string {
  invariant(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
}

function assertDigest(value: unknown, label: string): asserts value is string {
  invariant(typeof value === 'string' && /^[0-9a-f]{64}$/.test(value), `${label} must be a lowercase sha256 digest`);
}

function assertExactKeys(value: Record<string, unknown>, expected: string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(actual.length === wanted.length && actual.every((key, index) => key === wanted[index]), `${label} has invalid keys`);
}

function requireUuid(value: unknown, label: string): string {
  assertString(value, label);
  invariant(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value), `invalid_${label}`);
  return value.toLowerCase();
}

function uniqueEvidenceRefs(value: unknown, label: string): string[] {
  invariant(Array.isArray(value) && value.length > 0, `${label} must not be empty`);
  const refs = value.map((ref, index) => {
    assertString(ref, `${label}[${index}]`);
    invariant(ref.length <= 500, `${label}[${index}] is too long`);
    return ref;
  });
  invariant(new Set(refs).size === refs.length, `${label} must be unique`);
  return [...refs].sort();
}

function normalizeHumanObservation(value: unknown, binding: HumanBinding, index: number): TestArenaObservation {
  const label = `human_observations[${index}]`;
  const observation = assertObject(value, label);
  assertExactKeys(observation, ['criterion_id', 'mode', 'result', 'evidence_refs'], label);
  invariant(observation.criterion_id === binding.criterion_id, `${label}.criterion_id does not match frozen binding`);
  invariant(observation.mode === 'HUMAN_OBSERVATION', `${label}.mode does not match frozen binding`);
  invariant(['PASS', 'FAIL', 'DISPUTED'].includes(observation.result as string), `${label}.result invalid`);
  return {
    criterion_id: binding.criterion_id,
    mode: 'HUMAN_OBSERVATION',
    result: observation.result as QualificationCriterionResult,
    evidence_refs: uniqueEvidenceRefs(observation.evidence_refs, `${label}.evidence_refs`),
  };
}

function artifactDigestMatchExecutor(input: TrustedExecutorInput): TrustedExecutorOutput {
  const config = assertObject(input.config, 'artifact-digest-match config');
  assertExactKeys(config, ['expected_artifact_digest'], 'artifact-digest-match config');
  assertDigest(config.expected_artifact_digest, 'artifact-digest-match config.expected_artifact_digest');
  assertSubmissionManifest(input.submission);
  return {result: input.submission.artifact_digest === config.expected_artifact_digest ? 'PASS' : 'FAIL'};
}

const TRUSTED_EXECUTORS = new Map<string, TrustedExecutor>([
  [`${TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_ID}\0${TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_VERSION}`, {
    module_id: TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_ID,
    module_version: TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_VERSION,
    module_digest: TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_DIGEST,
    execute: artifactDigestMatchExecutor,
  }],
]);

function trustedExecutorFor(binding: AutomatedBinding): TrustedExecutor {
  const executor = TRUSTED_EXECUTORS.get(`${binding.module_id}\0${binding.module_version}`);
  if (!executor) throw new Error('test_arena_executor_unsupported');
  if (executor.module_digest !== binding.module_digest) throw new Error('test_arena_executor_digest_mismatch');
  if (binding.fixture_reference_ids.length !== 0) throw new Error('test_arena_executor_fixtures_unsupported');
  return executor;
}

export function executeTrustedAutomatedBinding(
  binding: AutomatedBinding,
  submission: SubmissionManifest,
  context: {challengeId: string; entryId: string; submissionId: string; termsDigest: string; acceptanceManifestDigest: string},
): Extract<TestArenaObservation, {mode: 'AUTOMATED'}> & {evidence_digest: string} {
  const executor = trustedExecutorFor(binding);
  const output = executor.execute({submission, config: binding.config});
  const evidence = canonicalizeJson({
    schema_version: 'challenge.acceptance.automated-evidence/1.0',
    challenge_id: context.challengeId,
    entry_id: context.entryId,
    submission_id: context.submissionId,
    submission_manifest_digest: canonicalizeJson(submission).sha256,
    terms_digest: context.termsDigest,
    acceptance_manifest_digest: context.acceptanceManifestDigest,
    criterion_id: binding.criterion_id,
    module_id: executor.module_id,
    module_version: executor.module_version,
    module_digest: executor.module_digest,
    config_digest: canonicalizeJson(binding.config).sha256,
    result: output.result,
  });
  return {
    criterion_id: binding.criterion_id,
    mode: 'AUTOMATED',
    module_id: executor.module_id,
    module_version: executor.module_version,
    module_digest: executor.module_digest,
    result: output.result,
    evidence_refs: [`challenge-evidence:${evidence.sha256}`],
    evidence_digest: evidence.sha256,
  };
}

function acceptanceManifestReferenceId(contract: BuildContract): string {
  const references = contract.normative_references.filter((reference) => reference.kind === ACCEPTANCE_MANIFEST_REFERENCE_KIND);
  if (references.length !== 1) throw new Error('acceptance manifest reference authority must be unique');
  assertString(references[0]?.id, 'acceptance manifest reference id');
  return references[0].id;
}

function selectedSubmission(snapshot: ChallengeSnapshot, contract: BuildContract, entryId: string) {
  const rows = snapshot.submissions.filter((row) => row.entry_id === entryId);
  const selected = selectFinalSubmission(rows.map((row) => row.manifest_json as SubmissionManifest), contract, entryId);
  if (!selected) throw new Error('challenge_test_arena_final_submission_missing');
  const selectedDigest = canonicalizeJson(selected).sha256;
  const row = rows.find((candidate) => candidate.manifest_digest === selectedDigest && String(candidate.submission_version) === String(selected.submission_version));
  if (!row || !row.is_final) throw new Error('challenge_test_arena_final_submission_not_marked');
  return {row, manifest: assertSubmissionManifest(selected)};
}

function evidencePayload(input: {
  mode: 'AUTOMATED' | 'HUMAN_OBSERVATION';
  challengeId: string;
  entryId: string;
  submissionId: string;
  termsDigest: string;
  acceptanceManifestDigest: string;
  criterionId: string;
  result: QualificationCriterionResult;
  evidenceRefs: string[];
  evidenceDigest: string;
  module?: {id: string; version: string; digest: string; configDigest: string};
}) {
  return {
    schema_version: `challenge.acceptance.${input.mode === 'AUTOMATED' ? 'automated-evidence' : 'human-observation'}/1.0`,
    challenge_id: input.challengeId,
    entry_id: input.entryId,
    submission_id: input.submissionId,
    terms_digest: input.termsDigest,
    acceptance_manifest_digest: input.acceptanceManifestDigest,
    criterion_id: input.criterionId,
    mode: input.mode,
    result: input.result,
    evidence_refs: input.evidenceRefs,
    evidence_digest: input.evidenceDigest,
    ...(input.module ? {module_id: input.module.id, module_version: input.module.version, module_digest: input.module.digest, config_digest: input.module.configDigest} : {}),
  };
}

function eventDedupeKey(challengeId: string, entryId: string, submissionId: string, acceptanceDigest: string, criterionId: string): string {
  return `evidence:challenge.acceptance:${challengeId}:${entryId}:${submissionId}:${acceptanceDigest}:${criterionId}`;
}

export interface ExecuteTestArenaInput {
  actor: Actor;
  challengeId: string;
  entryId: string;
  requestId: string;
  qualificationId: string;
  acceptanceManifest: AcceptanceManifest;
  humanObservations: unknown[];
}

export interface ExecuteTestArenaResult {
  state: 'INCOMPLETE' | 'COMPLETE';
  challenge_id: string;
  entry_id: string;
  submission_id: string;
  acceptance_manifest_digest: string;
  qualification_version: string;
  execution_digest: string | null;
  overall: QualificationOverall | 'INCOMPLETE';
  qualification: ChallengeQualificationRow | null;
}

export async function executeTestArenaQualification(db: InkubatorDatabase, input: ExecuteTestArenaInput): Promise<ExecuteTestArenaResult> {
  const challengeId = requireUuid(input.challengeId, 'challenge_id');
  const entryId = requireUuid(input.entryId, 'entry_id');
  const requestId = requireUuid(input.requestId, 'request_id');
  const qualificationId = requireUuid(input.qualificationId, 'qualification_id');
  const snapshot = await readChallengeSnapshot(db, challengeId);
  if (!snapshot) throw new Error('challenge_not_found');
  if (snapshot.challenge.organizer_player_id !== input.actor.playerId) {
    throw new Error('challenge_organizer_required');
  }
  if (snapshot.challenge.status !== 'QUALIFICATION') throw new Error('challenge_test_arena_not_qualifying');
  const entry = snapshot.entries.find((candidate) => candidate.entry_id === entryId);
  if (!entry || entry.challenge_id !== challengeId) throw new Error('challenge_entry_not_found');
  if (!snapshot.contract) throw new Error('challenge_contract_not_frozen');
  const contract = assertFrozenBuildContract(snapshot.contract.contract_json);
  assertString(contract.terms_digest, 'contract.terms_digest');
  const termsDigest = contract.terms_digest;
  const referenceId = acceptanceManifestReferenceId(contract);
  const boundManifest = bindAcceptanceManifestToContract(contract, input.acceptanceManifest, referenceId);
  const acceptanceDigest = digestAcceptanceManifest(boundManifest);
  const selected = selectedSubmission(snapshot, contract, entryId);

  const humanByCriterion = new Map<string, TestArenaObservation>();
  invariant(Array.isArray(input.humanObservations), 'human_observations must be an array');
  for (const [index, candidate] of input.humanObservations.entries()) {
    const object = assertObject(candidate, `human_observations[${index}]`);
    assertString(object.criterion_id, `human_observations[${index}].criterion_id`);
    invariant(!humanByCriterion.has(object.criterion_id), 'human observation criterion ids must be unique');
    const binding = boundManifest.bindings.find((item): item is HumanBinding => item.mode === 'HUMAN_OBSERVATION' && item.criterion_id === object.criterion_id);
    if (!binding) throw new Error('test_arena_human_observation_not_declared');
    humanByCriterion.set(object.criterion_id, normalizeHumanObservation(candidate, binding, index));
  }

  const automatedObservations = boundManifest.bindings
    .filter((binding): binding is AutomatedBinding => binding.mode === 'AUTOMATED')
    .map((binding) => executeTrustedAutomatedBinding(binding, selected.manifest, {
      challengeId,
      entryId,
      submissionId: selected.row.submission_id,
      termsDigest,
      acceptanceManifestDigest: acceptanceDigest,
    }));

  for (const observation of automatedObservations) {
    const binding = boundManifest.bindings.find((candidate): candidate is AutomatedBinding => candidate.mode === 'AUTOMATED' && candidate.criterion_id === observation.criterion_id);
    invariant(binding, 'test_arena_automated_binding_missing');
    const payload = evidencePayload({
      mode: 'AUTOMATED', challengeId, entryId, submissionId: selected.row.submission_id,
      termsDigest, acceptanceManifestDigest: acceptanceDigest,
      criterionId: observation.criterion_id, result: observation.result, evidenceRefs: observation.evidence_refs,
      evidenceDigest: observation.evidence_digest,
      module: {id: observation.module_id, version: observation.module_version, digest: observation.module_digest, configDigest: canonicalizeJson(binding.config).sha256},
    });
    await appendHistoryEvent(db, {
      eventFamily: 'evidence', eventType: TEST_ARENA_AUTOMATED_EVIDENCE_EVENT,
      dedupeKey: eventDedupeKey(challengeId, entryId, selected.row.submission_id, acceptanceDigest, observation.criterion_id),
      payload, actorPlayerId: input.actor.playerId, subjectType: 'challenge_submission', subjectId: selected.row.submission_id,
    });
  }

  for (const observation of humanByCriterion.values()) {
    const evidence = canonicalizeJson({
      schema_version: 'challenge.acceptance.human-observation/1.0', challenge_id: challengeId, entry_id: entryId,
      submission_id: selected.row.submission_id, terms_digest: contract.terms_digest, acceptance_manifest_digest: acceptanceDigest,
      criterion_id: observation.criterion_id, result: observation.result, evidence_refs: observation.evidence_refs,
    });
    const payload = evidencePayload({
      mode: 'HUMAN_OBSERVATION', challengeId, entryId, submissionId: selected.row.submission_id,
      termsDigest, acceptanceManifestDigest: acceptanceDigest,
      criterionId: observation.criterion_id, result: observation.result, evidenceRefs: observation.evidence_refs,
      evidenceDigest: evidence.sha256,
    });
    await appendHistoryEvent(db, {
      eventFamily: 'evidence', eventType: TEST_ARENA_HUMAN_EVIDENCE_EVENT,
      dedupeKey: eventDedupeKey(challengeId, entryId, selected.row.submission_id, acceptanceDigest, observation.criterion_id),
      payload, actorPlayerId: input.actor.playerId, subjectType: 'challenge_submission', subjectId: selected.row.submission_id,
    });
  }

  const humanBindings = boundManifest.bindings.filter((binding): binding is HumanBinding => binding.mode === 'HUMAN_OBSERVATION');
  if (humanByCriterion.size !== humanBindings.length) {
    return {
      state: 'INCOMPLETE', challenge_id: challengeId, entry_id: entryId, submission_id: selected.row.submission_id,
      acceptance_manifest_digest: acceptanceDigest,
      qualification_version: `${TEST_ARENA_EXECUTION_PROFILE_VERSION}:pending`, execution_digest: null,
      overall: 'INCOMPLETE', qualification: null,
    };
  }

  const observations: TestArenaObservation[] = [
    ...automatedObservations.map(({evidence_digest: _evidenceDigest, ...observation}) => observation),
    ...humanByCriterion.values(),
  ];
  const qualification = buildTestArenaQualification({
    contract,
    acceptanceManifest: boundManifest,
    acceptanceManifestReferenceId: referenceId,
    entryId,
    submissionManifests: snapshot.submissions.filter((row) => row.entry_id === entryId).map((row) => row.manifest_json as SubmissionManifest),
    observations,
  });
  const stored = await recordChallengeQualification(db, {
    requestId, qualificationId, challengeId, entryId, submissionId: selected.row.submission_id,
    qualificationVersion: qualification.qualification_version,
    criterionResults: qualification.criterion_results,
  });
  return {
    state: 'COMPLETE', challenge_id: challengeId, entry_id: entryId, submission_id: selected.row.submission_id,
    acceptance_manifest_digest: acceptanceDigest, qualification_version: qualification.qualification_version,
    execution_digest: qualification.execution_digest, overall: qualification.overall, qualification: stored,
  };
}

async function authenticatedActor(request: FastifyRequest, db: InkubatorDatabase): Promise<Actor | null> {
  const token = readSessionToken(request.headers.cookie);
  if (!token) return null;
  return resolveSessionActor(db, token);
}

function apiError(reply: FastifyReply, statusCode: number, message: string) {
  return reply.code(statusCode).send({error: message});
}

export function registerStageG2bTestArenaRoutes(app: FastifyInstance, db: InkubatorDatabase): void {
  app.post('/v1/challenges/:challengeId/entries/:entryId/test-arena/execute', async (request, reply) => {
    const actor = await authenticatedActor(request, db);
    if (!actor) return apiError(reply, 401, 'authentication_required');
    const body = request.body;
    try {
      const object = assertObject(body, 'test arena request');
      assertExactKeys(object, ['request_id', 'qualification_id', 'acceptance_manifest', 'human_observations'], 'test arena request');
      const result = await executeTestArenaQualification(db, {
        actor,
        challengeId: (request.params as {challengeId: string}).challengeId,
        entryId: (request.params as {entryId: string}).entryId,
        requestId: object.request_id as string,
        qualificationId: object.qualification_id as string,
        acceptanceManifest: object.acceptance_manifest as AcceptanceManifest,
        humanObservations: object.human_observations as unknown[],
      });
      reply.header('cache-control', 'no-store');
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'test_arena_execution_failed';
      if (message === 'challenge_not_found' || message === 'challenge_entry_not_found') return apiError(reply, 404, message);
      if (message === 'challenge_organizer_required') return apiError(reply, 403, message);
      if (message.startsWith('invalid_') || message.includes('must be') || message.includes('invalid keys')) return apiError(reply, 400, message);
      if (message === 'test_arena_executor_unsupported' || message === 'test_arena_executor_digest_mismatch' || message === 'test_arena_executor_fixtures_unsupported') return apiError(reply, 409, message);
      if (message.includes('not_qualifying') || message.includes('final_submission') || message.includes('not_declared') || message.includes('reference authority') || message.includes('manifest') || message.includes('idempotency_conflict') || message.includes('immutable_conflict')) return apiError(reply, 409, message);
      throw cause;
    }
  });
}
