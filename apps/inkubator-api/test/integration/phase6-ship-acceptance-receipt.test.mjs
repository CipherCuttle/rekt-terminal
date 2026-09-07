import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {runOneJob, SHIP_VERIFICATION_JOB_TYPE} from '../../dist/jobs.js';
import {operatorReviewShipAcceptance, reconcileShipAcceptances} from '../../dist/ship-acceptance.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL required');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';

function cookie(response) {
  const value = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'][0] : response.headers['set-cookie'];
  assert.ok(value);
  return value.split(';')[0];
}

async function session(app, name) {
  const response = await app.inject({method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: name}});
  assert.equal(response.statusCode, 201);
  return {cookie: cookie(response), playerId: response.json().player.player_id};
}

async function shipReadyMission(app, cookieValue, suffix) {
  const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie: cookieValue}});
  const round = rounds.json().find((row) => row.code === 'ROUND_01');
  assert.ok(round);
  const joined = await app.inject({method: 'POST', url: `/v1/rounds/${round.round_id}/join`, headers: {origin: appOrigin, cookie: cookieValue}});
  assert.equal(joined.statusCode, 200);
  const created = await app.inject({
    method: 'POST', url: '/v1/missions', headers: {origin: appOrigin, cookie: cookieValue},
    payload: {request_id: randomUUID(), round_id: round.round_id, project_name: `Ship Acceptance ${suffix}`, goal: 'Ship safely', ship_condition: 'Accepted by bounded rule', current_focus: 'Prepare', next_move: 'Submit'},
  });
  assert.equal(created.statusCode, 201);
  const missionId = created.json().mission.mission_id;
  const projectId = created.json().project.project_id;
  for (const state of ['BUILDING', 'SHIP_READY']) {
    const updated = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: {origin: appOrigin, cookie: cookieValue}, payload: {request_id: randomUUID(), state}});
    assert.equal(updated.statusCode, 200);
  }
  return {missionId, projectId};
}

async function submit(app, cookieValue, missionId, suffix, sourceUrl = undefined) {
  const response = await app.inject({
    method: 'POST', url: `/v1/missions/${missionId}/ship-submissions`, headers: {origin: appOrigin, cookie: cookieValue},
    payload: {request_id: randomUUID(), title: `Artifact ${suffix}`, url: `https://example.com/${suffix}`, demo_url: `https://example.com/${suffix}/demo`, ...(sourceUrl ? {source_url: sourceUrl} : {})},
  });
  assert.equal(response.statusCode, 201);
  return response.json().submission_id;
}

async function runVerifier(db, submissionId, outcome = 'PASS') {
  const jobs = await db.selectFrom('outbox_jobs').selectAll().where('job_type', '=', SHIP_VERIFICATION_JOB_TYPE).execute();
  const job = jobs.find((row) => row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) && row.payload.submission_id === submissionId);
  assert.ok(job);
  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
  const client = {
    verify: async ({submissionId: id, url}) => ({
      schema_version: 'ship-verifier.observation.v1', submission_id: id, outcome,
      reason_code: outcome === 'PASS' ? 'PUBLIC_HTTPS_OK' : outcome === 'FAILED' ? 'HTTP_STATUS' : 'NETWORK_ERROR',
      final_url: url, http_status: outcome === 'UNAVAILABLE' ? undefined : outcome === 'PASS' ? 200 : 503,
      duration_ms: 17, redirects: 0,
    }),
  };
  const result = await runOneJob(db, {shipVerifierClient: client});
  assert.equal(result.status, 'succeeded');
}

async function state(db, missionId, submissionId) {
  const mission = await db.selectFrom('missions').select('state').where('mission_id', '=', missionId).executeTakeFirstOrThrow();
  const submission = await db.selectFrom('ship_submissions').select('state').where('submission_id', '=', submissionId).executeTakeFirstOrThrow();
  const receipts = await db.selectFrom('ship_receipts').selectAll().where('submission_id', '=', submissionId).execute();
  const proven = await db.selectFrom('history_events').selectAll().where('event_type', '=', 'project.ship.accepted').where('dedupe_key', '=', `evidence:project.ship.accepted:${submissionId}`).execute();
  return {mission: mission.state, submission: submission.state, receipts, proven};
}

