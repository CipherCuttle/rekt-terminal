import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {
  assertFrozenBuildContract,
  selectFinalSubmission,
  type QualificationCriterionResult,
  type SubmissionManifest,
} from '@rekt-ink/protocol/challenge';
import {
  bindAcceptanceManifestToContract,
  type AcceptanceManifest,
} from '@rekt-ink/protocol/acceptance-manifest';
import {buildTestArenaQualification, type TestArenaQualification} from '@rekt-ink/protocol/test-arena-execution';
import {canonicalizeJson} from './canonical-json.js';
import {
  readChallengeSnapshot,
  recordChallengeQualification,
  type ChallengeSnapshot,
  type ChallengeSubmissionRow,
} from './challenge-store.js';
import {runTrustedTestModule, trustedTestModuleCatalog} from './challenge-test-runners.js';
import type {ChallengeSubmissionArchiveStatus, InkubatorDatabase} from './database.js';
import {appendHistoryEvent} from './events.js';
import {readSessionToken, resolveSessionActor} from './session.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESULT_VALUES = new Set<QualificationCriterionResult>(['PASS', 'FAIL', 'DISPUTED']);

export interface HumanObservationInput {
  criterion_id: string;
  result: QualificationCriterionResult;
  evidence_refs: string[];
}

export interface SafeArchiveInput {
  submission_id: string;
  challenge_id: string;
  entry_id: string;
  terms_digest: string;
  manifest_digest: string;
  status: ChallengeSubmissionArchiveStatus;
  archive_digest: string | null;
  reason_code: string | null;
}

export interface PreparedStageG2BQualification {
  submission_id: string;
  qualification: TestArenaQualification;
}

export interface RecordStageG2BQualificationInput {
  requestId: string;
  qualificationId: string;
  challengeId: string;
  entryId: string;
  actorPlayerId: string;
  acceptanceManifestReferenceId: string;
  acceptanceManifest: AcceptanceManifest;
  humanObservations: HumanObservationInput[];
}

function requireUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new Error(`invalid_${label}`);
  return value.toLowerCase();
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`invalid_${label}`);
  return value;
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parseHumanObservations(value: unknown): HumanObservationInput[] {
  if (!Array.isArray(value)) throw new Error('invalid_human_observations');
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`invalid_human_observation_${index}`);
    const object = item as Record<string, unknown>;
    if (!exactKeys(object, ['criterion_id', 'result', 'evidence_refs'])) throw new Error(`invalid_human_observation_${index}`);
    const criterionId = requireString(object.criterion_id, `human_observation_${index}_criterion_id`);
    if (typeof object.result !== 'string' || !RESULT_VALUES.has(object.result as QualificationCriterionResult)) {
      throw new Error(`invalid_human_observation_${index}_result`);
    }
    if (!Array.isArray(object.evidence_refs) || object.evidence_refs.length === 0) {
      throw new Error(`invalid_human_observation_${index}_evidence_refs`);
    }
    const evidenceRefs = object.evidence_refs.map((ref, refIndex) => requireString(ref, `human_observation_${index}_evidence_ref_${refIndex}`));
    if (new Set(evidenceRefs).size !== evidenceRefs.length) throw new Error(`invalid_human_observation_${index}_evidence_refs`);
    return {criterion_id: criterionId, result: object.result as QualificationCriterionResult, evidence_refs: [...evidenceRefs].sort()};
  });
}

function frozenContract(snapshot: ChallengeSnapshot) {
  if (!snapshot.contract) throw new Error('challenge_contract_not_frozen');
  const contract = assertFrozenBuildContract(snapshot.contract.contract_json);
  if (
    snapshot.challenge.current_contract_version !== snapshot.contract.contract_version
    || snapshot.challenge.current_terms_digest !== snapshot.contract.terms_digest
    || contract.contract_version !== snapshot.contract.contract_version
    || contract.terms_digest !== snapshot.contract.terms_digest
  ) throw new Error('challenge_contract_pointer_invalid');
  return contract;
}

function selectedFinalRow(snapshot: ChallengeSnapshot, entryId: string): {row: ChallengeSubmissionRow; manifests: SubmissionManifest[]} {
  const contract = frozenContract(snapshot);
  const rows = snapshot.submissions.filter((row) => row.entry_id === entryId);
  const manifests = rows.map((row) => row.manifest_json as SubmissionManifest);
  const selected = selectFinalSubmission(manifests, contract, entryId);
  if (!selected) throw new Error('challenge_test_final_submission_missing');
  const digest = canonicalizeJson(selected).sha256;
  const selectedRows = rows.filter((row) => row.manifest_digest === digest && String(row.submission_version) === String(selected.submission_version));
  if (selectedRows.length !== 1) throw new Error('challenge_test_final_submission_ambiguous');
  const finalRows = rows.filter((row) => row.is_final);
  if (finalRows.length !== 1 || finalRows[0].submission_id !== selectedRows[0].submission_id) {
    throw new Error('challenge_test_durable_finality_mismatch');
  }
  return {row: selectedRows[0], manifests};
}

