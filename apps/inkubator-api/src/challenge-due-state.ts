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
const PROGRESSION_RECHECK_MS = 60_000;

export type DueStatus = 'ENTRY_OPEN' | 'BUILDING' | 'SUBMISSIONS_LOCKED' | 'QUALIFICATION' | 'APPEAL_WINDOW';

type DueStatePayload = {
  challengeId: string;
  expectedStatus: DueStatus;
  dueAtMs: number;
};

type ChallengeDueRow = {
  challenge_id: string;
  organizer_player_id: string;
  status: string;
  current_contract_version: string | null;
  current_terms_digest: string | null;
  activation_minimum: number;
  entry_deadline: Date;
  submission_deadline: Date;
  appeal_opened_at: Date | null;
  appeal_window_ms: string;
};

type ContractRow = {terms_digest: string; contract_json: unknown};
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
type QualificationRow = {entry_id: string; result: 'QUALIFIED' | 'NOT_QUALIFIED' | 'DISPUTED'; created_at: Date; qualification_id: string};
type AppealResolutionRow = {entry_id: string; resolution_id: string | null; result: 'QUALIFIED' | 'NOT_QUALIFIED' | 'DISPUTED' | null};
type DecisionRow = {decision_id: string; decision_digest: string; decision_json: unknown};

function isDueStatus(value: unknown): value is DueStatus {
  return value === 'ENTRY_OPEN' || value === 'BUILDING' || value === 'SUBMISSIONS_LOCKED'
    || value === 'QUALIFICATION' || value === 'APPEAL_WINDOW';
}

function parsePayload(value: unknown): DueStatePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('challenge_due_state_payload_invalid');
  const payload = value as Record<string, unknown>;
  if (payload.schema_version !== CHALLENGE_DUE_STATE_SCHEMA_VERSION) throw new Error('challenge_due_state_payload_invalid');
  if (typeof payload.challenge_id !== 'string' || !UUID_PATTERN.test(payload.challenge_id)) throw new Error('challenge_due_state_payload_invalid');
  if (!isDueStatus(payload.expected_status)) throw new Error('challenge_due_state_payload_invalid');
  if (!Number.isSafeInteger(payload.due_at_ms) || Number(payload.due_at_ms) < 0) throw new Error('challenge_due_state_payload_invalid');
  return {challengeId: payload.challenge_id.toLowerCase(), expectedStatus: payload.expected_status, dueAtMs: Number(payload.due_at_ms)};
}

function nextPayload(challengeId: string, expectedStatus: DueStatus, dueAtMs: number) {
  return {schema_version: CHALLENGE_DUE_STATE_SCHEMA_VERSION, challenge_id: challengeId, expected_status: expectedStatus, due_at_ms: dueAtMs};
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
    select terms_digest, contract_json from challenge_contract_versions
    where challenge_id = ${challenge.challenge_id} and contract_version = ${challenge.current_contract_version}
  `.execute(db)).rows[0];
  if (!row || row.terms_digest !== challenge.current_terms_digest) throw new Error('challenge_contract_pointer_invalid');
  return assertFrozenBuildContract(row.contract_json);
}

async function enqueueFollowup(db: Kysely<DatabaseSchema>, challengeId: string, expectedStatus: DueStatus, dueAtMs: number): Promise<void> {
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
    select job_version, job_type, payload_hash, max_attempts from outbox_jobs where idempotency_key = ${input.idempotencyKey}
  `.execute(db)).rows[0];
  if (!existing || existing.job_version !== 'job.v1' || existing.job_type !== input.jobType || existing.payload_hash !== normalized.sha256 || existing.max_attempts !== 5) {
    throw new Error(`outbox_job_idempotency_conflict:${input.idempotencyKey}`);
  }
}

