import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

// Canonicalizes the Round-level FIRST_BLOOD source independently from lazy Cheevo
// materialization. New winners are written while trusted Ship acceptance holds the
// corresponding Round row lock; the backfill preserves deterministic legacy order.
export const phase7ReviewBoundariesMigration: Migration = {
  async up(db) {
    await db.schema.createTable('round_first_ship_receipts')
      .addColumn('round_id', 'uuid', (c) => c.primaryKey().references('rounds.round_id').onDelete('cascade'))
      .addColumn('receipt_id', 'uuid', (c) => c.notNull().unique().references('ship_receipts.receipt_id').onDelete('cascade'))
      .addColumn('owner_player_id', 'uuid', (c) => c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('shipped_at', 'timestamptz', (c) => c.notNull())
      .addColumn('recorded_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .execute();

    await sql`
      insert into round_first_ship_receipts (round_id, receipt_id, owner_player_id, shipped_at)
      select distinct on (round_id)
        round_id, receipt_id, owner_player_id, shipped_at
      from ship_receipts
      where round_id is not null
      order by round_id, shipped_at asc, receipt_id asc
      on conflict (round_id) do nothing
    `.execute(db);
  },

  async down(db) {
    await db.schema.dropTable('round_first_ship_receipts').execute();
  },
};
