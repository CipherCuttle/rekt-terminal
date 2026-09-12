import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema} from '../database.js';

export const phase6ShipVerifierControlMigration = {
  async up(db: Kysely<DatabaseSchema>) {
    await db.schema.createTable('ship_submissions')
      .addColumn('submission_id', 'uuid', (c) => c.primaryKey())
      .addColumn('mission_id', 'uuid', (c) => c.notNull().references('missions.mission_id').onDelete('cascade'))
      .addColumn('project_id', 'uuid', (c) => c.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('owner_player_id', 'uuid', (c) => c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id', 'uuid', (c) => c.notNull().unique())
      .addColumn('artifact_title', 'text', (c) => c.notNull())
      .addColumn('artifact_url', 'text', (c) => c.notNull())
      .addColumn('demo_url', 'text')
      .addColumn('source_url', 'text')
      .addColumn('state', 'text', (c) => c.notNull().defaultTo('SUBMITTED'))
      .addColumn('submitted_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('ship_submissions_state', sql`state in ('SUBMITTED','OBSERVED','ATTENTION')`)
      .addCheckConstraint('ship_submissions_title', sql`char_length(artifact_title) between 1 and 120`)
      .execute();
    await sql`create unique index ship_submissions_active_mission_idx on ship_submissions (mission_id) where state in ('SUBMITTED','OBSERVED','ATTENTION')`.execute(db);

    await db.schema.createTable('ship_verifier_observations')
      .addColumn('observation_id', 'uuid', (c) => c.primaryKey())
      .addColumn('submission_id', 'uuid', (c) => c.notNull().unique().references('ship_submissions.submission_id').onDelete('cascade'))
      .addColumn('outcome', 'text', (c) => c.notNull())
      .addColumn('reason_code', 'text', (c) => c.notNull())
      .addColumn('final_url', 'text')
      .addColumn('http_status', 'integer')
      .addColumn('duration_ms', 'integer', (c) => c.notNull())
      .addColumn('redirects', 'integer', (c) => c.notNull())
      .addColumn('observed_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('ship_verifier_observations_outcome', sql`outcome in ('PASS','FAILED','UNAVAILABLE')`)
      .addCheckConstraint('ship_verifier_observations_duration', sql`duration_ms >= 0 and duration_ms <= 60000`)
      .addCheckConstraint('ship_verifier_observations_redirects', sql`redirects between 0 and 3`)
      .execute();
  },
  async down(db: Kysely<DatabaseSchema>) {
    await db.schema.dropTable('ship_verifier_observations').execute();
    await db.schema.dropTable('ship_submissions').execute();
  },
};
