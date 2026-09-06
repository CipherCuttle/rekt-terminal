import {sql, type Kysely} from 'kysely';
import {Migrator, type Migration, type MigrationProvider} from 'kysely/migration';
import type {DatabaseSchema} from './database.js';

const initialMigration: Migration = {
  async up(db) {
    await db.schema
      .createTable('players')
      .addColumn('player_id', 'uuid', (column) => column.primaryKey())
      .addColumn('display_name', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('players_display_name_length', sql`char_length(display_name) between 1 and 80`)
      .execute();

    await db.schema
      .createTable('sessions')
      .addColumn('session_id', 'uuid', (column) => column.primaryKey())
      .addColumn('player_id', 'uuid', (column) =>
        column.notNull().references('players.player_id').onDelete('cascade'),
      )
      .addColumn('token_hash', 'varchar(64)', (column) => column.notNull().unique())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('revoked_at', 'timestamptz')
      .execute();

    await db.schema
      .createIndex('sessions_player_id_idx')
      .on('sessions')
      .column('player_id')
      .execute();
  },
  async down(db) {
    await db.schema.dropTable('sessions').execute();
    await db.schema.dropTable('players').execute();
  },
};

const eventJobFoundationMigration: Migration = {
  async up(db) {
    await db.schema
      .createTable('history_events')
      .addColumn('history_event_id', 'uuid', (column) => column.primaryKey())
      .addColumn('event_family', 'text', (column) => column.notNull())
      .addColumn('event_version', 'text', (column) => column.notNull())
      .addColumn('event_type', 'text', (column) => column.notNull())
      .addColumn('dedupe_key', 'text', (column) => column.notNull().unique())
      .addColumn('payload', 'jsonb', (column) => column.notNull())
      .addColumn('payload_hash', 'varchar(64)', (column) => column.notNull())
      .addColumn('actor_player_id', 'uuid', (column) =>
        column.references('players.player_id').onDelete('set null'),
      )
      .addColumn('subject_type', 'text', (column) => column.notNull())
      .addColumn('subject_id', 'text', (column) => column.notNull())
      .addColumn('occurred_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('history_events_family', sql`event_family in ('activity', 'evidence')`)
      .addCheckConstraint('history_events_version_nonempty', sql`char_length(event_version) > 0`)
      .addCheckConstraint('history_events_type_nonempty', sql`char_length(event_type) > 0`)
      .execute();

    await db.schema
      .createIndex('history_events_subject_idx')
      .on('history_events')
      .columns(['subject_type', 'subject_id', 'occurred_at'])
      .execute();

    await db.schema
      .createTable('outbox_jobs')
      .addColumn('job_id', 'uuid', (column) => column.primaryKey())
      .addColumn('job_version', 'text', (column) => column.notNull())
      .addColumn('job_type', 'text', (column) => column.notNull())
      .addColumn('idempotency_key', 'text', (column) => column.notNull().unique())
      .addColumn('payload', 'jsonb', (column) => column.notNull())
      .addColumn('payload_hash', 'varchar(64)', (column) => column.notNull())
      .addColumn('state', 'text', (column) => column.notNull().defaultTo('pending'))
      .addColumn('attempts', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('max_attempts', 'integer', (column) => column.notNull())
      .addColumn('next_attempt_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('locked_at', 'timestamptz')
      .addColumn('lock_token', 'uuid')
      .addColumn('last_error', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('completed_at', 'timestamptz')
      .addCheckConstraint('outbox_jobs_state', sql`state in ('pending', 'running', 'succeeded', 'failed')`)
      .addCheckConstraint('outbox_jobs_attempts', sql`attempts >= 0`)
      .addCheckConstraint('outbox_jobs_max_attempts', sql`max_attempts between 1 and 20`)
      .addCheckConstraint('outbox_jobs_running_lease', sql`state <> 'running' or (locked_at is not null and lock_token is not null)`)
      .execute();

    await db.schema
      .createIndex('outbox_jobs_due_idx')
      .on('outbox_jobs')
      .columns(['state', 'next_attempt_at', 'created_at'])
      .execute();
  },
  async down(db) {
    await db.schema.dropTable('outbox_jobs').execute();
    await db.schema.dropTable('history_events').execute();
  },
};

class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      '001_initial_player_sessions': initialMigration,
      '002_event_job_foundation': eventJobFoundationMigration,
    };
  }
}

export async function migrateToLatest(db: Kysely<DatabaseSchema>): Promise<void> {
  const migrator = new Migrator({db, provider: new StaticMigrationProvider()});
  const result = await migrator.migrateToLatest();
  if (result.error) {
    throw result.error;
  }
}
