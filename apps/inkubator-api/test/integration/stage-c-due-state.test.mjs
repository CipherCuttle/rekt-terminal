import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {challengeDueStateJobInput} from '../../dist/challenge-due-state.js';
import {
  acquireChallengeSeat,
  createChallenge,
  persistFrozenBuildContract,
} from '../../dist/challenge-store.js';
import {createDatabase, readDatabaseNow} from '../../dist/database.js';
import {enqueueOutboxJob, runOneJob} from '../../dist/jobs.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

async function player(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
  return playerId;
}

function contractFor(challengeId, entryDeadline, submissionDeadline, reviewDeadline) {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challengeId,
    contract_version: '1',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'Stage C due-state challenge',
    brief: 'Prove durable due-state progression',
    outcome_contract: {criteria: [{id: 'OUT', description: 'Works', mandatory: true}]},
    production_envelope: {criteria: []},
    delivery_contract: {criteria: []},
    preferences: {},
    reference_architecture: {},
    normative_constraints: [],
    normative_references: [],
    informational_references: [],
    knowledge: [],
    slot_limit: 2,
    activation_minimum: 1,
    entry_deadline: entryDeadline,
    build_start: entryDeadline,
    submission_deadline: submissionDeadline,
    appeal_window_ms: 100,
    review_deadline: reviewDeadline,
    prize_minor_units: 100,
    settlement_asset: 'TEST',
  });
}

async function createFrozenChallenge(db, contract, organizer) {
  await createChallenge(db, {
    requestId: randomUUID(),
    challengeId: contract.challenge_id,
    organizerPlayerId: organizer,
    mechanismVersion: contract.mechanism_version,
    settlementPolicyVersion: contract.settlement_policy_version,
    ipTermsVersion: contract.ip_terms_version,
    slotLimit: contract.slot_limit,
    activationMinimum: contract.activation_minimum,
    entryDeadlineMs: contract.entry_deadline,
    buildStartMs: contract.build_start,
    submissionDeadlineMs: contract.submission_deadline,
    appealWindowMs: contract.appeal_window_ms,
    reviewDeadlineMs: contract.review_deadline,
  });
  await persistFrozenBuildContract(db, {
    requestId: randomUUID(),
    actorPlayerId: organizer,
    challengeId: contract.challenge_id,
    contract,
  });
}

