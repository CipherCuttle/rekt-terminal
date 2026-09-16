import assert from 'node:assert/strict';
import test from 'node:test';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {createPlayer} from '../../dist/players.js';
import {buildFundedChallengeProductionApp} from '../../dist/production-app.js';
import {
  createSession,
  resolveFreshSessionActor,
  resolveSessionActor,
  revokeSession,
  SESSION_COOKIE_NAME,
  SESSION_STEP_UP_MAX_AGE_SECONDS,
} from '../../dist/session.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';
const displayName = 'H3 Session Security Builder';
const github = {
  runtime: {
    appSlug: 'rekt-inkubator-h3-test',
    clientId: 'Iv1.h3-test',
    clientSecret: 'h3-test-client-secret',
    webhookSecret: 'h3-test-webhook-secret-123456',
  },
  githubAppAuth: null,
};

async function cleanup(db) {
  const players = await db.selectFrom('players').select('player_id').where('display_name', '=', displayName).execute();
  const ids = players.map((row) => row.player_id);
  if (ids.length > 0) {
    await db.deleteFrom('sessions').where('player_id', 'in', ids).execute();
    await db.deleteFrom('players').where('player_id', 'in', ids).execute();
  }
}

function cookie(token) {
  return `${SESSION_COOKIE_NAME}=${token}`;
}

test('H3 session revoke, account-wide revoke and fresh-auth replay boundaries fail closed', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await cleanup(db);
  const player = await createPlayer(db, displayName);
  const app = buildFundedChallengeProductionApp({
    db,
    appOrigin,
    sessionTtlSeconds: 3600,
    github,
  });
  await app.ready();

  try {
    const first = await createSession(db, player.player_id, 3600);
    const second = await createSession(db, player.player_id, 3600);
    assert.deepEqual(await resolveSessionActor(db, first.token), {playerId: player.player_id});
    assert.deepEqual(await resolveSessionActor(db, second.token), {playerId: player.player_id});

    await revokeSession(db, first.token);
    assert.equal(await resolveSessionActor(db, first.token), null);
    assert.deepEqual(await resolveSessionActor(db, second.token), {playerId: player.player_id});

    const third = await createSession(db, player.player_id, 3600);
    const revokeAll = await app.inject({
      method: 'DELETE',
      url: '/v1/sessions',
      headers: {origin: appOrigin, cookie: cookie(second.token)},
    });
    assert.equal(revokeAll.statusCode, 204, revokeAll.body);
    assert.equal(await resolveSessionActor(db, second.token), null);
    assert.equal(await resolveSessionActor(db, third.token), null);

    const stale = await createSession(db, player.player_id, 3600);
    await db.updateTable('sessions').set({created_at: new Date(Date.now() - 20 * 60 * 1000)}).where('session_id', '=', stale.sessionId).execute();
    assert.deepEqual(await resolveSessionActor(db, stale.token), {playerId: player.player_id});
    assert.equal(await resolveFreshSessionActor(db, stale.token, SESSION_STEP_UP_MAX_AGE_SECONDS), null);

    const staleReconcile = await app.inject({
      method: 'POST',
      url: '/v1/github/reconcile',
      headers: {origin: appOrigin, cookie: cookie(stale.token)},
    });
    assert.equal(staleReconcile.statusCode, 403, staleReconcile.body);
    assert.deepEqual(staleReconcile.json(), {error: 'reauthentication_required'});

    const fresh = await createSession(db, player.player_id, 3600);
    assert.deepEqual(await resolveFreshSessionActor(db, fresh.token, SESSION_STEP_UP_MAX_AGE_SECONDS), {playerId: player.player_id});
    const freshReconcile = await app.inject({
      method: 'POST',
      url: '/v1/github/reconcile',
      headers: {origin: appOrigin, cookie: cookie(fresh.token)},
    });
    assert.equal(freshReconcile.statusCode, 503, freshReconcile.body);
    assert.deepEqual(freshReconcile.json(), {error: 'github_server_auth_unavailable'});
  } finally {
    await app.close();
    await cleanup(db);
    await db.destroy();
  }
});
