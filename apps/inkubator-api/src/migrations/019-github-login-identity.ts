import type {Migration} from 'kysely';

export const githubLoginIdentityMigration: Migration = {
  async up(db) {
    await db.schema
      .alterTable('players')
      .addColumn('github_user_id', 'bigint')
      .execute();

    await db.schema
      .createIndex('players_github_user_id_unique')
      .unique()
      .on('players')
      .column('github_user_id')
      .execute();
  },

  async down(db) {
    await db.schema.dropIndex('players_github_user_id_unique').execute();
    await db.schema.alterTable('players').dropColumn('github_user_id').execute();
  },
};