test('Phase 6B PASS alone cannot Ship; trusted ACCEPT issues one PROVEN canonical receipt idempotently', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const alice = await session(app, `Alice A ${randomUUID().slice(0, 5)}`);
    const bob = await session(app, `Bob A ${randomUUID().slice(0, 5)}`);
    const mission = await shipReadyMission(app, alice.cookie, randomUUID().slice(0, 6));
    const privateSource = `https://example.com/private-source-${randomUUID()}`;
    const submissionId = await submit(app, alice.cookie, mission.missionId, 'pass-accept', privateSource);

    const ownerDenied = await app.inject({method: 'POST', url: `/v1/ops/ship-submissions/${submissionId}/accept`, headers: {origin: appOrigin, cookie: alice.cookie}, payload: {request_id: randomUUID()}});
    const randomPlayerDenied = await app.inject({method: 'POST', url: `/v1/ops/ship-submissions/${submissionId}/accept`, headers: {origin: appOrigin, cookie: bob.cookie}, payload: {request_id: randomUUID()}});
    assert.equal(ownerDenied.statusCode, 404);
    assert.equal(randomPlayerDenied.statusCode, 404);

    await runVerifier(db, submissionId, 'PASS');
    let current = await state(db, mission.missionId, submissionId);
    assert.equal(current.mission, 'SUBMITTED');
    assert.equal(current.submission, 'OBSERVED');
    assert.equal(current.receipts.length, 0);
    assert.equal(current.proven.length, 0);

    const requestId = randomUUID();
    const accepted = await operatorReviewShipAcceptance(db, submissionId, {requestId, decision: 'ACCEPT', reason: 'Artifact matches the bounded founding-cohort Ship condition.'});
    assert.ok(accepted.accepted_receipt);
    const receiptId = accepted.accepted_receipt.receipt_id;
    assert.equal(accepted.review.truth_state, 'OBSERVED');
    assert.equal(accepted.accepted_receipt.truth_state, 'PROVEN');
    assert.equal(accepted.accepted_receipt.schema_version, 'inkubator.ship-receipt/1.0');
    assert.equal(accepted.accepted_receipt.acceptance_rule_version, 'ship.acceptance.v1');
    assert.equal(JSON.stringify(accepted.accepted_receipt).includes(privateSource), false);
    assert.equal(JSON.stringify(accepted.accepted_receipt).includes('source_url'), false);

    current = await state(db, mission.missionId, submissionId);
    assert.equal(current.mission, 'SHIPPED');
    assert.equal(current.submission, 'ACCEPTED');
    assert.equal(current.receipts.length, 1);
    assert.equal(current.receipts[0].receipt_id, receiptId);
    assert.equal(current.proven.length, 1);
    assert.equal(current.proven[0].payload.truth_state, 'PROVEN');
    assert.equal(current.proven[0].payload.acceptance_rule_version, 'ship.acceptance.v1');

    const reviewEvents = await db.selectFrom('history_events').selectAll().where('event_type', '=', 'ops.project_ship_acceptance_review.observed').where('subject_id', '=', mission.projectId).execute();
    const reviewEvent = reviewEvents.find((event) => event.payload?.submission_id === submissionId);
    assert.ok(reviewEvent);
    assert.equal(reviewEvent.payload.truth_state, 'OBSERVED');

    const gates = await db.selectFrom('mission_gates').selectAll().where('mission_id', '=', mission.missionId).execute();
    assert.equal(gates.every((gate) => gate.signal_state === 'UNKNOWN'), true);

    const replay = await operatorReviewShipAcceptance(db, submissionId, {requestId, decision: 'ACCEPT', reason: 'Artifact matches the bounded founding-cohort Ship condition.'});
    assert.equal(replay.accepted_receipt.receipt_id, receiptId);
    await assert.rejects(
      operatorReviewShipAcceptance(db, submissionId, {requestId, decision: 'ACCEPT', reason: 'Changed payload.'}),
      /ship_acceptance_review_idempotency_conflict/,
    );
    await assert.rejects(
      operatorReviewShipAcceptance(db, submissionId, {requestId: randomUUID(), decision: 'ACCEPT', reason: 'Second operator mutation.'}),
      /ship_acceptance_review_exists/,
    );
    current = await state(db, mission.missionId, submissionId);
    assert.equal(current.receipts.length, 1);
    assert.equal(current.proven.length, 1);
  } finally {
    await app.close();
    await db.destroy();
  }
});

