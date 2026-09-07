import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
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

async function shipReadyMission(app, cookieValue, suffix) {
  const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie: cookieValue}});
  const round = rounds.json().find((row) => row.code === 'ROUND_01');
  assert.ok(round);
  assert.equal((await app.inject({method: 'POST', url: `/v1/rounds/${round.round_id}/join`, headers: {origin: appOrigin, cookie: cookieValue}})).statusCode, 200);
  const created = await app.inject({
    method: 'POST', url: '/v1/missions', headers: {origin: appOrigin, cookie: cookieValue},
    payload: {request_id: randomUUID(), round_id: round.round_id, project_name: `Artifact Attribution ${suffix}`, goal: 'Ship with immutable credit', ship_condition: 'Accepted by bounded Ship rule', current_focus: 'Prepare', next_move: 'Submit'},
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

async function createBeacon(app, ownerCookie, projectId) {
  const response = await app.inject({
    method: 'POST', url: `/v1/projects/${projectId}/help-beacons`, headers: {origin: appOrigin, cookie: ownerCookie},
    payload: {request_id: randomUUID(), summary: 'Need one bounded assist before Ship.'},
  });
  assert.equal(response.statusCode, 201);
  return response.json().beacon_id;
}

async function offerAssist(app, helperCookie, beaconId, label) {
  const response = await app.inject({
    method: 'POST', url: `/v1/help-beacons/${beaconId}/assists`, headers: {origin: appOrigin, cookie: helperCookie},
    payload: {request_id: randomUUID(), message: `Assist ${label}`},
  });
  assert.equal(response.statusCode, 201);
  return response.json().assist_id;
}

async function acceptAssist(app, ownerCookie, assistId) {
  const response = await app.inject({
    method: 'POST', url: `/v1/assists/${assistId}/accept`, headers: {origin: appOrigin, cookie: ownerCookie},
    payload: {request_id: randomUUID()},
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().state, 'ACCEPTED');
}

async function submit(app, ownerCookie, missionId, secretSource) {
  const response = await app.inject({
    method: 'POST', url: `/v1/missions/${missionId}/ship-submissions`, headers: {origin: appOrigin, cookie: ownerCookie},
    payload: {request_id: randomUUID(), title: 'Immutable Artifact', url: 'https://example.com/artifact', demo_url: 'https://example.com/demo', source_url: secretSource},
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().artifact.source_url, secretSource);
  return response.json().submission_id;
}

async function runVerifier(db, submissionId) {
  const jobs = await db.selectFrom('outbox_jobs').selectAll().where('job_type', '=', SHIP_VERIFICATION_JOB_TYPE).execute();
  const job = jobs.find((row) => row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) && row.payload.submission_id === submissionId);
  assert.ok(job);
  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
  const result = await runOneJob(db, {shipVerifierClient: {verify: async ({submissionId: id, url}) => ({
    schema_version: 'ship-verifier.observation.v1', submission_id: id, outcome: 'PASS', reason_code: 'PUBLIC_HTTPS_OK', final_url: url, http_status: 200, duration_ms: 11, redirects: 0,
  })}});
  assert.equal(result.status, 'succeeded');
}

async function publicShip(app, projectId) {
  const response = await app.inject({method: 'GET', url: `/v1/projects/${projectId}/ship`});
  assert.equal(response.statusCode, 200);
  return response.json();
}

test('Phase 6C snapshots accepted Party/Assist attribution and exposes a privacy-safe PROVEN Artifact state', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const owner = await session(app, `Owner ${randomUUID().slice(0, 6)}`);
    const acceptedHelper = await session(app, `Accepted ${randomUUID().slice(0, 6)}`);
    const offeredHelper = await session(app, `Offered ${randomUUID().slice(0, 6)}`);
    const lateHelper = await session(app, `Late ${randomUUID().slice(0, 6)}`);
    const mission = await shipReadyMission(app, owner.cookie, randomUUID().slice(0, 6));
    const beaconId = await createBeacon(app, owner.cookie, mission.projectId);

    const acceptedAssistId = await offerAssist(app, acceptedHelper.cookie, beaconId, 'accepted before Ship');
    await acceptAssist(app, owner.cookie, acceptedAssistId);
    const offeredAssistId = await offerAssist(app, offeredHelper.cookie, beaconId, 'offered only');

    const privateMarker = `PRIVATE_SOURCE_${randomUUID()}`;
    const secretSource = `https://example.com/${privateMarker}`;
    const submissionId = await submit(app, owner.cookie, mission.missionId, secretSource);
    await runVerifier(db, submissionId);

    const before = await publicShip(app, mission.projectId);
    assert.equal(before.schema_version, 'project.ship.public.v2');
    assert.equal(before.latest_submission.state, 'OBSERVED');
    assert.equal(before.latest_submission.accepted_ship, undefined);
    assert.equal(JSON.stringify(before).includes('source_url'), false);
    assert.equal(JSON.stringify(before).includes(privateMarker), false);

    const reviewMarker = `PRIVATE_REVIEW_${randomUUID()}`;
    const requestId = randomUUID();
    const accepted = await operatorReviewShipAcceptance(db, submissionId, {requestId, decision: 'ACCEPT', reason: reviewMarker});
    assert.ok(accepted.accepted_receipt);

    const after = await publicShip(app, mission.projectId);
    assert.equal(after.schema_version, 'project.ship.public.v2');
    assert.equal(after.latest_submission.schema_version, 'ship.submission.public.v2');
    assert.equal(after.latest_submission.state, 'PROVEN');
    const artifact = after.latest_submission.accepted_ship;
    assert.ok(artifact);
    assert.equal(artifact.schema_version, 'ship.artifact.public.v1');
    assert.equal(artifact.receipt_id, accepted.accepted_receipt.receipt_id);
    assert.equal(artifact.receipt_schema_version, 'inkubator.ship-receipt/1.0');
    assert.equal(artifact.acceptance_rule_version, 'ship.acceptance.v1');
    assert.equal(artifact.truth_state, 'PROVEN');
    assert.equal(artifact.owner_player_id, owner.playerId);
    assert.deepEqual(artifact.builders.map((row) => [row.player_id, row.role]), [
      [owner.playerId, 'OWNER'],
      [acceptedHelper.playerId, 'PARTY'],
    ]);
    assert.equal(artifact.assists.length, 1);
    assert.equal(artifact.assists[0].assist_id, acceptedAssistId);
    assert.equal(artifact.assists[0].player_id, acceptedHelper.playerId);
    assert.equal(artifact.assists[0].source_state, 'ACCEPTED');
    assert.equal(artifact.assists.some((row) => row.assist_id === offeredAssistId), false);
    assert.equal(artifact.builders.some((row) => row.player_id === offeredHelper.playerId), false);

    const publicJson = JSON.stringify(after);
    assert.equal(publicJson.includes('source_url'), false);
    assert.equal(publicJson.includes(privateMarker), false);
    assert.equal(publicJson.includes(reviewMarker), false);
    assert.equal(publicJson.includes('reason'), false);

    const snapshotBeforeLate = await db.selectFrom('ship_receipt_attributions').selectAll().where('receipt_id', '=', artifact.receipt_id).orderBy('role', 'asc').orderBy('player_id', 'asc').execute();
    assert.equal(snapshotBeforeLate.length, 2);

    const lateAssistId = await offerAssist(app, lateHelper.cookie, beaconId, 'accepted after Ship');
    await acceptAssist(app, owner.cookie, lateAssistId);
    const afterLatePartyChange = await publicShip(app, mission.projectId);
    assert.deepEqual(afterLatePartyChange.latest_submission.accepted_ship, artifact);
    assert.equal(afterLatePartyChange.latest_submission.accepted_ship.builders.some((row) => row.player_id === lateHelper.playerId), false);
    assert.equal(afterLatePartyChange.latest_submission.accepted_ship.assists.some((row) => row.assist_id === lateAssistId), false);

    const replay = await operatorReviewShipAcceptance(db, submissionId, {requestId, decision: 'ACCEPT', reason: reviewMarker});
    assert.equal(replay.accepted_receipt.receipt_id, artifact.receipt_id);
    const snapshotAfterReplay = await db.selectFrom('ship_receipt_attributions').selectAll().where('receipt_id', '=', artifact.receipt_id).orderBy('role', 'asc').orderBy('player_id', 'asc').execute();
    assert.deepEqual(snapshotAfterReplay, snapshotBeforeLate);
  } finally {
    await app.close();
    await db.destroy();
  }
});
