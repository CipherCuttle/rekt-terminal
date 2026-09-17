import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {
  consumeDevkitRateLimit,
  DEVKIT_RATE_LIMIT_PER_MINUTE,
  issueDevkitToken,
} from '../../dist/devkit.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

async function createPlayer(db) {
  const playerId = randomUUID();
  await db.insertInto('players').values({
    player_id: playerId,
    display_name: `H5 quota ${playerId.slice(0, 6)}`,
  }).execute();
  return playerId;
}

test('H5 independent pools and rotated tokens share one Player-wide DevKit request budget', async () => {
  const pools = Array.from({length: 4}, () => createDatabase(databaseUrl));
  const authorityDb = pools[0];
  await migrateToLatest(authorityDb);
  try {
    const playerId = await createPlayer(authorityDb);
    const tokenIds = [];
    for (let index = 0; index < pools.length; index += 1) {
      const issued = await issueDevkitToken(authorityDb, playerId, {
        requestId: randomUUID(),
        credentialClass: index % 2 === 0 ? 'CLI' : 'AUTOMATION',
        label: `H5 quota token ${index}`,
        scopes: ['mission:read'],
        expiresInSeconds: 3600,
      });
      tokenIds.push(issued.token_id);
    }

    const burstSize = DEVKIT_RATE_LIMIT_PER_MINUTE + 20;
    const attempts = Array.from({length: burstSize}, (_, index) => consumeDevkitRateLimit(
      pools[index % pools.length],
      tokenIds[index % tokenIds.length],
    ));
    const results = await Promise.all(attempts);
    const allowed = results.filter((result) => result.allowed);
    const limited = results.filter((result) => !result.allowed && !result.invalid);
    const invalid = results.filter((result) => !result.allowed && result.invalid);

    assert.equal(allowed.length, DEVKIT_RATE_LIMIT_PER_MINUTE);
    assert.equal(limited.length, burstSize - DEVKIT_RATE_LIMIT_PER_MINUTE);
    assert.equal(invalid.length, 0);
    assert.equal(limited.every((result) => result.retryAfterSeconds >= 1), true);

    const rate = await authorityDb.selectFrom('devkit_player_rate_limits')
      .select(['player_id', 'rate_count', 'rate_window_started_at'])
      .where('player_id', '=', playerId)
      .executeTakeFirstOrThrow();
    assert.equal(rate.player_id, playerId);
    assert.equal(rate.rate_count, DEVKIT_RATE_LIMIT_PER_MINUTE);

    const usedTokens = await authorityDb.selectFrom('devkit_tokens')
      .select(['token_id', 'last_used_at'])
      .where('player_id', '=', playerId)
      .execute();
    assert.equal(usedTokens.length, tokenIds.length);
    assert.equal(usedTokens.every((row) => row.last_used_at instanceof Date), true);
  } finally {
    await Promise.all(pools.map((db) => db.destroy()));
  }
});
