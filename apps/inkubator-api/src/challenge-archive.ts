import {sql, type Kysely} from 'kysely';
import {canonicalizeJson} from './canonical-json.js';
import {readDatabaseNow, type ChallengeSubmissionArchiveSourceKind, type ChallengeSubmissionArchiveStatus, type DatabaseSchema, type OutboxJobRow} from './database.js';
import {appendHistoryEvent} from './events.js';

export const CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_JOB_TYPE = 'challenge.submission_archive_capture.v1';
export const CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_SCHEMA_VERSION = 'challenge.submission_archive_capture.job.v2';
const LEGACY_CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_SCHEMA_VERSION = 'challenge.submission_archive_capture.job.v1';
export const CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE = 'private-material-purged:v1';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const SOURCE_KINDS = new Set<ChallengeSubmissionArchiveSourceKind>(['GIT_COMMIT', 'CONTENT_ADDRESS', 'ARCHIVE_DIGEST']);
const SAFE_REASON_PATTERN = /^[A-Z][A-Z0-9_]{0,79}$/;

type AcceptedManifest = {
  terms_digest?: unknown;
  immutable_source_reference?: unknown;
  artifact_digest?: unknown;
  evidence_references?: unknown;
  optional_live_url?: unknown;
};

export type ChallengeSubmissionArchiveCapturePayload = {
  schema_version: typeof CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_SCHEMA_VERSION;
  submission_id: string;
  challenge_id: string;
  entry_id: string;
  source_kind: ChallengeSubmissionArchiveSourceKind;
  source_reference: string;
  terms_digest: string;
  manifest_digest: string;
  artifact_digest: string;
  evidence_references: string[];
  optional_live_url: string | null;
  ship_submission_id: string | null;
};

export type ChallengeSubmissionArchiveJobPayload = {
  schema_version: typeof CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_SCHEMA_VERSION;
  submission_id: string;
};

export type ChallengeSubmissionArchiveCaptureInput = {
  submissionId: string;
  challengeId: string;
  entryId: string;
  sourceKind: ChallengeSubmissionArchiveSourceKind;
  sourceReference: string;
  termsDigest: string;
  manifestDigest: string;
  artifactDigest: string;
  evidenceReferences: string[];
  optionalLiveUrl: string | null;
  shipSubmissionId: string | null;
};

export type ChallengeSubmissionArchiveCaptureResult =
  | {outcome: 'CAPTURED'; archive_digest: string; archive_reference: string}
  | {outcome: 'TRANSIENT_PLATFORM_UNAVAILABLE'; reason_code: string}
  | {outcome: 'BUILDER_SOURCE_REVOKED_OR_DELETED'; reason_code: string}
  | {outcome: 'UNSUPPORTED_SOURCE'; reason_code: string}
  | {outcome: 'UNKNOWN_UNAVAILABLE'; reason_code: string};

export interface ChallengeSubmissionArchiveCaptureClient {
  capture(input: ChallengeSubmissionArchiveCaptureInput): Promise<unknown>;
}

export interface ChallengeSubmissionArchiveDeletionClient {
  delete(input: {submissionId: string; archiveReference: string}): Promise<void>;
}

export interface ChallengeSubmissionArchiveRow {
  submission_id: string;
  challenge_id: string;
  entry_id: string;
  source_kind: ChallengeSubmissionArchiveSourceKind;
  source_reference: string;
  terms_digest: string;
  manifest_digest: string;
  status: ChallengeSubmissionArchiveStatus;
  archive_digest: string | null;
  archive_reference: string | null;
  observed_at: Date | null;
  reason_code: string | null;
}

export interface ChallengeSubmissionPrivateMaterialPurgeResult {
  submission_id: string;
  challenge_id: string;
  manifest_digest: string;
  archive_digest: string | null;
  archive_status: ChallengeSubmissionArchiveStatus;
  already_purged: boolean;
}

function requiredString(value: unknown, label: string, maxLength = 500): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength) throw new Error(`challenge_archive_${label}_invalid`);
  return value;
}

function requiredUuid(value: unknown, label: string): string {
  const result = requiredString(value, label, 36).toLowerCase();
  if (!UUID_PATTERN.test(result)) throw new Error(`challenge_archive_${label}_invalid`);
  return result;
}

function requiredDigest(value: unknown, label: string): string {
  const result = requiredString(value, label, 64).toLowerCase();
  if (!DIGEST_PATTERN.test(result)) throw new Error(`challenge_archive_${label}_invalid`);
  return result;
}

