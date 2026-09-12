import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const phase5ProjectDiscussionWorldMigration: Migration = {
  async up(db) {
    await db.schema.createTable('project_comments')
      .addColumn('comment_id', 'uuid', (column) => column.primaryKey())
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('author_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('parent_comment_id', 'uuid', (column) => column.references('project_comments.comment_id').onDelete('set null'))
      .addColumn('creation_request_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('deletion_request_id', 'uuid', (column) => column.unique())
      .addColumn('body', 'text', (column) => column.notNull())
      .addColumn('state', 'text', (column) => column.notNull().defaultTo('ACTIVE'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('deleted_at', 'timestamptz')
      .addCheckConstraint('project_comments_body_length', sql`char_length(body) between 1 and 1000`)
      .addCheckConstraint('project_comments_state', sql`state in ('ACTIVE', 'DELETED', 'REMOVED')`)
      .execute();
    await db.schema.createIndex('project_comments_project_created_idx').on('project_comments').columns(['project_id', 'created_at']).execute();

    await db.schema.createTable('project_comment_reactions')
      .addColumn('comment_id', 'uuid', (column) => column.notNull().references('project_comments.comment_id').onDelete('cascade'))
      .addColumn('player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('reaction', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('project_comment_reactions_pk', ['comment_id', 'player_id', 'reaction'])
      .addCheckConstraint('project_comment_reactions_reaction', sql`reaction = 'USEFUL'`)
      .execute();

    await db.schema.createTable('project_discussion_settings')
      .addColumn('project_id', 'uuid', (column) => column.primaryKey().references('projects.project_id').onDelete('cascade'))
      .addColumn('locked', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .execute();
  },
  async down(db) {
    await db.schema.dropTable('project_discussion_settings').execute();
    await db.schema.dropTable('project_comment_reactions').execute();
    await db.schema.dropTable('project_comments').execute();
  },
};
