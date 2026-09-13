import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema} from '../database.js';

export const stageCQualificationOverallMigration = {
  async up(db: Kysely<DatabaseSchema>) {
    await sql`alter table challenge_qualifications drop constraint challenge_qualifications_result`.execute(db);
    await sql`
      alter table challenge_qualifications
      add constraint challenge_qualifications_result
      check (result in ('QUALIFIED','NOT_QUALIFIED','DISPUTED'))
    `.execute(db);
  },

  async down(db: Kysely<DatabaseSchema>) {
    await sql`alter table challenge_qualifications drop constraint challenge_qualifications_result`.execute(db);
    await sql`
      alter table challenge_qualifications
      add constraint challenge_qualifications_result
      check (result in ('PASS','FAIL','DISPUTED'))
    `.execute(db);
  },
};
