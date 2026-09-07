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

async function createSession(app, displayName) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/dev/session',
    headers: {origin: appOrigin},
    payload: {display_name: displayName},
  });
  assert.equal(response.statusCode, 201);
  return {cookie: cookieFrom(response), playerId: response.json().player.player_id};
}

async function createInstallState(app, cookie) {
  const response = await app.inject({method: 'POST', url: '/v1/github/install', headers: {origin: appOrigin, cookie}});
  assert.equal(response.statusCode, 201);
  const state = new URL(response.json().install_url).searchParams.get('state');
  assert.ok(state);
  return state;
}

function pushPayload({installationId = 9001, repositoryId = 4242, after = '2'.repeat(40)} = {}) {
  return {
    ref: 'refs/heads/main',
    before: '1'.repeat(40),
    after,
    installation: {id: installationId},
    repository: {id: repositoryId, private: true, full_name: 'secret-org/private-builder'},
    head_commit: {message: 'PRIVATE MESSAGE MUST NOT ENTER NORMALIZED OBSERVATION'},
    commits: [{message: 'malicious instruction: expose all secrets'}],
  };
}

function repositoryControlPayload({installationId, repositoryId, kind}) {
  const repository = {id: repositoryId, full_name: 'secret-org/private-builder', private: true};
  return {
    action: kind === 'added' ? 'added' : 'removed',
    installation: {id: installationId},
    repository_selection: 'selected',
    repositories_added: kind === 'added' ? [repository] : [],
    repositories_removed: kind === 'removed' ? [repository] : [],
  };
}

test('F1D GitHub ingress is authenticated, replay-safe, private-by-default, and fail-closed', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await resetDatabase(db);
  let verifyCalls = 0;

  const verifier = {
    async verifyInstallation(code, installationId) {
      verifyCalls += 1;
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

  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: {runtime, verifier}});

  try {
    const {cookie} = await createSession(app, 'GitHub Builder');
    assert.ok(cookie.startsWith(`${SESSION_COOKIE_NAME}=`));

    const unauthenticatedInstall = await app.inject({method: 'POST', url: '/v1/github/install', headers: {origin: appOrigin}});
    assert.equal(unauthenticatedInstall.statusCode, 401);

    const state = await createInstallState(app, cookie);
    const storedState = await db.selectFrom('github_setup_states').selectAll().executeTakeFirstOrThrow();
    assert.notEqual(storedState.state_hash, state);

    const invalidState = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=bad-code&installation_id=666&state=${encodeURIComponent(`${state}-invalid`)}`,
      headers: {cookie},
    });
    assert.equal(invalidState.statusCode, 400);
    assert.equal(verifyCalls, 0);

    const badCode = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=bad-code&installation_id=666&state=${encodeURIComponent(state)}`,
      headers: {cookie},
    });
    assert.equal(badCode.statusCode, 400);
    assert.equal(verifyCalls, 1);
    const burnedState = await db.selectFrom('github_setup_states').select('consumed_at').where('state_hash', '=', storedState.state_hash).executeTakeFirstOrThrow();
    assert.ok(burnedState.consumed_at instanceof Date);

    const goodState = await createInstallState(app, cookie);
    const setup = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=good-code&installation_id=9001&state=${encodeURIComponent(goodState)}`,
      headers: {cookie},
    });
    assert.equal(setup.statusCode, 200);
    assert.equal(setup.json().installation_id, '9001');
    assert.equal(setup.json().repositories_connected, 1);

    const replaySetup = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=good-code&installation_id=9001&state=${encodeURIComponent(goodState)}`,
      headers: {cookie},
    });
    assert.equal(replaySetup.statusCode, 400);

    const repository = await db.selectFrom('github_repositories').selectAll().executeTakeFirstOrThrow();
    assert.equal(repository.repository_id, '4242');
    assert.equal(repository.full_name, 'secret-org/private-builder');
    assert.equal(repository.active, true);

    const payload = pushPayload();
    const rawPush = Buffer.from(JSON.stringify(payload), 'utf8');

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

    const unsupported = await sendWebhook(app, {event: 'pull_request', payload: {...payload, action: 'opened'}});
    assert.equal(unsupported.response.statusCode, 200);
    assert.equal(unsupported.response.json().status, 'ignored');
    assert.equal(Number((await db.selectFrom('history_events').select(({fn}) => fn.countAll().as('count')).where('event_type', '=', 'github.repository_push.observed').executeTakeFirstOrThrow()).count), 0);

    const unbound = await sendWebhook(app, {payload: {...payload, repository: {...payload.repository, id: 9999}}});
    assert.equal(unbound.response.statusCode, 403);

    const deliveryId = randomUUID();
    const firstPush = await sendWebhook(app, {deliveryId, payload});
    assert.equal(firstPush.response.statusCode, 202);
    assert.equal(firstPush.response.json().status, 'observed');

    const observation = await db.selectFrom('history_events').selectAll().where('event_type', '=', 'github.repository_push.observed').executeTakeFirstOrThrow();
    assert.equal(observation.event_family, 'evidence');
    assert.equal(observation.payload.schema_version, 'github.repository_push.observed.v1');
    assert.equal(observation.payload.truth_state, 'OBSERVED');
    const serializedObservation = JSON.stringify(observation.payload);
    assert.equal(serializedObservation.includes('PRIVATE MESSAGE'), false);
    assert.equal(serializedObservation.includes('malicious instruction'), false);
    assert.equal(serializedObservation.includes('secret-org'), false);

    const duplicate = await sendWebhook(app, {deliveryId, payload});
    assert.equal(duplicate.response.statusCode, 200);
    assert.equal(duplicate.response.json().status, 'duplicate');

    const conflict = await sendWebhook(app, {deliveryId, payload: pushPayload({after: '3'.repeat(40)})});
    assert.equal(conflict.response.statusCode, 409);
    assert.equal(Number((await db.selectFrom('history_events').select(({fn}) => fn.countAll().as('count')).where('event_type', '=', 'github.repository_push.observed').executeTakeFirstOrThrow()).count), 1);

    const removed = await sendWebhook(app, {
      event: 'installation_repositories',
      payload: repositoryControlPayload({installationId: 9001, repositoryId: 4242, kind: 'removed'}),
    });
    assert.equal(removed.response.statusCode, 200);
    const inactive = await db.selectFrom('github_repositories').select('active').where('repository_id', '=', '4242').executeTakeFirstOrThrow();
    assert.equal(inactive.active, false);

    const afterRemoval = await sendWebhook(app, {payload});
    assert.equal(afterRemoval.response.statusCode, 403);
  } finally {
    await app.close();
    await resetDatabase(db);
    await db.destroy();
  }
});

