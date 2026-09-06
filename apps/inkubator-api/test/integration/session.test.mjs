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
    const deniedPreflight = await app.inject({
      method: 'OPTIONS',
      url: '/v1/dev/session',
      headers: {origin: 'https://evil.example', 'access-control-request-method': 'POST'},
    });
    assert.equal(deniedPreflight.statusCode, 403);

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/v1/dev/session',
      headers: {
        origin: appOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.headers['access-control-allow-origin'], appOrigin);
    assert.equal(preflight.headers['access-control-allow-credentials'], 'true');
    assert.match(preflight.headers['access-control-allow-methods'] ?? '', /\bPOST\b/);
    assert.match(preflight.headers['access-control-allow-headers'] ?? '', /\bcontent-type\b/);

    const deniedOrigin = await app.inject({
      method: 'POST', url: '/v1/dev/session', headers: {origin: 'https://evil.example'}, payload: {display_name: 'Nope'},
    });
    assert.equal(deniedOrigin.statusCode, 403);

    const first = await app.inject({
      method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: ' First Builder '},
    });
    assert.equal(first.statusCode, 201);
    assert.equal(first.headers['access-control-allow-origin'], appOrigin);
    assert.equal(first.headers['access-control-allow-credentials'], 'true');
    const firstBody = first.json();
    const firstCookie = cookieFrom(first);
    const firstToken = tokenFromCookie(firstCookie);
    assert.equal(firstBody.player.display_name, 'First Builder');
    assert.equal(JSON.stringify(firstBody).includes(firstToken), false);

    const stored = await db.selectFrom('sessions').select(['token_hash']).executeTakeFirstOrThrow();
    assert.equal(stored.token_hash, hashSessionToken(firstToken));
    assert.notEqual(stored.token_hash, firstToken);

    const me = await app.inject({method: 'GET', url: '/v1/me', headers: {origin: appOrigin, cookie: firstCookie}});
    assert.equal(me.statusCode, 200);
    assert.equal(me.headers['cache-control'], 'no-store');
    assert.equal(me.headers['access-control-allow-origin'], appOrigin);
    assert.equal(me.headers['access-control-allow-credentials'], 'true');

    const malformedPublic = await app.inject({method: 'GET', url: '/v1/players/not-a-uuid'});
    assert.equal(malformedPublic.statusCode, 400);
    assert.equal(malformedPublic.json().error, 'invalid_player_id');

    const publicView = await app.inject({
      method: 'GET',
      url: `/v1/players/${firstBody.player.player_id}`,
      headers: {origin: appOrigin},
    });
    assert.equal(publicView.statusCode, 200);
    assert.equal(publicView.headers['access-control-allow-origin'], appOrigin);
    assert.deepEqual(Object.keys(publicView.json()).sort(), ['display_name', 'player_id', 'schema_version']);

    const second = await app.inject({
      method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: 'Second Builder'},
    });
    assert.equal(second.statusCode, 201);
    const secondCookie = cookieFrom(second);

    const malformedPrivate = await app.inject({
      method: 'GET', url: '/v1/players/not-a-uuid/private', headers: {cookie: firstCookie},
    });
    assert.equal(malformedPrivate.statusCode, 400);
    assert.equal(malformedPrivate.json().error, 'invalid_player_id');

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
    assert.equal(contract.json().paths['/v1/players/{playerId}'].get.responses['400'].content['application/json'].schema.$ref, '#/components/schemas/Error');

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
