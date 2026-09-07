import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const phase7CheevoReputationMigration: Migration = {
  async up(db) {
    // FIRST_BLOOD must be a canonical Ship-time fact, not a winner recomputed later
    // from whichever committed receipts happen to be visible to a public read.
    await db.schema.createTable('round_first_ship_receipts')
      .addColumn('round_id', 'uuid', (column) => column.primaryKey().references('rounds.round_id').onDelete('cascade'))
      .addColumn('receipt_id', 'uuid', (column) => column.notNull().unique().references('ship_receipts.receipt_id').onDelete('cascade'))
      .addColumn('owner_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('shipped_at', 'timestamptz', (column) => column.notNull())
      .addColumn('recorded_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .execute();

    // Existing Phase-6 receipts predate the serialized Phase-7 boundary. Backfill them
    // deterministically once so lazy Cheevo reconciliation never has to infer a second winner.
    await sql`
      insert into round_first_ship_receipts (round_id, receipt_id, owner_player_id, shipped_at)
      select distinct on (round_id)
        round_id, receipt_id, owner_player_id, shipped_at
      from ship_receipts
      where round_id is not null
      order by round_id, shipped_at asc, receipt_id asc
      on conflict (round_id) do nothing
    `.execute(db);

    await db.schema.createTable('player_cheevos')
      .addColumn('award_id', 'uuid', (column) => column.primaryKey())
      .addColumn('player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('restrict'))
      .addColumn('cheevo_key', 'text', (column) => column.notNull())
      .addColumn('rule_version', 'text', (column) => column.notNull())
      .addColumn('source_type', 'text', (column) => column.notNull())
      .addColumn('source_id', 'text', (column) => column.notNull())
      .addColumn('earned_at', 'timestamptz', (column) => column.notNull())
      .addColumn('recorded_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addUniqueConstraint('player_cheevos_once_per_rule', ['player_id', 'cheevo_key', 'rule_version'])
      .addCheckConstraint('player_cheevos_key', sql`cheevo_key in (
        'FIRST_BLOOD',
        'WORKING_URL_OR_GTFO',
        'REPEAT_OFFENDER',
        'ACTUALLY_HELPFUL',
        'PARTY_UP',
        'CREW_CHIEF',
        'SHIPMATE',
        'TOUCH_GRASS',
        'TEST_PILOT',
        'UNREKT'
      )`)
      .addCheckConstraint('player_cheevos_rule_version', sql`rule_version = 'cheevo.rules.v1'`)
      .addCheckConstraint('player_cheevos_source_type', sql`source_type in ('RECEIPT', 'ASSIST', 'TEST_RESULT', 'MISSION')`)
      .addCheckConstraint('player_cheevos_source_id', sql`char_length(source_id) between 1 and 160`)
      .execute();

    await db.schema.createIndex('player_cheevos_player_earned_idx')
      .on('player_cheevos')
      .columns(['player_id', 'earned_at'])
      .execute();

    await db.schema.createIndex('player_cheevos_key_earned_idx')
      .on('player_cheevos')
      .columns(['cheevo_key', 'earned_at'])
      .execute();

    // Serialize same-Round accepted Ships before assigning shipped_at. This makes
    // shipped_at reflect the canonical Round acceptance order and prevents a public
    // reputation read from ever observing a later winner while an earlier winner is
    // still uncommitted. The AFTER trigger persists the unique Round winner fact.
    await sql`
      create function phase7_serialize_round_ship()
      returns trigger
      language plpgsql
      as $$
      begin
        if new.round_id is not null then
          perform 1 from rounds where round_id = new.round_id for update;
          if not found then
            raise exception 'phase7_round_not_found' using errcode = '23503';
          end if;
          new.shipped_at := clock_timestamp();
        end if;
        return new;
      end;
      $$
    `.execute(db);

    await sql`
      create trigger phase7_ship_receipt_round_boundary
      before insert on ship_receipts
      for each row execute function phase7_serialize_round_ship()
    `.execute(db);

    await sql`
      create function phase7_record_first_round_ship()
      returns trigger
      language plpgsql
      as $$
      begin
        if new.round_id is not null then
          insert into round_first_ship_receipts (round_id, receipt_id, owner_player_id, shipped_at)
          values (new.round_id, new.receipt_id, new.owner_player_id, new.shipped_at)
          on conflict (round_id) do nothing;
        end if;
        return new;
      end;
      $$
    `.execute(db);

    await sql`
      create trigger phase7_ship_receipt_first_round_fact
      after insert on ship_receipts
      for each row execute function phase7_record_first_round_ship()
    `.execute(db);

    // External-test timestamps are only useful as a historical cutoff if they share
    // the same Project serialization boundary as Ship attribution. A test result now
    // locks its Project before observed_at is assigned, so it either commits before
    // Ship snapshotting or waits until the Ship transaction has committed.
    await sql`
      create function phase7_serialize_external_test()
      returns trigger
      language plpgsql
      as $$
      begin
        perform 1 from projects where project_id = new.project_id for update;
        if not found then
          raise exception 'phase7_project_not_found' using errcode = '23503';
        end if;
        new.observed_at := clock_timestamp();
        return new;
      end;
      $$
    `.execute(db);

    await sql`
      create trigger phase7_external_test_project_boundary
      before insert on external_test_results
      for each row execute function phase7_serialize_external_test()
    `.execute(db);

    // Cheevos are durable authority facts. The application may only add a new
    // versioned award; it cannot edit or erase historical awards in place.
    await sql`
      create function prevent_player_cheevo_mutation()
      returns trigger
      language plpgsql
      as $$
      begin
        raise exception 'player_cheevo_immutable' using errcode = '23514';
      end;
      $$
    `.execute(db);

    await sql`
      create trigger player_cheevos_immutable_update
      before update on player_cheevos
      for each row execute function prevent_player_cheevo_mutation()
    `.execute(db);

    await sql`
      create trigger player_cheevos_immutable_delete
      before delete on player_cheevos
      for each row execute function prevent_player_cheevo_mutation()
    `.execute(db);
  },

  async down(db) {
    await sql`drop trigger if exists player_cheevos_immutable_delete on player_cheevos`.execute(db);
    await sql`drop trigger if exists player_cheevos_immutable_update on player_cheevos`.execute(db);
    await sql`drop function if exists prevent_player_cheevo_mutation()`.execute(db);
    await sql`drop trigger if exists phase7_external_test_project_boundary on external_test_results`.execute(db);
    await sql`drop function if exists phase7_serialize_external_test()`.execute(db);
    await sql`drop trigger if exists phase7_ship_receipt_first_round_fact on ship_receipts`.execute(db);
    await sql`drop function if exists phase7_record_first_round_ship()`.execute(db);
    await sql`drop trigger if exists phase7_ship_receipt_round_boundary on ship_receipts`.execute(db);
    await sql`drop function if exists phase7_serialize_round_ship()`.execute(db);
    await db.schema.dropTable('player_cheevos').execute();
    await db.schema.dropTable('round_first_ship_receipts').execute();
  },
};