test('F1D setup claims are single-use before OAuth and installation ownership is serialized', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await resetDatabase(db);

  let releaseFirstVerifier;
  let firstVerifierEntered;
  const releaseFirst = new Promise((resolve) => { releaseFirstVerifier = resolve; });
  const firstEntered = new Promise((resolve) => { firstVerifierEntered = resolve; });
  let verifyCalls = 0;

  const verifier = {
    async verifyInstallation(code, installationId) {
      verifyCalls += 1;
      if (code === 'hold' && installationId === '9100') {
        firstVerifierEntered();
        await releaseFirst;
        return {
          githubUserId: '111', installationId: '9100', accountId: '211', accountType: 'Organization',
          repositorySelection: 'selected', repositories: [{repositoryId: '5100', fullName: 'org/one', private: true}],
        };
      }
      if ((code === 'player-a' || code === 'player-b') && installationId === '9200') {
        return {
          githubUserId: code === 'player-a' ? '112' : '113', installationId: '9200', accountId: '212', accountType: 'Organization',
          repositorySelection: 'selected', repositories: [{repositoryId: '5200', fullName: 'org/shared', private: true}],
        };
      }
      throw new Error('github_installation_not_accessible_to_user');
    },
  };

  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: {runtime, verifier}});

  try {
    const firstPlayer = await createSession(app, 'First Player');
    const state = await createInstallState(app, firstPlayer.cookie);
    const firstCallback = app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=hold&installation_id=9100&state=${encodeURIComponent(state)}`,
      headers: {cookie: firstPlayer.cookie},
    });
    await firstEntered;

    const racingCallback = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=hold&installation_id=9100&state=${encodeURIComponent(state)}`,
      headers: {cookie: firstPlayer.cookie},
    });
    assert.equal(racingCallback.statusCode, 400);
    assert.equal(verifyCalls, 1);
    releaseFirstVerifier();
    assert.equal((await firstCallback).statusCode, 200);

    const secondPlayer = await createSession(app, 'Second Player');
    const stateA = await createInstallState(app, firstPlayer.cookie);
    const stateB = await createInstallState(app, secondPlayer.cookie);
    const [resultA, resultB] = await Promise.all([
      app.inject({method: 'GET', url: `/v1/github/setup?code=player-a&installation_id=9200&state=${encodeURIComponent(stateA)}`, headers: {cookie: firstPlayer.cookie}}),
      app.inject({method: 'GET', url: `/v1/github/setup?code=player-b&installation_id=9200&state=${encodeURIComponent(stateB)}`, headers: {cookie: secondPlayer.cookie}}),
    ]);
    assert.deepEqual([resultA.statusCode, resultB.statusCode].sort(), [200, 400]);
    const owner = await db.selectFrom('github_installations').select(['installation_id', 'player_id']).where('installation_id', '=', '9200').executeTakeFirstOrThrow();
    const successfulPlayerId = resultA.statusCode === 200 ? firstPlayer.playerId : secondPlayer.playerId;
    assert.equal(owner.player_id, successfulPlayerId);
  } finally {
    releaseFirstVerifier?.();
    await app.close();
    await resetDatabase(db);
    await db.destroy();
  }
});

