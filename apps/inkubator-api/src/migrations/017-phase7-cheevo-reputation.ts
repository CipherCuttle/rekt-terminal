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

    // Project history ordering is an authority fact. Wall-clock timestamps remain useful
    // display/provenance metadata, but must never decide whether a concurrent external test
    // happened before or after Ship. Existing equal-time rows fail closed: Ship sorts first.
    await sql`create sequence phase7_project_boundary_order_seq as bigint`.execute(db);
    await sql`alter table ship_receipts add column project_boundary_order bigint`.execute(db);
    await sql`alter table external_test_results add column project_boundary_order bigint`.execute(db);

    await sql`
      with ordered as (
        select event_type, event_id,
          row_number() over (
            partition by project_id
            order by event_at asc, event_type_order asc, event_id asc
          )::bigint as boundary_order
        from (
          select 'SHIP'::text as event_type, receipt_id::text as event_id,
            project_id, shipped_at as event_at, 0::int as event_type_order
          from ship_receipts
          union all
          select 'TEST'::text, test_result_id::text,
            project_id, observed_at, 1::int
          from external_test_results
        ) events
      )
      update ship_receipts receipt
      set project_boundary_order = ordered.boundary_order
      from ordered
      where ordered.event_type = 'SHIP'
        and ordered.event_id = receipt.receipt_id::text
    `.execute(db);

    await sql`
      with ordered as (
        select event_type, event_id,
          row_number() over (
            partition by project_id
            order by event_at asc, event_type_order asc, event_id asc
          )::bigint as boundary_order
        from (
          select 'SHIP'::text as event_type, receipt_id::text as event_id,
            project_id, shipped_at as event_at, 0::int as event_type_order
          from ship_receipts
          union all
          select 'TEST'::text, test_result_id::text,
            project_id, observed_at, 1::int
          from external_test_results
        ) events
      )
      update external_test_results test
      set project_boundary_order = ordered.boundary_order
      from ordered
      where ordered.event_type = 'TEST'
        and ordered.event_id = test.test_result_id::text
    `.execute(db);

    await sql`
      select setval(
        'phase7_project_boundary_order_seq',
        coalesce((
          select max(project_boundary_order)
          from (
            select project_boundary_order from ship_receipts
            union all
            select project_boundary_order from external_test_results
          ) existing
        ), 1),
        exists (
          select 1 from ship_receipts where project_boundary_order is not null
          union all
          select 1 from external_test_results where project_boundary_order is not null
        )
      )
    `.execute(db);

    await sql`alter table ship_receipts alter column project_boundary_order set not null`.execute(db);
    await sql`alter table external_test_results alter column project_boundary_order set not null`.execute(db);
    await sql`
      create index phase7_ship_receipts_project_boundary_idx
      on ship_receipts(project_id, project_boundary_order)
    `.execute(db);
    await sql`
      create index phase7_external_tests_project_boundary_idx
      on external_test_results(project_id, project_boundary_order)
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

    // Serialize accepted Ships at both the Round and Project boundaries. The Project row
    // lock plus a DB-assigned monotonic order token is the authority for external-test
    // history; shipped_at is metadata and cannot change that ordering.
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
        end if;

        perform 1 from projects where project_id = new.project_id for update;
        if not found then
          raise exception 'phase7_project_not_found' using errcode = '23503';
        end if;

        new.project_boundary_order := nextval('phase7_project_boundary_order_seq');
        new.shipped_at := clock_timestamp();
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

    // External tests serialize on the exact same Project authority row before receiving
    // their order token. A test is pre-Ship iff its order is strictly lower than the
    // receipt order; timestamp equality or wall-clock rollback cannot change that fact.
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
        new.project_boundary_order := nextval('phase7_project_boundary_order_seq');
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

    // Defense in depth: even if future eligibility-query code regresses, FIRST_BLOOD
    // can only materialize from the receipt persisted as that Round's canonical winner.
    await sql`
      create function phase7_guard_first_blood_award()
      returns trigger
      language plpgsql
      as $$
      begin
        if new.cheevo_key = 'FIRST_BLOOD' and not exists (
          select 1
          from round_first_ship_receipts first_ship
          where first_ship.receipt_id::text = new.source_id
            and first_ship.owner_player_id = new.player_id
        ) then
          return null;
        end if;
        return new;
      end;
      $$
    `.execute(db);

    await sql`
      create trigger player_cheevos_first_blood_guard
      before insert on player_cheevos
      for each row execute function phase7_guard_first_blood_award()
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
    await sql`drop trigger if exists player_cheevos_first_blood_guard on player_cheevos`.execute(db);
    await sql`drop function if exists phase7_guard_first_blood_award()`.execute(db);
    await sql`drop trigger if exists phase7_external_test_project_boundary on external_test_results`.execute(db);
    await sql`drop function if exists phase7_serialize_external_test()`.execute(db);
    await sql`drop trigger if exists phase7_ship_receipt_first_round_fact on ship_receipts`.execute(db);
    await sql`drop function if exists phase7_record_first_round_ship()`.execute(db);
    await sql`drop trigger if exists phase7_ship_receipt_round_boundary on ship_receipts`.execute(db);
    await sql`drop function if exists phase7_serialize_round_ship()`.execute(db);
    await sql`drop index if exists phase7_external_tests_project_boundary_idx`.execute(db);
    await sql`drop index if exists phase7_ship_receipts_project_boundary_idx`.execute(db);
    await sql`alter table external_test_results drop column project_boundary_order`.execute(db);
    await sql`alter table ship_receipts drop column project_boundary_order`.execute(db);
    await sql`drop sequence if exists phase7_project_boundary_order_seq`.execute(db);
    await db.schema.dropTable('player_cheevos').execute();
    await db.schema.dropTable('round_first_ship_receipts').execute();
  },
};