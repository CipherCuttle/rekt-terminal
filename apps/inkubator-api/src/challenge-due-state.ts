import {randomUUID} from 'node:crypto';
import {
  activateEntries,
  assertFrozenBuildContract,
  selectFinalSubmission,
  transitionChallenge,
  type BuildContract,
  type ChallengeEntry,
  type SubmissionManifest,
} from '@rekt-ink/protocol/challenge';
import {sql, type Kysely} from 'kysely';
import {canonicalizeJson} from './canonical-json.js';
import type {DatabaseSchema, OutboxJobRow} from './database.js';
import {appendHistoryEvent} from './events.js';

export const CHALLENGE_DUE_STATE_JOB_TYPE = 'challenge.due_state.v1';
export const CHALLENGE_DUE_STATE_SCHEMA_VERSION = 'challenge.due_state.job.v1';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DueStatus = 'ENTRY_OPEN' | 'BUILDING';

type DueStatePayload = {
  challengeId: string;
  expectedStatus: DueStatus;
  dueAtMs: number;
};

type ChallengeDueRow = {
  challenge_id: string;
  status: string;
  current_contract_version: string | null;
  current_terms_digest: string | null;
  activation_minimum: number;
  entry_deadline: Date;
  submission_deadline: Date;
};

type ContractRow = {
  terms_digest: string;
  contract_json: unknown;
};

type EntryRow = {
  entry_id: string;
  builder_player_id: string;
  payout_identity: string;
  state: ChallengeEntry['state'];
  build_start: Date | null;
  submission_deadline: Date | null;
};

type SubmissionRow = {
  submission_id: string;
  entry_id: string;
  submission_version: string;
  manifest_json: unknown;
  is_final: boolean;
};

function parsePayload(value: unknown): DueStatePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('challenge_due_state_payload_invalid');
  const payload = value as Record<string, unknown>;
  if (payload.schema_version !== CHALLENGE_DUE_STATE_SCHEMA_VERSION) throw new Error('challenge_due_state_payload_invalid');
  if (typeof payload.challenge_id !== 'string' || !UUID_PATTERN.test(payload.challenge_id)) throw new Error('challenge_due_state_payload_invalid');
  if (payload.expected_status !== 'ENTRY_OPEN' && payload.expected_status !== 'BUILDING') throw new Error('challenge_due_state_payload_invalid');
  if (!Number.isSafeInteger(payload.due_at_ms) || Number(payload.due_at_ms) < 0) throw new Error('challenge_due_state_payload_invalid');
  return {
    challengeId: payload.challenge_id.toLowerCase(),
    expectedStatus: payload.expected_status,
    dueAtMs: Number(payload.due_at_ms),
  };
}

function nextPayload(challengeId: string, expectedStatus: DueStatus, dueAtMs: number) {
  return {
    schema_version: CHALLENGE_DUE_STATE_SCHEMA_VERSION,
    challenge_id: challengeId,
    expected_status: expectedStatus,
    due_at_ms: dueAtMs,
  };
}

export function challengeDueStateJobInput(challengeId: string, expectedStatus: DueStatus, dueAtMs: number) {
  if (!UUID_PATTERN.test(challengeId)) throw new Error('challenge_due_state_challenge_id_invalid');
  if (!Number.isSafeInteger(dueAtMs) || dueAtMs < 0) throw new Error('challenge_due_state_due_at_invalid');
  const payload = nextPayload(challengeId.toLowerCase(), expectedStatus, dueAtMs);
  return {
    jobType: CHALLENGE_DUE_STATE_JOB_TYPE,
    idempotencyKey: `challenge.due_state.v1:${payload.challenge_id}:${expectedStatus}:${dueAtMs}`,
    payload,
    nextAttemptAt: new Date(dueAtMs),
  };
}

async function loadContract(db: Kysely<DatabaseSchema>, challenge: ChallengeDueRow): Promise<BuildContract> {
  if (!challenge.current_contract_version || !challenge.current_terms_digest) throw new Error('challenge_contract_not_frozen');
  const row = (await sql<ContractRow>`
    select terms_digest, contract_json
    from challenge_contract_versions
    where challenge_id = ${challenge.challenge_id}
      and contract_version = ${challenge.current_contract_version}
  `.execute(db)).rows[0];
  if (!row || row.terms_digest !== challenge.current_terms_digest) throw new Error('challenge_contract_pointer_invalid');
  return assertFrozenBuildContract(row.contract_json);
}