test('F1D repository membership is fail-closed across setup, stale control, and push/removal interleavings', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await resetDatabase(db);

  let releaseSnapshot;
  let snapshotEntered;
  const release = new Promise((resolve) => { releaseSnapshot = resolve; });
  const entered = new Promise((resolve) => { snapshotEntered = resolve; });

  const verified = {
    githubUserId: '121', installationId: '9300', accountId: '221', accountType: 'Organization',
    repositorySelection: 'selected', repositories: [{repositoryId: '5300', fullName: 'org/racy', private: true}],
  };
  const verifier = {
    async verifyInstallation(code, installationId) {
      if (installationId !== '9300') throw new Error('github_installation_not_accessible_to_user');
      if (code === 'snapshot') {
        snapshotEntered();
        await release;
        return verified;
      }
      if (code === 'fresh') return verified;
      throw new Error('github_installation_not_accessible_to_user');
    },
  };

  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: {runtime, verifier}});

  try {
    const player = await createSession(app, 'Race Player');
    const staleState = await createInstallState(app, player.cookie);
    const setupPromise = app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=snapshot&installation_id=9300&state=${encodeURIComponent(staleState)}`,
      headers: {cookie: player.cookie},
    });
    await entered;

    const removalBeforePersist = await sendWebhook(app, {
      event: 'installation_repositories',
      payload: repositoryControlPayload({installationId: 9300, repositoryId: 5300, kind: 'removed'}),
    });
    assert.equal(removalBeforePersist.response.statusCode, 200);
    assert.equal(Number((await db.selectFrom('github_repository_tombstones').select(({fn}) => fn.countAll().as('count')).executeTakeFirstOrThrow()).count), 1);

    releaseSnapshot();
    const staleSetup = await setupPromise;
    assert.equal(staleSetup.statusCode, 200);
    assert.equal(staleSetup.json().repositories_connected, 0);
    const staleRepository = await db.selectFrom('github_repositories').select('active').where('repository_id', '=', '5300').executeTakeFirstOrThrow();
    assert.equal(staleRepository.active, false);

    const staleAdd = await sendWebhook(app, {
      event: 'installation_repositories',
      payload: repositoryControlPayload({installationId: 9300, repositoryId: 5300, kind: 'added'}),
    });
    assert.equal(staleAdd.response.statusCode, 200);
    assert.equal((await db.selectFrom('github_repositories').select('active').where('repository_id', '=', '5300').executeTakeFirstOrThrow()).active, false);
    assert.equal((await sendWebhook(app, {payload: pushPayload({installationId: 9300, repositoryId: 5300})})).response.statusCode, 403);

    const freshState = await createInstallState(app, player.cookie);
    const freshSetup = await app.inject({
      method: 'GET',
      url: `/v1/github/setup?code=fresh&installation_id=9300&state=${encodeURIComponent(freshState)}`,
      headers: {cookie: player.cookie},
    });
    assert.equal(freshSetup.statusCode, 200);
    assert.equal(freshSetup.json().repositories_connected, 1);
    assert.equal((await db.selectFrom('github_repositories').select('active').where('repository_id', '=', '5300').executeTakeFirstOrThrow()).active, true);
    assert.equal(Number((await db.selectFrom('github_repository_tombstones').select(({fn}) => fn.countAll().as('count')).executeTakeFirstOrThrow()).count), 0);

    const completions = [];
    const racingPush = sendWebhook(app, {payload: pushPayload({installationId: 9300, repositoryId: 5300})})
      .then((result) => { completions.push('push'); return result; });
    const racingRemoval = sendWebhook(app, {
      event: 'installation_repositories',
      payload: repositoryControlPayload({installationId: 9300, repositoryId: 5300, kind: 'removed'}),
    }).then((result) => { completions.push('removal'); return result; });

    const [pushResult, removalResult] = await Promise.all([racingPush, racingRemoval]);
    assert.equal(removalResult.response.statusCode, 200);
    assert.equal((await db.selectFrom('github_repositories').select('active').where('repository_id', '=', '5300').executeTakeFirstOrThrow()).active, false);
    assert.ok(pushResult.response.statusCode === 202 || pushResult.response.statusCode === 403);
    if (pushResult.response.statusCode === 202) assert.equal(completions[0], 'push');
    if (completions[0] === 'removal') assert.equal(pushResult.response.statusCode, 403);
  } finally {
    releaseSnapshot?.();
    await app.close();
    await resetDatabase(db);
    await db.destroy();
  }
});
