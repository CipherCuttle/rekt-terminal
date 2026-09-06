import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {hashSessionToken, SESSION_COOKIE_NAME} from '../../dist/session.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';

function cookieFrom(response) {
  const value = response.headers['set-cookie'];
  const serialized = Array.isArray(value) ? value[0] : value;
  assert.ok(serialized);
  return serialized.split(';')[0];
}

function tokenFromCookie(cookie) {
  const prefix = `${SESSION_COOKIE_NAME}=`;
  assert.ok(cookie.startsWith(prefix));
  return cookie.slice(prefix.length);
}

test('real Postgres session boundary preserves auth and projection invariants', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  await db.deleteFrom('sessions').execute();
  await db.deleteFrom('players').execute();

  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600});
  try {
    const deniedOrigin = await app.inject({
      method: 'POST', url: '/v1/dev/session', headers: {origin: 'https://evil.example'}, payload: {display_name: 'Nope'},
    });
    assert.equal(deniedOrigin.statusCode, 403);

    const first = await app.inject({
      method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: ' First Builder '},
    });
    assert.equal(first.statusCode, 201);
    const firstBody = first.json();
    const firstCookie = cookieFrom(first);
    const firstToken = tokenFromCookie(firstCookie);
    assert.equal(firstBody.player.display_name, 'First Builder');
    assert.equal(JSON.stringify(firstBody).includes(firstToken), false);

    const stored = await db.selectFrom('sessions').select(['token_hash']).executeTakeFirstOrThrow();
    assert.equal(stored.token_hash, hashSessionToken(firstToken));
    assert.notEqual(stored.token_hash, firstToken);

    const me = await app.inject({method: 'GET', url: '/v1/me', headers: {cookie: firstCookie}});
    assert.equal(me.statusCode, 200);
    assert.equal(me.headers['cache-control'], 'no-store');

    const publicView = await app.inject({method: 'GET', url: `/v1/players/${firstBody.player.player_id}`});
    assert.equal(publicView.statusCode, 200);
    assert.deepEqual(Object.keys(publicView.json()).sort(), ['display_name', 'player_id', 'schema_version']);

    const second = await app.inject({
      method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: 'Second Builder'},
    });
    assert.equal(second.statusCode, 201);
    const secondCookie = cookieFrom(second);

    const crossPlayer = await app.inject({
      method: 'GET', url: `/v1/players/${firstBody.player.player_id}/private`, headers: {cookie: secondCookie},
    });
    assert.equal(crossPlayer.statusCode, 403);

    const ownPrivate = await app.inject({
      method: 'GET', url: `/v1/players/${firstBody.player.player_id}/private`, headers: {cookie: firstCookie},
    });
    assert.equal(ownPrivate.statusCode, 200);
    assert.equal(ownPrivate.json().schema_version, 'player.private.v1');

    const contract = await app.inject({method: 'GET', url: '/openapi.json'});
    assert.equal(contract.statusCode, 200);
    assert.equal(contract.json().openapi, '3.1.0');

    const logout = await app.inject({method: 'DELETE', url: '/v1/session', headers: {origin: appOrigin, cookie: firstCookie}});
    assert.equal(logout.statusCode, 204);
    const afterLogout = await app.inject({method: 'GET', url: '/v1/me', headers: {cookie: firstCookie}});
    assert.equal(afterLogout.statusCode, 401);
  } finally {
    await app.close();
    await db.destroy();
  }
});

test('development identity bootstrap is absent when disabled', async () => {
  const db = createDatabase(databaseUrl);
  const app = buildApp({db, appOrigin, allowDevAuth: false, sessionTtlSeconds: 3600});
  try {
    const response = await app.inject({
      method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: 'Builder'},
    });
    assert.equal(response.statusCode, 404);
  } finally {
    await app.close();
    await db.destroy();
  }
});
