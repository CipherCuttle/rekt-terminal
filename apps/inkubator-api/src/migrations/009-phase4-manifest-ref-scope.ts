import type {Migration} from 'kysely/migration';

export const phase4ManifestRefScopeMigration: Migration = {
  async up(db) {
    await db.schema
      .alterTable('projects')
      .addColumn('observed_manifest_ref', 'text')
      .execute();

    // Pre-repair manifest state may have mixed multiple branch refs. Fail closed once,
    // then rebuild only from future canonical/default-branch observations.
    await db
      .updateTable('projects')
      .set({observed_manifest_ref: null, observed_manifest_fingerprints: {}, observed_stack_labels: []})
      .execute();
  },
  async down(db) {
    await db.schema.alterTable('projects').dropColumn('observed_manifest_ref').execute();
  },
};
