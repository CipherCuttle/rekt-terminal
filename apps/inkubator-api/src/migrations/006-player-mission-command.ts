import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const FOUNDING_ROUND_ID = '00000000-0000-4000-8000-000000000001';

export const playerMissionCommandMigration: Migration = {
  async up(db) {
    await db.schema
      .createTable('player_profiles')
      .addColumn('player_id', 'uuid', (column) =>
        column.primaryKey().references('players.player_id').onDelete('cascade'),
      )
      .addColumn('bio', 'text')
      .addColumn('character_name', 'text')
      .addColumn('character_archetype', 'text')
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('player_profiles_bio_length', sql`bio is null or char_length(bio) between 1 and 280`)
      .addCheckConstraint('player_profiles_character_name_length', sql`character_name is null or char_length(character_name) between 1 and 80`)
      .addCheckConstraint('player_profiles_character_archetype_length', sql`character_archetype is null or char_length(character_archetype) between 1 and 80`)
      .execute();

    await db.schema
      .createTable('rounds')
      .addColumn('round_id', 'uuid', (column) => column.primaryKey())
      .addColumn('schema_version', 'text', (column) => column.notNull())
      .addColumn('code', 'text', (column) => column.notNull().unique())
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('constraint_text', 'text', (column) => column.notNull())
      .addColumn('state', 'text', (column) => column.notNull())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('rounds_state', sql`state in ('OPEN', 'CLOSED', 'ARCHIVED')`)
      .addCheckConstraint('rounds_code_nonempty', sql`char_length(code) > 0`)
      .addCheckConstraint('rounds_title_nonempty', sql`char_length(title) > 0`)
      .addCheckConstraint('rounds_constraint_nonempty', sql`char_length(constraint_text) > 0`)
      .execute();

    await db.schema
      .createTable('round_memberships')
      .addColumn('round_id', 'uuid', (column) => column.notNull().references('rounds.round_id').onDelete('cascade'))
      .addColumn('player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('joined_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('selected_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('round_memberships_pk', ['round_id', 'player_id'])
      .execute();

    await db.schema
      .createTable('projects')
      .addColumn('project_id', 'uuid', (column) => column.primaryKey())
      .addColumn('schema_version', 'text', (column) => column.notNull())
      .addColumn('owner_player_id', 'uuid', (column) =>
        column.notNull().references('players.player_id').onDelete('cascade'),
      )
      .addColumn('name', 'text', (column) => column.notNull())
      .addColumn('repository_id', 'bigint', (column) =>
        column.references('github_repositories.repository_id').onDelete('set null'),
      )
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('projects_name_length', sql`char_length(name) between 1 and 120`)
      .addUniqueConstraint('projects_repository_unique', ['repository_id'])
      .execute();

    await db.schema
      .createIndex('projects_owner_idx')
      .on('projects')
      .columns(['owner_player_id', 'updated_at'])
      .execute();

    await db.schema
      .createTable('missions')
      .addColumn('mission_id', 'uuid', (column) => column.primaryKey())
      .addColumn('schema_version', 'text', (column) => column.notNull())
      .addColumn('creation_request_id', 'uuid', (column) => column.unique())
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('owner_player_id', 'uuid', (column) =>
        column.notNull().references('players.player_id').onDelete('cascade'),
      )
      .addColumn('round_id', 'uuid', (column) => column.references('rounds.round_id').onDelete('set null'))
      .addColumn('goal', 'text', (column) => column.notNull())
      .addColumn('ship_condition', 'text', (column) => column.notNull())
      .addColumn('state', 'text', (column) => column.notNull())
      .addColumn('current_focus', 'text', (column) => column.notNull())
      .addColumn('next_move', 'text', (column) => column.notNull())
      .addColumn('blocker', 'text')
      .addColumn('progress_model_version', 'text', (column) => column.notNull())
      .addColumn('stack_labels', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('stack_source', 'text', (column) => column.notNull().defaultTo('UNKNOWN'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('missions_state', sql`state in ('DRAFT', 'DECLARED', 'BUILDING', 'BLOCKED', 'SHIP_READY', 'SUBMITTED', 'SHIPPED', 'CLOSED_NOT_SHIPPED', 'ARCHIVED')`)
      .addCheckConstraint('missions_goal_length', sql`char_length(goal) between 1 and 240`)
      .addCheckConstraint('missions_ship_condition_length', sql`char_length(ship_condition) between 1 and 240`)
      .addCheckConstraint('missions_current_focus_length', sql`char_length(current_focus) between 1 and 240`)
      .addCheckConstraint('missions_next_move_length', sql`char_length(next_move) between 1 and 240`)
      .addCheckConstraint('missions_blocker_length', sql`blocker is null or char_length(blocker) between 1 and 240`)
      .addCheckConstraint('missions_blocked_requires_blocker', sql`state <> 'BLOCKED' or blocker is not null`)
      .addCheckConstraint('missions_stack_array', sql`jsonb_typeof(stack_labels) = 'array'`)
      .addCheckConstraint('missions_stack_source', sql`stack_source in ('UNKNOWN', 'PLAYER_CONFIRMED')`)
      .execute();

    await db.schema
      .createIndex('missions_owner_current_idx')
      .on('missions')
      .columns(['owner_player_id', 'updated_at'])
      .execute();

    await db.schema
      .createIndex('missions_project_idx')
      .on('missions')
      .columns(['project_id', 'updated_at'])
      .execute();

    await db.schema
      .createTable('mission_gates')
      .addColumn('mission_id', 'uuid', (column) => column.notNull().references('missions.mission_id').onDelete('cascade'))
      .addColumn('gate_key', 'text', (column) => column.notNull())
      .addColumn('label', 'text', (column) => column.notNull())
      .addColumn('signal_state', 'text', (column) => column.notNull())
      .addColumn('position', 'integer', (column) => column.notNull())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('mission_gates_pk', ['mission_id', 'gate_key'])
      .addCheckConstraint('mission_gates_key', sql`gate_key in ('FOUNDATION', 'CORE_EXPERIENCE', 'QUALITY_TESTING', 'SHIPABILITY')`)
      .addCheckConstraint('mission_gates_signal_state', sql`signal_state in ('UNKNOWN', 'CLAIMED', 'ACTIVE', 'OBSERVED', 'PROVEN', 'ATTENTION', 'BLOCKED', 'STALE', 'FAILED')`)
      .addCheckConstraint('mission_gates_position', sql`position between 0 and 3`)
      .execute();

    await sql`
      insert into rounds (round_id, schema_version, code, title, constraint_text, state)
      values (
        ${FOUNDING_ROUND_ID}::uuid,
        'round.current.v1',
        'ROUND_01',
        'FOUNDING ROUND 01',
        'BUILD SOMETHING WEIRD. SHIP IT.',
        'OPEN'
      )
      on conflict (round_id) do nothing
    `.execute(db);

    await sql`
      insert into projects (project_id, schema_version, owner_player_id, name)
      select
        subject_id::uuid,
        'project.current.v1',
        (payload ->> 'owner_player_id')::uuid,
        payload ->> 'name'
      from history_events
      where event_type = 'project.created'
        and subject_type = 'project'
        and payload ->> 'schema_version' = 'project.development.v1'
      on conflict (project_id) do nothing
    `.execute(db);

    await sql`
      insert into missions (
        mission_id,
        schema_version,
        creation_request_id,
        project_id,
        owner_player_id,
        round_id,
        goal,
        ship_condition,
        state,
        current_focus,
        next_move,
        blocker,
        progress_model_version,
        stack_labels,
        stack_source
      )
      select
        subject_id::uuid,
        'mission.current.v1',
        null,
        (payload ->> 'project_id')::uuid,
        (payload ->> 'owner_player_id')::uuid,
        null,
        payload ->> 'goal',
        payload ->> 'ship_condition',
        'DECLARED',
        payload ->> 'current_focus',
        payload ->> 'next_move',
        null,
        'mission.progress.v1',
        '[]'::jsonb,
        'UNKNOWN'
      from history_events
      where event_type = 'mission.declared'
        and subject_type = 'mission'
        and payload ->> 'schema_version' = 'mission.development.v1'
      on conflict (mission_id) do nothing
    `.execute(db);

    await sql`
      insert into mission_gates (mission_id, gate_key, label, signal_state, position)
      select mission_id, gate_key, label, 'UNKNOWN', position
      from missions
      cross join (
        values
          ('FOUNDATION', 'FOUNDATION', 0),
          ('CORE_EXPERIENCE', 'CORE EXPERIENCE', 1),
          ('QUALITY_TESTING', 'QUALITY / TESTING', 2),
          ('SHIPABILITY', 'SHIPABILITY', 3)
      ) as defaults(gate_key, label, position)
      on conflict (mission_id, gate_key) do nothing
    `.execute(db);

    await sql`
      update projects project
      set repository_id = (link.payload ->> 'repository_id')::bigint,
          updated_at = clock_timestamp()
      from history_events link
      where link.event_type = 'project.github_repository.linked'
        and link.subject_type = 'project'
        and link.subject_id::uuid = project.project_id
        and project.repository_id is null
    `.execute(db);
  },

  async down(db) {
    await db.schema.dropTable('mission_gates').execute();
    await db.schema.dropTable('missions').execute();
    await db.schema.dropTable('projects').execute();
    await db.schema.dropTable('round_memberships').execute();
    await db.schema.dropTable('rounds').execute();
    await db.schema.dropTable('player_profiles').execute();
  },
};
