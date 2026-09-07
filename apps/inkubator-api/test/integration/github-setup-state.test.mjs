import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';
const runtime = {
  appSlug: 'rekt-inkubator-test',
  clientId: 'Iv1.test-client',
  clientSecret: 'test-client-secret',
  webhookSecret: 'setup-state-webhook-secret-123456',
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

test('GitHub setup rejects invalid state before OAuth verification, spends claimed state, and refuses repository re-parenting', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await resetDatabase(db);
  let verifierCalls = 0;
  const verifier = {
    async verifyInstallation(_code, installationId) {
      verifierCalls += 1;
      return {
        githubUserId: installationId === '9001' ? '101' : '102',
        installationId,
        accountId: installationId === '9001' ? '201' : '202',
        accountType: 'Organization',
        repositorySelection: 'selected',
        repositories: [{repositoryId: '4242', fullName: 'secret-org/private-builder', private: true}],
      };
    },
  };
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: {runtime, verifier}});

  try {
    const firstSession = await app.inject({method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: 'First GitHub Builder'}});
    const firstCookie = cookieFrom(firstSession);
    const firstInstall = await app.inject({method: 'POST', url: '/v1/github/install', headers: {origin: appOrigin, cookie: firstCookie}});
    const firstState = new URL(firstInstall.json().install_url).searchParams.get('state');
    assert.ok(firstState);

    const invalidState = await app.inject({
      method: 'GET',
      url: '/v1/github/setup?code=good-code&installation_id=9001&state=tampered-state',
      headers: {cookie: firstCookie},
    });
    assert.equal(invalidState.statusCode, 400);
    assert.equal(invalidState.json().error, 'github_setup_state_invalid');
    assert.equal(verifierCalls, 0);

    const firstSetup = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=good-code&installation_id=9001&state=${encodeURIComponent(firstState)}`,
      headers: {cookie: firstCookie},
    });
    assert.equal(firstSetup.statusCode, 200);
    assert.equal(verifierCalls, 1);

    const secondSession = await app.inject({method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: 'Second GitHub Builder'}});
    const secondCookie = cookieFrom(secondSession);
    const secondInstall = await app.inject({method: 'POST', url: '/v1/github/install', headers: {origin: appOrigin, cookie: secondCookie}});
    const secondState = new URL(secondInstall.json().install_url).searchParams.get('state');
    assert.ok(secondState);

    const reparentAttempt = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=good-code&installation_id=9002&state=${encodeURIComponent(secondState)}`,
      headers: {cookie: secondCookie},
    });
    assert.equal(reparentAttempt.statusCode, 400);
    assert.equal(reparentAttempt.json().error, 'github_repository_already_bound');
    assert.equal(verifierCalls, 2);

    const repository = await db.selectFrom('github_repositories').select(['installation_id', 'repository_id']).where('repository_id', '=', '4242').executeTakeFirstOrThrow();
    assert.equal(repository.installation_id, '9001');
    const secondInstallation = await db.selectFrom('github_installations').select('installation_id').where('installation_id', '=', '9002').executeTakeFirst();
    assert.equal(secondInstallation, undefined);
    const secondStateRow = await db.selectFrom('github_setup_states').select('consumed_at').where('player_id', '=', secondSession.json().player.player_id).executeTakeFirstOrThrow();
    assert.ok(secondStateRow.consumed_at instanceof Date);

    const replayAfterFailedBinding = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=good-code&installation_id=9002&state=${encodeURIComponent(secondState)}`,
      headers: {cookie: secondCookie},
    });
    assert.equal(replayAfterFailedBinding.statusCode, 400);
    assert.equal(replayAfterFailedBinding.json().error, 'github_setup_state_invalid');
    assert.equal(verifierCalls, 2);
  } finally {
    await app.close();
    await resetDatabase(db);
    await db.destroy();
  }
});
