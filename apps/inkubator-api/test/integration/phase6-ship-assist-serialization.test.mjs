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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function shipReadyMission(app, ownerCookie) {
  const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie: ownerCookie}});
  const round = rounds.json().find((row) => row.code === 'ROUND_01');
  assert.ok(round);
  assert.equal((await app.inject({method: 'POST', url: `/v1/rounds/${round.round_id}/join`, headers: {origin: appOrigin, cookie: ownerCookie}})).statusCode, 200);
  const created = await app.inject({
    method: 'POST', url: '/v1/missions', headers: {origin: appOrigin, cookie: ownerCookie},
    payload: {
      request_id: randomUUID(), round_id: round.round_id,
      project_name: `Ship serialization ${randomUUID().slice(0, 6)}`,
      goal: 'Serialize Assist acceptance with Ship history',
      ship_condition: 'Accepted by bounded Ship rule',
      current_focus: 'Prepare', next_move: 'Submit',
    },
  });
  assert.equal(created.statusCode, 201);
  const missionId = created.json().mission.mission_id;
  const projectId = created.json().project.project_id;
  for (const state of ['BUILDING', 'SHIP_READY']) {
    const updated = await app.inject({
      method: 'PATCH', url: `/v1/missions/${missionId}`,
      headers: {origin: appOrigin, cookie: ownerCookie}, payload: {request_id: randomUUID(), state},
    });
    assert.equal(updated.statusCode, 200);
  }
  return {missionId, projectId};
}

async function createOfferedAssist(app, ownerCookie, helperCookie, projectId) {
  const beacon = await app.inject({
    method: 'POST', url: `/v1/projects/${projectId}/help-beacons`, headers: {origin: appOrigin, cookie: ownerCookie},
    payload: {request_id: randomUUID(), summary: 'Need a concurrent pre-Ship assist.'},
  });
  assert.equal(beacon.statusCode, 201);
  const offer = await app.inject({
    method: 'POST', url: `/v1/help-beacons/${beacon.json().beacon_id}/assists`, headers: {origin: appOrigin, cookie: helperCookie},
    payload: {request_id: randomUUID(), message: 'I can help before Ship.'},
  });
  assert.equal(offer.statusCode, 201);
  return offer.json().assist_id;
}

async function submitAndObserve(app, db, ownerCookie, missionId) {
  const submitted = await app.inject({
    method: 'POST', url: `/v1/missions/${missionId}/ship-submissions`, headers: {origin: appOrigin, cookie: ownerCookie},
    payload: {request_id: randomUUID(), title: 'Serialized Artifact', url: 'https://example.com/serialized'},
  });
  assert.equal(submitted.statusCode, 201);
  const submissionId = submitted.json().submission_id;
  const jobs = await db.selectFrom('outbox_jobs').selectAll().where('job_type', '=', SHIP_VERIFICATION_JOB_TYPE).execute();
  const job = jobs.find((row) => row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) && row.payload.submission_id === submissionId);
  assert.ok(job);
  await db.updateTable('outbox_jobs').set({next_attempt_at: new Date(0)}).where('job_id', '=', job.job_id).execute();
  const result = await runOneJob(db, {shipVerifierClient: {verify: async ({submissionId: id}) => ({
    schema_version: 'ship-verifier.observation.v1', submission_id: id, outcome: 'PASS', reason_code: 'PUBLIC_HTTPS_OK',
    final_url: 'https://example.com/serialized', http_status: 200, duration_ms: 10, redirects: 0,
  })}});
  assert.equal(result.status, 'succeeded');
  return submissionId;
}

async function assistRowLocked(db, assistId) {
  try {
    await db.transaction().execute(async (tx) => {
      await sql`select assist_id from assist_offers where assist_id = ${assistId}::uuid for update nowait`.execute(tx);
    });
    return false;
  } catch (error) {
    if (error && typeof error === 'object' && error.code === '55P03') return true;
    throw error;
  }
}

