import {randomUUID} from 'node:crypto';
import {sql, type Kysely} from 'kysely';
import {canonicalizeJson} from './canonical-json.js';
import {readDatabaseNow, type DatabaseSchema, type OutboxJobRow, type OutboxJobState} from './database.js';
import {appendHistoryEvent} from './events.js';
import {isDetectedStack, type DetectedStack} from './evidence.js';

export const OUTBOX_JOB_VERSION = 'job.v1';
export const SESSION_EXPIRY_JOB_TYPE = 'session.expiry';
export const PROJECT_GITHUB_OBSERVATION_JOB_TYPE = 'project.github_observation';
export const SHIP_VERIFICATION_JOB_TYPE = 'ship.verification';
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

export interface ShipVerifierClient {
  verify(input: {submissionId: string; url: string}): Promise<unknown>;
}

export interface RunOneJobOptions {
  leaseMs?: number;
  retryBaseMs?: number;
  shipVerifierClient?: ShipVerifierClient;
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

type ProjectManifestChange = {
  pathHash: string;
  stack: DetectedStack;
  state: 'PRESENT' | 'REMOVED';
};

type ProjectObservationPayload = {
  schemaVersion: 'project.github_observation.job.v1' | 'project.github_observation.job.v2';
  projectId: string;
  deliveryId: string;
  repositoryId: string;
  ref: string;
  before: string;
  after: string;
  repositoryPrivate: boolean;
  manifestProjectionRef: string | null;
  manifestChanges: ProjectManifestChange[];
  manifestChangesComplete: boolean;
  legacyObservedStacks: DetectedStack[];
};

function projectObservationPayload(payload: unknown): ProjectObservationPayload {
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
  if (schemaVersion !== 'project.github_observation.job.v1' && schemaVersion !== 'project.github_observation.job.v2') {
    throw new Error('project_github_observation_payload_invalid');
  }
  if (typeof projectId !== 'string' || !UUID_PATTERN.test(projectId)) throw new Error('project_github_observation_payload_invalid');
  if (typeof deliveryId !== 'string' || !DELIVERY_PATTERN.test(deliveryId)) throw new Error('project_github_observation_payload_invalid');
  if (typeof repositoryId !== 'string' || !/^[1-9]\d*$/.test(repositoryId)) throw new Error('project_github_observation_payload_invalid');
  if (typeof ref !== 'string' || !REF_PATTERN.test(ref)) throw new Error('project_github_observation_payload_invalid');
  if (typeof before !== 'string' || !GIT_SHA_PATTERN.test(before)) throw new Error('project_github_observation_payload_invalid');
  if (typeof after !== 'string' || !GIT_SHA_PATTERN.test(after)) throw new Error('project_github_observation_payload_invalid');
  if (typeof repositoryPrivate !== 'boolean') throw new Error('project_github_observation_payload_invalid');

  if (schemaVersion === 'project.github_observation.job.v1') {
    const observedStacksRaw = value.observed_stacks ?? [];
    if (!Array.isArray(observedStacksRaw) || observedStacksRaw.length > 9 || observedStacksRaw.some((stack) => !isDetectedStack(stack))) {
      throw new Error('project_github_observation_payload_invalid');
    }
    return {
      schemaVersion,
      projectId,
      deliveryId,
      repositoryId,
      ref,
      before,
      after,
      repositoryPrivate,
      manifestProjectionRef: null,
      manifestChanges: [],
      manifestChangesComplete: false,
      legacyObservedStacks: [...new Set(observedStacksRaw as DetectedStack[])].sort(),
    };
  }

  const manifestProjectionRefRaw = value.manifest_projection_ref;
  if (
    manifestProjectionRefRaw !== undefined && manifestProjectionRefRaw !== null &&
    (typeof manifestProjectionRefRaw !== 'string' || !REF_PATTERN.test(manifestProjectionRefRaw) || manifestProjectionRefRaw !== ref)
  ) throw new Error('project_github_observation_payload_invalid');
  const manifestProjectionRef = typeof manifestProjectionRefRaw === 'string' ? manifestProjectionRefRaw : null;
  const changesRaw = value.manifest_changes ?? [];
  const complete = value.manifest_changes_complete;
  if (!Array.isArray(changesRaw) || changesRaw.length > 128 || typeof complete !== 'boolean') {
    throw new Error('project_github_observation_payload_invalid');
  }
  const seen = new Set<string>();
  const manifestChanges: ProjectManifestChange[] = [];
  for (const raw of changesRaw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('project_github_observation_payload_invalid');
    const change = raw as Record<string, unknown>;
    if (typeof change.path_hash !== 'string' || !/^[0-9a-f]{64}$/.test(change.path_hash)) throw new Error('project_github_observation_payload_invalid');
    if (!isDetectedStack(change.stack)) throw new Error('project_github_observation_payload_invalid');
    if (change.state !== 'PRESENT' && change.state !== 'REMOVED') throw new Error('project_github_observation_payload_invalid');
    if (seen.has(change.path_hash)) throw new Error('project_github_observation_payload_invalid');
    seen.add(change.path_hash);
    manifestChanges.push({pathHash: change.path_hash, stack: change.stack, state: change.state});
  }
  manifestChanges.sort((left, right) => left.pathHash.localeCompare(right.pathHash));
  return {
    schemaVersion,
    projectId,
    deliveryId,
    repositoryId,
    ref,
    before,
    after,
    repositoryPrivate,
    manifestProjectionRef,
    manifestChanges,
    manifestChangesComplete: complete,
    legacyObservedStacks: [],
  };
}

function stackListFromProjection(value: unknown): DetectedStack[] {
  if (!Array.isArray(value) || value.length > 9 || value.some((stack) => !isDetectedStack(stack))) {
    throw new Error('project_github_stack_projection_invalid');
  }
  return [...new Set(value as DetectedStack[])].sort();
}

function manifestMapFromProjection(value: unknown): Record<string, DetectedStack> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('project_github_manifest_projection_invalid');
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 4096) throw new Error('project_github_manifest_projection_invalid');
  const result: Record<string, DetectedStack> = {};
  for (const [pathHash, stack] of entries) {
    if (!/^[0-9a-f]{64}$/.test(pathHash) || !isDetectedStack(stack)) throw new Error('project_github_manifest_projection_invalid');
    result[pathHash] = stack;
  }
  return result;
}

