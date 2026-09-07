import {randomUUID} from 'node:crypto';
import {sql, type Kysely} from 'kysely';
import {canonicalizeJson} from './canonical-json.js';
import {readDatabaseNow, type DatabaseSchema, type OutboxJobRow, type OutboxJobState} from './database.js';
import {appendHistoryEvent} from './events.js';
import {isDetectedStack, type DetectedStack} from './evidence.js';

export const OUTBOX_JOB_VERSION = 'job.v1';
export const SESSION_EXPIRY_JOB_TYPE = 'session.expiry';
export const PROJECT_GITHUB_OBSERVATION_JOB_TYPE = 'project.github_observation';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DELIVERY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GIT_SHA_PATTERN = /^[0-9a-f]{40,64}$/i;
const REF_PATTERN = /^refs\/[A-Za-z0-9._\/-]{1,240}$/;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_RETRY_BASE_MS = 1_000;
const MAX_RETRY_DELAY_MS = 5 * 60_000;

export interface EnqueueOutboxJobInput {
  jobType: string;
  idempotencyKey: string;
  payload: unknown;
  nextAttemptAt?: Date;
  maxAttempts?: number;
}

export interface RunOneJobOptions {
  leaseMs?: number;
  retryBaseMs?: number;
}

export type RunOneJobResult =
  | {status: 'idle'}
  | {status: 'succeeded'; jobId: string}
  | {status: 'retry'; jobId: string; attempts: number}
  | {status: 'failed'; jobId: string; attempts: number}
  | {status: 'lost_lease'; jobId: string; attempts: number};

function validateMaxAttempts(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error('maxAttempts must be between 1 and 20');
  return value;
}

function validatePositiveMs(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}

function truncateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000) || 'job_failed';
}

export async function enqueueOutboxJob(
  db: Kysely<DatabaseSchema>,
  input: EnqueueOutboxJobInput,
): Promise<OutboxJobRow> {
  const normalized = canonicalizeJson(input.payload);
  const maxAttempts = validateMaxAttempts(input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const nextAttemptAt = input.nextAttemptAt ?? (await readDatabaseNow(db));

  const inserted = await db
    .insertInto('outbox_jobs')
    .values({
      job_id: randomUUID(),
      job_version: OUTBOX_JOB_VERSION,
      job_type: input.jobType,
      idempotency_key: input.idempotencyKey,
      payload: normalized.value,
      payload_hash: normalized.sha256,
      max_attempts: maxAttempts,
      next_attempt_at: nextAttemptAt,
      locked_at: null,
      lock_token: null,
      last_error: null,
      completed_at: null,
    })
    .onConflict((conflict) => conflict.column('idempotency_key').doNothing())
    .returningAll()
    .executeTakeFirst();

  if (inserted) return inserted;

  const existing = await db
    .selectFrom('outbox_jobs')
    .selectAll()
    .where('idempotency_key', '=', input.idempotencyKey)
    .executeTakeFirstOrThrow();

  if (
    existing.job_version !== OUTBOX_JOB_VERSION ||
    existing.job_type !== input.jobType ||
    existing.payload_hash !== normalized.sha256 ||
    existing.max_attempts !== maxAttempts
  ) {
    throw new Error(`outbox_job_idempotency_conflict:${input.idempotencyKey}`);
  }

  return existing;
}

async function failExhaustedStaleJobs(
  db: Kysely<DatabaseSchema>,
  databaseNow: Date,
  leaseMs: number,
): Promise<void> {
  const staleBefore = new Date(databaseNow.getTime() - leaseMs);
  await db
    .updateTable('outbox_jobs')
    .set({
      state: 'failed',
      locked_at: null,
      lock_token: null,
      completed_at: databaseNow,
      last_error: 'worker_lease_expired_after_max_attempts',
    })
    .where('state', '=', 'running')
    .where('locked_at', '<=', staleBefore)
    .whereRef('attempts', '>=', 'max_attempts')
    .execute();
}

async function claimDueJob(
  db: Kysely<DatabaseSchema>,
  databaseNow: Date,
  leaseMs: number,
): Promise<OutboxJobRow | null> {
  const staleBefore = new Date(databaseNow.getTime() - leaseMs);
  const lockToken = randomUUID();
  const result = await sql<OutboxJobRow>`
    with candidate as (
      select job_id
      from outbox_jobs
      where attempts < max_attempts
        and (
          (state = 'pending' and next_attempt_at <= ${databaseNow})
          or
          (state = 'running' and locked_at is not null and locked_at <= ${staleBefore})
        )
      order by next_attempt_at asc, created_at asc
      for update skip locked
      limit 1
    )
    update outbox_jobs as job
    set state = 'running',
        attempts = job.attempts + 1,
        locked_at = ${databaseNow},
        lock_token = ${lockToken},
        last_error = null,
        completed_at = null
    from candidate
    where job.job_id = candidate.job_id
    returning job.*
  `.execute(db);
  return result.rows[0] ?? null;
}

async function completeJob(db: Kysely<DatabaseSchema>, job: OutboxJobRow, databaseNow: Date): Promise<boolean> {
  if (!job.lock_token) return false;
  const result = await db
    .updateTable('outbox_jobs')
    .set({state: 'succeeded', locked_at: null, lock_token: null, completed_at: databaseNow, last_error: null})
    .where('job_id', '=', job.job_id)
    .where('state', '=', 'running')
    .where('lock_token', '=', job.lock_token)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) === 1;
}