async function waitForAssistLock(db, assistId) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await assistRowLocked(db, assistId)) return;
    await sleep(10);
  }
  throw new Error('accept_assist_did_not_reach_project_lock_boundary');
}

test('Ship snapshot serializes with concurrent Assist acceptance on the project boundary', async () => {
  const db = createDatabase(databaseUrl);
  const gateDb = createDatabase(databaseUrl);
  const probeDb = createDatabase(databaseUrl);
  const reviewDb = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});

  let releaseProjectLock;
  const release = new Promise((resolve) => { releaseProjectLock = resolve; });
  let projectLockAcquired;
  const acquired = new Promise((resolve) => { projectLockAcquired = resolve; });

  try {
    const owner = await session(app, `Owner ${randomUUID().slice(0, 6)}`);
    const helper = await session(app, `Helper ${randomUUID().slice(0, 6)}`);
    const mission = await shipReadyMission(app, owner.cookie);
    const assistId = await createOfferedAssist(app, owner.cookie, helper.cookie, mission.projectId);
    const submissionId = await submitAndObserve(app, db, owner.cookie, mission.missionId);

    const gate = gateDb.transaction().execute(async (tx) => {
      await tx.selectFrom('projects').select('project_id').where('project_id', '=', mission.projectId).forUpdate().executeTakeFirstOrThrow();
      projectLockAcquired();
      await release;
    });
    await acquired;

    const acceptingAssist = app.inject({
      method: 'POST', url: `/v1/assists/${assistId}/accept`, headers: {origin: appOrigin, cookie: owner.cookie},
      payload: {request_id: randomUUID()},
    });

    // acceptAssist locks the Assist row before requesting the shared project lock.
    // Once that row is locked, it is queued at the Ship/Assist serialization boundary.
    await waitForAssistLock(probeDb, assistId);
    await sleep(25);

    let reviewSettled = false;
    const reviewingShip = operatorReviewShipAcceptance(reviewDb, submissionId, {
      requestId: randomUUID(), decision: 'ACCEPT', reason: 'serialization regression',
    }).finally(() => { reviewSettled = true; });

    // The Ship transaction must also wait on the held project row. Without the shared
    // lock, it would cross the boundary now and snapshot the still-uncommitted Assist out.
    await sleep(75);
    assert.equal(reviewSettled, false);

    releaseProjectLock();
    await gate;

    const acceptedAssist = await acceptingAssist;
    assert.equal(acceptedAssist.statusCode, 200);
    assert.equal(acceptedAssist.json().state, 'ACCEPTED');

    const reviewed = await reviewingShip;
    assert.ok(reviewed.accepted_receipt);
    const receiptId = reviewed.accepted_receipt.receipt_id;

    const builders = await db.selectFrom('ship_receipt_attributions').selectAll().where('receipt_id', '=', receiptId).execute();
    const assists = await db.selectFrom('ship_receipt_assists').selectAll().where('receipt_id', '=', receiptId).execute();
    assert.equal(builders.some((row) => row.player_id === helper.playerId && row.role === 'PARTY'), true);
    assert.equal(assists.some((row) => row.assist_id === assistId && row.player_id === helper.playerId), true);

    const publicShip = await app.inject({method: 'GET', url: `/v1/projects/${mission.projectId}/ship`});
    assert.equal(publicShip.statusCode, 200);
    const artifact = publicShip.json().latest_submission.accepted_ship;
    assert.ok(artifact);
    assert.equal(artifact.builders.some((row) => row.player_id === helper.playerId && row.role === 'PARTY'), true);
    assert.equal(artifact.assists.some((row) => row.assist_id === assistId && row.player_id === helper.playerId), true);
  } finally {
    if (releaseProjectLock) releaseProjectLock();
    await Promise.allSettled([app.close(), db.destroy(), gateDb.destroy(), probeDb.destroy(), reviewDb.destroy()]);
  }
});
