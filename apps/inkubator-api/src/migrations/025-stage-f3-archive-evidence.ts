import {sql, type Kysely} from 'kysely';
import {challengeSubmissionArchiveJob, ensureChallengeSubmissionArchiveState} from '../challenge-archive.js';
import type {DatabaseSchema} from '../database.js';
import {enqueueOutboxJob} from '../jobs.js';

export const stageF3ArchiveEvidenceMigration = {
  async up(db: Kysely<DatabaseSchema>) {
    await db.schema
      .createTable('challenge_submission_archives')
      .addColumn('submission_id', 'uuid', (c) => c.primaryKey().references('challenge_submissions.submission_id').onDelete('cascade'))
      .addColumn('challenge_id', 'uuid', (c) => c.notNull())
      .addColumn('entry_id', 'uuid', (c) => c.notNull())
      .addColumn('source_kind', 'text', (c) => c.notNull())
      .addColumn('source_reference', 'text', (c) => c.notNull())
      .addColumn('terms_digest', 'varchar(64)', (c) => c.notNull())
      .addColumn('manifest_digest', 'varchar(64)', (c) => c.notNull())
      .addColumn('status', 'text', (c) => c.notNull().defaultTo('PENDING'))
      .addColumn('archive_digest', 'varchar(64)')
      .addColumn('archive_reference', 'text')
      .addColumn('observed_at', 'timestamptz')
      .addColumn('reason_code', 'text')
      .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addForeignKeyConstraint('challenge_submission_archives_entry_fk', ['challenge_id', 'entry_id'], 'challenge_entries', ['challenge_id', 'entry_id'], (fk) => fk.onDelete('cascade'))
      .addCheckConstraint('challenge_submission_archives_source_kind', sql`source_kind in ('GIT_COMMIT','CONTENT_ADDRESS','ARCHIVE_DIGEST')`)
      .addCheckConstraint('challenge_submission_archives_source_reference', sql`char_length(source_reference) between 1 and 500`)
      .addCheckConstraint('challenge_submission_archives_terms_digest', sql`terms_digest ~ '^[0-9a-f]{64}$'`)
      .addCheckConstraint('challenge_submission_archives_manifest_digest', sql`manifest_digest ~ '^[0-9a-f]{64}$'`)
      .addCheckConstraint('challenge_submission_archives_status', sql`status in ('PENDING','CAPTURED','PLATFORM_UNAVAILABLE','BUILDER_CAUSED_UNAVAILABLE','UNSUPPORTED_SOURCE')`)
      .addCheckConstraint('challenge_submission_archives_archive_digest', sql`archive_digest is null or archive_digest ~ '^[0-9a-f]{64}$'`)
      .addCheckConstraint('challenge_submission_archives_reason_code', sql`reason_code is null or char_length(reason_code) between 1 and 80`)
      .addCheckConstraint('challenge_submission_archives_captured_fields', sql`(status = 'CAPTURED') = (archive_digest is not null and archive_reference is not null and observed_at is not null and reason_code is null)`)
      .addCheckConstraint('challenge_submission_archives_pending_fields', sql`status <> 'PENDING' or (archive_digest is null and archive_reference is null and observed_at is null and reason_code is null)`)
      .addCheckConstraint('challenge_submission_archives_unavailable_fields', sql`status = 'CAPTURED' or status = 'PENDING' or (archive_digest is null and archive_reference is null and observed_at is not null and reason_code is not null)`)
      .execute();

    await db.schema
      .createIndex('challenge_submission_archives_challenge_idx')
      .on('challenge_submission_archives')
      .columns(['challenge_id', 'entry_id'])
      .execute();

    const existingSubmissions = await sql<{
      submission_id: string;
      challenge_id: string;
      entry_id: string;
      terms_digest: string;
      manifest_digest: string;
      ship_submission_id: string | null;
      manifest_json: unknown;
    }>`
      select submission_id, challenge_id, entry_id, terms_digest, manifest_digest, ship_submission_id, manifest_json
      from challenge_submissions
    `.execute(db);
    for (const submission of existingSubmissions.rows) {
      const payload = await ensureChallengeSubmissionArchiveState(db, submission);
      await enqueueOutboxJob(db, challengeSubmissionArchiveJob(payload));
    }
  },
  async down(db: Kysely<DatabaseSchema>) {
    await db.deleteFrom('outbox_jobs').where('job_type', '=', 'challenge.submission_archive_capture.v1').execute();
    await db.schema.dropTable('challenge_submission_archives').execute();
  },
};