function reasonCode(value: unknown): string {
  if (typeof value !== 'string' || !SAFE_REASON_PATTERN.test(value)) throw new Error('challenge_archive_capture_result_invalid');
  return value;
}

function manifestParts(submission: {submission_id: string; challenge_id: string; entry_id: string; terms_digest: string; manifest_digest: string; ship_submission_id: string | null; manifest_json: unknown}): ChallengeSubmissionArchiveCapturePayload {
  if (!submission.manifest_json || typeof submission.manifest_json !== 'object' || Array.isArray(submission.manifest_json)) throw new Error('challenge_archive_manifest_invalid');
  const manifest = submission.manifest_json as AcceptedManifest;
  const source = manifest.immutable_source_reference;
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('challenge_archive_manifest_invalid');
  const sourceRecord = source as {kind?: unknown; value?: unknown};
  if (typeof sourceRecord.kind !== 'string' || !SOURCE_KINDS.has(sourceRecord.kind as ChallengeSubmissionArchiveSourceKind)) throw new Error('challenge_archive_manifest_invalid');
  const evidence = manifest.evidence_references;
  if (!Array.isArray(evidence) || evidence.some((item) => typeof item !== 'string' || item.length < 1 || item.length > 500)) throw new Error('challenge_archive_manifest_invalid');
  const liveUrl = manifest.optional_live_url;
  if (liveUrl !== undefined && liveUrl !== null && typeof liveUrl !== 'string') throw new Error('challenge_archive_manifest_invalid');
  return {
    schema_version: CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_SCHEMA_VERSION,
    submission_id: requiredUuid(submission.submission_id, 'submission_id'),
    challenge_id: requiredUuid(submission.challenge_id, 'challenge_id'),
    entry_id: requiredUuid(submission.entry_id, 'entry_id'),
    source_kind: sourceRecord.kind as ChallengeSubmissionArchiveSourceKind,
    source_reference: requiredString(sourceRecord.value, 'source_reference'),
    terms_digest: requiredDigest(submission.terms_digest, 'terms_digest'),
    manifest_digest: requiredDigest(submission.manifest_digest, 'manifest_digest'),
    artifact_digest: requiredDigest(manifest.artifact_digest, 'artifact_digest'),
    evidence_references: [...(evidence as string[])],
    optional_live_url: (liveUrl as string | null | undefined) ?? null,
    ship_submission_id: submission.ship_submission_id,
  };
}

export function challengeSubmissionArchiveCapturePayload(submission: {
  submission_id: string;
  challenge_id: string;
  entry_id: string;
  terms_digest: string;
  manifest_digest: string;
  ship_submission_id: string | null;
  manifest_json: unknown;
}): ChallengeSubmissionArchiveCapturePayload {
  return manifestParts(submission);
}

function jobPayload(submissionId: string): ChallengeSubmissionArchiveJobPayload {
  return {
    schema_version: CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_SCHEMA_VERSION,
    submission_id: requiredUuid(submissionId, 'submission_id'),
  };
}

function captureJobPayload(value: unknown): ChallengeSubmissionArchiveJobPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('challenge_archive_job_payload_invalid');
  const payload = value as Record<string, unknown>;
  const schemaVersion = payload.schema_version;
  if (schemaVersion !== CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_SCHEMA_VERSION && schemaVersion !== LEGACY_CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_SCHEMA_VERSION) {
    throw new Error('challenge_archive_job_payload_invalid');
  }
  if (schemaVersion === CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_SCHEMA_VERSION) {
    const keys = Object.keys(payload).sort();
    if (keys.length !== 2 || keys[0] !== 'schema_version' || keys[1] !== 'submission_id') throw new Error('challenge_archive_job_payload_invalid');
  }
  return jobPayload(requiredUuid(payload.submission_id, 'submission_id'));
}

async function sanitizeExistingArchiveJobPayload(db: Kysely<DatabaseSchema>, submissionId: string): Promise<void> {
  const idempotencyKey = `challenge.submission.archive:${submissionId}`;
  const existing = await db.selectFrom('outbox_jobs').selectAll().where('idempotency_key', '=', idempotencyKey).executeTakeFirst();
  if (!existing) return;
  if (existing.job_type !== CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_JOB_TYPE) throw new Error(`outbox_job_idempotency_conflict:${idempotencyKey}`);
  const existingReference = captureJobPayload(existing.payload);
  if (existingReference.submission_id !== submissionId) throw new Error('challenge_archive_job_lineage_invalid');
  const normalized = canonicalizeJson(jobPayload(submissionId));
  if (existing.payload_hash === normalized.sha256) return;
  await db.updateTable('outbox_jobs').set({payload: normalized.value, payload_hash: normalized.sha256}).where('job_id', '=', existing.job_id).execute();
}

