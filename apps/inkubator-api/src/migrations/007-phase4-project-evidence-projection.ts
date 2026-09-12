import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const phase4ProjectEvidenceProjectionMigration: Migration = {
  async up(db) {
    await db.schema
      .alterTable('projects')
      .addColumn('observed_stack_labels', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .execute();
    await sql`
      alter table projects
      add constraint projects_observed_stack_labels_array
      check (jsonb_typeof(observed_stack_labels) = 'array')
    `.execute(db);
    await sql`
      update projects project
      set observed_stack_labels = evidence.observed_stack_labels
      from (
        select
          history.subject_id::uuid as project_id,
          to_jsonb(array_agg(distinct stacks.stack_label order by stacks.stack_label)) as observed_stack_labels
        from history_events history
        cross join lateral jsonb_array_elements_text(history.payload -> 'observed_stacks') as stacks(stack_label)
        where history.event_type = 'project.github_repository_stack.observed'
          and history.subject_type = 'project'
        group by history.subject_id
      ) evidence
      where project.project_id = evidence.project_id
    `.execute(db);
  },
  async down(db) {
    await db.schema.alterTable('projects').dropColumn('observed_stack_labels').execute();
  },
};
