import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';

function cookie(response) {
  const value = response.headers['set-cookie'];
  const serialized = Array.isArray(value) ? value[0] : value;
  assert.ok(serialized);
  return serialized.split(';')[0];
}

async function session(app, name) {
  const response = await app.inject({method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: name}});
  assert.equal(response.statusCode, 201);
  return {cookie: cookie(response), playerId: response.json().player.player_id};
}

async function joinFounding(app, authCookie) {
  const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie: authCookie}});
  const founding = rounds.json().find((round) => round.code === 'ROUND_01');
  assert.ok(founding);
  assert.equal((await app.inject({method: 'POST', url: `/v1/rounds/${founding.round_id}/join`, headers: {origin: appOrigin, cookie: authCookie}})).statusCode, 200);
  return founding.round_id;
}

test('Phase 5 core makes another builder materially useful without minting proof', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const alice = await session(app, `Alice ${randomUUID().slice(0, 6)}`);
    const bob = await session(app, `Bob ${randomUUID().slice(0, 6)}`);
    const aliceHeaders = {origin: appOrigin, cookie: alice.cookie};
    const bobHeaders = {origin: appOrigin, cookie: bob.cookie};

    const aliceProfile = await app.inject({method: 'PATCH', url: '/v1/me/profile', headers: aliceHeaders, payload: {
      request_id: randomUUID(), skills_needed: ['TypeScript', 'testing'], can_help_with: ['art direction'],
    }});
    assert.equal(aliceProfile.statusCode, 200);
    assert.equal(aliceProfile.json().schema_version, 'player.profile.v2');
    assert.deepEqual(aliceProfile.json().skills_needed, ['TypeScript', 'testing']);
    const bobProfile = await app.inject({method: 'PATCH', url: '/v1/me/profile', headers: bobHeaders, payload: {
      request_id: randomUUID(), skills_needed: [], can_help_with: ['TypeScript', 'testing'],
    }});
    assert.equal(bobProfile.statusCode, 200);

    const roundId = await joinFounding(app, alice.cookie);
    const create = await app.inject({method: 'POST', url: '/v1/missions', headers: aliceHeaders, payload: {
      request_id: randomUUID(), round_id: roundId, project_name: 'Help Loop Project', goal: 'Get useful help from another builder',
      ship_condition: 'Accepted assist is recorded durably', current_focus: 'Need a tester', next_move: 'Open a Help Beacon',
    }});
    assert.equal(create.statusCode, 201);
    const projectId = create.json().project.project_id;
    const missionId = create.json().mission.mission_id;

    const players = await app.inject({method: 'GET', url: '/v1/discover/players'});
    assert.equal(players.statusCode, 200);
    const alicePublic = players.json().find((player) => player.player_id === alice.playerId);
    const bobPublic = players.json().find((player) => player.player_id === bob.playerId);
    assert.equal(alicePublic.schema_version, 'player.public.v2');
    assert.deepEqual(alicePublic.skills_needed, ['TypeScript', 'testing']);
    assert.deepEqual(bobPublic.can_help_with, ['TypeScript', 'testing']);

    const projects = await app.inject({method: 'GET', url: '/v1/discover/projects'});
    assert.equal(projects.statusCode, 200);
    const discovered = projects.json().find((entry) => entry.project.project_id === projectId);
    assert.ok(discovered);
    assert.equal(discovered.owner.player_id, alice.playerId);

    const followRequest = randomUUID();
    assert.equal((await app.inject({method: 'POST', url: `/v1/players/${alice.playerId}/follow`, headers: bobHeaders, payload: {request_id: followRequest}})).statusCode, 200);
    assert.equal((await app.inject({method: 'POST', url: `/v1/players/${alice.playerId}/follow`, headers: bobHeaders, payload: {request_id: followRequest}})).statusCode, 200);
    const followEvents = await db.selectFrom('history_events').select('history_event_id').where('event_type', '=', 'player.followed').where('actor_player_id', '=', bob.playerId).where('subject_id', '=', alice.playerId).execute();
    assert.equal(followEvents.length, 1);

    const watchRequest = randomUUID();
    assert.equal((await app.inject({method: 'POST', url: `/v1/projects/${projectId}/watch`, headers: bobHeaders, payload: {request_id: watchRequest}})).statusCode, 200);
    assert.equal((await app.inject({method: 'POST', url: `/v1/projects/${projectId}/watch`, headers: bobHeaders, payload: {request_id: watchRequest}})).statusCode, 200);
    const watchEvents = await db.selectFrom('history_events').select('history_event_id').where('event_type', '=', 'project.watched').where('actor_player_id', '=', bob.playerId).where('subject_id', '=', projectId).execute();
    assert.equal(watchEvents.length, 1);

    const forbiddenBeacon = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/help-beacons`, headers: bobHeaders, payload: {request_id: randomUUID(), summary: 'I should not own this'}});
    assert.equal(forbiddenBeacon.statusCode, 403);

    const beaconRequest = randomUUID();
    const beacon = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/help-beacons`, headers: aliceHeaders, payload: {
      request_id: beaconRequest, summary: 'Need someone to test the onboarding flow', skills_needed: ['testing', 'TypeScript'],
    }});
    assert.equal(beacon.statusCode, 201);
    const beaconId = beacon.json().beacon_id;
    assert.equal((await app.inject({method: 'POST', url: `/v1/projects/${projectId}/help-beacons`, headers: aliceHeaders, payload: {request_id: beaconRequest, summary: 'Need someone to test the onboarding flow', skills_needed: ['testing', 'TypeScript']}})).statusCode, 201);
    const secondBeacon = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/help-beacons`, headers: aliceHeaders, payload: {request_id: randomUUID(), summary: 'Duplicate open beacon'}});
    assert.equal(secondBeacon.statusCode, 409);

    const selfAssist = await app.inject({method: 'POST', url: `/v1/help-beacons/${beaconId}/assists`, headers: aliceHeaders, payload: {request_id: randomUUID(), message: 'Self help'}});
    assert.equal(selfAssist.statusCode, 403);

    const assistRequest = randomUUID();
    const assist = await app.inject({method: 'POST', url: `/v1/help-beacons/${beaconId}/assists`, headers: bobHeaders, payload: {
      request_id: assistRequest, message: 'I can test this and send a reproducible bug list',
    }});
    assert.equal(assist.statusCode, 201);
    const assistId = assist.json().assist_id;
    assert.equal(assist.json().state, 'OFFERED');
    assert.equal((await app.inject({method: 'POST', url: `/v1/help-beacons/${beaconId}/assists`, headers: bobHeaders, payload: {request_id: assistRequest, message: 'I can test this and send a reproducible bug list'}})).statusCode, 201);

    const bobCannotAccept = await app.inject({method: 'POST', url: `/v1/assists/${assistId}/accept`, headers: bobHeaders, payload: {request_id: randomUUID()}});
    assert.equal(bobCannotAccept.statusCode, 403);

    const acceptRequest = randomUUID();
    const accepted = await app.inject({method: 'POST', url: `/v1/assists/${assistId}/accept`, headers: aliceHeaders, payload: {request_id: acceptRequest}});
    assert.equal(accepted.statusCode, 200);
    assert.equal(accepted.json().state, 'ACCEPTED');
    const retryAccepted = await app.inject({method: 'POST', url: `/v1/assists/${assistId}/accept`, headers: aliceHeaders, payload: {request_id: acceptRequest}});
    assert.equal(retryAccepted.statusCode, 200);

    const helpLoop = await app.inject({method: 'GET', url: `/v1/projects/${projectId}/help-loop`});
    assert.equal(helpLoop.statusCode, 200);
    assert.equal(helpLoop.json().owner.player_id, alice.playerId);
    assert.deepEqual(helpLoop.json().party_members, [{player_id: bob.playerId, display_name: bobPublic.display_name, role: 'ASSIST'}]);

    const acceptedEvents = await db.selectFrom('history_events').selectAll().where('event_type', '=', 'project.assist.accepted').where('subject_id', '=', projectId).execute();
    const partyEvents = await db.selectFrom('history_events').selectAll().where('event_type', '=', 'project.party_member.joined').where('subject_id', '=', projectId).execute();
    assert.equal(acceptedEvents.length, 1);
    assert.equal(partyEvents.length, 1);
    assert.equal(acceptedEvents[0].payload.truth_state, 'OBSERVED');
    assert.equal(partyEvents[0].payload.truth_state, 'OBSERVED');
    assert.equal(JSON.stringify([...acceptedEvents, ...partyEvents]).includes('PROVEN'), false);
    const gates = await db.selectFrom('mission_gates').selectAll().where('mission_id', '=', missionId).execute();
    assert.equal(gates.every((gate) => gate.signal_state === 'UNKNOWN'), true);
  } finally {
    await app.close();
    await db.destroy();
  }
});
