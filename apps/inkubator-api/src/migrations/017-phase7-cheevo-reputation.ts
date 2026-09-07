import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const phase7CheevoReputationMigration: Migration = {
  async up(db) {
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
    await db.schema.dropTable('player_cheevos').execute();
  },
};
