import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema} from '../database.js';

export const phase6ShipArtifactAttributionMigration = {
  async up(db: Kysely<DatabaseSchema>) {
    await db.schema.createTable('ship_receipt_attributions')
      .addColumn('receipt_id', 'uuid', (c) => c.notNull().references('ship_receipts.receipt_id').onDelete('cascade'))
      .addColumn('player_id', 'uuid', (c) => c.notNull())
      .addColumn('display_name', 'text', (c) => c.notNull())
      .addColumn('role', 'text', (c) => c.notNull())
      .addColumn('assist_id', 'uuid')
      .addColumn('accepted_at', 'timestamptz')
      .addColumn('snapshotted_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('ship_receipt_attributions_pk', ['receipt_id', 'player_id'])
      .addCheckConstraint('ship_receipt_attributions_display_name', sql`char_length(display_name) between 1 and 80`)
      .addCheckConstraint('ship_receipt_attributions_role', sql`role in ('OWNER','PARTY')`)
      .addCheckConstraint(
        'ship_receipt_attributions_source_shape',
        sql`(role = 'OWNER' and assist_id is null and accepted_at is null) or (role = 'PARTY' and assist_id is not null and accepted_at is not null)`,
      )
      .execute();

    await sql`
      create unique index ship_receipt_attributions_assist_unique
      on ship_receipt_attributions(receipt_id, assist_id)
      where assist_id is not null
    `.execute(db);
  },

  async down(db: Kysely<DatabaseSchema>) {
    await sql`drop index if exists ship_receipt_attributions_assist_unique`.execute(db);
    await db.schema.dropTable('ship_receipt_attributions').execute();
  },
};
