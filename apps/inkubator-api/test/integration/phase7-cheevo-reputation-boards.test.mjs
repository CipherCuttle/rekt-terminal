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
  return {cookie: cookie(response), playerId: response.json().player.player_id, displayName: response.json().player.display_name};
}

async function reputation(app, playerId) {
  const response = await app.inject({method: 'GET', url: `/v1/players/${playerId}/reputation`});
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}

async function boards(app) {
  const response = await app.inject({method: 'GET', url: '/v1/world/boards'});
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
}

async function shipReadyMission(app, cookieValue, suffix) {
  const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie: cookieValue}});
  assert.equal(rounds.statusCode, 200);
  const round = rounds.json().find((row) => row.code === 'ROUND_01');
  assert.ok(round);
  const joined = await app.inject({method: 'POST', url: `/v1/rounds/${round.round_id}/join`, headers: {origin: appOrigin, cookie: cookieValue}});
  assert.equal(joined.statusCode, 200);

  const created = await app.inject({
    method: 'POST', url: '/v1/missions', headers: {origin: appOrigin, cookie: cookieValue},
    payload: {
      request_id: randomUUID(), round_id: round.round_id, project_name: `Phase 7 ${suffix}`,
      goal: 'Prove durable reputation from real shipped facts', ship_condition: 'Accepted by canonical Ship rule',
      current_focus: 'Build', next_move: 'Ship',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const missionId = created.json().mission.mission_id;
  const projectId = created.json().project.project_id;
  for (const state of ['BUILDING', 'SHIP_READY']) {
    const updated = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: {origin: appOrigin, cookie: cookieValue}, payload: {request_id: randomUUID(), state}});
    assert.equal(updated.statusCode, 200, updated.body);
  }
  return {missionId, projectId};
}

async function acceptedAssist(app, ownerCookie, helperCookie, projectId, label) {
  const beacon = await app.inject({
    method: 'POST', url: `/v1/projects/${projectId}/help-beacons`, headers: {origin: appOrigin, cookie: ownerCookie},
    payload: {request_id: randomUUID(), summary: `Need bounded help ${label}`},
  });
  assert.equal(beacon.statusCode, 201, beacon.body);
  const beaconId = beacon.json().beacon_id;
  const offered = await app.inject({
    method: 'POST', url: `/v1/help-beacons/${beaconId}/assists`, headers: {origin: appOrigin, cookie: helperCookie},
    payload: {request_id: randomUUID(), message: `Useful assist ${label}`},
  });
  assert.equal(offered.statusCode, 201, offered.body);
  const assistId = offered.json().assist_id;
  const accepted = await app.inject({
    method: 'POST', url: `/v1/assists/${assistId}/accept`, headers: {origin: appOrigin, cookie: ownerCookie},
    payload: {request_id: randomUUID()},
  });
  assert.equal(accepted.statusCode, 200, accepted.body);
  assert.equal(accepted.json().state, 'ACCEPTED');
  const closed = await app.inject({
    method: 'POST', url: `/v1/help-beacons/${beaconId}/close`, headers: {origin: appOrigin, cookie: ownerCookie},
    payload: {request_id: randomUUID()},
  });
  assert.equal(closed.statusCode, 200, closed.body);
  return assistId;
}

