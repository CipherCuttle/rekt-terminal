import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema} from '../database.js';

export const phase6ReviewRepairMigration = {
  async up(db: Kysely<DatabaseSchema>) {
    await db.schema.createTable('ship_receipt_assists')
      .addColumn('receipt_id', 'uuid', (c) => c.notNull().references('ship_receipts.receipt_id').onDelete('cascade'))
      .addColumn('assist_id', 'uuid', (c) => c.notNull())
      .addColumn('player_id', 'uuid', (c) => c.notNull())
      .addColumn('display_name', 'text', (c) => c.notNull())
      .addColumn('accepted_at', 'timestamptz', (c) => c.notNull())
      .addColumn('snapshotted_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('ship_receipt_assists_pk', ['receipt_id', 'assist_id'])
      .addCheckConstraint('ship_receipt_assists_display_name', sql`char_length(display_name) between 1 and 80`)
      .execute();

    await sql`alter table ship_submissions drop constraint ship_submissions_state`.execute(db);
    await sql`
      alter table ship_submissions
      add constraint ship_submissions_state
      check (state in ('SUBMITTED','OBSERVED','ATTENTION','ACCEPTED','REJECTED','SUPERSEDED'))
    `.execute(db);
  },

  async down(db: Kysely<DatabaseSchema>) {
    await sql`
      update ship_submissions
      set state = 'ATTENTION', updated_at = clock_timestamp()
      where state = 'SUPERSEDED'
    `.execute(db);
    await sql`alter table ship_submissions drop constraint ship_submissions_state`.execute(db);
    await sql`
      alter table ship_submissions
      add constraint ship_submissions_state
      check (state in ('SUBMITTED','OBSERVED','ATTENTION','ACCEPTED','REJECTED'))
    `.execute(db);
    await db.schema.dropTable('ship_receipt_assists').execute();
  },
};
