import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const phase5HelpLoopCoreMigration: Migration = {
  async up(db) {
    await db.schema.alterTable('player_profiles')
      .addColumn('skills_needed', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('can_help_with', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .execute();
    await sql`alter table player_profiles add constraint player_profiles_skills_needed_array check (jsonb_typeof(skills_needed) = 'array' and jsonb_array_length(skills_needed) <= 8)`.execute(db);
    await sql`alter table player_profiles add constraint player_profiles_can_help_with_array check (jsonb_typeof(can_help_with) = 'array' and jsonb_array_length(can_help_with) <= 8)`.execute(db);

    await db.schema.createTable('player_follows')
      .addColumn('follower_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('followed_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('player_follows_pk', ['follower_player_id', 'followed_player_id'])
      .addCheckConstraint('player_follows_not_self', sql`follower_player_id <> followed_player_id`)
      .execute();

    await db.schema.createTable('project_watches')
      .addColumn('player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('project_watches_pk', ['player_id', 'project_id'])
      .execute();

    await db.schema.createTable('help_beacons')
      .addColumn('beacon_id', 'uuid', (column) => column.primaryKey())
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('owner_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('summary', 'text', (column) => column.notNull())
      .addColumn('skills_needed', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('state', 'text', (column) => column.notNull().defaultTo('OPEN'))
      .addColumn('opened_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('closed_at', 'timestamptz')
      .addCheckConstraint('help_beacons_summary_length', sql`char_length(summary) between 1 and 240`)
      .addCheckConstraint('help_beacons_skills_array', sql`jsonb_typeof(skills_needed) = 'array' and jsonb_array_length(skills_needed) <= 8`)
      .addCheckConstraint('help_beacons_state', sql`state in ('OPEN', 'CLOSED')`)
      .execute();
    await sql`create unique index help_beacons_one_open_per_project on help_beacons(project_id) where state = 'OPEN'`.execute(db);

    await db.schema.createTable('assist_offers')
      .addColumn('assist_id', 'uuid', (column) => column.primaryKey())
      .addColumn('beacon_id', 'uuid', (column) => column.notNull().references('help_beacons.beacon_id').onDelete('cascade'))
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('offered_by_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('message', 'text', (column) => column.notNull())
      .addColumn('state', 'text', (column) => column.notNull().defaultTo('OFFERED'))
      .addColumn('acceptance_request_id', 'uuid', (column) => column.unique())
      .addColumn('offered_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('accepted_at', 'timestamptz')
      .addUniqueConstraint('assist_offers_beacon_helper_unique', ['beacon_id', 'offered_by_player_id'])
      .addCheckConstraint('assist_offers_message_length', sql`char_length(message) between 1 and 240`)
      .addCheckConstraint('assist_offers_state', sql`state in ('OFFERED', 'ACCEPTED', 'DECLINED', 'CANCELLED')`)
      .execute();

    await db.schema.createTable('project_party_members')
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('role', 'text', (column) => column.notNull())
      .addColumn('source_type', 'text', (column) => column.notNull())
      .addColumn('source_id', 'uuid', (column) => column.notNull())
      .addColumn('joined_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('project_party_members_pk', ['project_id', 'player_id'])
      .addUniqueConstraint('project_party_members_source_unique', ['source_type', 'source_id'])
      .addCheckConstraint('project_party_members_role', sql`role = 'ASSIST'`)
      .addCheckConstraint('project_party_members_source_type', sql`source_type = 'ASSIST'`)
      .execute();
  },
  async down(db) {
    await db.schema.dropTable('project_party_members').execute();
    await db.schema.dropTable('assist_offers').execute();
    await sql`drop index if exists help_beacons_one_open_per_project`.execute(db);
    await db.schema.dropTable('help_beacons').execute();
    await db.schema.dropTable('project_watches').execute();
    await db.schema.dropTable('player_follows').execute();
    await db.schema.alterTable('player_profiles').dropColumn('can_help_with').dropColumn('skills_needed').execute();
  },
};