async function requestExternalTest(app, ownerCookie, projectId, label) {
  const response = await app.inject({
    method: 'POST', url: `/v1/projects/${projectId}/tester-requests`, headers: {origin: appOrigin, cookie: ownerCookie},
    payload: {request_id: randomUUID(), prompt: `Test ${label} before I trust it.`},
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json().test_request_id;
}

async function recordExternalTest(app, testerCookie, testRequestId, label) {
  const response = await app.inject({
    method: 'POST', url: `/v1/tester-requests/${testRequestId}/results`, headers: {origin: appOrigin, cookie: testerCookie},
    payload: {request_id: randomUUID(), outcome: 'PASS', summary: `Observed ${label}`},
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json().test_result_id;
}

async function runVerifier(db, submissionId) {
  const jobs = await db.selectFrom('outbox_jobs').selectAll().where('job_type', '=', SHIP_VERIFICATION_JOB_TYPE).execute();
  const job = jobs.find((row) => row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) && row.payload.submission_id === submissionId);
  assert.ok(job);
  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
  const result = await runOneJob(db, {shipVerifierClient: {verify: async ({submissionId: id, url}) => ({
    schema_version: 'ship-verifier.observation.v1', submission_id: id, outcome: 'PASS', reason_code: 'PUBLIC_HTTPS_OK',
    final_url: url, http_status: 200, duration_ms: 7, redirects: 0,
  })}});
  assert.equal(result.status, 'succeeded');
}

async function acceptShip(app, db, ownerCookie, missionId, suffix) {
  const submitted = await app.inject({
    method: 'POST', url: `/v1/missions/${missionId}/ship-submissions`, headers: {origin: appOrigin, cookie: ownerCookie},
    payload: {request_id: randomUUID(), title: `Artifact ${suffix}`, url: `https://example.com/${suffix}`},
  });
  assert.equal(submitted.statusCode, 201, submitted.body);
  const submissionId = submitted.json().submission_id;
  await runVerifier(db, submissionId);
  const accepted = await operatorReviewShipAcceptance(db, submissionId, {requestId: randomUUID(), decision: 'ACCEPT', reason: `bounded review ${suffix}`});
  assert.ok(accepted.accepted_receipt);
  return accepted.accepted_receipt;
}

function cheevoKeys(view) {
  return new Set(view.cheevos.map((cheevo) => cheevo.key));
}

function board(view, key) {
  const found = view.boards.find((candidate) => candidate.key === key);
  assert.ok(found);
  return found;
}

test('Phase 7 derives Cheevos and contextual boards from shipped authority without engagement farming', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const owner = await session(app, `Owner7 ${randomUUID().slice(0, 6)}`);
    const helper = await session(app, `Helper7 ${randomUUID().slice(0, 6)}`);
    const tester = await session(app, `Tester7 ${randomUUID().slice(0, 6)}`);
    const quiet = await session(app, `Quiet7 ${randomUUID().slice(0, 6)}`);

    const quietView = await reputation(app, quiet.playerId);
    assert.deepEqual(quietView.metrics, {ships: 0, shipped_assists: 0, shipped_projects_assisted: 0, collaborative_ships: 0, tested_shipped_projects: 0});
    assert.deepEqual(quietView.cheevos, []);

    const first = await shipReadyMission(app, owner.cookie, `first-${randomUUID().slice(0, 6)}`);
    const assistOne = await acceptedAssist(app, owner.cookie, helper.cookie, first.projectId, 'one');
    const assistTwo = await acceptedAssist(app, owner.cookie, helper.cookie, first.projectId, 'two');
    assert.notEqual(assistOne, assistTwo);
    const firstTestRequest = await requestExternalTest(app, owner.cookie, first.projectId, 'first project');
    await recordExternalTest(app, tester.cookie, firstTestRequest, 'before first Ship');

    const helperBeforeShip = await reputation(app, helper.playerId);
    assert.equal(helperBeforeShip.metrics.shipped_assists, 0);
    assert.equal(helperBeforeShip.metrics.shipped_projects_assisted, 0);
    assert.equal(cheevoKeys(helperBeforeShip).has('ACTUALLY_HELPFUL'), false);
    const testerBeforeShip = await reputation(app, tester.playerId);
    assert.equal(testerBeforeShip.metrics.tested_shipped_projects, 0);

    await acceptShip(app, db, owner.cookie, first.missionId, `first-${randomUUID().slice(0, 6)}`);

    const ownerAfterFirst = await reputation(app, owner.playerId);
    assert.equal(ownerAfterFirst.metrics.ships, 1);
    assert.equal(ownerAfterFirst.metrics.collaborative_ships, 1);
    assert.equal(cheevoKeys(ownerAfterFirst).has('WORKING_URL_OR_GTFO'), true);
    assert.equal(cheevoKeys(ownerAfterFirst).has('PARTY_UP'), true);
    assert.equal(cheevoKeys(ownerAfterFirst).has('TOUCH_GRASS'), true);
    assert.equal(cheevoKeys(ownerAfterFirst).has('REPEAT_OFFENDER'), false);

    const helperAfterFirst = await reputation(app, helper.playerId);
    assert.equal(helperAfterFirst.metrics.shipped_assists, 2);
    assert.equal(helperAfterFirst.metrics.shipped_projects_assisted, 1);
    assert.equal(cheevoKeys(helperAfterFirst).has('ACTUALLY_HELPFUL'), true);
    assert.equal(cheevoKeys(helperAfterFirst).has('SHIPMATE'), false);

    const testerAfterFirst = await reputation(app, tester.playerId);
    assert.equal(testerAfterFirst.metrics.tested_shipped_projects, 1);

    const boardsAfterFirst = await boards(app);
    const assistBoardAfterFirst = board(boardsAfterFirst, 'ASSISTS');
    const helperAssistRowAfterFirst = assistBoardAfterFirst.rows.find((row) => row.player_id === helper.playerId);
    assert.ok(helperAssistRowAfterFirst);
    assert.equal(helperAssistRowAfterFirst.metric_count, 1, 'two Assists on one shipped Project must rank as one assisted Project');

    const second = await shipReadyMission(app, owner.cookie, `second-${randomUUID().slice(0, 6)}`);
    await acceptedAssist(app, owner.cookie, helper.cookie, second.projectId, 'three');
    const lateTestRequest = await requestExternalTest(app, owner.cookie, second.projectId, 'second project');
    await acceptShip(app, db, owner.cookie, second.missionId, `second-${randomUUID().slice(0, 6)}`);

    const ownerAfterSecond = await reputation(app, owner.playerId);
    assert.equal(ownerAfterSecond.metrics.ships, 2);
    assert.equal(cheevoKeys(ownerAfterSecond).has('REPEAT_OFFENDER'), true);

    const helperAfterSecond = await reputation(app, helper.playerId);
    assert.equal(helperAfterSecond.metrics.shipped_assists, 3);
    assert.equal(helperAfterSecond.metrics.shipped_projects_assisted, 2);
    assert.equal(cheevoKeys(helperAfterSecond).has('SHIPMATE'), true);

    const boardsAfterSecond = await boards(app);
    const helperAssistRowAfterSecond = board(boardsAfterSecond, 'ASSISTS').rows.find((row) => row.player_id === helper.playerId);
    assert.ok(helperAssistRowAfterSecond);
    assert.equal(helperAssistRowAfterSecond.metric_count, 2);

    await recordExternalTest(app, tester.cookie, lateTestRequest, 'after second Ship');
    const testerAfterLateResult = await reputation(app, tester.playerId);
    assert.equal(testerAfterLateResult.metrics.tested_shipped_projects, 1, 'post-Ship testing must not rewrite historical reputation');
    assert.equal(cheevoKeys(testerAfterLateResult).has('TEST_PILOT'), false);

    const ownerAwards = await db.selectFrom('player_cheevos').selectAll().where('player_id', '=', owner.playerId).execute();
    assert.ok(ownerAwards.length >= 2);
    const immutableAward = ownerAwards.find((row) => row.cheevo_key === 'WORKING_URL_OR_GTFO') ?? ownerAwards[0];
    await assert.rejects(
      db.updateTable('player_cheevos').set({source_id: randomUUID()}).where('award_id', '=', immutableAward.award_id).execute(),
      /player_cheevo_immutable/,
    );
    await assert.rejects(
      db.deleteFrom('player_cheevos').where('award_id', '=', immutableAward.award_id).execute(),
      /player_cheevo_immutable/,
    );

    const beforeReplayCount = (await db.selectFrom('player_cheevos').selectAll().where('player_id', '=', owner.playerId).execute()).length;
    await reputation(app, owner.playerId);
    const afterReplayCount = (await db.selectFrom('player_cheevos').selectAll().where('player_id', '=', owner.playerId).execute()).length;
    assert.equal(afterReplayCount, beforeReplayCount, 'reconciliation must be idempotent');
  } finally {
    await app.close();
    // Synthetic Cheevo rows are deliberately immutable to ordinary DELETE/UPDATE. Test isolation
    // uses TRUNCATE so this file cannot poison the repository-wide shared Postgres fixture.
    await sql`truncate table player_cheevos`.execute(db);
    await db.destroy();
  }
});
