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

async function createSession(app, name) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/dev/session',
    headers: {origin: appOrigin},
    payload: {display_name: name},
  });
  assert.equal(response.statusCode, 201, response.body);
  return {cookie: cookie(response), playerId: response.json().player.player_id};
}

async function createShipReadyMission(app, cookieValue) {
  const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie: cookieValue}});
  assert.equal(rounds.statusCode, 200, rounds.body);
  const round = rounds.json().find((row) => row.code === 'ROUND_01');
  assert.ok(round);
  const joined = await app.inject({
    method: 'POST',
    url: `/v1/rounds/${round.round_id}/join`,
    headers: {origin: appOrigin, cookie: cookieValue},
  });
  assert.equal(joined.statusCode, 200, joined.body);

  const created = await app.inject({
    method: 'POST',
    url: '/v1/missions',
    headers: {origin: appOrigin, cookie: cookieValue},
    payload: {
      request_id: randomUUID(),
      round_id: round.round_id,
      project_name: `H5 reconcile ${randomUUID().slice(0, 8)}`,
      goal: 'Prove cross-instance reconciliation serialization',
      ship_condition: 'One authoritative Ship receipt under concurrent reconcilers',
      current_focus: 'Reconciliation concurrency',
      next_move: 'Submit',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const missionId = created.json().mission.mission_id;
  const projectId = created.json().project.project_id;

  for (const state of ['BUILDING', 'SHIP_READY']) {
    const updated = await app.inject({
      method: 'PATCH',
      url: `/v1/missions/${missionId}`,
      headers: {origin: appOrigin, cookie: cookieValue},
      payload: {request_id: randomUUID(), state},
    });
    assert.equal(updated.statusCode, 200, updated.body);
  }
  return {missionId, projectId};
}

async function submit(app, cookieValue, missionId) {
  const response = await app.inject({
    method: 'POST',
    url: `/v1/missions/${missionId}/ship-submissions`,
    headers: {origin: appOrigin, cookie: cookieValue},
    payload: {
      request_id: randomUUID(),
      title: 'H5 reconciliation artifact',
      url: `https://example.com/h5-reconcile-${randomUUID()}`,
      demo_url: `https://example.com/h5-reconcile-${randomUUID()}/demo`,
    },
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json().submission_id;
}

async function runPassingVerifier(db, submissionId) {
  const jobs = await db.selectFrom('outbox_jobs').selectAll().where('job_type', '=', SHIP_VERIFICATION_JOB_TYPE).execute();
  const job = jobs.find((row) => row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) && row.payload.submission_id === submissionId);
  assert.ok(job, 'ship verification job must exist');
  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
  const result = await runOneJob(db, {
    shipVerifierClient: {
      verify: async ({submissionId: id, url}) => ({
        schema_version: 'ship-verifier.observation.v1',
        submission_id: id,
        outcome: 'PASS',
        reason_code: 'PUBLIC_HTTPS_OK',
        final_url: url,
        http_status: 200,
        duration_ms: 11,
        redirects: 0,
      }),
    },
  });
  assert.equal(result.status, 'succeeded');
}

test('H5 two independent DB pools reconcile the same accepted Ship exactly once', async () => {
  const dbA = createDatabase(databaseUrl);
  const dbB = createDatabase(databaseUrl);
  await migrateToLatest(dbA);
  const app = buildApp({db: dbA, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const alice = await createSession(app, `H5 reconcile ${randomUUID().slice(0, 6)}`);
    const mission = await createShipReadyMission(app, alice.cookie);
    const submissionId = await submit(app, alice.cookie, mission.missionId);

    const reviewed = await operatorReviewShipAcceptance(dbA, submissionId, {
      requestId: randomUUID(),
      decision: 'ACCEPT',
      reason: 'Trusted review is ready before verifier observation.',
    });
    assert.equal(reviewed.accepted_receipt, undefined);
    await runPassingVerifier(dbA, submissionId);

    const before = await dbA.selectFrom('ship_receipts').selectAll().where('submission_id', '=', submissionId).execute();
    assert.equal(before.length, 0);

    const results = await Promise.all([
      reconcileShipAcceptances(dbA),
      reconcileShipAcceptances(dbB),
    ]);
    assert.equal(results.every((result) => result.examined >= 1), true);

    const submission = await dbA.selectFrom('ship_submissions').select('state').where('submission_id', '=', submissionId).executeTakeFirstOrThrow();
    const missionRow = await dbA.selectFrom('missions').select('state').where('mission_id', '=', mission.missionId).executeTakeFirstOrThrow();
    assert.equal(submission.state, 'ACCEPTED');
    assert.equal(missionRow.state, 'SHIPPED');

    const receipts = await dbA.selectFrom('ship_receipts').selectAll().where('submission_id', '=', submissionId).execute();
    assert.equal(receipts.length, 1);

    const acceptedHistory = await dbA.selectFrom('history_events')
      .selectAll()
      .where('event_type', '=', 'project.ship.accepted')
      .where('dedupe_key', '=', `evidence:project.ship.accepted:${submissionId}`)
      .execute();
    assert.equal(acceptedHistory.length, 1);

    const attributions = await dbA.selectFrom('ship_receipt_attributions')
      .selectAll()
      .where('receipt_id', '=', receipts[0].receipt_id)
      .execute();
    assert.equal(attributions.length, 1);
    assert.equal(attributions[0].player_id, alice.playerId);
    assert.equal(attributions[0].role, 'OWNER');
  } finally {
    await app.close();
    await Promise.all([dbA.destroy(), dbB.destroy()]);
  }
});