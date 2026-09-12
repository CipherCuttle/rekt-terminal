import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const phase8DevkitCredentialsMigration: Migration = {
  async up(db) {
    await db.schema.createTable('devkit_tokens')
      .addColumn('token_id', 'uuid', (column) => column.primaryKey())
      .addColumn('player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id', 'uuid', (column) => column.notNull())
      .addColumn('credential_class', 'text', (column) => column.notNull())
      .addColumn('label', 'text', (column) => column.notNull())
      .addColumn('token_hash', 'varchar(64)', (column) => column.notNull().unique())
      .addColumn('scopes', 'jsonb', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('expires_at', 'timestamptz', (column) => column.notNull())
      .addColumn('revoked_at', 'timestamptz')
      .addColumn('rate_window_started_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('rate_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('last_used_at', 'timestamptz')
      .addUniqueConstraint('devkit_tokens_issue_request_once', ['player_id', 'creation_request_id'])
      .addCheckConstraint('devkit_tokens_class', sql`credential_class in ('CLI', 'MCP', 'AUTOMATION')`)
      .addCheckConstraint('devkit_tokens_label', sql`char_length(label) between 1 and 80`)
      .addCheckConstraint('devkit_tokens_scopes_array', sql`jsonb_typeof(scopes) = 'array'`)
      .addCheckConstraint('devkit_tokens_expiry', sql`expires_at > created_at`)
      .addCheckConstraint('devkit_tokens_rate_count', sql`rate_count >= 0`)
      .execute();

    await db.schema.createIndex('devkit_tokens_player_idx').on('devkit_tokens').columns(['player_id', 'created_at']).execute();
    await db.schema.createIndex('devkit_tokens_expiry_idx').on('devkit_tokens').columns(['expires_at', 'revoked_at']).execute();

    await db.schema.createTable('devkit_player_rate_limits')
      .addColumn('player_id', 'uuid', (column) => column.primaryKey().references('players.player_id').onDelete('cascade'))
      .addColumn('rate_window_started_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('rate_count', 'integer', (column) => column.notNull().defaultTo(0))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('devkit_player_rate_count', sql`rate_count >= 0`)
      .execute();
  },
  async down(db) {
    await db.schema.dropTable('devkit_player_rate_limits').execute();
    await db.schema.dropTable('devkit_tokens').execute();
  },
};