async function recordFailure(
  db: Kysely<DatabaseSchema>,
  job: OutboxJobRow,
  databaseNow: Date,
  retryBaseMs: number,
  error: unknown,
): Promise<{state: OutboxJobState; applied: boolean}> {
  if (!job.lock_token) return {state: 'running', applied: false};
  const terminal = job.attempts >= job.max_attempts;
  const retryDelayMs = Math.min(retryBaseMs * 2 ** Math.max(0, job.attempts - 1), MAX_RETRY_DELAY_MS);
  const result = await db
    .updateTable('outbox_jobs')
    .set(
      terminal
        ? {
            state: 'failed',
            locked_at: null,
            lock_token: null,
            completed_at: databaseNow,
            last_error: truncateError(error),
          }
        : {
            state: 'pending',
            locked_at: null,
            lock_token: null,
            completed_at: null,
            last_error: truncateError(error),
            next_attempt_at: new Date(databaseNow.getTime() + retryDelayMs),
          },
    )
    .where('job_id', '=', job.job_id)
    .where('state', '=', 'running')
    .where('lock_token', '=', job.lock_token)
    .executeTakeFirst();
  return {state: terminal ? 'failed' : 'pending', applied: Number(result.numUpdatedRows) === 1};
}

function sessionIdFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') throw new Error('session_expiry_payload_invalid');
  const sessionId = (payload as {session_id?: unknown}).session_id;
  if (typeof sessionId !== 'string' || !UUID_PATTERN.test(sessionId)) throw new Error('session_expiry_payload_invalid');
  return sessionId;
}

function projectObservationPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('project_github_observation_payload_invalid');
  const value = payload as Record<string, unknown>;
  const schemaVersion = value.schema_version;
  const projectId = value.project_id;
  const deliveryId = value.delivery_id;
  const repositoryId = value.repository_id;
  const ref = value.ref;
  const before = value.before;
  const after = value.after;
  const repositoryPrivate = value.repository_private;
  if (schemaVersion !== 'project.github_observation.job.v1') throw new Error('project_github_observation_payload_invalid');
  if (typeof projectId !== 'string' || !UUID_PATTERN.test(projectId)) throw new Error('project_github_observation_payload_invalid');
  if (typeof deliveryId !== 'string' || !DELIVERY_PATTERN.test(deliveryId)) throw new Error('project_github_observation_payload_invalid');
  if (typeof repositoryId !== 'string' || !/^[1-9]\d*$/.test(repositoryId)) throw new Error('project_github_observation_payload_invalid');
  if (typeof ref !== 'string' || !REF_PATTERN.test(ref)) throw new Error('project_github_observation_payload_invalid');
  if (typeof before !== 'string' || !GIT_SHA_PATTERN.test(before)) throw new Error('project_github_observation_payload_invalid');
  if (typeof after !== 'string' || !GIT_SHA_PATTERN.test(after)) throw new Error('project_github_observation_payload_invalid');
  if (typeof repositoryPrivate !== 'boolean') throw new Error('project_github_observation_payload_invalid');
  const observedStacksRaw = value.observed_stacks ?? [];
  if (!Array.isArray(observedStacksRaw) || observedStacksRaw.length > 9 || observedStacksRaw.some((stack) => !isDetectedStack(stack))) {
    throw new Error('project_github_observation_payload_invalid');
  }
  const observedStacks = [...new Set(observedStacksRaw as DetectedStack[])].sort();
  return {projectId, deliveryId, repositoryId, ref, before, after, repositoryPrivate, observedStacks};
}