function receiptMatches(payload: unknown, input: ProjectObservationPayload): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const value = payload as Record<string, unknown>;
  if (value.delivery_id !== input.deliveryId) return false;
  if (input.schemaVersion === 'project.github_observation.job.v1') {
    if (value.schema_version !== 'project.github_repository_stack.observed.v2') return false;
    if (value.projection_complete !== false || (value.projection_ref ?? null) !== null) return false;
    if (!Array.isArray(value.manifest_changes) || value.manifest_changes.length !== 0) return false;
    const stacks = value.legacy_observed_stacks;
    if (!Array.isArray(stacks) || stacks.some((stack) => !isDetectedStack(stack))) return false;
    const normalized = [...new Set(stacks as DetectedStack[])].sort();
    return canonicalizeJson(normalized).sha256 === canonicalizeJson(input.legacyObservedStacks).sha256;
  }
  if (value.schema_version !== 'project.github_repository_stack.observed.v2') return false;
  if (value.projection_complete !== input.manifestChangesComplete) return false;
  if ((value.projection_ref ?? null) !== input.manifestProjectionRef) return false;
  const rawChanges = value.manifest_changes;
  if (!Array.isArray(rawChanges)) return false;
  const expected = input.manifestChanges.map((change) => ({path_hash: change.pathHash, stack: change.stack, state: change.state}));
  return canonicalizeJson(rawChanges).sha256 === canonicalizeJson(expected).sha256;
}

