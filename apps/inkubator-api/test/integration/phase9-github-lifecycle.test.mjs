import {createHmac, randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';
const webhookSecret = 'phase9-lifecycle-webhook-secret-123456789';
const runtime = {
  appSlug: 'rekt-inkubator-phase9-lifecycle',
  clientId: 'Iv1.phase9-lifecycle',
  clientSecret: 'phase9-lifecycle-secret',
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

test('P9-H02 authenticated push refreshes repository rename and visibility without changing repository authority', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await resetDatabase(db);

  const installationId = '99001';
  const repositoryId = '99002';
  const originalName = 'private-rehearsal/original-name';
  const renamedName = 'public-rehearsal/renamed-repository';
  const verifier = {
    async verifyInstallation(code, requestedInstallationId) {
      assert.equal(code, 'phase9-lifecycle-code');
      assert.equal(requestedInstallationId, installationId);
      return {
        githubUserId: '99003',
        installationId,
        accountId: '99004',
        accountType: 'Organization',
        repositorySelection: 'selected',
        repositories: [{repositoryId, fullName: originalName, private: true}],
      };
    },
  };
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: {runtime, verifier}});

  try {
    const session = await app.inject({
      method: 'POST',
      url: '/v1/dev/session',
      headers: {origin: appOrigin},
      payload: {display_name: 'P9 Lifecycle Builder'},
    });
    assert.equal(session.statusCode, 201, session.body);
    const cookie = cookieFrom(session);

    const install = await app.inject({method: 'POST', url: '/v1/github/install', headers: {origin: appOrigin, cookie}});
    assert.equal(install.statusCode, 201, install.body);
    const state = new URL(install.json().install_url).searchParams.get('state');
    assert.ok(state);

    const setup = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=phase9-lifecycle-code&installation_id=${installationId}&state=${encodeURIComponent(state)}`,
      headers: {cookie},
    });
    assert.equal(setup.statusCode, 200, setup.body);

    const before = await db.selectFrom('github_repositories').selectAll().where('repository_id', '=', repositoryId).executeTakeFirstOrThrow();
    assert.equal(before.full_name, originalName);
    assert.equal(before.private, true);
    const authorityBefore = await db.selectFrom('github_repository_authority').selectAll().where('repository_id', '=', repositoryId).executeTakeFirstOrThrow();

    const payload = {
      ref: 'refs/heads/main',
      before: '1'.repeat(40),
      after: '2'.repeat(40),
      installation: {id: Number(installationId)},
      repository: {
        id: Number(repositoryId),
        private: false,
        full_name: renamedName,
        default_branch: 'main',
      },
      head_commit: {message: 'rename lifecycle observation'},
      commits: [{added: [], modified: [], removed: []}],
    };
    const raw = Buffer.from(JSON.stringify(payload), 'utf8');
    const push = await app.inject({
      method: 'POST',
      url: '/v1/github/webhook',
      headers: {
        'content-type': 'application/json',
        'x-github-delivery': randomUUID(),
        'x-github-event': 'push',
        'x-hub-signature-256': sign(raw),
      },
      payload: raw,
    });
    assert.equal(push.statusCode, 202, push.body);

    const after = await db.selectFrom('github_repositories').selectAll().where('repository_id', '=', repositoryId).executeTakeFirstOrThrow();
    assert.equal(after.full_name, renamedName, 'authenticated current GitHub push must refresh mutable repository name metadata');
    assert.equal(after.private, false, 'authenticated current GitHub push must refresh visibility metadata');

    const authorityAfter = await db.selectFrom('github_repository_authority').selectAll().where('repository_id', '=', repositoryId).executeTakeFirstOrThrow();
    assert.equal(authorityAfter.installation_id, authorityBefore.installation_id);
  } finally {
    await app.close();
    await resetDatabase(db);
    await db.destroy();
  }
});
