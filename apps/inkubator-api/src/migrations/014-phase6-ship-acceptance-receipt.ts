import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema} from '../database.js';

export const phase6ShipAcceptanceReceiptMigration = {
  async up(db: Kysely<DatabaseSchema>) {
    await sql`alter table ship_submissions drop constraint ship_submissions_state`.execute(db);
    await sql`
      alter table ship_submissions
      add constraint ship_submissions_state
      check (state in ('SUBMITTED','OBSERVED','ATTENTION','ACCEPTED','REJECTED'))
    `.execute(db);

    await db.schema.createTable('ship_acceptance_reviews')
      .addColumn('review_id', 'uuid', (c) => c.primaryKey())
      .addColumn('submission_id', 'uuid', (c) => c.notNull().unique().references('ship_submissions.submission_id').onDelete('cascade'))
      .addColumn('creation_request_id', 'uuid', (c) => c.notNull().unique())
      .addColumn('decision', 'text', (c) => c.notNull())
      .addColumn('reason', 'text', (c) => c.notNull())
      .addColumn('rule_version', 'text', (c) => c.notNull())
      .addColumn('reviewed_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('ship_acceptance_reviews_decision', sql`decision in ('ACCEPT','REJECT')`)
      .addCheckConstraint('ship_acceptance_reviews_reason', sql`char_length(reason) between 1 and 240`)
      .addCheckConstraint('ship_acceptance_reviews_rule', sql`rule_version = 'ship.acceptance.v1'`)
      .execute();

    await db.schema.createTable('ship_receipts')
      .addColumn('receipt_id', 'uuid', (c) => c.primaryKey())
      .addColumn('submission_id', 'uuid', (c) => c.notNull().unique().references('ship_submissions.submission_id').onDelete('cascade'))
      .addColumn('mission_id', 'uuid', (c) => c.notNull().unique().references('missions.mission_id').onDelete('cascade'))
      .addColumn('project_id', 'uuid', (c) => c.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('owner_player_id', 'uuid', (c) => c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('round_id', 'uuid', (c) => c.references('rounds.round_id').onDelete('set null'))
      .addColumn('schema_version', 'text', (c) => c.notNull())
      .addColumn('acceptance_rule_version', 'text', (c) => c.notNull())
      .addColumn('verifier_observation_id', 'uuid', (c) => c.notNull().unique().references('ship_verifier_observations.observation_id'))
      .addColumn('acceptance_review_id', 'uuid', (c) => c.notNull().unique().references('ship_acceptance_reviews.review_id'))
      .addColumn('artifact_title', 'text', (c) => c.notNull())
      .addColumn('artifact_url', 'text', (c) => c.notNull())
      .addColumn('demo_url', 'text')
      .addColumn('shipped_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('ship_receipts_schema', sql`schema_version = 'inkubator.ship-receipt/1.0'`)
      .addCheckConstraint('ship_receipts_acceptance_rule', sql`acceptance_rule_version = 'ship.acceptance.v1'`)
      .addCheckConstraint('ship_receipts_title', sql`char_length(artifact_title) between 1 and 120`)
      .execute();
  },

  async down(db: Kysely<DatabaseSchema>) {
    await sql`
      update missions mission
      set state = 'SUBMITTED', updated_at = clock_timestamp()
      from ship_receipts receipt
      where receipt.mission_id = mission.mission_id and mission.state = 'SHIPPED'
    `.execute(db);
    await db.schema.dropTable('ship_receipts').execute();
    await db.schema.dropTable('ship_acceptance_reviews').execute();
    await sql`
      update ship_submissions
      set state = case when state = 'ACCEPTED' then 'OBSERVED' else 'ATTENTION' end,
          updated_at = clock_timestamp()
      where state in ('ACCEPTED','REJECTED')
    `.execute(db);
    await sql`alter table ship_submissions drop constraint ship_submissions_state`.execute(db);
    await sql`
      alter table ship_submissions
      add constraint ship_submissions_state
      check (state in ('SUBMITTED','OBSERVED','ATTENTION'))
    `.execute(db);
  },
};
