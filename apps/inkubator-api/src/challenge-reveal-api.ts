import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {
  assertFrozenBuildContract,
  assertSubmissionManifest,
  selectFinalSubmission,
  type BuildContract,
  type Criterion,
  type SubmissionManifest,
} from '@rekt-ink/protocol/challenge';
import {canonicalizeJson} from './canonical-json.js';
import {readChallengeSnapshot, type ChallengeSnapshot, type ChallengeStatus} from './challenge-store.js';
import type {ChallengeSubmissionArchiveStatus, InkubatorDatabase} from './database.js';
import {readSessionToken, resolveSessionActor} from './session.js';

const REVEALABLE_STATES = new Set<ChallengeStatus>([
  'SUBMISSIONS_LOCKED',
  'QUALIFICATION',
  'APPEAL_WINDOW',
  'FINAL_QUALIFIERS',
  'SELECTION',
  'DEFAULT_RESOLUTION',
  'SETTLEMENT_PENDING',
  'SETTLED',
  'RECEIPT_FILED',
]);

type CriterionGroup = 'OUTCOME' | 'PRODUCTION_ENVELOPE' | 'DELIVERY' | 'NORMATIVE_CONSTRAINT';

export interface RevealArenaCriterionView {
  criterion_id: string;
  group: CriterionGroup;
  description: string;
}

export interface RevealArenaArchiveView {
  status: ChallengeSubmissionArchiveStatus;
  archive_digest: string | null;
  reason_code: string | null;
  observed_at: string | null;
}

export interface RevealArenaSubmissionView {
  entry_id: string;
  submission_id: string;
  submission_version: number;
  accepted_at: string;
  immutable_source_reference: SubmissionManifest['immutable_source_reference'];
  artifact_digest: string;
  optional_live_url?: string;
  archive: RevealArenaArchiveView | null;
}

export interface RevealArenaView {
  schema_version: 'challenge.reveal-arena/1.0';
  challenge_id: string;
  contract_version: string;
  terms_digest: string;
  reveal_state: 'REVEALED';
  criteria: RevealArenaCriterionView[];
  submissions: RevealArenaSubmissionView[];
}