async function requireDeliveryOrder(
  db: Kysely<DatabaseSchema>,
  job: OutboxJobRow,
  input: ProjectObservationPayload,
  receivedAt: Date,
): Promise<void> {
  const earlier = await sql<{state: OutboxJobState}>`
    select pending.state
    from outbox_jobs pending
    join github_deliveries delivery on delivery.delivery_id = pending.payload ->> 'delivery_id'
    where pending.job_type = ${PROJECT_GITHUB_OBSERVATION_JOB_TYPE}
      and pending.job_id <> ${job.job_id}
      and pending.payload ->> 'project_id' = ${input.projectId}
      and pending.state <> 'succeeded'
      and (
        delivery.received_at < ${receivedAt}
        or (delivery.received_at = ${receivedAt} and delivery.delivery_id < ${input.deliveryId})
      )
    order by delivery.received_at asc, delivery.delivery_id asc
    limit 1
  `.execute(db);
  const state = earlier.rows[0]?.state;
  if (!state) return;
  if (state === 'failed') throw new Error('project_github_observation_earlier_delivery_failed');
  throw new Error('project_github_observation_waiting_for_earlier_delivery');
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
      .select(['project_id', 'repository_id', 'observed_stack_labels', 'observed_manifest_fingerprints', 'observed_manifest_ref'])
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

    await requireDeliveryOrder(transaction, job, payload, delivery.received_at);

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

    const stackDedupeKey = `evidence:project.github_repository_stack.observed:${payload.projectId}:${payload.deliveryId}`;
    const existingStackReceipt = await transaction
      .selectFrom('history_events')
      .select('payload')
      .where('dedupe_key', '=', stackDedupeKey)
      .executeTakeFirst();
    if (existingStackReceipt) {
      if (!receiptMatches(existingStackReceipt.payload, payload)) throw new Error('project_github_stack_history_invalid');
      return;
    }

    if (payload.schemaVersion === 'project.github_observation.job.v2' && payload.manifestProjectionRef === null) return;
    const projectionRefChanged = payload.schemaVersion === 'project.github_observation.job.v2' && project.observed_manifest_ref !== payload.manifestProjectionRef;
    if (
      payload.schemaVersion === 'project.github_observation.job.v2' &&
      payload.manifestChanges.length === 0 && payload.manifestChangesComplete && !projectionRefChanged
    ) return;

    const previousObservedStacks = stackListFromProjection(project.observed_stack_labels);
    let manifestMap = manifestMapFromProjection(project.observed_manifest_fingerprints);
    let nextManifestRef: string | null = project.observed_manifest_ref;
    if (payload.schemaVersion === 'project.github_observation.job.v1') {
      manifestMap = {};
      nextManifestRef = null;
    } else if (!payload.manifestChangesComplete) {
      manifestMap = {};
      nextManifestRef = payload.manifestProjectionRef;
    } else {
      manifestMap = projectionRefChanged ? {} : {...manifestMap};
      nextManifestRef = payload.manifestProjectionRef;
      for (const change of payload.manifestChanges) {
        if (change.state === 'REMOVED') delete manifestMap[change.pathHash];
        else manifestMap[change.pathHash] = change.stack;
      }
    }
    const currentObservedStacks = [...new Set(Object.values(manifestMap))].sort();
    const manifestChanges = payload.manifestChanges.map((change) => ({path_hash: change.pathHash, stack: change.stack, state: change.state}));

    await appendHistoryEvent(transaction, {
      eventFamily: 'evidence',
      eventType: 'project.github_repository_stack.observed',
      dedupeKey: stackDedupeKey,
      actorPlayerId: null,
      subjectType: 'project',
      subjectId: payload.projectId,
      occurredAt: delivery.received_at,
      payload: payload.schemaVersion === 'project.github_observation.job.v1'
        ? {
            schema_version: 'project.github_repository_stack.observed.v2',
            provider: 'github',
            delivery_id: payload.deliveryId,
            manifest_changes: [],
            projection_complete: false,
            projection_ref: null,
            previous_observed_stacks: previousObservedStacks,
            current_observed_stacks: currentObservedStacks,
            legacy_observed_stacks: payload.legacyObservedStacks,
            truth_state: 'OBSERVED',
          }
        : {
            schema_version: 'project.github_repository_stack.observed.v2',
            provider: 'github',
            delivery_id: payload.deliveryId,
            manifest_changes: manifestChanges,
            projection_complete: payload.manifestChangesComplete,
            projection_ref: payload.manifestProjectionRef,
            previous_observed_stacks: previousObservedStacks,
            current_observed_stacks: currentObservedStacks,
            truth_state: 'OBSERVED',
          },
    });
    await transaction.updateTable('projects').set({
      observed_manifest_fingerprints: manifestMap,
      observed_manifest_ref: nextManifestRef,
      observed_stack_labels: currentObservedStacks,
    }).where('project_id', '=', payload.projectId).execute();
  });
}

