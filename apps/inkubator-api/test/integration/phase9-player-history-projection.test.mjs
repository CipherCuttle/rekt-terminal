import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {runOneJob, SHIP_VERIFICATION_JOB_TYPE} from '../../dist/jobs.js';
import {operatorReviewShipAcceptance} from '../../dist/ship-acceptance.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';

function cookieFrom(response) {
  const value = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'][0] : response.headers['set-cookie'];
  assert.ok(value);
  return value.split(';')[0];
}

async function session(app, label) {
  const response = await app.inject({
    method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: `${label} ${randomUUID().slice(0, 6)}`},
  });
  assert.equal(response.statusCode, 201, response.body);
  return {cookie: cookieFrom(response), playerId: response.json().player.player_id};
}

async function createMission(app, cookie) {
  const headers = {origin: appOrigin, cookie};
  const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie}});
  assert.equal(rounds.statusCode, 200, rounds.body);
  const founding = rounds.json().find((round) => round.code === 'ROUND_01');
  assert.ok(founding);
  assert.equal((await app.inject({method: 'POST', url: `/v1/rounds/${founding.round_id}/join`, headers})).statusCode, 200);
  const created = await app.inject({
    method: 'POST', url: '/v1/missions', headers,
    payload: {
      request_id: randomUUID(), round_id: founding.round_id, project_name: `P9 Player History ${randomUUID().slice(0, 6)}`,
      goal: 'Prove one canonical Player save-file projection', ship_condition: 'Accepted public artifact',
      current_focus: 'Exercise history projection', next_move: 'Build',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  return {headers, missionId: created.json().mission.mission_id, projectId: created.json().project.project_id};
}

async function updateMission(app, headers, missionId, state, extra = {}) {
  const response = await app.inject({
    method: 'PATCH', url: `/v1/missions/${missionId}`, headers,
    payload: {request_id: randomUUID(), state, ...extra},
  });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}

async function runVerifier(db, submissionId) {
  const jobs = await db.selectFrom('outbox_jobs').selectAll().where('job_type', '=', SHIP_VERIFICATION_JOB_TYPE).execute();
  const job = jobs.find((row) => row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) && row.payload.submission_id === submissionId);
  assert.ok(job);
  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
  const result = await runOneJob(db, {shipVerifierClient: {verify: async ({submissionId: id, url}) => ({
    schema_version: 'ship-verifier.observation.v1', submission_id: id, outcome: 'PASS', reason_code: 'PUBLIC_HTTPS_OK',
    final_url: url, http_status: 200, duration_ms: 5, redirects: 0,
  })}});
  assert.equal(result.status, 'succeeded');
}

function entry(history, kind) {
  return history.entries.find((item) => item.kind === kind);
}

test('Phase 9 PLAYER history is authenticated, canonical, truth-labelled and raw-payload-free', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});

  try {
    const owner = await session(app, 'History Owner');
    const helper = await session(app, 'History Helper');
    const tester = await session(app, 'History Tester');
    const mission = await createMission(app, owner.cookie);

    await updateMission(app, mission.headers, mission.missionId, 'BUILDING');
    await updateMission(app, mission.headers, mission.missionId, 'BLOCKED', {blocker: 'NO_HISTORY_BLOCKER_DETAIL'});
    await updateMission(app, mission.headers, mission.missionId, 'BUILDING', {blocker: null});

    const beacon = await app.inject({
      method: 'POST', url: `/v1/projects/${mission.projectId}/help-beacons`, headers: mission.headers,
      payload: {request_id: randomUUID(), summary: 'Need one bounded helper'},
    });
    assert.equal(beacon.statusCode, 201, beacon.body);
    const offered = await app.inject({
      method: 'POST', url: `/v1/help-beacons/${beacon.json().beacon_id}/assists`,
      headers: {origin: appOrigin, cookie: helper.cookie},
      payload: {request_id: randomUUID(), message: 'NO_HISTORY_ASSIST_MESSAGE'},
    });
    assert.equal(offered.statusCode, 201, offered.body);
    const assistId = offered.json().assist_id;
    assert.equal((await app.inject({
      method: 'POST', url: `/v1/assists/${assistId}/accept`, headers: mission.headers,
      payload: {request_id: randomUUID()},
    })).statusCode, 200);

    const testRequest = await app.inject({
      method: 'POST', url: `/v1/projects/${mission.projectId}/tester-requests`, headers: mission.headers,
      payload: {request_id: randomUUID(), prompt: 'Check the bounded artifact'},
    });
    assert.equal(testRequest.statusCode, 201, testRequest.body);
    const testResult = await app.inject({
      method: 'POST', url: `/v1/tester-requests/${testRequest.json().test_request_id}/results`,
      headers: {origin: appOrigin, cookie: tester.cookie},
      payload: {request_id: randomUUID(), outcome: 'PASS', summary: 'NO_HISTORY_TEST_SUMMARY'},
    });
    assert.equal(testResult.statusCode, 201, testResult.body);

    await updateMission(app, mission.headers, mission.missionId, 'SHIP_READY');
    const submitted = await app.inject({
      method: 'POST', url: `/v1/missions/${mission.missionId}/ship-submissions`, headers: mission.headers,
      payload: {request_id: randomUUID(), title: 'History-safe artifact', url: 'https://example.com/player-history'},
    });
    assert.equal(submitted.statusCode, 201, submitted.body);
    const submissionId = submitted.json().submission_id;
    await runVerifier(db, submissionId);
    const reviewed = await operatorReviewShipAcceptance(db, submissionId, {
      requestId: randomUUID(), decision: 'ACCEPT', reason: 'Bounded Phase 9 history projection rehearsal.',
    });
    assert.ok(reviewed.accepted_receipt);

    for (const playerId of [owner.playerId, helper.playerId, tester.playerId]) {
      const reputation = await app.inject({method: 'GET', url: `/v1/players/${playerId}/reputation`});
      assert.equal(reputation.statusCode, 200, reputation.body);
    }

    const unauthenticated = await app.inject({method: 'GET', url: '/v1/me/history'});
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(unauthenticated.json().error, 'authentication_required');

    const ownerResponse = await app.inject({method: 'GET', url: '/v1/me/history', headers: {cookie: owner.cookie}});
    assert.equal(ownerResponse.statusCode, 200, ownerResponse.body);
    assert.equal(ownerResponse.headers['cache-control'], 'no-store');
    const ownerHistory = ownerResponse.json();
    assert.equal(ownerHistory.schema_version, 'player.history.private.v1');
    assert.equal(ownerHistory.player_id, owner.playerId);
    assert.equal(entry(ownerHistory, 'MISSION_BLOCKED').truth_state, 'CLAIMED');
    assert.equal(entry(ownerHistory, 'MISSION_RECOVERED').truth_state, 'CLAIMED');
    assert.equal(entry(ownerHistory, 'SHIP_ACCEPTED').truth_state, 'PROVEN');
    assert.equal(entry(ownerHistory, 'SHIP_ACCEPTED').role, 'OWNER');
    assert.ok(entry(ownerHistory, 'CHEEVO_AWARDED'));

    const helperResponse = await app.inject({method: 'GET', url: '/v1/me/history', headers: {cookie: helper.cookie}});
    assert.equal(helperResponse.statusCode, 200, helperResponse.body);
    const helperHistory = helperResponse.json();
    assert.equal(helperHistory.player_id, helper.playerId);
    assert.equal(entry(helperHistory, 'ASSIST_ACCEPTED').truth_state, 'OBSERVED');
    assert.equal(entry(helperHistory, 'ASSIST_ACCEPTED').assist_id, assistId);
    assert.equal(entry(helperHistory, 'SHIP_ACCEPTED').truth_state, 'PROVEN');
    assert.equal(entry(helperHistory, 'SHIP_ACCEPTED').role, 'PARTY');

    const testerResponse = await app.inject({method: 'GET', url: '/v1/me/history', headers: {cookie: tester.cookie}});
    assert.equal(testerResponse.statusCode, 200, testerResponse.body);
    const testerHistory = testerResponse.json();
    assert.equal(testerHistory.player_id, tester.playerId);
    assert.equal(entry(testerHistory, 'EXTERNAL_TEST_RECORDED').truth_state, 'OBSERVED');
    assert.equal(entry(testerHistory, 'EXTERNAL_TEST_RECORDED').outcome, 'PASS');

    for (const history of [ownerHistory, helperHistory, testerHistory]) {
      const serialized = JSON.stringify(history);
      assert.equal(serialized.includes('NO_HISTORY_BLOCKER_DETAIL'), false);
      assert.equal(serialized.includes('NO_HISTORY_ASSIST_MESSAGE'), false);
      assert.equal(serialized.includes('NO_HISTORY_TEST_SUMMARY'), false);
      assert.equal(serialized.includes('repository_id'), false);
      assert.equal(serialized.includes('acceptance_review_id'), false);
    }

    const openapi = await app.inject({method: 'GET', url: '/openapi.json'});
    assert.equal(openapi.statusCode, 200);
    assert.equal(openapi.json().paths['/v1/me/history'].get.operationId, 'getMyHistory');
    assert.equal(openapi.json().paths['/v1/players/{playerId}/reputation'].get.operationId, 'getPlayerReputation');
  } finally {
    await app.close();
    // Player Cheevos are deliberately immutable to normal DELETE/UPDATE. Test-only
    // TRUNCATE follows the Phase-7 fixture-isolation pattern so this focused proof
    // cannot poison the shared Postgres instance used by the full regression suite.
    await sql`truncate table player_cheevos`.execute(db);
    await db.destroy();
  }
});
