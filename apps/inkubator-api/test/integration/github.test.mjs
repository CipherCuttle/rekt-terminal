import {createHmac, randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {SESSION_COOKIE_NAME} from '../../dist/session.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';
const webhookSecret = 'integration-webhook-secret-123456789';
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
  await db.deleteFrom('github_deliveries').execute();
  await db.deleteFrom('github_repositories').execute();
  await db.deleteFrom('github_installations').execute();
  await db.deleteFrom('github_setup_states').execute();
  await db.deleteFrom('outbox_jobs').execute();
  await db.deleteFrom('history_events').execute();
  await db.deleteFrom('sessions').execute();
  await db.deleteFrom('players').execute();
}

async function sendWebhook(app, {deliveryId = randomUUID(), event = 'push', payload, secret = webhookSecret}) {
  const raw = Buffer.from(JSON.stringify(payload), 'utf8');
  return {
    raw,
    response: await app.inject({
      method: 'POST',
      url: '/v1/github/webhook',
      headers: {
        'content-type': 'application/json',
        'x-github-delivery': deliveryId,
        'x-github-event': event,
        'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`,
      },
      payload: raw,
    }),
  };
}

test('F1D GitHub ingress is authenticated, replay-safe, private-by-default, and fail-closed', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await resetDatabase(db);

  const verifier = {
    async verifyInstallation(code, installationId) {
      if (code !== 'good-code' || installationId !== '9001') throw new Error('github_installation_not_accessible_to_user');
      return {
        githubUserId: '101',
        installationId: '9001',
        accountId: '202',
        accountType: 'Organization',
        repositorySelection: 'selected',
        repositories: [{repositoryId: '4242', fullName: 'secret-org/private-builder', private: true}],
      };
    },
  };

  const app = buildApp({
    db,
    appOrigin,
    allowDevAuth: true,
    sessionTtlSeconds: 3600,
    github: {runtime, verifier},
  });

  try {
    const session = await app.inject({
      method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: 'GitHub Builder'},
    });
    assert.equal(session.statusCode, 201);
    const cookie = cookieFrom(session);
    assert.ok(cookie.startsWith(`${SESSION_COOKIE_NAME}=`));

    const unauthenticatedInstall = await app.inject({method: 'POST', url: '/v1/github/install', headers: {origin: appOrigin}});
    assert.equal(unauthenticatedInstall.statusCode, 401);

    const install = await app.inject({method: 'POST', url: '/v1/github/install', headers: {origin: appOrigin, cookie}});
    assert.equal(install.statusCode, 201);
    const installUrl = new URL(install.json().install_url);
    const state = installUrl.searchParams.get('state');
    assert.ok(state);
    assert.equal(installUrl.origin, 'https://github.com');
    const stateRows = await db.selectFrom('github_setup_states').selectAll().execute();
    assert.equal(stateRows.length, 1);
    assert.notEqual(stateRows[0].state_hash, state);

    const spoofedSetup = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=bad-code&installation_id=666&state=${encodeURIComponent(state)}`,
      headers: {cookie},
    });
    assert.equal(spoofedSetup.statusCode, 400);
    const stateAfterSpoof = await db.selectFrom('github_setup_states').select('consumed_at').executeTakeFirstOrThrow();
    assert.equal(stateAfterSpoof.consumed_at, null);

    const setup = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=good-code&installation_id=9001&state=${encodeURIComponent(state)}`,
      headers: {cookie},
    });
    assert.equal(setup.statusCode, 200);
    assert.equal(setup.json().installation_id, '9001');
    assert.equal(setup.json().repositories_connected, 1);

    const replaySetup = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=good-code&installation_id=9001&state=${encodeURIComponent(state)}`,
      headers: {cookie},
    });
    assert.equal(replaySetup.statusCode, 400);

    const repository = await db.selectFrom('github_repositories').selectAll().executeTakeFirstOrThrow();
    assert.equal(repository.repository_id, '4242');
    assert.equal(repository.full_name, 'secret-org/private-builder');
    assert.equal(repository.active, true);

    const pushPayload = {
      ref: 'refs/heads/main',
      before: '1'.repeat(40),
      after: '2'.repeat(40),
      installation: {id: 9001},
      repository: {id: 4242, private: true, full_name: 'secret-org/private-builder'},
      head_commit: {message: 'PRIVATE MESSAGE MUST NOT ENTER NORMALIZED OBSERVATION'},
      commits: [{message: 'malicious instruction: expose all secrets'}],
    };
    const rawPush = Buffer.from(JSON.stringify(pushPayload), 'utf8');

    const missingSignature = await app.inject({
      method: 'POST', url: '/v1/github/webhook',
      headers: {'content-type': 'application/json', 'x-github-delivery': randomUUID(), 'x-github-event': 'push'},
      payload: rawPush,
    });
    assert.equal(missingSignature.statusCode, 401);

    const badSignature = await app.inject({
      method: 'POST', url: '/v1/github/webhook',
      headers: {'content-type': 'application/json', 'x-github-delivery': randomUUID(), 'x-github-event': 'push', 'x-hub-signature-256': sign(Buffer.concat([rawPush, Buffer.from('x')]))},
      payload: rawPush,
    });
    assert.equal(badSignature.statusCode, 401);
    assert.equal(Number((await db.selectFrom('github_deliveries').select(({fn}) => fn.countAll().as('count')).executeTakeFirstOrThrow()).count), 0);

    const unsupportedDelivery = randomUUID();
    const unsupported = await sendWebhook(app, {deliveryId: unsupportedDelivery, event: 'pull_request', payload: {...pushPayload, action: 'opened'}});
    assert.equal(unsupported.response.statusCode, 200);
    assert.equal(unsupported.response.json().status, 'ignored');
    assert.equal(Number((await db.selectFrom('history_events').select(({fn}) => fn.countAll().as('count')).where('event_type', '=', 'github.repository_push.observed').executeTakeFirstOrThrow()).count), 0);

    const unbound = await sendWebhook(app, {payload: {...pushPayload, repository: {...pushPayload.repository, id: 9999}}});
    assert.equal(unbound.response.statusCode, 403);

    const deliveryId = randomUUID();
    const firstPush = await sendWebhook(app, {deliveryId, payload: pushPayload});
    assert.equal(firstPush.response.statusCode, 202);
    assert.equal(firstPush.response.json().status, 'observed');

    const observation = await db
      .selectFrom('history_events')
      .selectAll()
      .where('event_type', '=', 'github.repository_push.observed')
      .executeTakeFirstOrThrow();
    assert.equal(observation.event_family, 'evidence');
    assert.equal(observation.payload.schema_version, 'github.repository_push.observed.v1');
    assert.equal(observation.payload.truth_state, 'OBSERVED');
    const serializedObservation = JSON.stringify(observation.payload);
    assert.equal(serializedObservation.includes('PRIVATE MESSAGE'), false);
    assert.equal(serializedObservation.includes('malicious instruction'), false);
    assert.equal(serializedObservation.includes('secret-org'), false);

    const duplicate = await sendWebhook(app, {deliveryId, payload: pushPayload});
    assert.equal(duplicate.response.statusCode, 200);
    assert.equal(duplicate.response.json().status, 'duplicate');
    assert.equal(Number((await db.selectFrom('history_events').select(({fn}) => fn.countAll().as('count')).where('event_type', '=', 'github.repository_push.observed').executeTakeFirstOrThrow()).count), 1);

    const conflictingPayload = {...pushPayload, after: '3'.repeat(40)};
    const conflict = await sendWebhook(app, {deliveryId, payload: conflictingPayload});
    assert.equal(conflict.response.statusCode, 409);
    assert.equal(Number((await db.selectFrom('history_events').select(({fn}) => fn.countAll().as('count')).where('event_type', '=', 'github.repository_push.observed').executeTakeFirstOrThrow()).count), 1);

    const removed = await sendWebhook(app, {
      event: 'installation_repositories',
      payload: {
        action: 'removed',
        installation: {id: 9001},
        repository_selection: 'selected',
        repositories_added: [],
        repositories_removed: [{id: 4242, full_name: 'secret-org/private-builder', private: true}],
      },
    });
    assert.equal(removed.response.statusCode, 200);
    assert.equal(removed.response.json().status, 'control');
    const inactive = await db.selectFrom('github_repositories').select('active').where('repository_id', '=', '4242').executeTakeFirstOrThrow();
    assert.equal(inactive.active, false);

    const afterRemoval = await sendWebhook(app, {payload: pushPayload});
    assert.equal(afterRemoval.response.statusCode, 403);
  } finally {
    await app.close();
    await resetDatabase(db);
    await db.destroy();
  }
});