test('Phase 6B ACCEPT before verifier PASS converges through trusted server reconciliation', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const alice = await session(app, `Alice B ${randomUUID().slice(0, 5)}`);
    const mission = await shipReadyMission(app, alice.cookie, randomUUID().slice(0, 6));
    const submissionId = await submit(app, alice.cookie, mission.missionId, 'accept-pass');
    const reviewed = await operatorReviewShipAcceptance(db, submissionId, {requestId: randomUUID(), decision: 'ACCEPT', reason: 'Trusted review is ready before URL observation.'});
    assert.equal(reviewed.review.truth_state, 'OBSERVED');
    assert.equal(reviewed.accepted_receipt, undefined);
    let current = await state(db, mission.missionId, submissionId);
    assert.equal(current.mission, 'SUBMITTED');
    assert.equal(current.receipts.length, 0);

    await runVerifier(db, submissionId, 'PASS');
    current = await state(db, mission.missionId, submissionId);
    assert.equal(current.mission, 'SUBMITTED');
    assert.equal(current.submission, 'OBSERVED');
    assert.equal(current.receipts.length, 0);

    const reconciled = await reconcileShipAcceptances(db);
    assert.equal(reconciled.accepted >= 1, true);
    current = await state(db, mission.missionId, submissionId);
    assert.equal(current.mission, 'SHIPPED');
    assert.equal(current.submission, 'ACCEPTED');
    assert.equal(current.receipts.length, 1);
    assert.equal(current.proven.length, 1);
  } finally {
    await app.close();
    await db.destroy();
  }
});

test('Phase 6B REJECT and failed verifier evidence never mint PROVEN', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const alice = await session(app, `Alice C ${randomUUID().slice(0, 5)}`);

    const rejectedMission = await shipReadyMission(app, alice.cookie, randomUUID().slice(0, 6));
    const rejectedSubmission = await submit(app, alice.cookie, rejectedMission.missionId, 'reject-pass');
    await operatorReviewShipAcceptance(db, rejectedSubmission, {requestId: randomUUID(), decision: 'REJECT', reason: 'Artifact does not satisfy the Ship condition.'});
    let rejected = await state(db, rejectedMission.missionId, rejectedSubmission);
    assert.equal(rejected.mission, 'SUBMITTED');
    assert.equal(rejected.receipts.length, 0);
    await runVerifier(db, rejectedSubmission, 'PASS');
    await reconcileShipAcceptances(db);
    rejected = await state(db, rejectedMission.missionId, rejectedSubmission);
    assert.equal(rejected.mission, 'SHIP_READY');
    assert.equal(rejected.submission, 'REJECTED');
    assert.equal(rejected.receipts.length, 0);
    assert.equal(rejected.proven.length, 0);

    const failedMission = await shipReadyMission(app, alice.cookie, randomUUID().slice(0, 6));
    const failedSubmission = await submit(app, alice.cookie, failedMission.missionId, 'failed-accept');
    await runVerifier(db, failedSubmission, 'FAILED');
    const failedReview = await operatorReviewShipAcceptance(db, failedSubmission, {requestId: randomUUID(), decision: 'ACCEPT', reason: 'Human review accepts, but verifier evidence does not.'});
    assert.equal(failedReview.accepted_receipt, undefined);
    const failed = await state(db, failedMission.missionId, failedSubmission);
    assert.equal(failed.mission, 'SHIP_READY');
    assert.equal(failed.submission, 'REJECTED');
    assert.equal(failed.receipts.length, 0);
    assert.equal(failed.proven.length, 0);
  } finally {
    await app.close();
    await db.destroy();
  }
});

test('Phase 6B concurrent trusted acceptance attempts cannot create duplicate receipts', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const alice = await session(app, `Alice D ${randomUUID().slice(0, 5)}`);
    const mission = await shipReadyMission(app, alice.cookie, randomUUID().slice(0, 6));
    const submissionId = await submit(app, alice.cookie, mission.missionId, 'race');
    await runVerifier(db, submissionId, 'PASS');

    const attempts = await Promise.allSettled([
      operatorReviewShipAcceptance(db, submissionId, {requestId: randomUUID(), decision: 'ACCEPT', reason: 'Concurrent review A.'}),
      operatorReviewShipAcceptance(db, submissionId, {requestId: randomUUID(), decision: 'ACCEPT', reason: 'Concurrent review B.'}),
    ]);
    assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1);
    const current = await state(db, mission.missionId, submissionId);
    assert.equal(current.mission, 'SHIPPED');
    assert.equal(current.submission, 'ACCEPTED');
    assert.equal(current.receipts.length, 1);
    assert.equal(current.proven.length, 1);
    const reviews = await db.selectFrom('ship_acceptance_reviews').selectAll().where('submission_id', '=', submissionId).execute();
    assert.equal(reviews.length, 1);
  } finally {
    await app.close();
    await db.destroy();
  }
});