export interface SafeArchiveObservation {
  submission_id: string;
  status: ChallengeSubmissionArchiveStatus;
  archive_digest: string | null;
  reason_code: string | null;
  observed_at: Date | null;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function mandatoryCriteria(contract: BuildContract): RevealArenaCriterionView[] {
  const grouped: Array<[CriterionGroup, Criterion[]]> = [
    ['OUTCOME', contract.outcome_contract.criteria ?? []],
    ['PRODUCTION_ENVELOPE', contract.production_envelope.criteria ?? []],
    ['DELIVERY', contract.delivery_contract.criteria ?? []],
    ['NORMATIVE_CONSTRAINT', contract.normative_constraints],
  ];
  return grouped
    .flatMap(([group, criteria]) => criteria
      .filter((criterion) => criterion.mandatory)
      .map((criterion) => ({criterion_id: criterion.id, group, description: criterion.description})))
    .sort((left, right) => compareText(left.criterion_id, right.criterion_id));
}

function revealContract(snapshot: ChallengeSnapshot): BuildContract {
  if (!snapshot.contract) throw new Error('challenge_contract_not_frozen');
  const contract = assertFrozenBuildContract(snapshot.contract.contract_json);
  if (
    snapshot.challenge.current_contract_version !== snapshot.contract.contract_version
    || snapshot.challenge.current_terms_digest !== snapshot.contract.terms_digest
    || contract.contract_version !== snapshot.contract.contract_version
    || contract.terms_digest !== snapshot.contract.terms_digest
  ) {
    throw new Error('challenge_contract_pointer_invalid');
  }
  return contract;
}

function selectedSubmissionRows(snapshot: ChallengeSnapshot, contract: BuildContract) {
  const rows = [];
  for (const entry of [...snapshot.entries].sort((left, right) => compareText(left.entry_id, right.entry_id))) {
    const entryRows = snapshot.submissions.filter((submission) => submission.entry_id === entry.entry_id);
    const manifests = entryRows.map((submission) => assertSubmissionManifest(submission.manifest_json));
    const selected = selectFinalSubmission(manifests, contract, entry.entry_id);
    if (!selected) continue;
    const selectedDigest = canonicalizeJson(selected).sha256;
    const row = entryRows.find((submission) =>
      String(submission.submission_version) === String(selected.submission_version)
      && submission.manifest_digest === selectedDigest,
    );
    if (!row) throw new Error('challenge_reveal_final_submission_invalid');
    rows.push({row, manifest: selected});
  }
  return rows;
}

export function buildStageGRevealArenaProjection(
  snapshot: ChallengeSnapshot,
  archives: SafeArchiveObservation[],
  actorPlayerId: string,
): RevealArenaView {
  if (snapshot.challenge.organizer_player_id !== actorPlayerId) throw new Error('challenge_organizer_required');
  if (!REVEALABLE_STATES.has(snapshot.challenge.status)) throw new Error('challenge_reveal_sealed');

  const contract = revealContract(snapshot);
  const archiveBySubmissionId = new Map(archives.map((archive) => [archive.submission_id, archive]));
  const submissions = selectedSubmissionRows(snapshot, contract).map(({row, manifest}) => {
    const archive = archiveBySubmissionId.get(row.submission_id);
    return {
      entry_id: manifest.entry_id,
      submission_id: row.submission_id,
      submission_version: manifest.submission_version,
      accepted_at: new Date(manifest.accepted_at).toISOString(),
      immutable_source_reference: {...manifest.immutable_source_reference},
      artifact_digest: manifest.artifact_digest,
      ...(manifest.optional_live_url ? {optional_live_url: manifest.optional_live_url} : {}),
      archive: archive
        ? {
            status: archive.status,
            archive_digest: archive.archive_digest,
            reason_code: archive.reason_code,
            observed_at: archive.observed_at?.toISOString() ?? null,
          }
        : null,
    } satisfies RevealArenaSubmissionView;
  });

  return {
    schema_version: 'challenge.reveal-arena/1.0',
    challenge_id: snapshot.challenge.challenge_id,
    contract_version: snapshot.contract!.contract_version,
    terms_digest: snapshot.contract!.terms_digest,
    reveal_state: 'REVEALED',
    criteria: mandatoryCriteria(contract),
    submissions,
  };
}

export async function loadStageGRevealArenaView(
  db: InkubatorDatabase,
  challengeId: string,
  actorPlayerId: string,
): Promise<RevealArenaView> {
  const snapshot = await readChallengeSnapshot(db, challengeId);
  if (!snapshot) throw new Error('challenge_not_found');
  if (snapshot.challenge.organizer_player_id !== actorPlayerId) throw new Error('challenge_organizer_required');
  if (!REVEALABLE_STATES.has(snapshot.challenge.status)) throw new Error('challenge_reveal_sealed');

  const archives = await db.selectFrom('challenge_submission_archives')
    .select(['submission_id', 'status', 'archive_digest', 'reason_code', 'observed_at'])
    .where('challenge_id', '=', challengeId)
    .execute();
  return buildStageGRevealArenaProjection(snapshot, archives, actorPlayerId);
}

async function authenticatedPlayerId(request: FastifyRequest, db: InkubatorDatabase): Promise<string | null> {
  const token = readSessionToken(request.headers.cookie);
  if (!token) return null;
  return (await resolveSessionActor(db, token))?.playerId ?? null;
}

function apiError(reply: FastifyReply, statusCode: number, message: string) {
  return reply.code(statusCode).send({error: message});
}

export function registerStageGRevealArenaRoutes(app: FastifyInstance, db: InkubatorDatabase): void {
  app.get('/v1/challenges/:challengeId/reveal-arena', async (request, reply) => {
    const actorPlayerId = await authenticatedPlayerId(request, db);
    if (!actorPlayerId) return apiError(reply, 401, 'authentication_required');
    const {challengeId} = request.params as {challengeId: string};

    try {
      const view = await loadStageGRevealArenaView(db, challengeId, actorPlayerId);
      reply.header('cache-control', 'no-store');
      return view;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'challenge_reveal_failed';
      if (message === 'invalid_challenge_id') return apiError(reply, 400, message);
      if (message === 'challenge_not_found') return apiError(reply, 404, message);
      if (message === 'challenge_organizer_required') return apiError(reply, 403, message);
      if (
        message === 'challenge_reveal_sealed'
        || message === 'challenge_contract_not_frozen'
        || message === 'challenge_contract_pointer_invalid'
        || message === 'challenge_reveal_final_submission_invalid'
      ) {
        return apiError(reply, 409, message);
      }
      throw cause;
    }
  });
}
