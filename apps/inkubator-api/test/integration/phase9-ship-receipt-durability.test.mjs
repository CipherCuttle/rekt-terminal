import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
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

async function shipReadyMission(app, cookie, suffix) {
  const headers = {origin: appOrigin, cookie};
  const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie}});
  assert.equal(rounds.statusCode, 200, rounds.body);
  const founding = rounds.json().find((round) => round.code === 'ROUND_01');
  assert.ok(founding);
  assert.equal((await app.inject({method: 'POST', url: `/v1/rounds/${founding.round_id}/join`, headers})).statusCode, 200);
  const created = await app.inject({
    method: 'POST', url: '/v1/missions', headers,
    payload: {
      request_id: randomUUID(), round_id: founding.round_id, project_name: `Receipt Durability ${suffix}`,
      goal: 'Prove the accepted receipt survives Mission completion', ship_condition: 'Accepted public artifact',
      current_focus: 'Ship', next_move: 'Submit',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  const missionId = created.json().mission.mission_id;
  const projectId = created.json().project.project_id;
  for (const state of ['BUILDING', 'SHIP_READY']) {
    const updated = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers, payload: {request_id: randomUUID(), state}});
    assert.equal(updated.statusCode, 200, updated.body);
  }
  return {headers, missionId, projectId};
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

// Regression: after a successful Ship the Mission leaves the active-command
// projection by design (terminal SHIPPED state). The accepted receipt must stay
// inspectable, the PLAYER history must reference it, and following that
// historical reference must reopen the exact durable SHIP context.
test('Phase 9 accepted receipt survives Mission completion and stays addressable from PLAYER history', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});

  try {
    const owner = await session(app, 'Receipt Durability Owner');
    const mission = await shipReadyMission(app, owner.cookie, randomUUID().slice(0, 6));

    // 1. The artifact is accepted and the canonical Ship projection is PROVEN.
    const submitted = await app.inject({
      method: 'POST', url: `/v1/missions/${mission.missionId}/ship-submissions`, headers: mission.headers,
      payload: {request_id: randomUUID(), title: 'Durable receipt artifact', url: 'https://example.com/receipt-durability'},
    });
    assert.equal(submitted.statusCode, 201, submitted.body);
    const submissionId = submitted.json().submission_id;
    await runVerifier(db, submissionId);
    const reviewed = await operatorReviewShipAcceptance(db, submissionId, {
      requestId: randomUUID(), decision: 'ACCEPT', reason: 'Bounded receipt-durability rehearsal.',
    });
    assert.ok(reviewed.accepted_receipt);
    const receiptId = reviewed.accepted_receipt.receipt_id;
    assert.equal(reviewed.accepted_receipt.truth_state, 'PROVEN');

    const shipState = await app.inject({method: 'GET', url: `/v1/projects/${mission.projectId}/ship`});
    assert.equal(shipState.statusCode, 200, shipState.body);
    assert.equal(shipState.json().latest_submission.state, 'PROVEN');
    assert.equal(shipState.json().latest_submission.accepted_ship.receipt_id, receiptId);

    // 2. The Mission is no longer active in the active-Mission endpoint.
    const command = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie: owner.cookie}});
    assert.equal(command.statusCode, 404, command.body);
    assert.equal(command.json().error, 'active_mission_not_found');

    // 3. The receipt remains inspectable after Mission completion.
    const receipt = await app.inject({method: 'GET', url: `/v1/ship-receipts/${receiptId}`});
    assert.equal(receipt.statusCode, 200, receipt.body);
    assert.equal(receipt.json().truth_state, 'PROVEN');
    assert.equal(receipt.json().receipt_id, receiptId);
    assert.equal(receipt.json().project_id, mission.projectId);
    assert.equal(receipt.json().artifact.title, 'Durable receipt artifact');

    // 4. PLAYER history contains the accepted Ship and reference-links it.
    const history = await app.inject({method: 'GET', url: '/v1/me/history', headers: {cookie: owner.cookie}});
    assert.equal(history.statusCode, 200, history.body);
    const shipEntry = history.json().entries.find((entry) => entry.kind === 'SHIP_ACCEPTED');
    assert.ok(shipEntry);
    assert.equal(shipEntry.truth_state, 'PROVEN');
    assert.equal(shipEntry.receipt_id, receiptId);
    assert.equal(shipEntry.project_id, mission.projectId);
    assert.equal(shipEntry.role, 'OWNER');

    // 5. Following the historical reference reopens the exact SHIP context:
    //    the authorized private project context and the public Ship projection
    //    both resolve to the same accepted receipt (?project=&receipt= pair).
    const privateProject = await app.inject({method: 'GET', url: `/v1/projects/${mission.projectId}/private`, headers: {cookie: owner.cookie}});
    assert.equal(privateProject.statusCode, 200, privateProject.body);
    assert.equal(privateProject.json().project_id, shipEntry.project_id);
    assert.equal(privateProject.json().mission_id, shipEntry.mission_id);

    const reopened = await app.inject({method: 'GET', url: `/v1/projects/${shipEntry.project_id}/ship`});
    assert.equal(reopened.statusCode, 200, reopened.body);
    assert.equal(reopened.json().latest_submission.accepted_ship.receipt_id, shipEntry.receipt_id);
    assert.equal(reopened.json().latest_submission.accepted_ship.project_id, shipEntry.project_id);

    // The receipt permalink itself must agree with the historical reference.
    assert.equal(receipt.json().project_id, privateProject.json().project_id);
  } finally {
    await app.close();
    await db.destroy();
  }
});
