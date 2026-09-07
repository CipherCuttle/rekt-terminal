import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const phase5TesterModerationMigration: Migration = {
  async up(db) {
    await db.schema.createTable('player_blocks')
      .addColumn('blocker_player_id','uuid',(c)=>c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('blocked_player_id','uuid',(c)=>c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('created_at','timestamptz',(c)=>c.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('player_blocks_pk',['blocker_player_id','blocked_player_id'])
      .addCheckConstraint('player_blocks_not_self',sql`blocker_player_id <> blocked_player_id`).execute();

    await db.schema.createTable('content_reports')
      .addColumn('report_id','uuid',(c)=>c.primaryKey())
      .addColumn('reporter_player_id','uuid',(c)=>c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('comment_id','uuid',(c)=>c.notNull().references('project_comments.comment_id').onDelete('cascade'))
      .addColumn('creation_request_id','uuid',(c)=>c.notNull().unique())
      .addColumn('reason','text',(c)=>c.notNull())
      .addColumn('detail','text')
      .addColumn('state','text',(c)=>c.notNull().defaultTo('OPEN'))
      .addColumn('created_at','timestamptz',(c)=>c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('content_reports_reason',sql`reason in ('SPAM','ABUSE','PRIVACY','OTHER')`)
      .addCheckConstraint('content_reports_detail_length',sql`detail is null or char_length(detail) between 1 and 500`)
      .addCheckConstraint('content_reports_state',sql`state = 'OPEN'`).execute();
    await db.schema.createIndex('content_reports_comment_idx').on('content_reports').column('comment_id').execute();

    await db.schema.createTable('moderation_operators')
      .addColumn('player_id','uuid',(c)=>c.primaryKey().references('players.player_id').onDelete('cascade'))
      .addColumn('scope','text',(c)=>c.notNull())
      .addColumn('granted_at','timestamptz',(c)=>c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('moderation_operators_scope',sql`scope = 'GLOBAL_MODERATION'`).execute();

    await db.schema.createTable('external_test_requests')
      .addColumn('test_request_id','uuid',(c)=>c.primaryKey())
      .addColumn('project_id','uuid',(c)=>c.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('owner_player_id','uuid',(c)=>c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id','uuid',(c)=>c.notNull().unique())
      .addColumn('prompt','text',(c)=>c.notNull())
      .addColumn('state','text',(c)=>c.notNull().defaultTo('OPEN'))
      .addColumn('created_at','timestamptz',(c)=>c.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('completed_at','timestamptz')
      .addCheckConstraint('external_test_requests_prompt_length',sql`char_length(prompt) between 1 and 500`)
      .addCheckConstraint('external_test_requests_state',sql`state in ('OPEN','COMPLETED','CLOSED')`).execute();
    await sql`create unique index external_test_requests_one_open_per_project on external_test_requests(project_id) where state = 'OPEN'`.execute(db);

    await db.schema.createTable('external_test_results')
      .addColumn('test_result_id','uuid',(c)=>c.primaryKey())
      .addColumn('test_request_id','uuid',(c)=>c.notNull().unique().references('external_test_requests.test_request_id').onDelete('cascade'))
      .addColumn('project_id','uuid',(c)=>c.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('tester_player_id','uuid',(c)=>c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id','uuid',(c)=>c.notNull().unique())
      .addColumn('outcome','text',(c)=>c.notNull())
      .addColumn('summary','text',(c)=>c.notNull())
      .addColumn('observed_at','timestamptz',(c)=>c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('external_test_results_outcome',sql`outcome in ('PASS','ISSUE_FOUND','BLOCKED')`)
      .addCheckConstraint('external_test_results_summary_length',sql`char_length(summary) between 1 and 500`).execute();
  },
  async down(db) {
    await db.schema.dropTable('external_test_results').execute();
    await sql`drop index if exists external_test_requests_one_open_per_project`.execute(db);
    await db.schema.dropTable('external_test_requests').execute();
    await db.schema.dropTable('moderation_operators').execute();
    await db.schema.dropTable('content_reports').execute();
    await db.schema.dropTable('player_blocks').execute();
  },
};
