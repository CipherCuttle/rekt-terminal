import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize} from '../../dist/authorization.js';
import {loadRuntimeConfig} from '../../dist/config.js';
import {toPrivatePlayer, toPublicPlayer} from '../../dist/projection.js';
import {
  SESSION_COOKIE_NAME,
  createOpaqueSessionToken,
  hashSessionToken,
  readSessionToken,
  serializeSessionCookie,
} from '../../dist/session.js';

test('authorization is owner-only and deny-by-default', () => {
  const actor = {playerId: '11111111-1111-4111-8111-111111111111'};
  const own = {kind: 'player', playerId: actor.playerId};
  const other = {kind: 'player', playerId: '22222222-2222-4222-8222-222222222222'};
  const ownProject = {kind: 'project', ownerPlayerId: actor.playerId};
  const otherProject = {kind: 'project', ownerPlayerId: other.playerId};
  assert.equal(authorize(actor, 'player.read_private', own), true);
  assert.equal(authorize(actor, 'player.update', own), true);
  assert.equal(authorize(actor, 'player.read_private', other), false);
  assert.equal(authorize(actor, 'project.read_private', ownProject), true);
  assert.equal(authorize(actor, 'project.link_repository', ownProject), true);
  assert.equal(authorize(actor, 'project.read_private', otherProject), false);
  assert.equal(authorize(null, 'project.read_private', ownProject), false);
  assert.equal(authorize(null, 'player.read_private', own), false);
  assert.equal(authorize(actor, 'future.unknown.action', own), false);
});

test('public projection cannot expose private timestamps', () => {
  const row = {
    player_id: '11111111-1111-4111-8111-111111111111',
    display_name: 'REKT Builder',
    created_at: new Date('2026-09-06T00:00:00Z'),
    updated_at: new Date('2026-09-06T01:00:00Z'),
  };
  assert.deepEqual(Object.keys(toPublicPlayer(row)).sort(), ['display_name', 'player_id', 'schema_version']);
  assert.equal(toPrivatePlayer(row).created_at, '2026-09-06T00:00:00.000Z');
});

test('opaque session material is hashed and cookie stays server-only', () => {
  const token = createOpaqueSessionToken();
  assert.notEqual(hashSessionToken(token), token);
  assert.equal(hashSessionToken(token).length, 64);
  const cookie = serializeSessionCookie(token, 3600);
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE_NAME}=`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal(readSessionToken(cookie), token);
});

test('production refuses the development identity bootstrap', () => {
  assert.throws(
    () => loadRuntimeConfig({
      NODE_ENV: 'production',
      INKUBATOR_DEV_AUTH: '1',
      DATABASE_URL: 'postgres://example.invalid/rekt',
      INKUBATOR_APP_ORIGIN: 'https://inkubator.example',
    }),
    /must never be enabled in production/,
  );
});