test('Stage C due-state uses canonical outbox leases, advances once, and stale jobs no-op', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const dueBase = 1_600_000_000_000;
    const organizer = await player(db, 'due-organizer');
    const builder = await player(db, 'due-builder');
    const challengeId = randomUUID();
    const contract = contractFor(challengeId, dueBase, dueBase + 1_000, dueBase + 2_000);
    await createFrozenChallenge(db, contract, organizer);

    const entryJob = challengeDueStateJobInput(challengeId, 'ENTRY_OPEN', contract.entry_deadline);
    await db.transaction().execute(async (transaction) => {
      await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${challengeId}`.execute(transaction);
      await enqueueOutboxJob(transaction, entryJob);
    });

    const entry = await acquireChallengeSeat(db, {
      requestId: randomUUID(),
      entryId: randomUUID(),
      challengeId,
      builderPlayerId: builder,
      payoutIdentity: 'due-builder-pay',
    });

    const replay = await enqueueOutboxJob(db, entryJob);
    const oneEntryJob = await sql`
      select count(*)::int as count
      from outbox_jobs
      where idempotency_key = ${entryJob.idempotencyKey}
    `.execute(db);
    assert.equal(oneEntryJob.rows[0].count, 1);
    assert.equal(replay.idempotency_key, entryJob.idempotencyKey);

    const firstRun = await runOneJob(db, {retryBaseMs: 100});
    assert.equal(firstRun.status, 'succeeded');
    const afterEntryDeadline = await sql`
      select status from challenges where challenge_id = ${challengeId}
    `.execute(db);
    assert.equal(afterEntryDeadline.rows[0].status, 'BUILDING');
    const activatedEntry = await sql`
      select state, build_start, submission_deadline from challenge_entries where entry_id = ${entry.entry_id}
    `.execute(db);
    assert.equal(activatedEntry.rows[0].state, 'ACTIVE');
    assert.equal(activatedEntry.rows[0].build_start.getTime(), contract.build_start);
    assert.equal(activatedEntry.rows[0].submission_deadline.getTime(), contract.submission_deadline);

    const followupKey = `challenge.due_state.v1:${challengeId}:BUILDING:${contract.submission_deadline}`;
    const followup = await sql`
      select state, attempts from outbox_jobs where idempotency_key = ${followupKey}
    `.execute(db);
    assert.equal(followup.rows.length, 1);
    assert.equal(followup.rows[0].state, 'pending');

    const secondRun = await runOneJob(db, {retryBaseMs: 100});
    assert.equal(secondRun.status, 'succeeded');
    const afterSubmissionDeadline = await sql`
      select status from challenges where challenge_id = ${challengeId}
    `.execute(db);
    assert.equal(afterSubmissionDeadline.rows[0].status, 'SUBMISSIONS_LOCKED');

    const beforeStaleEvents = await sql`
      select count(*)::int as count from history_events
      where subject_type = 'challenge' and subject_id = ${challengeId}
        and event_type = 'challenge.lifecycle.due_transition'
    `.execute(db);
    assert.equal(beforeStaleEvents.rows[0].count, 2);

    await enqueueOutboxJob(db, {
      jobType: entryJob.jobType,
      idempotencyKey: `${entryJob.idempotencyKey}:stale:${randomUUID()}`,
      payload: entryJob.payload,
      nextAttemptAt: new Date(dueBase),
    });
    const staleRun = await runOneJob(db, {retryBaseMs: 100});
    assert.equal(staleRun.status, 'succeeded');
    const afterStale = await sql`
      select status from challenges where challenge_id = ${challengeId}
    `.execute(db);
    assert.equal(afterStale.rows[0].status, 'SUBMISSIONS_LOCKED');
    const afterStaleEvents = await sql`
      select count(*)::int as count from history_events
      where subject_type = 'challenge' and subject_id = ${challengeId}
        and event_type = 'challenge.lifecycle.due_transition'
    `.execute(db);
    assert.equal(afterStaleEvents.rows[0].count, 2);

    const databaseNow = await readDatabaseNow(db);
    const futureEntry = databaseNow.getTime() + 60_000;
    const futureChallengeId = randomUUID();
    const futureOrganizer = await player(db, 'future-organizer');
    const futureContract = contractFor(futureChallengeId, futureEntry, futureEntry + 60_000, futureEntry + 120_000);
    await createFrozenChallenge(db, futureContract, futureOrganizer);
    await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${futureChallengeId}`.execute(db);
    const earlyJob = challengeDueStateJobInput(futureChallengeId, 'ENTRY_OPEN', futureContract.entry_deadline);
    const queuedEarly = await enqueueOutboxJob(db, {...earlyJob, nextAttemptAt: new Date(0)});
    const retryRun = await runOneJob(db, {retryBaseMs: 100});
    assert.equal(retryRun.status, 'retry');
    assert.equal(retryRun.jobId, queuedEarly.job_id);
    const retried = await sql`
      select state, attempts, last_error from outbox_jobs where job_id = ${queuedEarly.job_id}
    `.execute(db);
    assert.equal(retried.rows[0].state, 'pending');
    assert.equal(retried.rows[0].attempts, 1);
    assert.match(retried.rows[0].last_error, /challenge_due_state_not_due/);
  } finally {
    await db.destroy();
  }
});

test('Stage C due-state enqueue rolls back with its domain mutation', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const dueBase = 1_600_100_000_000;
    const organizer = await player(db, 'rollback-organizer');
    const challengeId = randomUUID();
    const contract = contractFor(challengeId, dueBase, dueBase + 1_000, dueBase + 2_000);
    await createFrozenChallenge(db, contract, organizer);
    const jobInput = challengeDueStateJobInput(challengeId, 'ENTRY_OPEN', contract.entry_deadline);

    await assert.rejects(
      db.transaction().execute(async (transaction) => {
        await sql`update challenges set status = 'ENTRY_OPEN' where challenge_id = ${challengeId}`.execute(transaction);
        await enqueueOutboxJob(transaction, jobInput);
        throw new Error('force_stage_c_atomic_rollback');
      }),
      /force_stage_c_atomic_rollback/,
    );

    const challenge = await sql`select status from challenges where challenge_id = ${challengeId}`.execute(db);
    assert.equal(challenge.rows[0].status, 'DRAFT');
    const jobCount = await sql`
      select count(*)::int as count from outbox_jobs where idempotency_key = ${jobInput.idempotencyKey}
    `.execute(db);
    assert.equal(jobCount.rows[0].count, 0);
  } finally {
    await db.destroy();
  }
});
