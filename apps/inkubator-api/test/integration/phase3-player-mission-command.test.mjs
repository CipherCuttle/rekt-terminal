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
  const response = await app.inject({method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: displayName}});
  assert.equal(response.statusCode, 201);
  return {cookie: cookieFrom(response), playerId: response.json().player.player_id};
}

function mutationHeaders(cookie) {
  return {origin: appOrigin, cookie};
}

test('Phase 3 persists Player -> Round -> Mission -> Command with bounded participant authority', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});

  try {
    const owner = await createSession(app, `Phase3 Owner ${randomUUID().slice(0, 8)}`);
    const stranger = await createSession(app, `Phase3 Stranger ${randomUUID().slice(0, 8)}`);

    const profileRequest = randomUUID();
    const profile = await app.inject({method: 'PATCH', url: '/v1/me/profile', headers: mutationHeaders(owner.cookie), payload: {
      request_id: profileRequest,
      bio: 'Ships weird tools.',
      character_name: 'Cuttle',
      character_archetype: 'BUILDER',
    }});
    assert.equal(profile.statusCode, 200);
    assert.equal(profile.json().character_name, 'Cuttle');
    const profileRetry = await app.inject({method: 'PATCH', url: '/v1/me/profile', headers: mutationHeaders(owner.cookie), payload: {
      request_id: profileRequest,
      bio: 'Ships weird tools.',
      character_name: 'Cuttle',
      character_archetype: 'BUILDER',
    }});
    assert.equal(profileRetry.statusCode, 200);
    const profileConflict = await app.inject({method: 'PATCH', url: '/v1/me/profile', headers: mutationHeaders(owner.cookie), payload: {
      request_id: profileRequest,
      bio: 'Changed meaning under reused key.',
    }});
    assert.equal(profileConflict.statusCode, 409);

    const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie: owner.cookie}});
    assert.equal(rounds.statusCode, 200);
    assert.equal(rounds.json().length >= 1, true);
    const founding = rounds.json().find((round) => round.code === 'ROUND_01');
    assert.ok(founding);
    assert.equal(founding.state, 'OPEN');
    assert.equal(founding.joined, false);

    const createBeforeJoin = await app.inject({method: 'POST', url: '/v1/missions', headers: mutationHeaders(owner.cookie), payload: {
      request_id: randomUUID(), round_id: founding.round_id, project_name: 'No Membership', goal: 'Must fail',
      ship_condition: 'Must fail', current_focus: 'Must fail', next_move: 'Must fail',
    }});
    assert.equal(createBeforeJoin.statusCode, 400);
    assert.equal(createBeforeJoin.json().error, 'round_membership_required');

    const join = await app.inject({method: 'POST', url: `/v1/rounds/${founding.round_id}/join`, headers: mutationHeaders(owner.cookie)});
    assert.equal(join.statusCode, 200);
    assert.equal(join.json().joined, true);
    const joinRetry = await app.inject({method: 'POST', url: `/v1/rounds/${founding.round_id}/join`, headers: mutationHeaders(owner.cookie)});
    assert.equal(joinRetry.statusCode, 200);

    const creationRequest = randomUUID();
    const declaration = {
      request_id: creationRequest,
      round_id: founding.round_id,
      project_name: 'REKT Command Proof',
      goal: 'Make the real Command Center persist',
      ship_condition: 'Return to the same Mission without database surgery',
      current_focus: 'Wire the vertical slice',
      next_move: 'Move Mission into BUILDING',
      stack_labels: ['React', 'Fastify', 'Postgres'],
    };
    const create = await app.inject({method: 'POST', url: '/v1/missions', headers: mutationHeaders(owner.cookie), payload: declaration});
    assert.equal(create.statusCode, 201);
    const command = create.json();
    const missionId = command.mission.mission_id;
    const projectId = command.project.project_id;
    assert.equal(command.mission.state, 'DECLARED');
    assert.equal(command.mission.progress_model_version, 'mission.progress.v1');
    assert.deepEqual(command.mission.stack_labels, ['React', 'Fastify', 'Postgres']);
    assert.equal(command.mission.stack_source, 'PLAYER_CONFIRMED');
    assert.equal(command.gates.length, 4);
    assert.deepEqual(command.gates.map((gate) => gate.key), ['FOUNDATION', 'CORE_EXPERIENCE', 'QUALITY_TESTING', 'SHIPABILITY']);
    assert.equal(command.gates.every((gate) => gate.state === 'UNKNOWN'), true);

    const duplicateCreate = await app.inject({method: 'POST', url: '/v1/missions', headers: mutationHeaders(owner.cookie), payload: declaration});
    assert.equal(duplicateCreate.statusCode, 201);
    assert.equal(duplicateCreate.json().mission.mission_id, missionId);
    assert.equal(duplicateCreate.json().project.project_id, projectId);

    const conflictCreate = await app.inject({method: 'POST', url: '/v1/missions', headers: mutationHeaders(owner.cookie), payload: {...declaration, goal: 'Different meaning'}});
    assert.equal(conflictCreate.statusCode, 409);

    const projectCount = Number((await db.selectFrom('projects').select(({fn}) => fn.countAll().as('count')).where('project_id', '=', projectId).executeTakeFirstOrThrow()).count);
    const missionCount = Number((await db.selectFrom('missions').select(({fn}) => fn.countAll().as('count')).where('creation_request_id', '=', creationRequest).executeTakeFirstOrThrow()).count);
    const gateCount = Number((await db.selectFrom('mission_gates').select(({fn}) => fn.countAll().as('count')).where('mission_id', '=', missionId).executeTakeFirstOrThrow()).count);
    assert.equal(projectCount, 1);
    assert.equal(missionCount, 1);
    assert.equal(gateCount, 4);

    const reloaded = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie: owner.cookie}});
    assert.equal(reloaded.statusCode, 200);
    assert.equal(reloaded.json().mission.mission_id, missionId);
    assert.equal(reloaded.json().mission.next_move, declaration.next_move);

    const strangerCommand = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie: stranger.cookie}});
    assert.equal(strangerCommand.statusCode, 404);
    const strangerMutation = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: mutationHeaders(stranger.cookie), payload: {
      request_id: randomUUID(), state: 'BUILDING',
    }});
    assert.equal(strangerMutation.statusCode, 403);

    const buildingRequest = randomUUID();
    const building = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: buildingRequest, state: 'BUILDING', current_focus: 'Exercise the real Command flow', next_move: 'Record the first gate claim',
    }});
    assert.equal(building.statusCode, 200);
    assert.equal(building.json().mission.state, 'BUILDING');

    const laterFocus = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: randomUUID(), current_focus: 'A later focus that must survive retry',
    }});
    assert.equal(laterFocus.statusCode, 200);
    const oldRetry = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: buildingRequest, state: 'BUILDING', current_focus: 'Exercise the real Command flow', next_move: 'Record the first gate claim',
    }});
    assert.equal(oldRetry.statusCode, 200);
    assert.equal(oldRetry.json().mission.current_focus, 'A later focus that must survive retry');

    const blockWithoutReason = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: randomUUID(), state: 'BLOCKED',
    }});
    assert.equal(blockWithoutReason.statusCode, 400);
    assert.equal(blockWithoutReason.json().error, 'mission_blocker_required');

    const blocked = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: randomUUID(), state: 'BLOCKED', blocker: 'Need one outside tester', next_move: 'Find a hostile tester',
    }});
    assert.equal(blocked.statusCode, 200);
    assert.equal(blocked.json().mission.state, 'BLOCKED');
    assert.equal(blocked.json().mission.blocker, 'Need one outside tester');

    const clearBlockedReason = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: randomUUID(), blocker: null,
    }});
    assert.equal(clearBlockedReason.statusCode, 400);

    const forbiddenShip = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: randomUUID(), state: 'SHIPPED',
    }});
    assert.equal(forbiddenShip.statusCode, 400);

    const gateRequest = randomUUID();
    const claimedGate = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}/gates/FOUNDATION`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: gateRequest, state: 'CLAIMED',
    }});
    assert.equal(claimedGate.statusCode, 200);
    assert.equal(claimedGate.json().gates.find((gate) => gate.key === 'FOUNDATION').state, 'CLAIMED');
    const gateRetry = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}/gates/FOUNDATION`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: gateRequest, state: 'CLAIMED',
    }});
    assert.equal(gateRetry.statusCode, 200);

    const forbiddenProof = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}/gates/FOUNDATION`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: randomUUID(), state: 'PROVEN',
    }});
    assert.equal(forbiddenProof.statusCode, 400);
    const forbiddenObserved = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}/gates/FOUNDATION`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: randomUUID(), state: 'OBSERVED',
    }});
    assert.equal(forbiddenObserved.statusCode, 400);

    const publicProject = await app.inject({method: 'GET', url: `/v1/projects/${projectId}`});
    assert.equal(publicProject.statusCode, 200);
    const serializedPublic = JSON.stringify(publicProject.json());
    assert.equal(serializedPublic.includes(declaration.ship_condition), false);
    assert.equal(serializedPublic.includes('current_focus'), false);
    assert.equal(serializedPublic.includes('next_move'), false);

    const historyMission = await db.selectFrom('history_events').selectAll().where('event_type', '=', 'mission.declared').where('subject_id', '=', missionId).executeTakeFirstOrThrow();
    assert.equal(historyMission.payload.schema_version, 'mission.current.v1');
    assert.equal(historyMission.payload.progress_model_version, 'mission.progress.v1');

    const finalReload = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie: owner.cookie}});
    assert.equal(finalReload.statusCode, 200);
    assert.equal(finalReload.json().mission.state, 'BLOCKED');
    assert.equal(finalReload.json().gates.find((gate) => gate.key === 'FOUNDATION').state, 'CLAIMED');
  } finally {
    await app.close();
    await db.destroy();
  }
});