async function enqueueFollowup(
  db: Kysely<DatabaseSchema>,
  challengeId: string,
  expectedStatus: DueStatus,
  dueAtMs: number,
): Promise<void> {
  const input = challengeDueStateJobInput(challengeId, expectedStatus, dueAtMs);
  const normalized = canonicalizeJson(input.payload);
  const inserted = await sql<{job_id: string}>`
    insert into outbox_jobs (
      job_id, job_version, job_type, idempotency_key, payload, payload_hash,
      state, attempts, max_attempts, next_attempt_at
    ) values (
      ${randomUUID()}, 'job.v1', ${input.jobType}, ${input.idempotencyKey},
      ${normalized.value}::jsonb, ${normalized.sha256}, 'pending', 0, 5, ${input.nextAttemptAt}
    )
    on conflict (idempotency_key) do nothing
    returning job_id
  `.execute(db);
  if (inserted.rows[0]) return;
  const existing = (await sql<{job_version: string; job_type: string; payload_hash: string; max_attempts: number}>`
    select job_version, job_type, payload_hash, max_attempts
    from outbox_jobs where idempotency_key = ${input.idempotencyKey}
  `.execute(db)).rows[0];
  if (!existing || existing.job_version !== 'job.v1' || existing.job_type !== input.jobType || existing.payload_hash !== normalized.sha256 || existing.max_attempts !== 5) {
    throw new Error(`outbox_job_idempotency_conflict:${input.idempotencyKey}`);
  }
}

async function finalizeChallengeSubmissions(
  db: Kysely<DatabaseSchema>,
  challengeId: string,
  contract: BuildContract,
  databaseNow: Date,
): Promise<void> {
  const entries = (await sql<EntryRow>`
    select entry_id, builder_player_id, payout_identity, state, build_start, submission_deadline
    from challenge_entries
    where challenge_id = ${challengeId} and state = 'ACTIVE'
    order by entry_id
    for update
  `.execute(db)).rows;
  const submissions = (await sql<SubmissionRow>`
    select submission_id, entry_id, submission_version, manifest_json, is_final
    from challenge_submissions
    where challenge_id = ${challengeId}
    order by entry_id, accepted_at, submission_id
    for update
  `.execute(db)).rows;

  for (const entry of entries) {
    const rows = submissions.filter((submission) => submission.entry_id === entry.entry_id);
    const manifests = rows.map((submission) => submission.manifest_json as SubmissionManifest);
    const selected = selectFinalSubmission(manifests, contract, entry.entry_id);

    if (!selected) {
      await sql`
        update challenge_entries
        set state = 'ABANDONED', updated_at = ${databaseNow}
        where entry_id = ${entry.entry_id} and state = 'ACTIVE'
      `.execute(db);
      continue;
    }

    const selectedDigest = canonicalizeJson(selected).sha256;
    const selectedRow = rows.find((submission) =>
      String(submission.submission_version) === String(selected.submission_version)
      && canonicalizeJson(submission.manifest_json).sha256 === selectedDigest,
    );
    if (!selectedRow) throw new Error('challenge_due_state_final_submission_missing');

    await sql`
      update challenge_submissions
      set is_final = (submission_id = ${selectedRow.submission_id})
      where entry_id = ${entry.entry_id}
    `.execute(db);
    await sql`
      update challenge_entries
      set state = 'SUBMITTED', updated_at = ${databaseNow}
      where entry_id = ${entry.entry_id} and state = 'ACTIVE'
    `.execute(db);
  }
}