function sameStackReceiptMatches(payload: unknown, deliveryId: string, observedStacks: readonly DetectedStack[]): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const value = payload as Record<string, unknown>;
  if (value.schema_version !== 'project.github_repository_stack.observed.v1' || value.delivery_id !== deliveryId || value.truth_state !== 'OBSERVED') return false;
  const stacks = value.observed_stacks;
  if (!Array.isArray(stacks) || stacks.some((stack) => !isDetectedStack(stack))) return false;
  const normalized = [...new Set(stacks as DetectedStack[])].sort();
  return normalized.length === observedStacks.length && normalized.every((stack, index) => stack === observedStacks[index]);
}

function stackListFromProjection(value: unknown): DetectedStack[] {
  if (!Array.isArray(value) || value.length > 9 || value.some((stack) => !isDetectedStack(stack))) {
    throw new Error('project_github_stack_projection_invalid');
  }
  return [...new Set(value as DetectedStack[])].sort();
}

function stackListFromEvidencePayload(payload: unknown): DetectedStack[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('project_github_stack_history_invalid');
  const value = payload as Record<string, unknown>;
  const stacks = value.current_observed_stacks;
  if (!Array.isArray(stacks) || stacks.length > 9 || stacks.some((stack) => !isDetectedStack(stack))) {
    throw new Error('project_github_stack_history_invalid');
  }
  return [...new Set(stacks as DetectedStack[])].sort();
}

async function handleSessionExpiry(db: Kysely<DatabaseSchema>, job: OutboxJobRow, databaseNow: Date): Promise<void> {
  const sessionId = sessionIdFromPayload(job.payload);
  const session = await db
    .selectFrom('sessions')
    .select(['expires_at', 'revoked_at'])
    .where('session_id', '=', sessionId)
    .executeTakeFirst();

  if (!session || session.revoked_at) return;
  if (session.expires_at.getTime() > databaseNow.getTime()) throw new Error('session_not_expired');

  await db
    .updateTable('sessions')
    .set({revoked_at: databaseNow})
    .where('session_id', '=', sessionId)
    .where('revoked_at', 'is', null)
    .where('expires_at', '<=', databaseNow)
    .execute();
}

