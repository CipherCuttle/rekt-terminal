import {Migrator, sql, type Kysely, type Migration, type MigrationProvider} from 'kysely';
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

class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {'001_initial_player_sessions': initialMigration};
  }
}

export async function migrateToLatest(db: Kysely<DatabaseSchema>): Promise<void> {
  const migrator = new Migrator({db, provider: new StaticMigrationProvider()});
  const result = await migrator.migrateToLatest();
  if (result.error) {
    throw result.error;
  }
}