export async function ensureChallengeSubmissionArchiveState(
  db: Kysely<DatabaseSchema>,
  submission: {
    submission_id: string;
    challenge_id: string;
    entry_id: string;
    terms_digest: string;
    manifest_digest: string;
    ship_submission_id: string | null;
    manifest_json: unknown;
  },
): Promise<ChallengeSubmissionArchiveCapturePayload> {
  const payload = challengeSubmissionArchiveCapturePayload(submission);
  const inserted = await db
    .insertInto('challenge_submission_archives')
    .values({
      submission_id: payload.submission_id,
      challenge_id: payload.challenge_id,
      entry_id: payload.entry_id,
      source_kind: payload.source_kind,
      source_reference: payload.source_reference,
      terms_digest: payload.terms_digest,
      manifest_digest: payload.manifest_digest,
      status: 'PENDING',
      archive_digest: null,
      archive_reference: null,
      observed_at: null,
      reason_code: null,
    })
    .onConflict((conflict) => conflict.column('submission_id').doNothing())
    .returningAll()
    .executeTakeFirst();
  const existing = inserted ?? await db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', payload.submission_id).executeTakeFirst();
  if (!existing) throw new Error('challenge_archive_state_missing');
  const sourceReferenceMatches = existing.source_reference === payload.source_reference || existing.source_reference === CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE;
  if (
    existing.challenge_id !== payload.challenge_id || existing.entry_id !== payload.entry_id ||
    existing.source_kind !== payload.source_kind || !sourceReferenceMatches ||
    existing.terms_digest !== payload.terms_digest || existing.manifest_digest !== payload.manifest_digest
  ) throw new Error('challenge_archive_state_immutable_conflict');
  await sanitizeExistingArchiveJobPayload(db, payload.submission_id);
  return payload;
}

export function challengeSubmissionArchiveJob(payload: ChallengeSubmissionArchiveCapturePayload): {
  jobType: string;
  idempotencyKey: string;
  payload: ChallengeSubmissionArchiveJobPayload;
  maxAttempts: number;
} {
  return {
    jobType: CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_JOB_TYPE,
    idempotencyKey: `challenge.submission.archive:${payload.submission_id}`,
    payload: jobPayload(payload.submission_id),
    maxAttempts: 5,
  };
}

function captureResult(value: unknown): ChallengeSubmissionArchiveCaptureResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('challenge_archive_capture_result_invalid');
  const result = value as Record<string, unknown>;
  const outcome = result.outcome;
  if (outcome === 'CAPTURED') return {outcome, archive_digest: requiredDigest(result.archive_digest, 'archive_digest'), archive_reference: requiredString(result.archive_reference, 'archive_reference')};
  if (outcome === 'TRANSIENT_PLATFORM_UNAVAILABLE' || outcome === 'BUILDER_SOURCE_REVOKED_OR_DELETED' || outcome === 'UNSUPPORTED_SOURCE' || outcome === 'UNKNOWN_UNAVAILABLE') {
    return {outcome, reason_code: reasonCode(result.reason_code)};
  }
  throw new Error('challenge_archive_capture_result_invalid');
}

function terminalStatus(outcome: ChallengeSubmissionArchiveCaptureResult): ChallengeSubmissionArchiveStatus | null {
  if (outcome.outcome === 'CAPTURED') return 'CAPTURED';
  if (outcome.outcome === 'BUILDER_SOURCE_REVOKED_OR_DELETED') return 'BUILDER_CAUSED_UNAVAILABLE';
  if (outcome.outcome === 'UNSUPPORTED_SOURCE') return 'UNSUPPORTED_SOURCE';
  return null;
}

async function appendCaptureEvent(
  db: Kysely<DatabaseSchema>,
  row: ChallengeSubmissionArchiveRow,
  outcome: ChallengeSubmissionArchiveCaptureResult,
  observedAt: Date,
): Promise<void> {
  const captured = outcome.outcome === 'CAPTURED';
  await appendHistoryEvent(db, {
    eventFamily: 'evidence',
    eventType: captured ? 'challenge.submission_archive.captured' : 'challenge.submission_archive.unavailable',
    dedupeKey: `evidence:challenge.submission_archive:${row.submission_id}:${captured ? 'captured' : row.status.toLowerCase()}`,
    actorPlayerId: null,
    subjectType: 'challenge_submission',
    subjectId: row.submission_id,
    occurredAt: observedAt,
    payload: captured
      ? {
          schema_version: 'challenge.submission_archive.captured.v1',
          submission_id: row.submission_id,
          challenge_id: row.challenge_id,
          entry_id: row.entry_id,
          source_kind: row.source_kind,
          manifest_digest: row.manifest_digest,
          archive_digest: outcome.archive_digest,
          truth_state: 'OBSERVED',
        }
      : {
          schema_version: 'challenge.submission_archive.unavailable.v1',
          submission_id: row.submission_id,
          challenge_id: row.challenge_id,
          entry_id: row.entry_id,
          source_kind: row.source_kind,
          manifest_digest: row.manifest_digest,
          reason_code: outcome.reason_code,
          availability_state: row.status,
          truth_state: row.status === 'BUILDER_CAUSED_UNAVAILABLE' ? 'OBSERVED' : 'UNKNOWN',
        },
  });
}

