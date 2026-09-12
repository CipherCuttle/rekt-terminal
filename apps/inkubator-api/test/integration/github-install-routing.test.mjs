import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {registerGitHubLoginRoutes} from '../../dist/github-login-routes.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';
const runtime = {
  appSlug: 'rekt-inkubator-test',
  clientId: 'Iv1.test-client',
  clientSecret: 'test-client-secret',
  webhookSecret: 'setup-routing-webhook-secret-123456',
};

function cookieFrom(response) {
  const value = response.headers['set-cookie'];
  const serialized = Array.isArray(value) ? value[0] : value;
  assert.ok(serialized);
  return serialized.split(';')[0];
}

async function resetDatabase(db) {
  await db.deleteFrom('github_repository_tombstones').execute();
  await db.deleteFrom('github_installation_tombstones').execute();
  await db.deleteFrom('github_deliveries').execute();
  await db.deleteFrom('github_repositories').execute();
  await db.deleteFrom('github_installations').execute();
  await db.deleteFrom('github_setup_states').execute();
  await db.deleteFrom('outbox_jobs').execute();
  await db.deleteFrom('history_events').execute();
  await db.deleteFrom('sessions').execute();
  await db.deleteFrom('players').execute();
}

test('GitHub Setup URL callback consumes opaque state and closes the provider loop into PKCE verification', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await resetDatabase(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  registerGitHubLoginRoutes(app, {db, appOrigin, sessionTtlSeconds: 3600, github: runtime, githubAppAuth: null});

  try {
    const session = await app.inject({
      method: 'POST',
      url: '/v1/dev/session',
      headers: {origin: appOrigin},
      payload: {display_name: 'Setup Routing Builder'},
    });
    assert.equal(session.statusCode, 201, session.body);
    const cookie = cookieFrom(session);

    const install = await app.inject({method: 'GET', url: '/v1/auth/github/install', headers: {cookie}});
    assert.equal(install.statusCode, 302, install.body);
    const installUrl = new URL(install.headers.location);
    assert.equal(installUrl.origin, 'https://github.com');
    const state = installUrl.searchParams.get('state');
    assert.ok(state);

    const callback = await app.inject({
      method: 'GET',
      url: `/v1/github/install/callback?installation_id=9001&setup_action=install&state=${encodeURIComponent(state)}`,
      headers: {cookie},
    });
    assert.equal(callback.statusCode, 302, callback.body);
    const oauthUrl = new URL(callback.headers.location);
    assert.equal(oauthUrl.origin, 'https://github.com');
    assert.equal(oauthUrl.pathname, '/login/oauth/authorize');
    assert.equal(oauthUrl.searchParams.get('code_challenge_method'), 'S256');
    const callbackCookies = Array.isArray(callback.headers['set-cookie']) ? callback.headers['set-cookie'] : [callback.headers['set-cookie']];
    assert.ok(callbackCookies.some(value => value?.includes('__Host-rekt_github_oauth_flow=install')));
    assert.ok(callbackCookies.some(value => value?.includes('__Host-rekt_github_pending_installation=9001')));

    const replay = await app.inject({
      method: 'GET',
      url: `/v1/github/install/callback?installation_id=9001&setup_action=install&state=${encodeURIComponent(state)}`,
      headers: {cookie},
    });
    assert.equal(replay.statusCode, 302, replay.body);
    const replayUrl = new URL(replay.headers.location);
    assert.equal(replayUrl.origin, new URL(appOrigin).origin);
    assert.equal(replayUrl.searchParams.get('source'), 'authorization_failed');
    assert.equal(replayUrl.searchParams.get('reason'), 'github_setup_state_invalid');
  } finally {
    await app.close();
    await resetDatabase(db);
    await db.destroy();
  }
});