async function finalizeChallengeSubmissions(db: Kysely<DatabaseSchema>, challengeId: string, contract: BuildContract, databaseNow: Date): Promise<void> {
  const entries = (await sql<EntryRow>`
    select entry_id, builder_player_id, payout_identity, state, build_start, submission_deadline
    from challenge_entries where challenge_id = ${challengeId} and state = 'ACTIVE'
    order by entry_id for update
  `.execute(db)).rows;
  const submissions = (await sql<SubmissionRow>`
    select submission_id, entry_id, submission_version, manifest_json, is_final
    from challenge_submissions where challenge_id = ${challengeId}
    order by entry_id, accepted_at, submission_id for update
  `.execute(db)).rows;

  for (const entry of entries) {
    const rows = submissions.filter((submission) => submission.entry_id === entry.entry_id);
    const selected = selectFinalSubmission(rows.map((submission) => submission.manifest_json as SubmissionManifest), contract, entry.entry_id);
    if (!selected) {
      await sql`update challenge_entries set state = 'ABANDONED', updated_at = ${databaseNow} where entry_id = ${entry.entry_id} and state = 'ACTIVE'`.execute(db);
      continue;
    }
    const selectedDigest = canonicalizeJson(selected).sha256;
    const selectedRow = rows.find((submission) => String(submission.submission_version) === String(selected.submission_version)
      && canonicalizeJson(submission.manifest_json).sha256 === selectedDigest);
    if (!selectedRow) throw new Error('challenge_due_state_final_submission_missing');
    await sql`update challenge_submissions set is_final = (submission_id = ${selectedRow.submission_id}) where entry_id = ${entry.entry_id}`.execute(db);
    await sql`update challenge_entries set state = 'SUBMITTED', updated_at = ${databaseNow} where entry_id = ${entry.entry_id} and state = 'ACTIVE'`.execute(db);
  }
}

async function firstPassComplete(db: Kysely<DatabaseSchema>, challengeId: string): Promise<boolean> {
  const counts = (await sql<{final_count: number; qualified_count: number}>`
    select
      count(*)::int as final_count,
      count(*) filter (where exists (
        select 1 from challenge_qualifications qualification
        where qualification.challenge_id = ${challengeId}
          and qualification.entry_id = submission.entry_id
          and qualification.submission_id = submission.submission_id
      ))::int as qualified_count
    from challenge_submissions submission
    where submission.challenge_id = ${challengeId} and submission.is_final = true
  `.execute(db)).rows[0];
  return (counts?.final_count ?? 0) === (counts?.qualified_count ?? 0);
}

async function effectiveFinalQualifierIds(db: Kysely<DatabaseSchema>, challengeId: string): Promise<{allResolved: boolean; qualifierIds: string[]}> {
  const firstPass = (await sql<QualificationRow>`
    select distinct on (qualification.entry_id)
      qualification.entry_id, qualification.result, qualification.created_at, qualification.qualification_id
    from challenge_qualifications qualification
    join challenge_submissions submission on submission.submission_id = qualification.submission_id
    where qualification.challenge_id = ${challengeId} and submission.is_final = true
    order by qualification.entry_id, qualification.created_at, qualification.qualification_id
  `.execute(db)).rows;
  const appeals = (await sql<AppealResolutionRow>`
    select appeal.entry_id, resolution.resolution_id, revised.result
    from challenge_appeals appeal
    left join challenge_appeal_resolutions resolution on resolution.appeal_id = appeal.appeal_id
    left join challenge_qualifications revised on revised.qualification_id = resolution.effective_qualification_id
    where appeal.challenge_id = ${challengeId}
  `.execute(db)).rows;
  if (appeals.some((row) => row.resolution_id === null || row.result === null)) return {allResolved: false, qualifierIds: []};
  const appealByEntry = new Map(appeals.map((row) => [row.entry_id, row.result]));
  const qualifierIds = firstPass
    .filter((row) => (appealByEntry.get(row.entry_id) ?? row.result) === 'QUALIFIED')
    .map((row) => row.entry_id)
    .sort();
  return {allResolved: true, qualifierIds};
}

