import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema} from '../database.js';

export const stageCChallengeDomainBridgeMigration = {
  async up(db: Kysely<DatabaseSchema>) {
    await db.schema
      .createTable('challenges')
      .addColumn('challenge_id', 'uuid', (c) => c.primaryKey())
      .addColumn('organizer_player_id', 'uuid', (c) => c.notNull().references('players.player_id'))
      .addColumn('status', 'text', (c) => c.notNull())
      .addColumn('mechanism_version', 'text', (c) => c.notNull())
      .addColumn('settlement_policy_version', 'text', (c) => c.notNull())
      .addColumn('ip_terms_version', 'text', (c) => c.notNull())
      .addColumn('current_contract_version', 'text')
      .addColumn('current_terms_digest', 'varchar(64)')
      .addColumn('slot_limit', 'integer', (c) => c.notNull())
      .addColumn('activation_minimum', 'integer', (c) => c.notNull())
      .addColumn('entry_deadline', 'timestamptz', (c) => c.notNull())
      .addColumn('build_start', 'timestamptz', (c) => c.notNull())
      .addColumn('submission_deadline', 'timestamptz', (c) => c.notNull())
      .addColumn('appeal_window_ms', 'bigint', (c) => c.notNull())
      .addColumn('review_deadline', 'timestamptz', (c) => c.notNull())
      .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('challenges_status', sql`status in ('DRAFT','AWAITING_FUNDING','FUNDED','ENTRY_OPEN','NOT_ACTIVATED','BUILDING','SUBMISSIONS_LOCKED','QUALIFICATION','APPEAL_WINDOW','FINAL_QUALIFIERS','SELECTION','DEFAULT_RESOLUTION','SETTLEMENT_PENDING','SETTLED','RECEIPT_FILED')`)
      .addCheckConstraint('challenges_versions_nonempty', sql`char_length(mechanism_version) > 0 and char_length(settlement_policy_version) > 0 and char_length(ip_terms_version) > 0`)
      .addCheckConstraint('challenges_contract_pointer_pair', sql`(current_contract_version is null) = (current_terms_digest is null)`)
      .addCheckConstraint('challenges_terms_digest', sql`current_terms_digest is null or current_terms_digest ~ '^[0-9a-f]{64}$'`)
      .addCheckConstraint('challenges_slots', sql`slot_limit >= 1 and activation_minimum >= 1 and activation_minimum <= slot_limit`)
      .addCheckConstraint('challenges_appeal_window', sql`appeal_window_ms > 0`)
      .addCheckConstraint('challenges_timeline', sql`entry_deadline = build_start and build_start < submission_deadline and submission_deadline < review_deadline`)
      .execute();

    await db.schema
      .createIndex('challenges_organizer_idx')
      .on('challenges')
      .columns(['organizer_player_id', 'created_at'])
      .execute();

    await db.schema
      .createTable('challenge_contract_versions')
      .addColumn('challenge_id', 'uuid', (c) => c.notNull().references('challenges.challenge_id').onDelete('cascade'))
      .addColumn('contract_version', 'text', (c) => c.notNull())
      .addColumn('schema_version', 'text', (c) => c.notNull())
      .addColumn('terms_digest', 'varchar(64)', (c) => c.notNull())
      .addColumn('contract_json', 'jsonb', (c) => c.notNull())
      .addColumn('frozen_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('challenge_contract_versions_pk', ['challenge_id', 'contract_version'])
      .addUniqueConstraint('challenge_contract_versions_digest_unique', ['challenge_id', 'terms_digest'])
      .addCheckConstraint('challenge_contract_versions_version_nonempty', sql`char_length(contract_version) > 0 and char_length(schema_version) > 0`)
      .addCheckConstraint('challenge_contract_versions_digest', sql`terms_digest ~ '^[0-9a-f]{64}$'`)
      .execute();

    await db.schema
      .createTable('challenge_entries')
      .addColumn('entry_id', 'uuid', (c) => c.primaryKey())
      .addColumn('challenge_id', 'uuid', (c) => c.notNull().references('challenges.challenge_id').onDelete('cascade'))
      .addColumn('builder_player_id', 'uuid', (c) => c.notNull().references('players.player_id'))
      .addColumn('project_id', 'uuid', (c) => c.references('projects.project_id').onDelete('set null'))
      .addColumn('mission_id', 'uuid', (c) => c.references('missions.mission_id').onDelete('set null'))
      .addColumn('payout_identity', 'text', (c) => c.notNull())
      .addColumn('state', 'text', (c) => c.notNull().defaultTo('SEATED'))
      .addColumn('build_start', 'timestamptz')
      .addColumn('submission_deadline', 'timestamptz')
      .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addUniqueConstraint('challenge_entries_challenge_entry_unique', ['challenge_id', 'entry_id'])
      .addUniqueConstraint('challenge_entries_builder_unique', ['challenge_id', 'builder_player_id'])
      .addUniqueConstraint('challenge_entries_payout_unique', ['challenge_id', 'payout_identity'])
      .addCheckConstraint('challenge_entries_payout_nonempty', sql`char_length(payout_identity) between 1 and 256`)
      .addCheckConstraint('challenge_entries_state', sql`state in ('SEATED','WITHDRAWN_PRE_BUILD','ACTIVE','SUBMITTED','INVALID_SUBMISSION','ABANDONED')`)
      .execute();

    await db.schema
      .createIndex('challenge_entries_challenge_state_idx')
      .on('challenge_entries')
      .columns(['challenge_id', 'state', 'created_at'])
      .execute();

    await db.schema
      .createTable('challenge_submissions')
      .addColumn('submission_id', 'uuid', (c) => c.primaryKey())
      .addColumn('challenge_id', 'uuid', (c) => c.notNull())
      .addColumn('entry_id', 'uuid', (c) => c.notNull())
      .addColumn('submission_version', 'text', (c) => c.notNull())
      .addColumn('terms_digest', 'varchar(64)', (c) => c.notNull())
      .addColumn('manifest_json', 'jsonb', (c) => c.notNull())
      .addColumn('manifest_digest', 'varchar(64)', (c) => c.notNull())
      .addColumn('ship_submission_id', 'uuid', (c) => c.references('ship_submissions.submission_id').onDelete('set null'))
      .addColumn('accepted_at', 'timestamptz', (c) => c.notNull())
      .addColumn('is_final', 'boolean', (c) => c.notNull().defaultTo(false))
      .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addForeignKeyConstraint('challenge_submissions_entry_fk', ['challenge_id', 'entry_id'], 'challenge_entries', ['challenge_id', 'entry_id'], (fk) => fk.onDelete('cascade'))
      .addUniqueConstraint('challenge_submissions_entry_version_unique', ['entry_id', 'submission_version'])
      .addUniqueConstraint('challenge_submissions_ship_unique', ['ship_submission_id'])
      .addCheckConstraint('challenge_submissions_version_nonempty', sql`char_length(submission_version) > 0`)
      .addCheckConstraint('challenge_submissions_terms_digest', sql`terms_digest ~ '^[0-9a-f]{64}$'`)
      .addCheckConstraint('challenge_submissions_manifest_digest', sql`manifest_digest ~ '^[0-9a-f]{64}$'`)
      .execute();

    await sql`create unique index challenge_submissions_final_entry_unique on challenge_submissions (entry_id) where is_final`.execute(db);

    await db.schema
      .createTable('challenge_qualifications')
      .addColumn('qualification_id', 'uuid', (c) => c.primaryKey())
      .addColumn('challenge_id', 'uuid', (c) => c.notNull())
      .addColumn('entry_id', 'uuid', (c) => c.notNull())
      .addColumn('submission_id', 'uuid', (c) => c.notNull().references('challenge_submissions.submission_id').onDelete('cascade'))
      .addColumn('terms_digest', 'varchar(64)', (c) => c.notNull())
      .addColumn('qualification_version', 'text', (c) => c.notNull())
      .addColumn('result', 'text', (c) => c.notNull())
      .addColumn('qualification_json', 'jsonb', (c) => c.notNull())
      .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addForeignKeyConstraint('challenge_qualifications_entry_fk', ['challenge_id', 'entry_id'], 'challenge_entries', ['challenge_id', 'entry_id'], (fk) => fk.onDelete('cascade'))
      .addUniqueConstraint('challenge_qualifications_entry_version_unique', ['entry_id', 'qualification_version'])
      .addCheckConstraint('challenge_qualifications_version_nonempty', sql`char_length(qualification_version) > 0`)
      .addCheckConstraint('challenge_qualifications_result', sql`result in ('PASS','FAIL','DISPUTED')`)
      .addCheckConstraint('challenge_qualifications_terms_digest', sql`terms_digest ~ '^[0-9a-f]{64}$'`)
      .execute();

    await db.schema
      .createTable('challenge_decisions')
      .addColumn('decision_id', 'uuid', (c) => c.primaryKey())
      .addColumn('challenge_id', 'uuid', (c) => c.notNull().references('challenges.challenge_id').onDelete('cascade'))
      .addColumn('entry_id', 'uuid', (c) => c.references('challenge_entries.entry_id').onDelete('set null'))
      .addColumn('decision_type', 'text', (c) => c.notNull())
      .addColumn('decision_version', 'text', (c) => c.notNull())
      .addColumn('decision_json', 'jsonb', (c) => c.notNull())
      .addColumn('decision_digest', 'varchar(64)', (c) => c.notNull())
      .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addUniqueConstraint('challenge_decisions_authority_unique', ['challenge_id', 'decision_type', 'decision_version'])
      .addCheckConstraint('challenge_decisions_type_version_nonempty', sql`char_length(decision_type) > 0 and char_length(decision_version) > 0`)
      .addCheckConstraint('challenge_decisions_digest', sql`decision_digest ~ '^[0-9a-f]{64}$'`)
      .execute();

    await db.schema
      .createTable('challenge_receipts')
      .addColumn('receipt_id', 'uuid', (c) => c.primaryKey())
      .addColumn('challenge_id', 'uuid', (c) => c.notNull().references('challenges.challenge_id').onDelete('cascade'))
      .addColumn('terms_digest', 'varchar(64)', (c) => c.notNull())
      .addColumn('receipt_version', 'text', (c) => c.notNull())
      .addColumn('receipt_json', 'jsonb', (c) => c.notNull())
      .addColumn('receipt_digest', 'varchar(64)', (c) => c.notNull())
      .addColumn('ship_receipt_id', 'uuid', (c) => c.references('ship_receipts.receipt_id').onDelete('set null'))
      .addColumn('supersedes_receipt_id', 'uuid', (c) => c.references('challenge_receipts.receipt_id'))
      .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addUniqueConstraint('challenge_receipts_digest_unique', ['challenge_id', 'receipt_digest'])
      .addUniqueConstraint('challenge_receipts_ship_unique', ['ship_receipt_id'])
      .addUniqueConstraint('challenge_receipts_supersedes_unique', ['supersedes_receipt_id'])
      .addCheckConstraint('challenge_receipts_version_nonempty', sql`char_length(receipt_version) > 0`)
      .addCheckConstraint('challenge_receipts_terms_digest', sql`terms_digest ~ '^[0-9a-f]{64}$'`)
      .addCheckConstraint('challenge_receipts_digest', sql`receipt_digest ~ '^[0-9a-f]{64}$'`)
      .execute();
  },

  async down(db: Kysely<DatabaseSchema>) {
    await db.schema.dropTable('challenge_receipts').execute();
    await db.schema.dropTable('challenge_decisions').execute();
    await db.schema.dropTable('challenge_qualifications').execute();
    await db.schema.dropTable('challenge_submissions').execute();
    await db.schema.dropTable('challenge_entries').execute();
    await db.schema.dropTable('challenge_contract_versions').execute();
    await db.schema.dropTable('challenges').execute();
  },
};