export async function handleChallengeSubmissionArchiveJob(
  db: Kysely<DatabaseSchema>,
  job: OutboxJobRow,
  client: ChallengeSubmissionArchiveCaptureClient | undefined,
): Promise<void> {
  const reference = captureJobPayload(job.payload);
  const archive = await db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', reference.submission_id).executeTakeFirst();
  if (!archive) throw new Error('challenge_archive_state_missing');
  if (archive.source_reference === CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE || archive.status !== 'PENDING') return;

  const submission = (await sql<{
    submission_id: string;
    challenge_id: string;
    entry_id: string;
    terms_digest: string;
    manifest_digest: string;
    ship_submission_id: string | null;
    manifest_json: unknown;
  }>`
    select submission_id, challenge_id, entry_id, terms_digest, manifest_digest, ship_submission_id, manifest_json
    from challenge_submissions
    where submission_id = ${reference.submission_id}
  `.execute(db)).rows[0];
  if (!submission) throw new Error('challenge_archive_submission_missing');
  const payload = challengeSubmissionArchiveCapturePayload(submission);
  if (
    archive.challenge_id !== payload.challenge_id || archive.entry_id !== payload.entry_id ||
    archive.source_kind !== payload.source_kind || archive.source_reference !== payload.source_reference ||
    archive.terms_digest !== payload.terms_digest || archive.manifest_digest !== payload.manifest_digest
  ) throw new Error('challenge_archive_job_lineage_invalid');

  let outcome: ChallengeSubmissionArchiveCaptureResult;
  if (!client) {
    outcome = {outcome: 'TRANSIENT_PLATFORM_UNAVAILABLE', reason_code: 'CAPTURE_CLIENT_UNAVAILABLE'};
  } else {
    try {
      outcome = captureResult(await client.capture({
        submissionId: payload.submission_id,
        challengeId: payload.challenge_id,
        entryId: payload.entry_id,
        sourceKind: payload.source_kind,
        sourceReference: payload.source_reference,
        termsDigest: payload.terms_digest,
        manifestDigest: payload.manifest_digest,
        artifactDigest: payload.artifact_digest,
        evidenceReferences: payload.evidence_references,
        optionalLiveUrl: payload.optional_live_url,
        shipSubmissionId: payload.ship_submission_id,
      }));
    } catch {
      outcome = {outcome: 'TRANSIENT_PLATFORM_UNAVAILABLE', reason_code: 'CAPTURE_CLIENT_ERROR'};
    }
  }

  const terminal = terminalStatus(outcome);
  if (!terminal && job.attempts < job.max_attempts) {
    if (outcome.outcome === 'CAPTURED') throw new Error('challenge_archive_capture_transition_invalid');
    throw new Error(`challenge_archive_transient:${outcome.reason_code}`);
  }
  const status = terminal ?? 'PLATFORM_UNAVAILABLE';
  await db.transaction().execute(async (transaction) => {
    const locked = await transaction.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', payload.submission_id).forUpdate().executeTakeFirst();
    if (!locked) throw new Error('challenge_archive_state_missing');
    if (locked.source_reference === CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE || locked.status !== 'PENDING') return;
    if (status === 'CAPTURED') {
      if (outcome.outcome !== 'CAPTURED') throw new Error('challenge_archive_capture_transition_invalid');
      await transaction.updateTable('challenge_submission_archives').set({status, archive_digest: outcome.archive_digest, archive_reference: outcome.archive_reference, observed_at: sql`clock_timestamp()`, reason_code: null, updated_at: sql`clock_timestamp()`}).where('submission_id', '=', payload.submission_id).execute();
    } else {
      const reason = outcome.outcome === 'CAPTURED' ? 'CAPTURE_RESULT_INVALID' : outcome.reason_code;
      await transaction.updateTable('challenge_submission_archives').set({status, observed_at: sql`clock_timestamp()`, reason_code: reason, updated_at: sql`clock_timestamp()`}).where('submission_id', '=', payload.submission_id).execute();
    }
    const updated = await transaction.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', payload.submission_id).executeTakeFirstOrThrow();
    await appendCaptureEvent(transaction, updated, outcome, updated.observed_at ?? await readDatabaseNow(transaction));
  });
}