export async function handleChallengeDueStateJob(
  db: Kysely<DatabaseSchema>,
  job: OutboxJobRow,
  databaseNow: Date,
): Promise<void> {
  const payload = parsePayload(job.payload);
  await db.transaction().execute(async (transaction) => {
    const challenge = (await sql<ChallengeDueRow>`
      select challenge_id, status, current_contract_version, current_terms_digest,
             activation_minimum, entry_deadline, submission_deadline
      from challenges where challenge_id = ${payload.challengeId} for update
    `.execute(transaction)).rows[0];
    if (!challenge) return;
    if (challenge.status !== payload.expectedStatus) return;

    const expectedDueAtMs = payload.expectedStatus === 'ENTRY_OPEN'
      ? challenge.entry_deadline.getTime()
      : challenge.submission_deadline.getTime();
    if (payload.dueAtMs !== expectedDueAtMs) throw new Error('challenge_due_state_schedule_mismatch');
    if (databaseNow.getTime() < expectedDueAtMs) throw new Error('challenge_due_state_not_due');

    const contract = await loadContract(transaction, challenge);
    let nextStatus: 'NOT_ACTIVATED' | 'BUILDING' | 'SUBMISSIONS_LOCKED';
    let activeSeatCount: number | null = null;

    if (payload.expectedStatus === 'ENTRY_OPEN') {
      const rows = (await sql<EntryRow>`
        select entry_id, builder_player_id, payout_identity, state, build_start, submission_deadline
        from challenge_entries where challenge_id = ${payload.challengeId}
        order by entry_id
      `.execute(transaction)).rows;
      const entries: ChallengeEntry[] = rows.map((row) => ({
        entry_id: row.entry_id,
        builder_id: row.builder_player_id,
        payout_id: row.payout_identity,
        state: row.state,
        ...(row.build_start ? {build_start: row.build_start.getTime()} : {}),
        ...(row.submission_deadline ? {submission_deadline: row.submission_deadline.getTime()} : {}),
      }));
      activeSeatCount = entries.filter((entry) => entry.state === 'SEATED').length;
      nextStatus = activeSeatCount >= challenge.activation_minimum ? 'BUILDING' : 'NOT_ACTIVATED';
      transitionChallenge(
        {challenge_id: challenge.challenge_id, status: 'ENTRY_OPEN', contract},
        nextStatus,
        {now: databaseNow.getTime(), activeSeatCount},
      );

      if (nextStatus === 'BUILDING') {
        activateEntries(entries, contract);
        const updated = await sql<{entry_id: string}>`
          update challenge_entries
          set state = 'ACTIVE', build_start = ${new Date(contract.build_start)},
              submission_deadline = ${new Date(contract.submission_deadline)}, updated_at = ${databaseNow}
          where challenge_id = ${payload.challengeId} and state = 'SEATED'
          returning entry_id
        `.execute(transaction);
        if (updated.rows.length !== activeSeatCount) throw new Error('challenge_due_state_entry_activation_race');
      }
    } else {
      nextStatus = 'SUBMISSIONS_LOCKED';
      transitionChallenge(
        {challenge_id: challenge.challenge_id, status: 'BUILDING', contract},
        nextStatus,
        {now: databaseNow.getTime()},
      );
      await finalizeChallengeSubmissions(transaction, payload.challengeId, contract, databaseNow);
    }

    const updated = await sql<{challenge_id: string}>`
      update challenges
      set status = ${nextStatus}, updated_at = ${databaseNow}
      where challenge_id = ${payload.challengeId} and status = ${payload.expectedStatus}
      returning challenge_id
    `.execute(transaction);
    if (updated.rows.length !== 1) throw new Error('challenge_due_state_transition_race');

    await appendHistoryEvent(transaction, {
      eventFamily: 'activity',
      eventType: 'challenge.lifecycle.due_transition',
      dedupeKey: `activity:challenge.lifecycle.due_transition:${payload.challengeId}:${payload.expectedStatus}:${payload.dueAtMs}`,
      actorPlayerId: null,
      subjectType: 'challenge',
      subjectId: payload.challengeId,
      occurredAt: databaseNow,
      payload: {
        schema_version: 'challenge.lifecycle.due_transition.v1',
        from_status: payload.expectedStatus,
        to_status: nextStatus,
        due_at_ms: payload.dueAtMs,
        ...(activeSeatCount === null ? {} : {active_seat_count: activeSeatCount}),
      },
    });

    if (nextStatus === 'BUILDING') {
      await enqueueFollowup(transaction, payload.challengeId, 'BUILDING', challenge.submission_deadline.getTime());
    }
  });
}
