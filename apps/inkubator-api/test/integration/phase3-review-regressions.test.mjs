import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';

function cookieFrom(response) {
  const value = response.headers['set-cookie'];
  const serialized = Array.isArray(value) ? value[0] : value;
  assert.ok(serialized);
  return serialized.split(';')[0];
}

async function createSession(app, displayName) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/dev/session',
    headers: {origin: appOrigin},
    payload: {display_name: displayName},
  });
  assert.equal(response.statusCode, 201);
  return cookieFrom(response);
}

function mutationHeaders(cookie) {
  return {origin: appOrigin, cookie};
}

test('Phase 3 review regressions preserve terminal gates and Command blocker contract', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});

  try {
    const cookie = await createSession(app, `Phase3 Review ${randomUUID().slice(0, 8)}`);
    const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie}});
    assert.equal(rounds.statusCode, 200);
    const founding = rounds.json().find((round) => round.code === 'ROUND_01');
    assert.ok(founding);

    const join = await app.inject({
      method: 'POST',
      url: `/v1/rounds/${founding.round_id}/join`,
      headers: mutationHeaders(cookie),
    });
    assert.equal(join.statusCode, 200);

    const declaration = await app.inject({
      method: 'POST',
      url: '/v1/missions',
      headers: mutationHeaders(cookie),
      payload: {
        request_id: randomUUID(),
        round_id: founding.round_id,
        project_name: 'Phase 3 review repair',
        goal: 'Preserve terminal integrity and generated Command contract',
        ship_condition: 'Terminal gates become immutable and null blocker is omitted',
        current_focus: 'Exercise bounded review regressions',
        next_move: 'Claim gate then close Mission',
      },
    });
    assert.equal(declaration.statusCode, 201);
    const missionId = declaration.json().mission.mission_id;
    assert.equal(Object.hasOwn(declaration.json().mission, 'blocker'), false);

    const commandReload = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie}});
    assert.equal(commandReload.statusCode, 200);
    assert.equal(Object.hasOwn(commandReload.json().mission, 'blocker'), false);

    const gateRequestId = randomUUID();
    const gateClaim = await app.inject({
      method: 'PATCH',
      url: `/v1/missions/${missionId}/gates/FOUNDATION`,
      headers: mutationHeaders(cookie),
      payload: {request_id: gateRequestId, state: 'CLAIMED'},
    });
    assert.equal(gateClaim.statusCode, 200);
    assert.equal(gateClaim.json().gates.find((gate) => gate.key === 'FOUNDATION').state, 'CLAIMED');

    const closeMission = await app.inject({
      method: 'PATCH',
      url: `/v1/missions/${missionId}`,
      headers: mutationHeaders(cookie),
      payload: {request_id: randomUUID(), state: 'CLOSED_NOT_SHIPPED'},
    });
    assert.equal(closeMission.statusCode, 200);
    assert.equal(closeMission.json().mission.state, 'CLOSED_NOT_SHIPPED');

    const idempotentGateRetry = await app.inject({
      method: 'PATCH',
      url: `/v1/missions/${missionId}/gates/FOUNDATION`,
      headers: mutationHeaders(cookie),
      payload: {request_id: gateRequestId, state: 'CLAIMED'},
    });
    assert.equal(idempotentGateRetry.statusCode, 200);
    assert.equal(idempotentGateRetry.json().gates.find((gate) => gate.key === 'FOUNDATION').state, 'CLAIMED');

    const forbiddenTerminalGateMutation = await app.inject({
      method: 'PATCH',
      url: `/v1/missions/${missionId}/gates/FOUNDATION`,
      headers: mutationHeaders(cookie),
      payload: {request_id: randomUUID(), state: 'ACTIVE'},
    });
    assert.equal(forbiddenTerminalGateMutation.statusCode, 409);
    assert.equal(forbiddenTerminalGateMutation.json().error, 'mission_terminal');

    const persistedGate = await db.selectFrom('mission_gates')
      .selectAll()
      .where('mission_id', '=', missionId)
      .where('gate_key', '=', 'FOUNDATION')
      .executeTakeFirstOrThrow();
    assert.equal(persistedGate.signal_state, 'CLAIMED');

    const gateHistoryCount = Number((await db.selectFrom('history_events')
      .select(({fn}) => fn.countAll().as('count'))
      .where('event_type', '=', 'mission.gate.updated')
      .where('subject_id', '=', missionId)
      .executeTakeFirstOrThrow()).count);
    assert.equal(gateHistoryCount, 1);
  } finally {
    await app.close();
    await db.destroy();
  }
});
