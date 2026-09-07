import {createHmac, randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';
const webhookSecret = 'repository-authority-webhook-secret-123456789';
const runtime = {
  appSlug: 'rekt-inkubator-test',
  clientId: 'Iv1.test-client',
  clientSecret: 'test-client-secret',
  webhookSecret,
};

function cookieFrom(response) {
  const value = response.headers['set-cookie'];
  const serialized = Array.isArray(value) ? value[0] : value;
  assert.ok(serialized);
  return serialized.split(';')[0];
}

function sign(raw) {
  return `sha256=${createHmac('sha256', webhookSecret).update(raw).digest('hex')}`;
}

async function resetDatabase(db) {
  await db.deleteFrom('github_repository_tombstones').execute();
  await db.deleteFrom('github_repositories').execute();
  await db.deleteFrom('github_repository_authority').execute();
  await db.deleteFrom('github_installation_tombstones').execute();
  await db.deleteFrom('github_deliveries').execute();
  await db.deleteFrom('github_installations').execute();
  await db.deleteFrom('github_setup_states').execute();
  await db.deleteFrom('outbox_jobs').execute();
  await db.deleteFrom('history_events').execute();
  await db.deleteFrom('sessions').execute();
  await db.deleteFrom('players').execute();
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

async function createInstallState(app, cookie) {
  const response = await app.inject({method: 'POST', url: '/v1/github/install', headers: {origin: appOrigin, cookie}});
  assert.equal(response.statusCode, 201);
  const state = new URL(response.json().install_url).searchParams.get('state');
  assert.ok(state);
  return state;
}

async function sendRemoval(app, installationId, repositoryId) {
  const payload = {
    action: 'removed',
    installation: {id: Number(installationId)},
    repository_selection: 'selected',
    repositories_added: [],
    repositories_removed: [{id: Number(repositoryId), full_name: 'org/repository', private: true}],
  };
  const raw = Buffer.from(JSON.stringify(payload), 'utf8');
  return app.inject({
    method: 'POST',
    url: '/v1/github/webhook',
    headers: {
      'content-type': 'application/json',
      'x-github-delivery': randomUUID(),
      'x-github-event': 'installation_repositories',
      'x-hub-signature-256': sign(raw),
    },
    payload: raw,
  });
}

function verifierFor(installationId, repositoryId) {
  return {
    async verifyInstallation(_code, requestedInstallationId) {
      if (requestedInstallationId !== installationId) throw new Error('github_installation_not_accessible_to_user');
      return {
        githubUserId: '701',
        installationId,
        accountId: '801',
        accountType: 'Organization',
        repositorySelection: 'selected',
        repositories: [{repositoryId, fullName: 'org/repository', private: true}],
      };
    },
  };
}

test('repository authority survives tombstone deletion attempts and rejects cross-installation setup', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await resetDatabase(db);

  const removalInstallationId = '9401';
  const setupInstallationId = '9501';
  const repositoryId = '8801';
  const app = buildApp({
    db,
    appOrigin,
    allowDevAuth: true,
    sessionTtlSeconds: 3600,
    github: {runtime, verifier: verifierFor(setupInstallationId, repositoryId)},
  });

  try {
    const removal = await sendRemoval(app, removalInstallationId, repositoryId);
    assert.equal(removal.statusCode, 200);

    const authorityBefore = await db.selectFrom('github_repository_authority').selectAll().where('repository_id', '=', repositoryId).executeTakeFirstOrThrow();
    assert.equal(authorityBefore.installation_id, removalInstallationId);
    const tombstoneBefore = await db.selectFrom('github_repository_tombstones').selectAll().where('repository_id', '=', repositoryId).executeTakeFirstOrThrow();
    assert.equal(tombstoneBefore.installation_id, removalInstallationId);

    const cookie = await createSession(app, 'Cross Install Setup');
    const state = await createInstallState(app, cookie);
    const setup = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=good-code&installation_id=${setupInstallationId}&state=${encodeURIComponent(state)}`,
      headers: {cookie},
    });
    assert.equal(setup.statusCode, 400);

    const authorityAfter = await db.selectFrom('github_repository_authority').selectAll().where('repository_id', '=', repositoryId).executeTakeFirstOrThrow();
    assert.equal(authorityAfter.installation_id, removalInstallationId);
    const tombstoneAfter = await db.selectFrom('github_repository_tombstones').selectAll().where('repository_id', '=', repositoryId).executeTakeFirstOrThrow();
    assert.equal(tombstoneAfter.installation_id, removalInstallationId);
    const repository = await db.selectFrom('github_repositories').select('repository_id').where('repository_id', '=', repositoryId).executeTakeFirst();
    assert.equal(repository, undefined);
  } finally {
    await app.close();
    await resetDatabase(db);
    await db.destroy();
  }
});

test('cross-installation removal/setup race has exactly one repository authority winner', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await resetDatabase(db);

  const removalInstallationId = '9402';
  const setupInstallationId = '9502';
  const repositoryId = '8802';
  const app = buildApp({
    db,
    appOrigin,
    allowDevAuth: true,
    sessionTtlSeconds: 3600,
    github: {runtime, verifier: verifierFor(setupInstallationId, repositoryId)},
  });

  try {
    const cookie = await createSession(app, 'Cross Install Race');
    const state = await createInstallState(app, cookie);

    const [removal, setup] = await Promise.all([
      sendRemoval(app, removalInstallationId, repositoryId),
      app.inject({
        method: 'GET',
        url: `/v1/github/setup?code=good-code&installation_id=${setupInstallationId}&state=${encodeURIComponent(state)}`,
        headers: {cookie},
      }),
    ]);

    assert.deepEqual([removal.statusCode, setup.statusCode].sort(), [200, 400]);

    const authority = await db.selectFrom('github_repository_authority').selectAll().where('repository_id', '=', repositoryId).executeTakeFirstOrThrow();
    assert.ok(authority.installation_id === removalInstallationId || authority.installation_id === setupInstallationId);

    const repository = await db.selectFrom('github_repositories').select(['repository_id', 'installation_id', 'active']).where('repository_id', '=', repositoryId).executeTakeFirst();
    const tombstone = await db.selectFrom('github_repository_tombstones').select(['repository_id', 'installation_id']).where('repository_id', '=', repositoryId).executeTakeFirst();

    if (setup.statusCode === 200) {
      assert.equal(authority.installation_id, setupInstallationId);
      assert.equal(repository?.installation_id, setupInstallationId);
      assert.equal(repository?.active, true);
      assert.equal(tombstone, undefined);
    } else {
      assert.equal(authority.installation_id, removalInstallationId);
      assert.equal(tombstone?.installation_id, removalInstallationId);
      assert.equal(repository, undefined);
    }
  } finally {
    await app.close();
    await resetDatabase(db);
    await db.destroy();
  }
});
