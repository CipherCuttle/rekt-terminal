import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const phase4ManifestTruthMigration: Migration = {
  async up(db) {
    await db.schema
      .alterTable('projects')
      .addColumn('observed_manifest_fingerprints', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
      .execute();
    await sql`
      alter table projects
      add constraint projects_observed_manifest_fingerprints_object
      check (jsonb_typeof(observed_manifest_fingerprints) = 'object')
    `.execute(db);

    // Legacy Phase-4 stack labels have no path identity, so they cannot be safely retracted.
    // Fail closed rather than preserving an unremovable positive stack claim.
    await sql`update projects set observed_stack_labels = '[]'::jsonb`.execute(db);
  },
  async down(db) {
    await db.schema.alterTable('projects').dropColumn('observed_manifest_fingerprints').execute();
  },
};
