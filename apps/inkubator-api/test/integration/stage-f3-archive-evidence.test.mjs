import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {buildApp} from '../../dist/app.js';
import {acceptChallengeSubmission, acquireChallengeSeat, createChallenge, persistFrozenBuildContract} from '../../dist/challenge-store.js';
import {CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_JOB_TYPE} from '../../dist/challenge-archive.js';
import {createDatabase, readDatabaseNow} from '../../dist/database.js';
import {enqueueOutboxJob, runOneJob} from '../../dist/jobs.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {registerStageEChallengeProductRoutes} from '../../dist/challenge-product-api.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';

async function player(db, label) {
  const playerId = randomUUID();
  await db.insertInto('players').values({player_id: playerId, display_name: `${label}-${playerId.slice(0, 6)}`}).execute();
  return playerId;
}

function contractFor(challengeId, now) {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0', challenge_id: challengeId, contract_version: 'f3a-test-v1',
    mechanism_version: 'funded-challenge/1.1', settlement_policy_version: 'funded-challenge-settlement/1.0', ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'Stage F3 archive challenge', brief: 'Prove archive evidence remains separate from acceptance.',
    outcome_contract: {criteria: [{id: 'OUT-1', description: 'Capture is durable', mandatory: true}]}, production_envelope: {criteria: []}, delivery_contract: {criteria: []},
    preferences: {}, reference_architecture: {}, normative_constraints: [], normative_references: [], informational_references: [], knowledge: [],
    slot_limit: 2, activation_minimum: 1, entry_deadline: now + 60_000, build_start: now + 60_000, submission_deadline: now + 120_000, appeal_window_ms: 100, review_deadline: now + 180_000,
    prize_minor_units: 100, settlement_asset: 'TEST',
  });
}

async function acceptedFixture(db, sourceValue = 'private/source/reference') {
  const now = (await readDatabaseNow(db)).getTime();
  const organizer = await player(db, 'f3a-organizer');
  const builder = await player(db, 'f3a-builder');
  const challengeId = randomUUID();
  const contract = contractFor(challengeId, now);
  await createChallenge(db, {requestId: randomUUID(), challengeId, organizerPlayerId: organizer, organizerPayoutIdentity: `organizer-${challengeId}`, funderPayoutIdentity: `funder-${challengeId}`, mechanismVersion: contract.mechanism_version, settlementPolicyVersion: contract.settlement_policy_version, ipTermsVersion: contract.ip_terms_version, slotLimit: contract.slot_limit, activationMinimum: contract.activation_minimum, entryDeadlineMs: contract.entry_deadline, buildStartMs: contract.build_start, submissionDeadlineMs: contract.submission_deadline, appealWindowMs: contract.appeal_window_ms, reviewDeadlineMs: contract.review_deadline});
  await persistFrozenBuildContract(db, {requestId: randomUUID(), actorPlayerId: organizer, challengeId, contract});
  await db.updateTable('challenges').set({status: 'ENTRY_OPEN'}).where('challenge_id', '=', challengeId).execute();
  const entry = await acquireChallengeSeat(db, {requestId: randomUUID(), entryId: randomUUID(), challengeId, builderPlayerId: builder, payoutIdentity: `builder-${challengeId}`});
  await db.updateTable('challenges').set({status: 'BUILDING'}).where('challenge_id', '=', challengeId).execute();
  await db.updateTable('challenge_entries').set({state: 'ACTIVE', build_start: new Date(contract.build_start), submission_deadline: new Date(contract.submission_deadline)}).where('entry_id', '=', entry.entry_id).execute();
  const requestId = randomUUID();
  const submissionId = randomUUID();
  const manifest = {schema_version: 'inkubator.submission-manifest/1.0', challenge_id: challengeId, entry_id: entry.entry_id, terms_digest: contract.terms_digest, submission_version: 1, immutable_source_reference: {kind: 'GIT_COMMIT', value: sourceValue}, artifact_digest: 'a'.repeat(64), evidence_references: ['private-evidence-reference'], accepted_at: 0};
  const accepted = await acceptChallengeSubmission(db, {requestId, submissionId, challengeId, entryId: entry.entry_id, manifest});
  return {challengeId, entryId: entry.entry_id, submissionId, requestId, manifest, accepted};
}

async function archiveJob(db, submissionId) {
  const job = await db.selectFrom('outbox_jobs').selectAll().where('job_type', '=', CHALLENGE_SUBMISSION_ARCHIVE_CAPTURE_JOB_TYPE).where('idempotency_key', '=', `challenge.submission.archive:${submissionId}`).executeTakeFirstOrThrow();
  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(-1)}).where('job_id', '=', job.job_id).execute();
  return job;
}

async function archiveState(db, submissionId) {
  return db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', submissionId).executeTakeFirstOrThrow();
}

async function setMaxAttempts(db, jobId, maxAttempts) {
  await db.updateTable('outbox_jobs').set({max_attempts: maxAttempts, next_attempt_at: new Date(0)}).where('job_id', '=', jobId).execute();
}

