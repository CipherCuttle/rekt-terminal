import {sql, type Kysely} from 'kysely';
import {Migrator, type Migration, type MigrationProvider} from 'kysely/migration';
import type {DatabaseSchema} from './database.js';
import {playerMissionCommandMigration} from './migrations/006-player-mission-command.js';
import {phase4ProjectEvidenceProjectionMigration} from './migrations/007-phase4-project-evidence-projection.js';
import {phase4ManifestTruthMigration} from './migrations/008-phase4-manifest-truth.js';

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

const githubIngressFoundationMigration: Migration = {
  async up(db) {
    await db.schema
      .createTable('github_setup_states')
      .addColumn('state_hash', 'varchar(64)', (column) => column.primaryKey())
      .addColumn('player_id', 'uuid', (column) =>
        column.notNull().references('players.player_id').onDelete('cascade'),
      )
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('consumed_at', 'timestamptz')
      .execute();

    await db.schema
      .createTable('github_installations')
      .addColumn('installation_id', 'bigint', (column) => column.primaryKey())
      .addColumn('player_id', 'uuid', (column) =>
        column.notNull().references('players.player_id').onDelete('cascade'),
      )
      .addColumn('github_user_id', 'bigint', (column) => column.notNull())
      .addColumn('account_id', 'bigint', (column) => column.notNull())
      .addColumn('account_type', 'text', (column) => column.notNull())
      .addColumn('repository_selection', 'text', (column) => column.notNull())
      .addColumn('installed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('revoked_at', 'timestamptz')
      .addCheckConstraint('github_installations_repository_selection', sql`repository_selection in ('all', 'selected')`)
      .addCheckConstraint('github_installations_account_type_nonempty', sql`char_length(account_type) > 0`)
      .execute();

    await db.schema
      .createIndex('github_installations_player_idx')
      .on('github_installations')
      .column('player_id')
      .execute();

    await db.schema
      .createTable('github_repositories')
      .addColumn('repository_id', 'bigint', (column) => column.primaryKey())
      .addColumn('installation_id', 'bigint', (column) =>
        column.notNull().references('github_installations.installation_id').onDelete('cascade'),
      )
      .addColumn('full_name', 'text', (column) => column.notNull())
      .addColumn('private', 'boolean', (column) => column.notNull())
      .addColumn('active', 'boolean', (column) => column.notNull().defaultTo(true))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('github_repositories_full_name_nonempty', sql`char_length(full_name) > 0`)
      .execute();

    await db.schema
      .createIndex('github_repositories_installation_idx')
      .on('github_repositories')
      .columns(['installation_id', 'active'])
      .execute();

    await db.schema
      .createTable('github_deliveries')
      .addColumn('delivery_id', 'text', (column) => column.primaryKey())
      .addColumn('event_name', 'text', (column) => column.notNull())
      .addColumn('payload_hash', 'varchar(64)', (column) => column.notNull())
      .addColumn('installation_id', 'bigint')
      .addColumn('repository_id', 'bigint')
      .addColumn('received_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
      .addCheckConstraint('github_deliveries_event_nonempty', sql`char_length(event_name) > 0`)
      .execute();
  },
  async down(db) {
    await db.schema.dropTable('github_deliveries').execute();
    await db.schema.dropTable('github_repositories').execute();
    await db.schema.dropTable('github_installations').execute();
    await db.schema.dropTable('github_setup_states').execute();
  },
};

const githubConcurrencyHardeningMigration: Migration = {
  async up(db) {
    await db.schema
      .createTable('github_installation_tombstones')
      .addColumn('installation_id', 'bigint', (column) => column.primaryKey())
      .addColumn('revoked_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('source_key', 'text', (column) => column.notNull())
      .addCheckConstraint('github_installation_tombstones_source_nonempty', sql`char_length(source_key) > 0`)
      .execute();

    await db.schema
      .createTable('github_repository_tombstones')
      .addColumn('repository_id', 'bigint', (column) => column.primaryKey())
      .addColumn('installation_id', 'bigint', (column) => column.notNull())
      .addColumn('removed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('source_key', 'text', (column) => column.notNull())
      .addCheckConstraint('github_repository_tombstones_source_nonempty', sql`char_length(source_key) > 0`)
      .execute();

    await db.schema
      .createIndex('github_repository_tombstones_installation_idx')
      .on('github_repository_tombstones')
      .column('installation_id')
      .execute();
  },
  async down(db) {
    await db.schema.dropTable('github_repository_tombstones').execute();
    await db.schema.dropTable('github_installation_tombstones').execute();
  },
};

const githubRepositoryAuthorityMigration: Migration = {
  async up(db) {
    await db.schema
      .createTable('github_repository_authority')
      .addColumn('repository_id', 'bigint', (column) => column.primaryKey())
      .addColumn('installation_id', 'bigint', (column) => column.notNull())
      .addColumn('claimed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .execute();

    await sql`
      insert into github_repository_authority (repository_id, installation_id)
      select repository_id, installation_id from github_repositories
      on conflict (repository_id) do nothing
    `.execute(db);

    const conflicts = await sql<{count: string}>`
      select count(*)::text as count
      from github_repository_tombstones tombstone
      join github_repository_authority authority using (repository_id)
      where tombstone.installation_id <> authority.installation_id
    `.execute(db);
    if (Number(conflicts.rows[0]?.count ?? '0') !== 0) {
      throw new Error('github_repository_authority_backfill_conflict');
    }

    await sql`
      insert into github_repository_authority (repository_id, installation_id)
      select repository_id, installation_id from github_repository_tombstones
      on conflict (repository_id) do nothing
    `.execute(db);

    await sql`
      create function enforce_github_repository_authority()
      returns trigger
      language plpgsql
      as $$
      begin
        insert into github_repository_authority (repository_id, installation_id)
        values (new.repository_id, new.installation_id)
        on conflict (repository_id) do nothing;

        if not exists (
          select 1
          from github_repository_authority
          where repository_id = new.repository_id
            and installation_id = new.installation_id
        ) then
          raise exception 'github_repository_already_bound' using errcode = '23514';
        end if;

        return new;
      end;
      $$
    `.execute(db);

    await sql`
      create trigger github_repositories_authority_guard
      before insert or update of repository_id, installation_id
      on github_repositories
      for each row execute function enforce_github_repository_authority()
    `.execute(db);

    await sql`
      create trigger github_repository_tombstones_authority_guard
      before insert or update of repository_id, installation_id
      on github_repository_tombstones
      for each row execute function enforce_github_repository_authority()
    `.execute(db);
  },
  async down(db) {
    await sql`drop trigger if exists github_repository_tombstones_authority_guard on github_repository_tombstones`.execute(db);
    await sql`drop trigger if exists github_repositories_authority_guard on github_repositories`.execute(db);
    await sql`drop function if exists enforce_github_repository_authority()`.execute(db);
    await db.schema.dropTable('github_repository_authority').execute();
  },
};

class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      '001_initial_player_sessions': initialMigration,
      '002_event_job_foundation': eventJobFoundationMigration,
      '003_github_ingress_foundation': githubIngressFoundationMigration,
      '004_github_concurrency_hardening': githubConcurrencyHardeningMigration,
      '005_github_repository_authority': githubRepositoryAuthorityMigration,
      '006_player_mission_command': playerMissionCommandMigration,
      '007_phase4_project_evidence_projection': phase4ProjectEvidenceProjectionMigration,
      '008_phase4_manifest_truth': phase4ManifestTruthMigration,
    };
  }
}

export async function migrateToLatest(db: Kysely<DatabaseSchema>): Promise<void> {
  const migrator = new Migrator({db, provider: new StaticMigrationProvider()});
  const result = await migrator.migrateToLatest();
  if (result.error) throw result.error;
}