async function appendTransitionHistory(
  db: Kysely<DatabaseSchema>, challengeId: string, fromStatus: string, toStatus: string,
  dueAtMs: number, databaseNow: Date, suffix = '', extra: Record<string, unknown> = {},
): Promise<void> {
  await appendHistoryEvent(db, {
    eventFamily: 'activity', eventType: 'challenge.lifecycle.due_transition',
    dedupeKey: `activity:challenge.lifecycle.due_transition:${challengeId}:${fromStatus}:${dueAtMs}${suffix}`,
    actorPlayerId: null, subjectType: 'challenge', subjectId: challengeId, occurredAt: databaseNow,
    payload: {schema_version: 'challenge.lifecycle.due_transition.v1', from_status: fromStatus, to_status: toStatus, due_at_ms: dueAtMs, ...extra},
  });
}

async function persistDerivedFinalQualifiers(
  db: Kysely<DatabaseSchema>, challenge: ChallengeDueRow, qualifierIds: string[], databaseNow: Date,
): Promise<void> {
  const decision = {final_qualifier_ids: qualifierIds};
  const normalized = canonicalizeJson(decision);
  const existing = (await sql<DecisionRow>`
    select decision_id, decision_digest, decision_json from challenge_decisions
    where challenge_id = ${challenge.challenge_id} and decision_type = 'FINAL_QUALIFIERS'
    order by created_at desc, decision_id desc limit 1
  `.execute(db)).rows[0];
  if (existing) {
    if (existing.decision_digest !== normalized.sha256 || canonicalizeJson(existing.decision_json).sha256 !== normalized.sha256) {
      throw new Error('challenge_final_qualifiers_authority_conflict');
    }
    return;
  }
  const decisionId = randomUUID();
  await sql`
    insert into challenge_decisions (
      decision_id, challenge_id, entry_id, decision_type, decision_version, decision_json, decision_digest, created_at
    ) values (
      ${decisionId}, ${challenge.challenge_id}, null, 'FINAL_QUALIFIERS', 'stage-c-effective-v1',
      ${normalized.value}::jsonb, ${normalized.sha256}, ${databaseNow}
    )
  `.execute(db);
  await appendHistoryEvent(db, {
    eventFamily: 'activity', eventType: 'challenge.decision.derived',
    dedupeKey: `activity:challenge.decision.derived:${challenge.challenge_id}:FINAL_QUALIFIERS:${normalized.sha256}`,
    actorPlayerId: challenge.organizer_player_id, subjectType: 'challenge', subjectId: challenge.challenge_id, occurredAt: databaseNow,
    payload: {schema_version: 'challenge.decision.derived.v1', decision_id: decisionId, decision_type: 'FINAL_QUALIFIERS', decision_digest: normalized.sha256},
  });
}