test('F3A acceptance, replay, capture success, privacy, and immutable manifest', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await acceptedFixture(db, 'PRIVATE_SOURCE_BODY_MUST_NOT_LEAK');
    const firstJob = await archiveJob(db, fixture.submissionId);
    assert.equal((await db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', fixture.submissionId).execute()).length, 1);
    const replay = await acceptChallengeSubmission(db, {requestId: fixture.requestId, submissionId: fixture.submissionId, challengeId: fixture.challengeId, entryId: fixture.entryId, manifest: fixture.manifest});
    assert.equal(replay.submission_id, fixture.submissionId);
    assert.equal((await db.selectFrom('outbox_jobs').selectAll().where('idempotency_key', '=', firstJob.idempotency_key).execute()).length, 1);
    assert.equal((await db.selectFrom('challenge_submission_archives').selectAll().where('submission_id', '=', fixture.submissionId).execute()).length, 1);

    const before = await db.selectFrom('challenge_submissions').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    const client = {capture: async (input) => {
      assert.equal(input.submissionId, fixture.submissionId);
      assert.equal(input.sourceReference, 'PRIVATE_SOURCE_BODY_MUST_NOT_LEAK');
      return {outcome: 'CAPTURED', archive_digest: 'b'.repeat(64), archive_reference: 'PRIVATE_ARCHIVE_LOCATION_SECRET'};
    }};
    assert.deepEqual((await runOneJob(db, {challengeSubmissionArchiveClient: client})).status, 'succeeded');
    const captured = await archiveState(db, fixture.submissionId);
    assert.equal(captured.status, 'CAPTURED');
    assert.equal(captured.archive_digest, 'b'.repeat(64));
    assert.equal(captured.archive_reference, 'PRIVATE_ARCHIVE_LOCATION_SECRET');
    const after = await db.selectFrom('challenge_submissions').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    assert.equal(after.manifest_digest, before.manifest_digest);
    assert.equal(after.accepted_at.getTime(), before.accepted_at.getTime());
    assert.deepEqual(after.manifest_json, before.manifest_json);
    const evidence = await db.selectFrom('history_events').selectAll().where('subject_id', '=', fixture.submissionId).where('event_family', '=', 'evidence').execute();
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].event_type, 'challenge.submission_archive.captured');
    assert.equal(JSON.stringify(evidence).includes('PRIVATE_SOURCE_BODY_MUST_NOT_LEAK'), false);
    assert.equal(JSON.stringify(evidence).includes('PRIVATE_ARCHIVE_LOCATION_SECRET'), false);
    const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600});
    registerStageEChallengeProductRoutes(app, db);
    try {
      const publicResponse = await app.inject({method: 'GET', url: `/v1/challenges/${fixture.challengeId}`});
      assert.equal(publicResponse.statusCode, 200);
      assert.equal(JSON.stringify(publicResponse.json()).includes('PRIVATE_SOURCE_BODY_MUST_NOT_LEAK'), false);
      assert.equal(JSON.stringify(publicResponse.json()).includes('PRIVATE_ARCHIVE_LOCATION_SECRET'), false);
    } finally { await app.close(); }
  } finally { await db.destroy(); }
});

test('F3A platform outage retries and exhausts without changing acceptance or builder truth', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await acceptedFixture(db);
    const job = await archiveJob(db, fixture.submissionId);
    await setMaxAttempts(db, job.job_id, 2);
    const client = {capture: async () => ({outcome: 'TRANSIENT_PLATFORM_UNAVAILABLE', reason_code: 'PLATFORM_TIMEOUT'})};
    assert.equal((await runOneJob(db, {retryBaseMs: 1, challengeSubmissionArchiveClient: client})).status, 'retry');
    assert.equal((await archiveState(db, fixture.submissionId)).status, 'PENDING');
    await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
    assert.equal((await runOneJob(db, {retryBaseMs: 1, challengeSubmissionArchiveClient: client})).status, 'succeeded');
    const state = await archiveState(db, fixture.submissionId);
    assert.equal(state.status, 'PLATFORM_UNAVAILABLE');
    assert.equal((await archiveJob(db, fixture.submissionId)).state, 'succeeded');
    const submission = await db.selectFrom('challenge_submissions').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    assert.deepEqual(submission.manifest_json, fixture.accepted.manifest_json);
    assert.equal(submission.accepted_at.getTime(), fixture.accepted.accepted_at.getTime());
    const entry = await db.selectFrom('challenge_entries').select('state').where('entry_id', '=', fixture.entryId).executeTakeFirstOrThrow();
    assert.equal(entry.state, 'ACTIVE');
    const event = await db.selectFrom('history_events').selectAll().where('subject_id', '=', fixture.submissionId).where('event_type', '=', 'challenge.submission_archive.unavailable').executeTakeFirstOrThrow();
    assert.equal(event.payload.truth_state, 'UNKNOWN');
    assert.equal(event.payload.availability_state, 'PLATFORM_UNAVAILABLE');
  } finally { await db.destroy(); }
});