function humanObservationMap(bindings: AcceptanceManifest['bindings'], humanObservations: HumanObservationInput[]) {
  const expected = bindings.filter((binding) => binding.mode === 'HUMAN_OBSERVATION').map((binding) => binding.criterion_id).sort();
  const supplied = humanObservations.map((observation) => observation.criterion_id).sort();
  if (new Set(supplied).size !== supplied.length || expected.length !== supplied.length || expected.some((id, index) => id !== supplied[index])) {
    throw new Error('challenge_test_human_observations_mismatch');
  }
  return new Map(humanObservations.map((observation) => [observation.criterion_id, observation]));
}

export function buildStageG2BQualificationFromSnapshot(
  snapshot: ChallengeSnapshot,
  archives: SafeArchiveInput[],
  input: {
    entryId: string;
    acceptanceManifestReferenceId: string;
    acceptanceManifest: AcceptanceManifest;
    humanObservations: HumanObservationInput[];
  },
): PreparedStageG2BQualification {
  if (snapshot.challenge.status !== 'QUALIFICATION') throw new Error('challenge_not_qualifying');
  if (!snapshot.entries.some((entry) => entry.entry_id === input.entryId)) throw new Error('challenge_entry_not_found');
  const contract = frozenContract(snapshot);
  const boundManifest = bindAcceptanceManifestToContract(contract, input.acceptanceManifest, input.acceptanceManifestReferenceId);
  const {row: finalRow, manifests} = selectedFinalRow(snapshot, input.entryId);
  const selectedManifest = selectFinalSubmission(manifests, contract, input.entryId);
  if (!selectedManifest) throw new Error('challenge_test_final_submission_missing');
  const selectedManifestDigest = canonicalizeJson(selectedManifest).sha256;
  const matchingArchives = archives.filter((archive) => archive.submission_id === finalRow.submission_id);
  if (matchingArchives.length > 1) throw new Error('challenge_test_archive_ambiguous');
  const archive = matchingArchives[0] ?? null;
  const humanByCriterion = humanObservationMap(boundManifest.bindings, input.humanObservations);

  const observations = boundManifest.bindings.map((binding) => {
    if (binding.mode === 'HUMAN_OBSERVATION') {
      const observation = humanByCriterion.get(binding.criterion_id);
      if (!observation) throw new Error('challenge_test_human_observations_mismatch');
      return {...observation, mode: 'HUMAN_OBSERVATION' as const};
    }
    return runTrustedTestModule(binding, {
      challenge_id: snapshot.challenge.challenge_id,
      entry_id: input.entryId,
      submission_id: finalRow.submission_id,
      terms_digest: contract.terms_digest!,
      selected_manifest_digest: selectedManifestDigest,
      stored_manifest_digest: finalRow.manifest_digest,
      stored_is_final: finalRow.is_final,
      archive,
    });
  });

  const qualification = buildTestArenaQualification({
    contract,
    acceptanceManifest: boundManifest,
    acceptanceManifestReferenceId: input.acceptanceManifestReferenceId,
    entryId: input.entryId,
    submissionManifests: manifests,
    observations,
  });
  if (qualification.execution.submission.manifest_digest !== finalRow.manifest_digest) {
    throw new Error('challenge_test_execution_lineage_mismatch');
  }
  return {submission_id: finalRow.submission_id, qualification};
}

