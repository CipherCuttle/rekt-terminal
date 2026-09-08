import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from 'kysely';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {getPlayerReputation} from '../../dist/reputation.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL required');
const ROLLBACK = 'phase9_rule_version_test_rollback';

test('P9-H10 historical Cheevo grants remain visible with their stored rule version', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  try {
    await assert.rejects(
      db.transaction().execute(async (tx) => {
        const playerId = randomUUID();
        await tx.insertInto('players').values({player_id: playerId, display_name: `Legacy Cheevo ${playerId.slice(0, 6)}`}).execute();

        await sql`alter table player_cheevos drop constraint player_cheevos_rule_version`.execute(tx);
        await sql`alter table player_cheevos add constraint player_cheevos_rule_version check (rule_version ~ '^cheevo\\.rules\\.v[0-9]+$')`.execute(tx);

        await tx.insertInto('player_cheevos').values({
          award_id: randomUUID(),
          player_id: playerId,
          cheevo_key: 'WORKING_URL_OR_GTFO',
          rule_version: 'cheevo.rules.v0',
          source_type: 'RECEIPT',
          source_id: 'legacy-receipt-fixture',
          earned_at: new Date('2026-01-01T00:00:00.000Z'),
        }).execute();

        const view = await getPlayerReputation(tx, playerId);
        assert.ok(view);
        assert.equal(view.cheevos.length, 1, 'a historical grant must not disappear when the current grant rule version changes');
        assert.equal(view.cheevos[0].key, 'WORKING_URL_OR_GTFO');
        assert.equal(view.cheevos[0].rule_version, 'cheevo.rules.v0', 'the projection must preserve the stored grant rule version rather than relabel it as current');
        assert.equal(view.cheevos[0].truth_state, 'PROVEN');

        throw new Error(ROLLBACK);
      }),
      (error) => error instanceof Error && error.message === ROLLBACK,
    );
  } finally {
    await db.destroy();
  }
});