test('F3A explicit builder revocation is separately represented and never rewrites acceptance', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await acceptedFixture(db);
    const before = await db.selectFrom('challenge_submissions').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    const job = await archiveJob(db, fixture.submissionId);
    await setMaxAttempts(db, job.job_id, 1);
    assert.equal((await runOneJob(db, {challengeSubmissionArchiveClient: {capture: async () => ({outcome: 'BUILDER_SOURCE_REVOKED_OR_DELETED', reason_code: 'TRUSTED_SOURCE_REVOKED'})}})).status, 'succeeded');
    const state = await archiveState(db, fixture.submissionId);
    assert.equal(state.status, 'BUILDER_CAUSED_UNAVAILABLE');
    assert.equal(state.reason_code, 'TRUSTED_SOURCE_REVOKED');
    const after = await db.selectFrom('challenge_submissions').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    assert.equal(after.manifest_digest, before.manifest_digest);
    assert.equal(after.accepted_at.getTime(), before.accepted_at.getTime());
    const event = await db.selectFrom('history_events').selectAll().where('subject_id', '=', fixture.submissionId).where('event_type', '=', 'challenge.submission_archive.unavailable').executeTakeFirstOrThrow();
    assert.equal(event.payload.truth_state, 'OBSERVED');
    assert.equal(event.payload.availability_state, 'BUILDER_CAUSED_UNAVAILABLE');
  } finally { await db.destroy(); }
});

test('F3A ambiguous absence and unsupported source fail closed without authoritative capture', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const ambiguous = await acceptedFixture(db);
    const ambiguousJob = await archiveJob(db, ambiguous.submissionId);
    await setMaxAttempts(db, ambiguousJob.job_id, 1);
    await runOneJob(db, {challengeSubmissionArchiveClient: {capture: async () => ({outcome: 'UNKNOWN_UNAVAILABLE', reason_code: 'AMBIGUOUS_ABSENCE'})}});
    assert.equal((await archiveState(db, ambiguous.submissionId)).status, 'PLATFORM_UNAVAILABLE');
    const unsupported = await acceptedFixture(db, 'SUBMODULE_OR_LFS_SOURCE');
    const unsupportedJob = await archiveJob(db, unsupported.submissionId);
    assert.equal((await runOneJob(db, {challengeSubmissionArchiveClient: {capture: async () => ({outcome: 'UNSUPPORTED_SOURCE', reason_code: 'SUBMODULE_OR_LFS_UNSUPPORTED'})}})).status, 'succeeded');
    const state = await archiveState(db, unsupported.submissionId);
    assert.equal(state.status, 'UNSUPPORTED_SOURCE');
    assert.equal(state.archive_digest, null);
    assert.equal((await archiveJob(db, unsupported.submissionId)).job_id, unsupportedJob.job_id);
  } finally { await db.destroy(); }
});

test('F3A final lease exhaustion terminalizes evidence availability without rewriting acceptance', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const fixture = await acceptedFixture(db);
    const before = await db.selectFrom('challenge_submissions').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    const job = await archiveJob(db, fixture.submissionId);
    await db.updateTable('outbox_jobs').set({
      state: 'running',
      attempts: 1,
      max_attempts: 1,
      locked_at: new Date(0),
      lock_token: randomUUID(),
      last_error: null,
      next_attempt_at: new Date(0),
    }).where('job_id', '=', job.job_id).execute();

    const run = await runOneJob(db, {leaseMs: 1_000});
    assert.equal(run.status, 'idle');

    const exhausted = await db.selectFrom('outbox_jobs').selectAll().where('job_id', '=', job.job_id).executeTakeFirstOrThrow();
    assert.equal(exhausted.state, 'failed');
    assert.equal(exhausted.last_error, 'worker_lease_expired_after_max_attempts');

    const state = await archiveState(db, fixture.submissionId);
    assert.equal(state.status, 'PLATFORM_UNAVAILABLE');
    assert.equal(state.reason_code, 'WORKER_LEASE_EXPIRED_AFTER_MAX_ATTEMPTS');
    assert.ok(state.observed_at instanceof Date);

    const after = await db.selectFrom('challenge_submissions').selectAll().where('submission_id', '=', fixture.submissionId).executeTakeFirstOrThrow();
    assert.equal(after.manifest_digest, before.manifest_digest);
    assert.equal(after.accepted_at.getTime(), before.accepted_at.getTime());
    assert.deepEqual(after.manifest_json, before.manifest_json);
    const entry = await db.selectFrom('challenge_entries').select('state').where('entry_id', '=', fixture.entryId).executeTakeFirstOrThrow();
    assert.equal(entry.state, 'ACTIVE');
  } finally { await db.destroy(); }
});