export async function recordStageG2BQualification(
  db: InkubatorDatabase,
  input: RecordStageG2BQualificationInput,
) {
  const requestId = requireUuid(input.requestId, 'request_id');
  const qualificationId = requireUuid(input.qualificationId, 'qualification_id');
  const challengeId = requireUuid(input.challengeId, 'challenge_id');
  const entryId = requireUuid(input.entryId, 'entry_id');
  const actorPlayerId = requireUuid(input.actorPlayerId, 'actor_player_id');
  const acceptanceManifestReferenceId = requireString(input.acceptanceManifestReferenceId, 'acceptance_manifest_reference_id');
  const snapshot = await readChallengeSnapshot(db, challengeId);
  if (!snapshot) throw new Error('challenge_not_found');
  if (snapshot.challenge.organizer_player_id !== actorPlayerId) throw new Error('challenge_organizer_required');

  const archives = await db.selectFrom('challenge_submission_archives')
    .select(['submission_id', 'challenge_id', 'entry_id', 'terms_digest', 'manifest_digest', 'status', 'archive_digest', 'reason_code'])
    .where('challenge_id', '=', challengeId)
    .where('entry_id', '=', entryId)
    .execute();

  const prepared = buildStageG2BQualificationFromSnapshot(snapshot, archives, {
    entryId,
    acceptanceManifestReferenceId,
    acceptanceManifest: input.acceptanceManifest,
    humanObservations: input.humanObservations,
  });
  const row = await recordChallengeQualification(db, {
    requestId,
    qualificationId,
    challengeId,
    entryId,
    submissionId: prepared.submission_id,
    qualificationVersion: prepared.qualification.qualification_version,
    criterionResults: prepared.qualification.criterion_results,
  });

  await appendHistoryEvent(db, {
    eventFamily: 'evidence',
    eventType: 'challenge.test_arena.executed',
    dedupeKey: `evidence:challenge.test_arena.executed:${challengeId}:${requestId}`,
    actorPlayerId,
    subjectType: 'challenge',
    subjectId: challengeId,
    payload: {
      schema_version: 'challenge.test-arena-execution-event/1.0',
      request_id: requestId,
      qualification_id: qualificationId,
      challenge_id: challengeId,
      entry_id: entryId,
      submission_id: prepared.submission_id,
      qualification_version: prepared.qualification.qualification_version,
      result: prepared.qualification.overall,
      execution_digest: prepared.qualification.execution_digest,
      execution: prepared.qualification.execution,
    },
  });

  return {
    schema_version: 'challenge.test-arena-qualification/1.0' as const,
    challenge_id: challengeId,
    entry_id: entryId,
    submission_id: prepared.submission_id,
    qualification_id: row.qualification_id,
    qualification_version: row.qualification_version,
    result: row.result,
    execution_digest: prepared.qualification.execution_digest,
  };
}

async function authenticatedPlayerId(request: FastifyRequest, db: InkubatorDatabase): Promise<string | null> {
  const token = readSessionToken(request.headers.cookie);
  if (!token) return null;
  return (await resolveSessionActor(db, token))?.playerId ?? null;
}

function apiError(reply: FastifyReply, statusCode: number, message: string) {
  return reply.code(statusCode).send({error: message});
}

export function registerStageG2BTestArenaRoutes(app: FastifyInstance, db: InkubatorDatabase): void {
  app.get('/v1/test-arena/modules', async (request, reply) => {
    const actorPlayerId = await authenticatedPlayerId(request, db);
    if (!actorPlayerId) return apiError(reply, 401, 'authentication_required');
    reply.header('cache-control', 'no-store');
    return {schema_version: 'challenge.test-module-catalog/1.0', modules: trustedTestModuleCatalog()};
  });

  app.post('/v1/challenges/:challengeId/test-arena/entries/:entryId/qualify', async (request, reply) => {
    const actorPlayerId = await authenticatedPlayerId(request, db);
    if (!actorPlayerId) return apiError(reply, 401, 'authentication_required');
    const {challengeId, entryId} = request.params as {challengeId: string; entryId: string};
    const body = request.body as Record<string, unknown> | null;
    try {
      if (!body || !exactKeys(body, ['request_id', 'qualification_id', 'acceptance_manifest_reference_id', 'acceptance_manifest', 'human_observations'])) {
        return apiError(reply, 400, 'challenge_test_arena_input_invalid');
      }
      const result = await recordStageG2BQualification(db, {
        requestId: requireString(body.request_id, 'request_id'),
        qualificationId: requireString(body.qualification_id, 'qualification_id'),
        challengeId,
        entryId,
        actorPlayerId,
        acceptanceManifestReferenceId: requireString(body.acceptance_manifest_reference_id, 'acceptance_manifest_reference_id'),
        acceptanceManifest: body.acceptance_manifest as AcceptanceManifest,
        humanObservations: parseHumanObservations(body.human_observations),
      });
      reply.header('cache-control', 'no-store');
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'challenge_test_arena_failed';
      if (message.startsWith('invalid_') || message.includes('acceptance manifest') || message.includes('test arena')) {
        return apiError(reply, 400, 'challenge_test_arena_input_invalid');
      }
      if (message === 'challenge_not_found') return apiError(reply, 404, message);
      if (message === 'challenge_organizer_required') return apiError(reply, 403, message);
      if (
        message === 'challenge_not_qualifying'
        || message === 'challenge_entry_not_found'
        || message.startsWith('challenge_test_')
        || message.startsWith('challenge_qualification_')
        || message.includes('idempotency_conflict')
      ) return apiError(reply, 409, message);
      throw cause;
    }
  });
}