export async function purgeChallengeSubmissionPrivateMaterial(
  db: Kysely<DatabaseSchema>,
  submissionIdInput: string,
  deletionClient?: ChallengeSubmissionArchiveDeletionClient,
): Promise<ChallengeSubmissionPrivateMaterialPurgeResult> {
  const submissionId = requiredUuid(submissionIdInput, 'submission_id');
  const dedupeKey = `activity:challenge.submission_private_material.purged:${submissionId}`;
  const archive = await db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', submissionId).executeTakeFirst();
  if (!archive) throw new Error('challenge_archive_state_missing');

  const existingPurge = await db.selectFrom('history_events').select('history_event_id').where('dedupe_key', '=', dedupeKey).executeTakeFirst();
  if (existingPurge) {
    return {
      submission_id: archive.submission_id,
      challenge_id: archive.challenge_id,
      manifest_digest: archive.manifest_digest,
      archive_digest: archive.archive_digest,
      archive_status: archive.status,
      already_purged: true,
    };
  }
  if (archive.status === 'PENDING') throw new Error('challenge_private_material_purge_archive_pending');

  const challenge = (await sql<{status: string}>`
    select status from challenges where challenge_id = ${archive.challenge_id}
  `.execute(db)).rows[0];
  if (!challenge) throw new Error('challenge_private_material_purge_challenge_missing');
  if (challenge.status !== 'RECEIPT_FILED') throw new Error('challenge_private_material_purge_liability_hold');

  const archiveReference = archive.archive_reference;
  if (archiveReference && archiveReference !== CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE) {
    if (!deletionClient) throw new Error('challenge_private_material_deletion_client_required');
    await deletionClient.delete({submissionId, archiveReference});
  }

  return db.transaction().execute(async (transaction) => {
    const locked = await transaction.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', submissionId).forUpdate().executeTakeFirst();
    if (!locked) throw new Error('challenge_archive_state_missing');
    const replay = await transaction.selectFrom('history_events').select('history_event_id').where('dedupe_key', '=', dedupeKey).executeTakeFirst();
    if (replay) {
      return {
        submission_id: locked.submission_id,
        challenge_id: locked.challenge_id,
        manifest_digest: locked.manifest_digest,
        archive_digest: locked.archive_digest,
        archive_status: locked.status,
        already_purged: true,
      };
    }
    if (locked.status === 'PENDING') throw new Error('challenge_private_material_purge_archive_pending');
    if (locked.archive_reference !== archiveReference) throw new Error('challenge_private_material_purge_archive_changed');
    const lockedChallenge = (await sql<{status: string}>`
      select status from challenges where challenge_id = ${locked.challenge_id} for update
    `.execute(transaction)).rows[0];
    if (!lockedChallenge || lockedChallenge.status !== 'RECEIPT_FILED') throw new Error('challenge_private_material_purge_liability_hold');

    await transaction.updateTable('challenge_submission_archives').set({
      source_reference: CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE,
      archive_reference: locked.status === 'CAPTURED' ? CHALLENGE_SUBMISSION_PRIVATE_MATERIAL_PURGED_REFERENCE : null,
      updated_at: sql`clock_timestamp()`,
    }).where('submission_id', '=', submissionId).execute();
    await sql`delete from challenge_submission_archive_sources where submission_id = ${submissionId}`.execute(transaction);
    await sanitizeExistingArchiveJobPayload(transaction, submissionId);
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity',
      eventType: 'challenge.submission_private_material.purged',
      dedupeKey,
      actorPlayerId: null,
      subjectType: 'challenge_submission',
      subjectId: submissionId,
      payload: {
        schema_version: 'challenge.submission_private_material.purged.v1',
        submission_id: locked.submission_id,
        challenge_id: locked.challenge_id,
        entry_id: locked.entry_id,
        source_kind: locked.source_kind,
        manifest_digest: locked.manifest_digest,
        archive_digest: locked.archive_digest,
        archive_status: locked.status,
      },
    });

    return {
      submission_id: locked.submission_id,
      challenge_id: locked.challenge_id,
      manifest_digest: locked.manifest_digest,
      archive_digest: locked.archive_digest,
      archive_status: locked.status,
      already_purged: false,
    };
  });
}