test('Phase 3 current product routes remain available when development auth is disabled', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: false, sessionTtlSeconds: 3600, github: null});
  try {
    const createDev = await app.inject({method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: 'must not exist'}});
    assert.equal(createDev.statusCode, 404);
    const developmentProject = await app.inject({method: 'POST', url: '/v1/development/projects', headers: {origin: appOrigin}, payload: {
      name: 'must not exist', goal: 'must not exist', ship_condition: 'must not exist', current_focus: 'must not exist', next_move: 'must not exist',
    }});
    assert.equal(developmentProject.statusCode, 404);
    const productProject = await app.inject({method: 'GET', url: `/v1/projects/${randomUUID()}`});
    assert.equal(productProject.statusCode, 404);
    assert.equal(productProject.json().error, 'project_not_found');
  } finally {
    await app.close();
    await db.destroy();
  }
});

test('Phase 3 serializes first profile writes, Mission creation, and state transitions', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const owner = await createSession(app, `Phase3 Race ${randomUUID().slice(0, 8)}`);

    const profilePayload = {
      request_id: randomUUID(),
      bio: 'Concurrency proof',
      character_name: 'Lockstep',
      character_archetype: 'BUILDER',
    };
    let releaseProfilePlayerLock;
    let profilePlayerLockReady;
    const profilePlayerRelease = new Promise((resolve) => { releaseProfilePlayerLock = resolve; });
    const profilePlayerReady = new Promise((resolve) => { profilePlayerLockReady = resolve; });
    const heldProfilePlayerLock = db.transaction().execute(async (transaction) => {
      await transaction.selectFrom('players').select('player_id').where('player_id', '=', owner.playerId).forUpdate().executeTakeFirstOrThrow();
      profilePlayerLockReady();
      await profilePlayerRelease;
    });
    await profilePlayerReady;
    const profileOnePromise = app.inject({method: 'PATCH', url: '/v1/me/profile', headers: mutationHeaders(owner.cookie), payload: profilePayload});
    const profileTwoPromise = app.inject({method: 'PATCH', url: '/v1/me/profile', headers: mutationHeaders(owner.cookie), payload: profilePayload});
    await new Promise((resolve) => setTimeout(resolve, 75));
    releaseProfilePlayerLock();
    await heldProfilePlayerLock;
    const [profileOne, profileTwo] = await Promise.all([profileOnePromise, profileTwoPromise]);
    assert.equal(profileOne.statusCode, 200);
    assert.equal(profileTwo.statusCode, 200);
    assert.deepEqual(profileOne.json(), profileTwo.json());
    const profileHistoryCount = Number((await db.selectFrom('history_events').select(({fn}) => fn.countAll().as('count')).where('dedupe_key', '=', `activity:player.profile.updated:${owner.playerId}:${profilePayload.request_id}`).executeTakeFirstOrThrow()).count);
    assert.equal(profileHistoryCount, 1);

    const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie: owner.cookie}});
    const founding = rounds.json().find((round) => round.code === 'ROUND_01');
    assert.ok(founding);
    assert.equal((await app.inject({method: 'POST', url: `/v1/rounds/${founding.round_id}/join`, headers: mutationHeaders(owner.cookie)})).statusCode, 200);

    const declaration = {
      request_id: randomUUID(),
      round_id: founding.round_id,
      project_name: 'REKT Race Proof',
      goal: 'Serialize concurrent declaration',
      ship_condition: 'One durable Mission exists',
      current_focus: 'Race duplicate creation',
      next_move: 'Enter BUILDING',
    };

    let releaseCreatePlayerLock;
    let createPlayerLockReady;
    const createPlayerRelease = new Promise((resolve) => { releaseCreatePlayerLock = resolve; });
    const createPlayerReady = new Promise((resolve) => { createPlayerLockReady = resolve; });
    const heldCreatePlayerLock = db.transaction().execute(async (transaction) => {
      await transaction.selectFrom('players').select('player_id').where('player_id', '=', owner.playerId).forUpdate().executeTakeFirstOrThrow();
      createPlayerLockReady();
      await createPlayerRelease;
    });
    await createPlayerReady;
    const createOnePromise = app.inject({method: 'POST', url: '/v1/missions', headers: mutationHeaders(owner.cookie), payload: declaration});
    const createTwoPromise = app.inject({method: 'POST', url: '/v1/missions', headers: mutationHeaders(owner.cookie), payload: declaration});
    await new Promise((resolve) => setTimeout(resolve, 75));
    releaseCreatePlayerLock();
    await heldCreatePlayerLock;
    const [createOne, createTwo] = await Promise.all([createOnePromise, createTwoPromise]);
    assert.equal(createOne.statusCode, 201);
    assert.equal(createTwo.statusCode, 201);
    assert.equal(createOne.json().mission.mission_id, createTwo.json().mission.mission_id);
    assert.equal(createOne.json().project.project_id, createTwo.json().project.project_id);
    const missionId = createOne.json().mission.mission_id;
    const projectId = createOne.json().project.project_id;
    const creationCount = Number((await db.selectFrom('missions').select(({fn}) => fn.countAll().as('count')).where('creation_request_id', '=', declaration.request_id).executeTakeFirstOrThrow()).count);
    assert.equal(creationCount, 1);

    const building = await app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: randomUUID(), state: 'BUILDING', current_focus: 'Force a stale-read race', next_move: 'Serialize transition validation',
    }});
    assert.equal(building.statusCode, 200);

    const oldCreationRetry = await app.inject({method: 'POST', url: '/v1/missions', headers: mutationHeaders(owner.cookie), payload: declaration});
    assert.equal(oldCreationRetry.statusCode, 201);
    assert.equal(oldCreationRetry.json().mission.mission_id, missionId);
    assert.equal(oldCreationRetry.json().project.project_id, projectId);
    assert.equal(oldCreationRetry.json().mission.state, 'BUILDING');
    assert.equal(oldCreationRetry.json().mission.current_focus, 'Force a stale-read race');

    let releaseMissionLock;
    let missionLockReady;
    const missionRelease = new Promise((resolve) => { releaseMissionLock = resolve; });
    const missionReady = new Promise((resolve) => { missionLockReady = resolve; });
    const heldMissionLock = db.transaction().execute(async (transaction) => {
      await transaction.selectFrom('missions').select('mission_id').where('mission_id', '=', missionId).forUpdate().executeTakeFirstOrThrow();
      missionLockReady();
      await missionRelease;
    });
    await missionReady;
    const blockPromise = app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: randomUUID(), state: 'BLOCKED', blocker: 'Forced concurrency barrier', next_move: 'Resolve the barrier',
    }});
    await new Promise((resolve) => setTimeout(resolve, 75));
    const shipReadyPromise = app.inject({method: 'PATCH', url: `/v1/missions/${missionId}`, headers: mutationHeaders(owner.cookie), payload: {
      request_id: randomUUID(), state: 'SHIP_READY',
    }});
    await new Promise((resolve) => setTimeout(resolve, 75));
    releaseMissionLock();
    await heldMissionLock;
    const [blocked, shipReady] = await Promise.all([blockPromise, shipReadyPromise]);
    assert.equal(blocked.statusCode, 200);
    assert.equal(blocked.json().mission.state, 'BLOCKED');
    assert.equal(shipReady.statusCode, 409);
    assert.equal(shipReady.json().error, 'mission_transition_invalid');

    const finalCommand = await app.inject({method: 'GET', url: '/v1/me/command', headers: {cookie: owner.cookie}});
    assert.equal(finalCommand.statusCode, 200);
    assert.equal(finalCommand.json().mission.state, 'BLOCKED');
    assert.equal(finalCommand.json().mission.blocker, 'Forced concurrency barrier');
  } finally {
    await app.close();
    await db.destroy();
  }
});
