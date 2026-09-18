import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {createDatabase} from '../../dist/database.js';
import {issueDevkitToken, resolveDevkitCredential} from '../../dist/devkit.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {createPlayer} from '../../dist/players.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');

test('Stage I submit credentials are cryptographically bound to exactly one Challenge', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    const player = await createPlayer(db, `Stage I Credential ${randomUUID().slice(0, 8)}`);
    const challengeA = randomUUID();
    const challengeB = randomUUID();

    const scoped = await issueDevkitToken(db, player.player_id, {
      requestId: randomUUID(),
      credentialClass: 'CLI',
      label: 'Stage I scoped submit',
      scopes: ['challenge:submit'],
      expiresInSeconds: 3600,
      challengeId: challengeA,
    });
    const resolvedScoped = await resolveDevkitCredential(db, scoped.token);
    assert.ok(resolvedScoped);
    assert.equal(resolvedScoped.playerId, player.player_id);
    assert.deepEqual(resolvedScoped.scopes, ['challenge:submit']);
    assert.equal(resolvedScoped.challengeId, challengeA.toLowerCase());
    assert.notEqual(resolvedScoped.challengeId, challengeB.toLowerCase());

    const tampered = scoped.token.replace(challengeA.toLowerCase(), challengeB.toLowerCase());
    assert.notEqual(tampered, scoped.token);
    assert.equal(await resolveDevkitCredential(db, tampered), null);

    const generic = await issueDevkitToken(db, player.player_id, {
      requestId: randomUUID(),
      credentialClass: 'CLI',
      label: 'Generic submit scope',
      scopes: ['challenge:submit'],
      expiresInSeconds: 3600,
    });
    const resolvedGeneric = await resolveDevkitCredential(db, generic.token);
    assert.ok(resolvedGeneric);
    assert.deepEqual(resolvedGeneric.scopes, ['challenge:submit']);
    assert.equal(resolvedGeneric.challengeId, null);
  } finally {
    await db.destroy();
  }
});
