import type {Migration} from 'kysely/migration';
import {sql} from 'kysely';

export const githubLoginDisplayMetadataMigration: Migration = {
  async up(db) {
    await db.schema
      .alterTable('players')
      .addColumn('github_login', 'text')
      .execute();

    await db.schema
      .alterTable('players')
      .addCheckConstraint('players_github_login_length', sql`github_login is null or char_length(github_login) between 1 and 100`)
      .execute();
  },

  async down(db) {
    await db.schema.alterTable('players').dropConstraint('players_github_login_length').execute();
    await db.schema.alterTable('players').dropColumn('github_login').execute();
  },
};