export async function handleChallengeDueStateJob(db: Kysely<DatabaseSchema>, job: OutboxJobRow, databaseNow: Date): Promise<void> {
  const payload = parsePayload(job.payload);
  await db.transaction().execute(async (transaction) => {
    const challenge = (await sql<ChallengeDueRow>`
      select challenge_id, organizer_player_id, status, current_contract_version, current_terms_digest,
             activation_minimum, entry_deadline, submission_deadline, appeal_opened_at, appeal_window_ms
      from challenges where challenge_id = ${payload.challengeId} for update
    `.execute(transaction)).rows[0];
    if (!challenge || challenge.status !== payload.expectedStatus) return;
    if (databaseNow.getTime() < payload.dueAtMs) throw new Error('challenge_due_state_not_due');

    if (payload.expectedStatus === 'ENTRY_OPEN' && payload.dueAtMs !== challenge.entry_deadline.getTime()) throw new Error('challenge_due_state_schedule_mismatch');
    if (payload.expectedStatus === 'BUILDING' && payload.dueAtMs !== challenge.submission_deadline.getTime()) throw new Error('challenge_due_state_schedule_mismatch');
    if (payload.expectedStatus === 'APPEAL_WINDOW') {
      if (!challenge.appeal_opened_at) throw new Error('challenge_appeal_opened_at_missing');
      const closeAt = challenge.appeal_opened_at.getTime() + Number(challenge.appeal_window_ms);
      if (payload.dueAtMs < closeAt) throw new Error('challenge_due_state_schedule_mismatch');
      if (databaseNow.getTime() < closeAt) throw new Error('challenge_due_state_not_due');
    }

    const contract = await loadContract(transaction, challenge);

    if (payload.expectedStatus === 'ENTRY_OPEN') {
      const rows = (await sql<EntryRow>`
        select entry_id, builder_player_id, payout_identity, state, build_start, submission_deadline
        from challenge_entries where challenge_id = ${payload.challengeId} order by entry_id
      `.execute(transaction)).rows;
      const entries: ChallengeEntry[] = rows.map((row) => ({
        entry_id: row.entry_id, builder_id: row.builder_player_id, payout_id: row.payout_identity, state: row.state,
        ...(row.build_start ? {build_start: row.build_start.getTime()} : {}),
        ...(row.submission_deadline ? {submission_deadline: row.submission_deadline.getTime()} : {}),
      }));
      const activeSeatCount = entries.filter((entry) => entry.state === 'SEATED').length;
      const nextStatus = activeSeatCount >= challenge.activation_minimum ? 'BUILDING' : 'NOT_ACTIVATED';
      transitionChallenge({challenge_id: challenge.challenge_id, status: 'ENTRY_OPEN', contract}, nextStatus, {now: databaseNow.getTime(), activeSeatCount});
      if (nextStatus === 'BUILDING') {
        activateEntries(entries, contract);
        const updatedEntries = await sql<{entry_id: string}>`
          update challenge_entries set state = 'ACTIVE', build_start = ${new Date(contract.build_start)},
            submission_deadline = ${new Date(contract.submission_deadline)}, updated_at = ${databaseNow}
          where challenge_id = ${payload.challengeId} and state = 'SEATED' returning entry_id
        `.execute(transaction);
        if (updatedEntries.rows.length !== activeSeatCount) throw new Error('challenge_due_state_entry_activation_race');
      }
      const updated = await sql<{challenge_id: string}>`
        update challenges set status = ${nextStatus}, updated_at = ${databaseNow}
        where challenge_id = ${payload.challengeId} and status = 'ENTRY_OPEN' returning challenge_id
      `.execute(transaction);
      if (updated.rows.length !== 1) throw new Error('challenge_due_state_transition_race');
      await appendTransitionHistory(transaction, payload.challengeId, 'ENTRY_OPEN', nextStatus, payload.dueAtMs, databaseNow, '', {active_seat_count: activeSeatCount});
      if (nextStatus === 'BUILDING') await enqueueFollowup(transaction, payload.challengeId, 'BUILDING', challenge.submission_deadline.getTime());
      return;
    }

    if (payload.expectedStatus === 'BUILDING') {
      transitionChallenge({challenge_id: challenge.challenge_id, status: 'BUILDING', contract}, 'SUBMISSIONS_LOCKED', {now: databaseNow.getTime()});
      await finalizeChallengeSubmissions(transaction, payload.challengeId, contract, databaseNow);
      const updated = await sql<{challenge_id: string}>`
        update challenges set status = 'SUBMISSIONS_LOCKED', updated_at = ${databaseNow}
        where challenge_id = ${payload.challengeId} and status = 'BUILDING' returning challenge_id
      `.execute(transaction);
      if (updated.rows.length !== 1) throw new Error('challenge_due_state_transition_race');
      await appendTransitionHistory(transaction, payload.challengeId, 'BUILDING', 'SUBMISSIONS_LOCKED', payload.dueAtMs, databaseNow);
      await enqueueFollowup(transaction, payload.challengeId, 'SUBMISSIONS_LOCKED', databaseNow.getTime());
      return;
    }

    if (payload.expectedStatus === 'SUBMISSIONS_LOCKED') {
      transitionChallenge({challenge_id: challenge.challenge_id, status: 'SUBMISSIONS_LOCKED', contract}, 'QUALIFICATION', {});
      const updated = await sql<{challenge_id: string}>`
        update challenges set status = 'QUALIFICATION', updated_at = ${databaseNow}
        where challenge_id = ${payload.challengeId} and status = 'SUBMISSIONS_LOCKED' returning challenge_id
      `.execute(transaction);
      if (updated.rows.length !== 1) throw new Error('challenge_due_state_transition_race');
      await appendTransitionHistory(transaction, payload.challengeId, 'SUBMISSIONS_LOCKED', 'QUALIFICATION', payload.dueAtMs, databaseNow);
      await enqueueFollowup(transaction, payload.challengeId, 'QUALIFICATION', databaseNow.getTime());
      return;
    }

    if (payload.expectedStatus === 'QUALIFICATION') {
      if (!(await firstPassComplete(transaction, payload.challengeId))) {
        await enqueueFollowup(transaction, payload.challengeId, 'QUALIFICATION', databaseNow.getTime() + PROGRESSION_RECHECK_MS);
        return;
      }
      const opened = transitionChallenge(
        {challenge_id: challenge.challenge_id, status: 'QUALIFICATION', contract},
        'APPEAL_WINDOW', {now: databaseNow.getTime(), allFirstPassComplete: true},
      ) as {appeal_opened_at?: number};
      if (!opened.appeal_opened_at) throw new Error('challenge_appeal_opened_at_missing');
      const updated = await sql<{challenge_id: string}>`
        update challenges set status = 'APPEAL_WINDOW', appeal_opened_at = ${new Date(opened.appeal_opened_at)}, updated_at = ${databaseNow}
        where challenge_id = ${payload.challengeId} and status = 'QUALIFICATION' returning challenge_id
      `.execute(transaction);
      if (updated.rows.length !== 1) throw new Error('challenge_due_state_transition_race');
      await appendTransitionHistory(transaction, payload.challengeId, 'QUALIFICATION', 'APPEAL_WINDOW', payload.dueAtMs, databaseNow);
      await enqueueFollowup(transaction, payload.challengeId, 'APPEAL_WINDOW', opened.appeal_opened_at + contract.appeal_window_ms);
      return;
    }

    const effective = await effectiveFinalQualifierIds(transaction, payload.challengeId);
    if (!effective.allResolved) {
      await enqueueFollowup(transaction, payload.challengeId, 'APPEAL_WINDOW', databaseNow.getTime() + PROGRESSION_RECHECK_MS);
      return;
    }
    transitionChallenge(
      {challenge_id: challenge.challenge_id, status: 'APPEAL_WINDOW', contract, appeal_opened_at: challenge.appeal_opened_at!.getTime()},
      'FINAL_QUALIFIERS', {now: databaseNow.getTime(), appealsResolved: true},
    );
    await persistDerivedFinalQualifiers(transaction, challenge, effective.qualifierIds, databaseNow);
    const finalized = await sql<{challenge_id: string}>`
      update challenges set status = 'FINAL_QUALIFIERS', updated_at = ${databaseNow}
      where challenge_id = ${payload.challengeId} and status = 'APPEAL_WINDOW' returning challenge_id
    `.execute(transaction);
    if (finalized.rows.length !== 1) throw new Error('challenge_due_state_transition_race');
    await appendTransitionHistory(transaction, payload.challengeId, 'APPEAL_WINDOW', 'FINAL_QUALIFIERS', payload.dueAtMs, databaseNow);

    if (effective.qualifierIds.length > 0) {
      transitionChallenge(
        {challenge_id: challenge.challenge_id, status: 'FINAL_QUALIFIERS', contract},
        'SELECTION', {finalQualifierIds: effective.qualifierIds},
      );
      const selection = await sql<{challenge_id: string}>`
        update challenges set status = 'SELECTION', updated_at = ${databaseNow}
        where challenge_id = ${payload.challengeId} and status = 'FINAL_QUALIFIERS' returning challenge_id
      `.execute(transaction);
      if (selection.rows.length !== 1) throw new Error('challenge_due_state_transition_race');
      await appendTransitionHistory(transaction, payload.challengeId, 'FINAL_QUALIFIERS', 'SELECTION', payload.dueAtMs, databaseNow, ':selection');
    }
  });
}