type ShipVerificationPayload = {submissionId:string; artifactUrl:string};
function shipVerificationPayload(payload:unknown):ShipVerificationPayload{
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('ship_verification_payload_invalid');
  const value=payload as Record<string,unknown>;
  if(value.schema_version!=='ship.verification.job.v1'||typeof value.submission_id!=='string'||!UUID_PATTERN.test(value.submission_id)||typeof value.artifact_url!=='string')throw new Error('ship_verification_payload_invalid');
  let url:URL;try{url=new URL(value.artifact_url);}catch{throw new Error('ship_verification_payload_invalid');}
  if(url.protocol!=='https:'||url.username||url.password)throw new Error('ship_verification_payload_invalid');
  return{submissionId:value.submission_id.toLowerCase(),artifactUrl:url.href};
}
const SHIP_REASON_CODES=new Set(['PUBLIC_HTTPS_OK','URL_INVALID','TARGET_NOT_PUBLIC','DNS_FAILURE','NETWORK_ERROR','TIMEOUT','RESPONSE_TOO_LARGE','HTTP_STATUS','REDIRECT_LIMIT','REDIRECT_INVALID']);
function verifierResult(raw:unknown,submissionId:string){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('ship_verifier_result_invalid');const v=raw as Record<string,unknown>;
  if(v.schema_version!=='ship-verifier.observation.v1'||v.submission_id!==submissionId||!['PASS','FAILED','UNAVAILABLE'].includes(String(v.outcome))||!SHIP_REASON_CODES.has(String(v.reason_code)))throw new Error('ship_verifier_result_invalid');
  if(!Number.isInteger(v.duration_ms)||Number(v.duration_ms)<0||Number(v.duration_ms)>60000||!Number.isInteger(v.redirects)||Number(v.redirects)<0||Number(v.redirects)>3)throw new Error('ship_verifier_result_invalid');
  const finalUrl=typeof v.final_url==='string'?v.final_url:null;if(finalUrl){let u:URL;try{u=new URL(finalUrl);}catch{throw new Error('ship_verifier_result_invalid');}if(u.protocol!=='https:'||u.username||u.password)throw new Error('ship_verifier_result_invalid');}
  const httpStatus=v.http_status===undefined?null:Number(v.http_status);if(httpStatus!==null&&(!Number.isInteger(httpStatus)||httpStatus<100||httpStatus>599))throw new Error('ship_verifier_result_invalid');
  return{outcome:v.outcome as 'PASS'|'FAILED'|'UNAVAILABLE',reasonCode:String(v.reason_code),finalUrl,httpStatus,durationMs:Number(v.duration_ms),redirects:Number(v.redirects)};
}
async function handleShipVerification(db:Kysely<DatabaseSchema>,job:OutboxJobRow,client:ShipVerifierClient|undefined):Promise<void>{
  const input=shipVerificationPayload(job.payload);
  const existing=await db.selectFrom('ship_verifier_observations').select('observation_id').where('submission_id','=',input.submissionId).executeTakeFirst();if(existing)return;
  if(!client)throw new Error('ship_verifier_unavailable');
  const result=verifierResult(await client.verify({submissionId:input.submissionId,url:input.artifactUrl}),input.submissionId);
  await db.transaction().execute(async tx=>{
    const submission=await tx.selectFrom('ship_submissions').selectAll().where('submission_id','=',input.submissionId).forUpdate().executeTakeFirst();
    if(!submission||submission.artifact_url!==input.artifactUrl)throw new Error('ship_verification_submission_invalid');
    const replay=await tx.selectFrom('ship_verifier_observations').select('observation_id').where('submission_id','=',input.submissionId).executeTakeFirst();if(replay)return;
    const now=await readDatabaseNow(tx);
    await tx.insertInto('ship_verifier_observations').values({observation_id:randomUUID(),submission_id:input.submissionId,outcome:result.outcome,reason_code:result.reasonCode,final_url:result.finalUrl,http_status:result.httpStatus,duration_ms:result.durationMs,redirects:result.redirects,observed_at:now}).execute();
    await tx.updateTable('ship_submissions').set({state:result.outcome==='PASS'?'OBSERVED':'ATTENTION',updated_at:now}).where('submission_id','=',input.submissionId).execute();
    await appendHistoryEvent(tx,{eventFamily:'evidence',eventType:'project.ship_verifier.observed',dedupeKey:`evidence:project.ship_verifier.observed:${input.submissionId}`,actorPlayerId:null,subjectType:'project',subjectId:submission.project_id,occurredAt:now,
      payload:{schema_version:'project.ship_verifier.observed.v1',submission_id:input.submissionId,outcome:result.outcome,reason_code:result.reasonCode,...(result.finalUrl?{final_url:result.finalUrl}:{}),...(result.httpStatus!==null?{http_status:result.httpStatus}:{}),duration_ms:result.durationMs,redirects:result.redirects,truth_state:result.outcome==='UNAVAILABLE'?'UNKNOWN':'OBSERVED'}});
  });
}

async function handleJob(db: Kysely<DatabaseSchema>, job: OutboxJobRow, databaseNow: Date, options: RunOneJobOptions): Promise<void> {
  if (job.job_version !== OUTBOX_JOB_VERSION) throw new Error(`unsupported_job_version:${job.job_version}`);
  switch (job.job_type) {
    case SESSION_EXPIRY_JOB_TYPE:
      await handleSessionExpiry(db, job, databaseNow);
      return;
    case PROJECT_GITHUB_OBSERVATION_JOB_TYPE:
      await handleProjectGitHubObservation(db, job);
      return;
    case SHIP_VERIFICATION_JOB_TYPE:
      await handleShipVerification(db, job, options.shipVerifierClient);
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
    await handleJob(db, job, await readDatabaseNow(db), options);
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
