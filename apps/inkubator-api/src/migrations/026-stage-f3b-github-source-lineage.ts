import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema} from '../database.js';

const FREEZE_FUNCTION = 'stage_f3b_freeze_archive_source_lineage_fn';
const FREEZE_TRIGGER = 'stage_f3b_freeze_archive_source_lineage';

export const stageF3bGitHubSourceLineageMigration = {
  async up(db: Kysely<DatabaseSchema>) {
    await db.schema
      .createTable('challenge_submission_archive_sources')
      .addColumn('submission_id', 'uuid', (column) =>
        column.primaryKey().references('challenge_submission_archives.submission_id').onDelete('cascade'),
      )
      .addColumn('repository_id', 'bigint', (column) => column.notNull())
      .addColumn('installation_id', 'bigint', (column) => column.notNull())
      .addColumn('frozen_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('challenge_submission_archive_sources_repository_id', sql`repository_id > 0`)
      .addCheckConstraint('challenge_submission_archive_sources_installation_id', sql`installation_id > 0`)
      .execute();

    await db.schema
      .createIndex('challenge_submission_archive_sources_repository_idx')
      .on('challenge_submission_archive_sources')
      .column('repository_id')
      .execute();

    // Deliberately do not backfill pre-F3B submissions from the mutable current
    // Project repository pointer: doing so would fabricate point-in-time source
    // lineage. Only archive rows created after this migration can gain frozen
    // GitHub repository identity.
    await sql`
      create function ${sql.ref(FREEZE_FUNCTION)}()
      returns trigger
      language plpgsql
      as $$
      declare
        frozen_repository_id bigint;
        frozen_installation_id bigint;
      begin
        if new.source_kind <> 'GIT_COMMIT' then
          return new;
        end if;

        select repository.repository_id, installation.installation_id
          into frozen_repository_id, frozen_installation_id
        from challenge_entries entry
        join projects project on project.project_id = entry.project_id
        join github_repositories repository on repository.repository_id = project.repository_id
        join github_installations installation on installation.installation_id = repository.installation_id
        where entry.entry_id = new.entry_id
          and entry.challenge_id = new.challenge_id
          and project.owner_player_id = entry.builder_player_id
          and repository.active is true
          and installation.revoked_at is null
          and installation.player_id = entry.builder_player_id
        for share of entry, project, repository, installation;

        if frozen_repository_id is not null and frozen_installation_id is not null then
          insert into challenge_submission_archive_sources (
            submission_id, repository_id, installation_id
          ) values (
            new.submission_id, frozen_repository_id, frozen_installation_id
          ) on conflict (submission_id) do nothing;
        end if;

        return new;
      end;
      $$
    `.execute(db);

    await sql`
      create trigger ${sql.ref(FREEZE_TRIGGER)}
      after insert on challenge_submission_archives
      for each row execute function ${sql.ref(FREEZE_FUNCTION)}()
    `.execute(db);
  },

  async down(db: Kysely<DatabaseSchema>) {
    await sql`drop trigger if exists ${sql.ref(FREEZE_TRIGGER)} on challenge_submission_archives`.execute(db);
    await sql`drop function if exists ${sql.ref(FREEZE_FUNCTION)}()`.execute(db);
    await db.schema.dropTable('challenge_submission_archive_sources').execute();
  },
};
