import {randomUUID} from 'node:crypto';
import {sql, type Kysely} from 'kysely';
import {canonicalizeJson} from './canonical-json.js';
import type {DatabaseSchema, OutboxJobRow, OutboxJobState} from './database.js';

export const OUTBOX_JOB_VERSION = 'job.v1';
export const SESSION_EXPIRY_JOB_TYPE = 'session.expiry';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  now?: () => Date;
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
  const nextAttemptAt = input.nextAttemptAt ?? new Date();

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
  now: Date,
  leaseMs: number,
): Promise<void> {
  const staleBefore = new Date(now.getTime() - leaseMs);
  await db
    .updateTable('outbox_jobs')
    .set({
      state: 'failed',
      locked_at: null,
      lock_token: null,
      completed_at: now,
      last_error: 'worker_lease_expired_after_max_attempts',
    })
    .where('state', '=', 'running')
    .where('locked_at', '<=', staleBefore)
    .whereRef('attempts', '>=', 'max_attempts')
    .execute();
}

async function claimDueJob(
  db: Kysely<DatabaseSchema>,
  now: Date,
  leaseMs: number,
): Promise<OutboxJobRow | null> {
  const staleBefore = new Date(now.getTime() - leaseMs);
  const lockToken = randomUUID();
  const result = await sql<OutboxJobRow>`
    with candidate as (
      select job_id
      from outbox_jobs
      where attempts < max_attempts
        and (
          (state = 'pending' and next_attempt_at <= ${now})
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
        locked_at = ${now},
        lock_token = ${lockToken},
        last_error = null,
        completed_at = null
    from candidate
    where job.job_id = candidate.job_id
    returning job.*
  `.execute(db);
  return result.rows[0] ?? null;
}

async function completeJob(db: Kysely<DatabaseSchema>, job: OutboxJobRow, now: Date): Promise<boolean> {
  if (!job.lock_token) return false;
  const result = await db
    .updateTable('outbox_jobs')
    .set({state: 'succeeded', locked_at: null, lock_token: null, completed_at: now, last_error: null})
    .where('job_id', '=', job.job_id)
    .where('state', '=', 'running')
    .where('lock_token', '=', job.lock_token)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) === 1;
}

async function recordFailure(
  db: Kysely<DatabaseSchema>,
  job: OutboxJobRow,
  now: Date,
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
            completed_at: now,
            last_error: truncateError(error),
          }
        : {
            state: 'pending',
            locked_at: null,
            lock_token: null,
            completed_at: null,
            last_error: truncateError(error),
            next_attempt_at: new Date(now.getTime() + retryDelayMs),
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

async function handleSessionExpiry(db: Kysely<DatabaseSchema>, job: OutboxJobRow, now: Date): Promise<void> {
  const sessionId = sessionIdFromPayload(job.payload);
  const session = await db
    .selectFrom('sessions')
    .select(['expires_at', 'revoked_at'])
    .where('session_id', '=', sessionId)
    .executeTakeFirst();

  if (!session || session.revoked_at) return;
  if (session.expires_at.getTime() > now.getTime()) throw new Error('session_not_expired');

  await db
    .updateTable('sessions')
    .set({revoked_at: now})
    .where('session_id', '=', sessionId)
    .where('revoked_at', 'is', null)
    .where('expires_at', '<=', now)
    .execute();
}

async function handleJob(db: Kysely<DatabaseSchema>, job: OutboxJobRow, now: Date): Promise<void> {
  if (job.job_version !== OUTBOX_JOB_VERSION) throw new Error(`unsupported_job_version:${job.job_version}`);
  switch (job.job_type) {
    case SESSION_EXPIRY_JOB_TYPE:
      await handleSessionExpiry(db, job, now);
      return;
    default:
      throw new Error(`unsupported_job_type:${job.job_type}`);
  }
}

export async function runOneJob(
  db: Kysely<DatabaseSchema>,
  options: RunOneJobOptions = {},
): Promise<RunOneJobResult> {
  const clock = options.now ?? (() => new Date());
  const leaseMs = validatePositiveMs(options.leaseMs ?? DEFAULT_LEASE_MS, 'leaseMs');
  const retryBaseMs = validatePositiveMs(options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS, 'retryBaseMs');
  const claimTime = clock();

  await failExhaustedStaleJobs(db, claimTime, leaseMs);
  const job = await claimDueJob(db, claimTime, leaseMs);
  if (!job) return {status: 'idle'};

  try {
    await handleJob(db, job, clock());
  } catch (error) {
    const failure = await recordFailure(db, job, clock(), retryBaseMs, error);
    if (!failure.applied) return {status: 'lost_lease', jobId: job.job_id, attempts: job.attempts};
    return {
      status: failure.state === 'failed' ? 'failed' : 'retry',
      jobId: job.job_id,
      attempts: job.attempts,
    };
  }

  const completed = await completeJob(db, job, clock());
  if (!completed) return {status: 'lost_lease', jobId: job.job_id, attempts: job.attempts};
  return {status: 'succeeded', jobId: job.job_id};
}
