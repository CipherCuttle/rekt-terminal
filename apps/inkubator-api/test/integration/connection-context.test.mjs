import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const origin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';

function cookieFrom(response) {
  const value = response.headers['set-cookie'];
  const serialized = Array.isArray(value) ? value[0] : value;
  assert.ok(serialized);
  return serialized.split(';')[0];
}

test('private connection context separates access states and recovers a revoked linked source', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin: origin, allowDevAuth: true, sessionTtlSeconds: 3600});
  const suffix = randomUUID().slice(0, 8);
  let playerId;
  let projectId;
  try {
    const session = await app.inject({method: 'POST', url: '/v1/dev/session', headers: {origin}, payload: {display_name: `Connection context ${suffix}`}});
    assert.equal(session.statusCode, 201, session.body);
    const cookie = cookieFrom(session);
    playerId = session.json().player.player_id;

    const initial = await app.inject({method: 'GET', url: '/v1/me/connection', headers: {cookie}});
    assert.equal(initial.statusCode, 200, initial.body);
    assert.deepEqual(initial.json().states, {
      signed_in: 'SIGNED_IN',
      app_access: 'NOT_GRANTED',
      repository_authorized: 'NOT_AUTHORIZED',
      project_linked: 'NOT_LINKED',
      observing: 'NOT_OBSERVING',
    });

    const project = await app.inject({method: 'POST', url: '/v1/development/projects', headers: {origin, cookie}, payload: {
      name: `Connection project ${suffix}`,
      goal: 'Make connection state legible',
      ship_condition: 'The state is truthful',
      current_focus: 'Wire the source',
      next_move: 'Observe one push',
    }});
    assert.equal(project.statusCode, 201, project.body);
    projectId = project.json().project_id;

    const installationId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const repositoryId = `${Number(installationId) + 1}`;
    await db.insertInto('github_installations').values({
      installation_id: installationId,
      player_id: playerId,
      github_user_id: '700001',
      account_id: '700002',
      account_type: 'User',
      repository_selection: 'selected',
      revoked_at: null,
    }).execute();
    await db.insertInto('github_repositories').values({repository_id: repositoryId, installation_id: installationId, full_name: `context/${suffix}`, private: true, active: true}).execute();

    const linked = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/github-repositories`, headers: {origin, cookie}, payload: {repository_id: repositoryId}});
    assert.equal(linked.statusCode, 200, linked.body);
    const available = await app.inject({method: 'GET', url: '/v1/me/connection', headers: {cookie}});
    assert.deepEqual(available.json().states, {
      signed_in: 'SIGNED_IN', app_access: 'GRANTED', repository_authorized: 'AUTHORIZED', project_linked: 'LINKED', observing: 'OBSERVING',
    });
    assert.equal(available.json().github.user_id, null, 'dev auth has no GitHub identity authority');

    await db.updateTable('github_installations').set({revoked_at: new Date()}).where('installation_id', '=', installationId).execute();
    await db.updateTable('github_repositories').set({active: false}).where('repository_id', '=', repositoryId).execute();
    const revoked = await app.inject({method: 'GET', url: '/v1/me/connection', headers: {cookie}});
    assert.deepEqual(revoked.json().states, {
      signed_in: 'SIGNED_IN', app_access: 'REVOKED', repository_authorized: 'REVOKED', project_linked: 'ACCESS_REVOKED', observing: 'UNAVAILABLE',
    });
    assert.equal(revoked.json().source.availability, 'REVOKED');

    const replacementInstallationId = `${Number(installationId) + 10}`;
    const replacementRepositoryId = `${Number(installationId) + 11}`;
    await db.insertInto('github_installations').values({installation_id: replacementInstallationId, player_id: playerId, github_user_id: '700001', account_id: '700003', account_type: 'User', repository_selection: 'selected', revoked_at: null}).execute();
    await db.insertInto('github_repositories').values({repository_id: replacementRepositoryId, installation_id: replacementInstallationId, full_name: `context/${suffix}-replacement`, private: false, active: true}).execute();
    const repaired = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/github-repositories`, headers: {origin, cookie}, payload: {repository_id: replacementRepositoryId}});
    assert.equal(repaired.statusCode, 200, repaired.body);
    const recovered = await app.inject({method: 'GET', url: '/v1/me/connection', headers: {cookie}});
    assert.deepEqual(recovered.json().states, {
      signed_in: 'SIGNED_IN', app_access: 'GRANTED', repository_authorized: 'AUTHORIZED', project_linked: 'LINKED', observing: 'OBSERVING',
    });
    assert.equal(recovered.json().source.repository_full_name, `context/${suffix}-replacement`);
  } finally {
    if (playerId) await db.deleteFrom('players').where('player_id', '=', playerId).execute();
    await app.close();
    await db.destroy();
  }
});