async function handleProjectGitHubObservation(db: Kysely<DatabaseSchema>, job: OutboxJobRow): Promise<void> {
  const payload = projectObservationPayload(job.payload);
  await db.transaction().execute(async (transaction) => {
    const project = await transaction
      .selectFrom('projects')
      .select(['project_id', 'repository_id', 'observed_stack_labels'])
      .where('project_id', '=', payload.projectId)
      .forUpdate()
      .executeTakeFirst();
    if (!project || project.repository_id !== payload.repositoryId) throw new Error('project_github_observation_project_binding_invalid');

    const delivery = await transaction
      .selectFrom('github_deliveries')
      .select(['event_name', 'repository_id', 'received_at'])
      .where('delivery_id', '=', payload.deliveryId)
      .executeTakeFirst();
    if (!delivery || delivery.event_name !== 'push' || delivery.repository_id !== payload.repositoryId || !(delivery.received_at instanceof Date)) {
      throw new Error('project_github_observation_delivery_receipt_invalid');
    }

    await appendHistoryEvent(transaction, {
      eventFamily: 'evidence',
      eventType: 'project.github_repository_push.observed',
      dedupeKey: `evidence:project.github_repository_push.observed:${payload.projectId}:${payload.deliveryId}`,
      actorPlayerId: null,
      subjectType: 'project',
      subjectId: payload.projectId,
      occurredAt: delivery.received_at,
      payload: {
        schema_version: 'project.github_repository_push.observed.v1',
        provider: 'github',
        delivery_id: payload.deliveryId,
        repository_id: payload.repositoryId,
        ref: payload.ref,
        before: payload.before,
        after: payload.after,
        repository_private: payload.repositoryPrivate,
        truth_state: 'OBSERVED',
      },
    });

    if (payload.observedStacks.length === 0) return;

    const previousObservedStacks = stackListFromProjection(project.observed_stack_labels);
    const currentObservedStacks = [...new Set([...previousObservedStacks, ...payload.observedStacks])].sort();
    const stackDedupeKey = `evidence:project.github_repository_stack.observed:${payload.projectId}:${payload.deliveryId}`;
    const existingStackReceipt = await transaction
      .selectFrom('history_events')
      .select('payload')
      .where('dedupe_key', '=', stackDedupeKey)
      .executeTakeFirst();
    if (existingStackReceipt) {
      if (!sameStackReceiptMatches(existingStackReceipt.payload, payload.deliveryId, payload.observedStacks)) {
        throw new Error('project_github_stack_history_invalid');
      }
      if (currentObservedStacks.length !== previousObservedStacks.length) {
        await transaction.updateTable('projects').set({observed_stack_labels: currentObservedStacks}).where('project_id', '=', payload.projectId).execute();
      }
      return;
    }

    await appendHistoryEvent(transaction, {
      eventFamily: 'evidence',
      eventType: 'project.github_repository_stack.observed',
      dedupeKey: stackDedupeKey,
      actorPlayerId: null,
      subjectType: 'project',
      subjectId: payload.projectId,
      occurredAt: delivery.received_at,
      payload: {
        schema_version: 'project.github_repository_stack.observed.v1',
        provider: 'github',
        delivery_id: payload.deliveryId,
        observed_stacks: payload.observedStacks,
        previous_observed_stacks: previousObservedStacks,
        current_observed_stacks: currentObservedStacks,
        truth_state: 'OBSERVED',
      },
    });
    await transaction.updateTable('projects').set({observed_stack_labels: currentObservedStacks}).where('project_id', '=', payload.projectId).execute();
  });
}

async function handleJob(db: Kysely<DatabaseSchema>, job: OutboxJobRow, databaseNow: Date): Promise<void> {
  if (job.job_version !== OUTBOX_JOB_VERSION) throw new Error(`unsupported_job_version:${job.job_version}`);
  switch (job.job_type) {
    case SESSION_EXPIRY_JOB_TYPE:
      await handleSessionExpiry(db, job, databaseNow);
      return;
    case PROJECT_GITHUB_OBSERVATION_JOB_TYPE:
      await handleProjectGitHubObservation(db, job);
      return;
    default:
      throw new Error(`unsupported_job_type:${job.job_type}`);
  }
}

export async function runOneJob(
  db: Kysely<DatabaseSchema>,
  options: RunOneJobOptions = {},
): Promise<RunOneJobResult> {
  const leaseMs = validatePositiveMs(options.leaseMs ?? DEFAULT_LEASE_MS, 'leaseMs');
  const retryBaseMs = validatePositiveMs(options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS, 'retryBaseMs');
  const claimTime = await readDatabaseNow(db);

  await failExhaustedStaleJobs(db, claimTime, leaseMs);
  const job = await claimDueJob(db, claimTime, leaseMs);
  if (!job) return {status: 'idle'};

  try {
    await handleJob(db, job, await readDatabaseNow(db));
  } catch (error) {
    const failure = await recordFailure(db, job, await readDatabaseNow(db), retryBaseMs, error);
    if (!failure.applied) return {status: 'lost_lease', jobId: job.job_id, attempts: job.attempts};
    return {
      status: failure.state === 'failed' ? 'failed' : 'retry',
      jobId: job.job_id,
      attempts: job.attempts,
    };
  }

  const completed = await completeJob(db, job, await readDatabaseNow(db));
  if (!completed) return {status: 'lost_lease', jobId: job.job_id, attempts: job.attempts};
  return {status: 'succeeded', jobId: job.job_id};
}
