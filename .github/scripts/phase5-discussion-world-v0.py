from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing anchor in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


# Database types.
db = 'apps/inkubator-api/src/database.ts'
replace_once(db, "export interface GitHubSetupStateTable {", """export type ProjectCommentState = 'ACTIVE' | 'DELETED' | 'REMOVED';
export interface ProjectCommentTable {
  comment_id: string;
  project_id: string;
  author_player_id: string;
  parent_comment_id: string | null;
  creation_request_id: string;
  deletion_request_id: string | null;
  body: string;
  state: ProjectCommentState;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  deleted_at: Date | null;
}

export interface ProjectCommentReactionTable {
  comment_id: string;
  player_id: string;
  reaction: 'USEFUL';
  created_at: Generated<Date>;
}

export interface ProjectDiscussionSettingTable {
  project_id: string;
  locked: Generated<boolean>;
  updated_at: Generated<Date>;
}

export interface GitHubSetupStateTable {""")
replace_once(db, "  project_party_members: ProjectPartyMemberTable;\n  github_setup_states:", "  project_party_members: ProjectPartyMemberTable;\n  project_comments: ProjectCommentTable;\n  project_comment_reactions: ProjectCommentReactionTable;\n  project_discussion_settings: ProjectDiscussionSettingTable;\n  github_setup_states:")

# Migration 011.
Path('apps/inkubator-api/src/migrations/011-phase5-project-discussion-world.ts').write_text("""import {sql} from 'kysely';
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
""")

migrations = 'apps/inkubator-api/src/migrations.ts'
replace_once(migrations, "import {phase5HelpLoopCoreMigration} from './migrations/010-phase5-help-loop-core.js';", "import {phase5HelpLoopCoreMigration} from './migrations/010-phase5-help-loop-core.js';\nimport {phase5ProjectDiscussionWorldMigration} from './migrations/011-phase5-project-discussion-world.js';")
replace_once(migrations, "      '010_phase5_help_loop_core': phase5HelpLoopCoreMigration,", "      '010_phase5_help_loop_core': phase5HelpLoopCoreMigration,\n      '011_phase5_project_discussion_world': phase5ProjectDiscussionWorldMigration,")

# Phase 5A truth repair + discussion/world functions.
social = 'apps/inkubator-api/src/social.ts'
replace_once(social, "payload: {schema_version: 'project.assist.accepted.v1', assist_id: assistId, project_id: assist.project_id, helper_player_id: assist.offered_by_player_id, truth_state: 'CLAIMED'},", "payload: {schema_version: 'project.assist.accepted.v1', assist_id: assistId, project_id: assist.project_id, helper_player_id: assist.offered_by_player_id, truth_state: 'OBSERVED'},")
replace_once(social, "payload: {schema_version: 'project.party_member.joined.v1', project_id: assist.project_id, player_id: assist.offered_by_player_id, role: 'ASSIST', source_type: 'ASSIST', source_id: assistId, truth_state: 'CLAIMED'},", "payload: {schema_version: 'project.party_member.joined.v1', project_id: assist.project_id, player_id: assist.offered_by_player_id, role: 'ASSIST', source_type: 'ASSIST', source_id: assistId, truth_state: 'OBSERVED'},")

with Path(social).open('a') as f:
    f.write(r'''

function commentView(row: {comment_id: string; project_id: string; author_player_id: string; parent_comment_id: string | null; body: string; state: 'ACTIVE' | 'DELETED' | 'REMOVED'; created_at: Date}, displayName: string, usefulCount: number) {
  return {
    schema_version: 'project.comment.public.v1' as const,
    comment_id: row.comment_id,
    project_id: row.project_id,
    author: {player_id: row.author_player_id, display_name: displayName},
    ...(row.parent_comment_id ? {parent_comment_id: row.parent_comment_id} : {}),
    state: row.state,
    ...(row.state === 'ACTIVE' ? {body: row.body} : {}),
    useful_count: usefulCount,
    created_at: row.created_at.toISOString(),
  };
}

async function discussionLocked(db: Kysely<DatabaseSchema>, projectId: string): Promise<boolean> {
  const setting = await db.selectFrom('project_discussion_settings').select('locked').where('project_id', '=', projectId).executeTakeFirst();
  return setting?.locked ?? false;
}

export async function listProjectComments(db: Kysely<DatabaseSchema>, projectIdInput: string) {
  const projectId = uuid(projectIdInput, 'project_id');
  const project = await db.selectFrom('projects').select('project_id').where('project_id', '=', projectId).executeTakeFirst();
  if (!project) throw new Error('project_not_found');
  const rows = await db.selectFrom('project_comments as comment')
    .innerJoin('players as author', 'author.player_id', 'comment.author_player_id')
    .select(['comment.comment_id', 'comment.project_id', 'comment.author_player_id', 'comment.parent_comment_id', 'comment.body', 'comment.state', 'comment.created_at', 'author.display_name'])
    .where('comment.project_id', '=', projectId)
    .orderBy('comment.created_at', 'asc').orderBy('comment.comment_id', 'asc').limit(200).execute();
  const counts = rows.length === 0 ? [] : await db.selectFrom('project_comment_reactions').select(['comment_id']).select(({fn}) => fn.countAll<number>().as('count'))
    .where('comment_id', 'in', rows.map((row) => row.comment_id)).where('reaction', '=', 'USEFUL').groupBy('comment_id').execute();
  const byComment = new Map(counts.map((row) => [row.comment_id, Number(row.count)]));
  return {
    schema_version: 'project.comments.public.v1' as const,
    project_id: projectId,
    locked: await discussionLocked(db, projectId),
    comments: rows.map((row) => commentView(row, row.display_name, byComment.get(row.comment_id) ?? 0)),
  };
}

export async function createProjectComment(db: Kysely<DatabaseSchema>, actorIdInput: string, projectIdInput: string, input: {requestId: string; body: string; parentCommentId?: string | null}) {
  const actorId = uuid(actorIdInput, 'player_id');
  const projectId = uuid(projectIdInput, 'project_id');
  const requestId = uuid(input.requestId, 'request_id');
  const body = text(input.body, 'comment_body', 1000);
  const parentCommentId = input.parentCommentId ? uuid(input.parentCommentId, 'parent_comment_id') : null;
  return db.transaction().execute(async (tx) => {
    const replay = await tx.selectFrom('project_comments').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (replay) {
      if (replay.project_id !== projectId || replay.author_player_id !== actorId || replay.parent_comment_id !== parentCommentId || replay.body !== body) throw new Error('comment_idempotency_conflict');
      const author = await tx.selectFrom('players').select('display_name').where('player_id', '=', actorId).executeTakeFirstOrThrow();
      const count = await tx.selectFrom('project_comment_reactions').select(({fn}) => fn.countAll<number>().as('count')).where('comment_id', '=', replay.comment_id).where('reaction', '=', 'USEFUL').executeTakeFirstOrThrow();
      return commentView(replay, author.display_name, Number(count.count));
    }
    const project = await tx.selectFrom('projects').select('project_id').where('project_id', '=', projectId).forUpdate().executeTakeFirst();
    if (!project) throw new Error('project_not_found');
    if (await discussionLocked(tx, projectId)) throw new Error('project_discussion_locked');
    if (parentCommentId) {
      const parent = await tx.selectFrom('project_comments').select(['project_id', 'state']).where('comment_id', '=', parentCommentId).executeTakeFirst();
      if (!parent) throw new Error('parent_comment_not_found');
      if (parent.project_id !== projectId) throw new Error('parent_comment_project_mismatch');
      if (parent.state !== 'ACTIVE') throw new Error('parent_comment_not_active');
    }
    const row = await tx.insertInto('project_comments').values({
      comment_id: randomUUID(), project_id: projectId, author_player_id: actorId, parent_comment_id: parentCommentId,
      creation_request_id: requestId, deletion_request_id: null, body, state: 'ACTIVE', deleted_at: null,
    }).returningAll().executeTakeFirstOrThrow();
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.comment.created', dedupeKey: `activity:project.comment.created:${row.comment_id}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: projectId,
      payload: {schema_version: 'project.comment.created.v1', comment_id: row.comment_id, project_id: projectId, ...(parentCommentId ? {parent_comment_id: parentCommentId} : {}), truth_state: 'CLAIMED'},
    });
    const author = await tx.selectFrom('players').select('display_name').where('player_id', '=', actorId).executeTakeFirstOrThrow();
    return commentView(row, author.display_name, 0);
  });
}

export async function reactUsefulToComment(db: Kysely<DatabaseSchema>, actorIdInput: string, commentIdInput: string, requestIdInput: string) {
  const actorId = uuid(actorIdInput, 'player_id');
  const commentId = uuid(commentIdInput, 'comment_id');
  uuid(requestIdInput, 'request_id');
  return db.transaction().execute(async (tx) => {
    const comment = await tx.selectFrom('project_comments').select(['comment_id', 'project_id', 'state']).where('comment_id', '=', commentId).executeTakeFirst();
    if (!comment) throw new Error('comment_not_found');
    if (comment.state !== 'ACTIVE') throw new Error('comment_not_active');
    const project = await tx.selectFrom('projects').select('project_id').where('project_id', '=', comment.project_id).forUpdate().executeTakeFirstOrThrow();
    if (await discussionLocked(tx, project.project_id)) throw new Error('project_discussion_locked');
    const inserted = await tx.insertInto('project_comment_reactions').values({comment_id: commentId, player_id: actorId, reaction: 'USEFUL'})
      .onConflict((c) => c.columns(['comment_id', 'player_id', 'reaction']).doNothing()).returning('comment_id').executeTakeFirst();
    if (inserted) await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.comment.reacted', dedupeKey: `activity:project.comment.reacted:${commentId}:${actorId}:USEFUL`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: comment.project_id,
      payload: {schema_version: 'project.comment.reacted.v1', comment_id: commentId, project_id: comment.project_id, reaction: 'USEFUL', truth_state: 'CLAIMED'},
    });
    return {schema_version: 'project.comment.reaction.v1' as const, comment_id: commentId, player_id: actorId, reaction: 'USEFUL' as const, active: true};
  });
}

export async function deleteOwnProjectComment(db: Kysely<DatabaseSchema>, actorIdInput: string, commentIdInput: string, requestIdInput: string) {
  const actorId = uuid(actorIdInput, 'player_id');
  const commentId = uuid(commentIdInput, 'comment_id');
  const requestId = uuid(requestIdInput, 'request_id');
  return db.transaction().execute(async (tx) => {
    const comment = await tx.selectFrom('project_comments').selectAll().where('comment_id', '=', commentId).forUpdate().executeTakeFirst();
    if (!comment) throw new Error('comment_not_found');
    if (comment.author_player_id !== actorId) throw new Error('authorization_denied');
    if (comment.state === 'REMOVED') throw new Error('comment_not_active');
    if (comment.state === 'DELETED') return {schema_version: 'project.comment.delete.v1' as const, comment_id: commentId, state: 'DELETED' as const};
    await tx.updateTable('project_comments').set({state: 'DELETED', deletion_request_id: requestId, deleted_at: sql`clock_timestamp()`, updated_at: sql`clock_timestamp()`}).where('comment_id', '=', commentId).execute();
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.comment.deleted', dedupeKey: `activity:project.comment.deleted:${commentId}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: comment.project_id,
      payload: {schema_version: 'project.comment.deleted.v1', comment_id: commentId, project_id: comment.project_id},
    });
    return {schema_version: 'project.comment.delete.v1' as const, comment_id: commentId, state: 'DELETED' as const};
  });
}

export async function setProjectDiscussionLock(db: Kysely<DatabaseSchema>, actorIdInput: string, projectIdInput: string, input: {requestId: string; locked: boolean}) {
  const actorId = uuid(actorIdInput, 'player_id');
  const projectId = uuid(projectIdInput, 'project_id');
  const requestId = uuid(input.requestId, 'request_id');
  if (typeof input.locked !== 'boolean') throw new Error('invalid_discussion_locked');
  return db.transaction().execute(async (tx) => {
    const project = await tx.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', projectId).forUpdate().executeTakeFirst();
    if (!project) throw new Error('project_not_found');
    if (project.owner_player_id !== actorId) throw new Error('authorization_denied');
    await tx.insertInto('project_discussion_settings').values({project_id: projectId, locked: input.locked})
      .onConflict((c) => c.column('project_id').doUpdateSet({locked: input.locked, updated_at: sql`clock_timestamp()`})).execute();
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.discussion.locked_changed', dedupeKey: `activity:project.discussion.locked_changed:${projectId}:${requestId}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: projectId,
      payload: {schema_version: 'project.discussion.locked_changed.v1', request_id: requestId, project_id: projectId, locked: input.locked},
    });
    return {schema_version: 'project.discussion.setting.v1' as const, project_id: projectId, locked: input.locked};
  });
}

export async function listWorldSignals(db: Kysely<DatabaseSchema>) {
  const events = await db.selectFrom('history_events')
    .select(['history_event_id', 'event_type', 'subject_id', 'occurred_at'])
    .where('subject_type', '=', 'project')
    .where('event_type', 'in', ['project.help_beacon.opened', 'project.assist.accepted'])
    .orderBy('occurred_at', 'desc').orderBy('history_event_id', 'desc').limit(50).execute();
  const projectIds = [...new Set(events.map((event) => event.subject_id))];
  const projects = projectIds.length === 0 ? [] : await db.selectFrom('projects').select(['project_id', 'name']).where('project_id', 'in', projectIds).execute();
  const names = new Map(projects.map((project) => [project.project_id, project.name]));
  return events.flatMap((event) => {
    const projectName = names.get(event.subject_id);
    if (!projectName) return [];
    if (event.event_type === 'project.help_beacon.opened') return [{
      schema_version: 'world.signal.public.v1' as const, signal_id: event.history_event_id, kind: 'HELP_BEACON_OPENED' as const,
      project_id: event.subject_id, project_name: projectName, truth_state: 'CLAIMED' as const, occurred_at: event.occurred_at.toISOString(),
    }];
    if (event.event_type === 'project.assist.accepted') return [{
      schema_version: 'world.signal.public.v1' as const, signal_id: event.history_event_id, kind: 'ASSIST_ACCEPTED' as const,
      project_id: event.subject_id, project_name: projectName, truth_state: 'OBSERVED' as const, occurred_at: event.occurred_at.toISOString(),
    }];
    return [];
  });
}
''')

# App routes/imports/errors.
app = 'apps/inkubator-api/src/app.ts'
replace_once(app, "import {acceptAssist, createHelpBeacon, followPlayer, getProjectHelpLoop, listDiscoverablePlayers, listDiscoverableProjects, offerAssist, watchProject} from './social.js';", "import {acceptAssist, createHelpBeacon, createProjectComment, deleteOwnProjectComment, followPlayer, getProjectHelpLoop, listDiscoverablePlayers, listDiscoverableProjects, listProjectComments, listWorldSignals, offerAssist, reactUsefulToComment, setProjectDiscussionLock, watchProject} from './social.js';")
replace_once(app, "  if (message.includes('idempotency_conflict') || message.endsWith('_already_open') || message.endsWith('_already_offered') || message === 'help_beacon_not_open' || message === 'assist_not_offerable') return error(reply, 409, message);", "  if (message.includes('idempotency_conflict') || message.endsWith('_already_open') || message.endsWith('_already_offered') || message === 'help_beacon_not_open' || message === 'assist_not_offerable' || message === 'project_discussion_locked' || message.endsWith('_not_active') || message === 'parent_comment_project_mismatch') return error(reply, 409, message);")
anchor = "  app.get('/v1/rounds', async (request, reply) => {"
insert = r'''  app.get('/v1/projects/:projectId/comments', async (request, reply) => {
    const {projectId} = request.params as {projectId: string};
    try { return await listProjectComments(options.db, projectId); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.post('/v1/projects/:projectId/comments', {schema: {body: fastifyBodySchema('ProjectCommentCreateRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {projectId} = request.params as {projectId: string};
    const body = request.body as {request_id: string; body: string; parent_comment_id?: string | null};
    try { return reply.code(201).send(await createProjectComment(options.db, authenticated.actor.playerId, projectId, {requestId: body.request_id, body: body.body, parentCommentId: body.parent_comment_id})); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.post('/v1/comments/:commentId/reactions/useful', {schema: {body: fastifyBodySchema('SocialMutationRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {commentId} = request.params as {commentId: string};
    const body = request.body as {request_id: string};
    try { return await reactUsefulToComment(options.db, authenticated.actor.playerId, commentId, body.request_id); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.delete('/v1/comments/:commentId', {schema: {body: fastifyBodySchema('SocialMutationRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {commentId} = request.params as {commentId: string};
    const body = request.body as {request_id: string};
    try { return await deleteOwnProjectComment(options.db, authenticated.actor.playerId, commentId, body.request_id); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.patch('/v1/projects/:projectId/discussion', {schema: {body: fastifyBodySchema('ProjectDiscussionSettingRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {projectId} = request.params as {projectId: string};
    const body = request.body as {request_id: string; locked: boolean};
    try { return await setProjectDiscussionLock(options.db, authenticated.actor.playerId, projectId, {requestId: body.request_id, locked: body.locked}); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.get('/v1/world/signals', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=15');
    return listWorldSignals(options.db);
  });

'''
replace_once(app, anchor, insert + anchor)

# Contract schemas and paths.
contract = 'apps/inkubator-api/src/contract.ts'
schema_anchor = "  RoundView: {"
schemas = r'''  ProjectCommentCreateRequest: {
    type: 'object', additionalProperties: false, required: ['request_id', 'body'],
    properties: {request_id: {$ref: '#/components/schemas/RequestId'}, body: {type: 'string', minLength: 1, maxLength: 1000}, parent_comment_id: {type: ['string', 'null'], format: 'uuid'}},
  },
  ProjectDiscussionSettingRequest: {
    type: 'object', additionalProperties: false, required: ['request_id', 'locked'],
    properties: {request_id: {$ref: '#/components/schemas/RequestId'}, locked: {type: 'boolean'}},
  },
  ProjectCommentAuthorView: {
    type: 'object', additionalProperties: false, required: ['player_id', 'display_name'],
    properties: {player_id: {$ref: '#/components/schemas/PlayerId'}, display_name: {type: 'string'}},
  },
  ProjectCommentView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'comment_id', 'project_id', 'author', 'state', 'useful_count', 'created_at'],
    properties: {schema_version: {type: 'string', const: 'project.comment.public.v1'}, comment_id: {type: 'string', format: 'uuid'}, project_id: {$ref: '#/components/schemas/ProjectId'}, author: {$ref: '#/components/schemas/ProjectCommentAuthorView'}, parent_comment_id: {type: 'string', format: 'uuid'}, state: {type: 'string', enum: ['ACTIVE', 'DELETED', 'REMOVED']}, body: {type: 'string'}, useful_count: {type: 'integer', minimum: 0}, created_at: {type: 'string', format: 'date-time'}},
  },
  ProjectCommentsView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'project_id', 'locked', 'comments'],
    properties: {schema_version: {type: 'string', const: 'project.comments.public.v1'}, project_id: {$ref: '#/components/schemas/ProjectId'}, locked: {type: 'boolean'}, comments: {type: 'array', maxItems: 200, items: {$ref: '#/components/schemas/ProjectCommentView'}}},
  },
  ProjectCommentReactionView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'comment_id', 'player_id', 'reaction', 'active'],
    properties: {schema_version: {type: 'string', const: 'project.comment.reaction.v1'}, comment_id: {type: 'string', format: 'uuid'}, player_id: {$ref: '#/components/schemas/PlayerId'}, reaction: {type: 'string', const: 'USEFUL'}, active: {type: 'boolean'}},
  },
  ProjectCommentDeleteView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'comment_id', 'state'],
    properties: {schema_version: {type: 'string', const: 'project.comment.delete.v1'}, comment_id: {type: 'string', format: 'uuid'}, state: {type: 'string', const: 'DELETED'}},
  },
  ProjectDiscussionSettingView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'project_id', 'locked'],
    properties: {schema_version: {type: 'string', const: 'project.discussion.setting.v1'}, project_id: {$ref: '#/components/schemas/ProjectId'}, locked: {type: 'boolean'}},
  },
  WorldSignalView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'signal_id', 'kind', 'project_id', 'project_name', 'truth_state', 'occurred_at'],
    properties: {schema_version: {type: 'string', const: 'world.signal.public.v1'}, signal_id: {type: 'string', format: 'uuid'}, kind: {type: 'string', enum: ['HELP_BEACON_OPENED', 'ASSIST_ACCEPTED']}, project_id: {$ref: '#/components/schemas/ProjectId'}, project_name: {type: 'string'}, truth_state: {type: 'string', enum: ['CLAIMED', 'OBSERVED']}, occurred_at: {type: 'string', format: 'date-time'}},
  },
  WorldSignalList: {type: 'array', maxItems: 50, items: {$ref: '#/components/schemas/WorldSignalView'}},
'''
replace_once(contract, schema_anchor, schemas + schema_anchor)
path_anchor = "    '/v1/rounds': {"
paths = r'''    '/v1/projects/{projectId}/comments': {
      get: {operationId: 'listProjectComments', parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], responses: {'200': {description: 'Project-context discussion', content: {'application/json': {schema: ref('ProjectCommentsView')}}}, '404': errorResponse('Project not found')}},
      post: {operationId: 'createProjectComment', security: [{sessionCookie: []}], parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], requestBody: {required: true, content: {'application/json': {schema: ref('ProjectCommentCreateRequest')}}}, responses: {'201': {description: 'Claimed Project comment', content: {'application/json': {schema: ref('ProjectCommentView')}}}, '400': errorResponse('Invalid comment'), '401': errorResponse('Authentication required'), '409': errorResponse('Discussion or idempotency conflict')}},
    },
    '/v1/comments/{commentId}/reactions/useful': {
      post: {operationId: 'reactUsefulToComment', security: [{sessionCookie: []}], parameters: [{name: 'commentId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Semantic useful reaction', content: {'application/json': {schema: ref('ProjectCommentReactionView')}}}, '401': errorResponse('Authentication required'), '404': errorResponse('Comment not found'), '409': errorResponse('Comment/discussion unavailable')}},
    },
    '/v1/comments/{commentId}': {
      delete: {operationId: 'deleteOwnProjectComment', security: [{sessionCookie: []}], parameters: [{name: 'commentId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Author soft-deleted comment', content: {'application/json': {schema: ref('ProjectCommentDeleteView')}}}, '401': errorResponse('Authentication required'), '403': errorResponse('Author only'), '404': errorResponse('Comment not found')}},
    },
    '/v1/projects/{projectId}/discussion': {
      patch: {operationId: 'setProjectDiscussionLock', security: [{sessionCookie: []}], parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], requestBody: {required: true, content: {'application/json': {schema: ref('ProjectDiscussionSettingRequest')}}}, responses: {'200': {description: 'Owner discussion setting', content: {'application/json': {schema: ref('ProjectDiscussionSettingView')}}}, '401': errorResponse('Authentication required'), '403': errorResponse('Project owner only'), '404': errorResponse('Project not found')}},
    },
    '/v1/world/signals': {
      get: {operationId: 'listWorldSignals', responses: {'200': {description: 'Deterministic meaningful World Signals', content: {'application/json': {schema: ref('WorldSignalList')}}}}},
    },
'''
replace_once(contract, path_anchor, paths + path_anchor)

# Strengthen Phase 5A truth regression.
phase5a = 'apps/inkubator-api/test/integration/phase5-multiplayer-help-loop.test.mjs'
replace_once(phase5a, "    assert.equal(acceptedEvents.length, 1);\n    assert.equal(partyEvents.length, 1);", "    assert.equal(acceptedEvents.length, 1);\n    assert.equal(partyEvents.length, 1);\n    assert.equal(acceptedEvents[0].payload.truth_state, 'OBSERVED');\n    assert.equal(partyEvents[0].payload.truth_state, 'OBSERVED');")

# Focused Phase 5B1 integration test.
Path('apps/inkubator-api/test/integration/phase5-project-discussion-world.test.mjs').write_text(r'''import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';
function cookie(response) { const raw = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'][0] : response.headers['set-cookie']; assert.ok(raw); return raw.split(';')[0]; }
async function session(app, name) { const response = await app.inject({method:'POST', url:'/v1/dev/session', headers:{origin:appOrigin}, payload:{display_name:name}}); assert.equal(response.statusCode,201); return {cookie:cookie(response), playerId:response.json().player.player_id}; }
async function project(app, authCookie) {
  const rounds = await app.inject({method:'GET',url:'/v1/rounds',headers:{cookie:authCookie}}); const round = rounds.json().find((r)=>r.code==='ROUND_01'); assert.ok(round);
  assert.equal((await app.inject({method:'POST',url:`/v1/rounds/${round.round_id}/join`,headers:{origin:appOrigin,cookie:authCookie}})).statusCode,200);
  const created = await app.inject({method:'POST',url:'/v1/missions',headers:{origin:appOrigin,cookie:authCookie},payload:{request_id:randomUUID(),round_id:round.round_id,project_name:'Discussion World',goal:'Make social context useful',ship_condition:'Discussion remains bounded',current_focus:'Ask for help',next_move:'Open beacon'}}); assert.equal(created.statusCode,201); return {projectId:created.json().project.project_id, missionId:created.json().mission.mission_id};
}

test('Phase 5 discussion is project-scoped, moderation-safe and World broadcasts meaning rather than engagement', async () => {
  const db = createDatabase(databaseUrl); await migrateToLatest(db); const app = buildApp({db,appOrigin,allowDevAuth:true,sessionTtlSeconds:3600,github:null});
  try {
    const alice = await session(app, `Alice D ${randomUUID().slice(0,6)}`); const bob = await session(app, `Bob D ${randomUUID().slice(0,6)}`); const carol = await session(app, `Carol D ${randomUUID().slice(0,6)}`);
    const ah={origin:appOrigin,cookie:alice.cookie}, bh={origin:appOrigin,cookie:bob.cookie}, ch={origin:appOrigin,cookie:carol.cookie};
    const first=await project(app,alice.cookie); const second=await project(app,carol.cookie);

    const beacon=await app.inject({method:'POST',url:`/v1/projects/${first.projectId}/help-beacons`,headers:ah,payload:{request_id:randomUUID(),summary:'Need a useful human'}}); assert.equal(beacon.statusCode,201);
    const assist=await app.inject({method:'POST',url:`/v1/help-beacons/${beacon.json().beacon_id}/assists`,headers:bh,payload:{request_id:randomUUID(),message:'I can review the flow'}}); assert.equal(assist.statusCode,201);
    assert.equal((await app.inject({method:'POST',url:`/v1/assists/${assist.json().assist_id}/accept`,headers:ah,payload:{request_id:randomUUID()}})).statusCode,200);
    const acceptedEvent=await db.selectFrom('history_events').select('payload').where('event_type','=','project.assist.accepted').where('subject_id','=',first.projectId).executeTakeFirstOrThrow(); assert.equal(acceptedEvent.payload.truth_state,'OBSERVED');

    const commentReq=randomUUID();
    const comment=await app.inject({method:'POST',url:`/v1/projects/${first.projectId}/comments`,headers:bh,payload:{request_id:commentReq,body:'The onboarding copy is ambiguous.'}}); assert.equal(comment.statusCode,201); const commentId=comment.json().comment_id;
    const replay=await app.inject({method:'POST',url:`/v1/projects/${first.projectId}/comments`,headers:bh,payload:{request_id:commentReq,body:'The onboarding copy is ambiguous.'}}); assert.equal(replay.statusCode,201); assert.equal(replay.json().comment_id,commentId);
    const commentEvents=await db.selectFrom('history_events').selectAll().where('event_type','=','project.comment.created').where('subject_id','=',first.projectId).execute(); assert.equal(commentEvents.length,1); assert.equal(commentEvents[0].payload.truth_state,'CLAIMED');

    const reply=await app.inject({method:'POST',url:`/v1/projects/${first.projectId}/comments`,headers:ah,payload:{request_id:randomUUID(),body:'Good catch — fixing it.',parent_comment_id:commentId}}); assert.equal(reply.statusCode,201); assert.equal(reply.json().parent_comment_id,commentId);
    const cross=await app.inject({method:'POST',url:`/v1/projects/${second.projectId}/comments`,headers:ch,payload:{request_id:randomUUID(),body:'Cross project reply',parent_comment_id:commentId}}); assert.equal(cross.statusCode,409); assert.equal(cross.json().error,'parent_comment_project_mismatch');

    const reactReq=randomUUID();
    assert.equal((await app.inject({method:'POST',url:`/v1/comments/${commentId}/reactions/useful`,headers:ah,payload:{request_id:reactReq}})).statusCode,200);
    assert.equal((await app.inject({method:'POST',url:`/v1/comments/${commentId}/reactions/useful`,headers:ah,payload:{request_id:randomUUID()}})).statusCode,200);
    const reactionRows=await db.selectFrom('project_comment_reactions').selectAll().where('comment_id','=',commentId).where('player_id','=',alice.playerId).execute(); assert.equal(reactionRows.length,1);
    const reactionEvents=await db.selectFrom('history_events').selectAll().where('event_type','=','project.comment.reacted').where('subject_id','=',first.projectId).execute(); assert.equal(reactionEvents.length,1);

    const bobLock=await app.inject({method:'PATCH',url:`/v1/projects/${first.projectId}/discussion`,headers:bh,payload:{request_id:randomUUID(),locked:true}}); assert.equal(bobLock.statusCode,403);
    assert.equal((await app.inject({method:'PATCH',url:`/v1/projects/${first.projectId}/discussion`,headers:ah,payload:{request_id:randomUUID(),locked:true}})).statusCode,200);
    const lockedComment=await app.inject({method:'POST',url:`/v1/projects/${first.projectId}/comments`,headers:bh,payload:{request_id:randomUUID(),body:'Should be blocked'}}); assert.equal(lockedComment.statusCode,409); assert.equal(lockedComment.json().error,'project_discussion_locked');
    const lockedReaction=await app.inject({method:'POST',url:`/v1/comments/${reply.json().comment_id}/reactions/useful`,headers:bh,payload:{request_id:randomUUID()}}); assert.equal(lockedReaction.statusCode,409);
    const listedLocked=await app.inject({method:'GET',url:`/v1/projects/${first.projectId}/comments`}); assert.equal(listedLocked.statusCode,200); assert.equal(listedLocked.json().locked,true); assert.equal(listedLocked.json().comments.length,2);
    assert.equal((await app.inject({method:'PATCH',url:`/v1/projects/${first.projectId}/discussion`,headers:ah,payload:{request_id:randomUUID(),locked:false}})).statusCode,200);

    const aliceCannotDelete=await app.inject({method:'DELETE',url:`/v1/comments/${commentId}`,headers:ah,payload:{request_id:randomUUID()}}); assert.equal(aliceCannotDelete.statusCode,403);
    const deleted=await app.inject({method:'DELETE',url:`/v1/comments/${commentId}`,headers:bh,payload:{request_id:randomUUID()}}); assert.equal(deleted.statusCode,200); assert.equal(deleted.json().state,'DELETED');
    const afterDelete=await app.inject({method:'GET',url:`/v1/projects/${first.projectId}/comments`}); const deletedView=afterDelete.json().comments.find((c)=>c.comment_id===commentId); assert.equal(deletedView.state,'DELETED'); assert.equal('body' in deletedView,false);
    const reactDeleted=await app.inject({method:'POST',url:`/v1/comments/${commentId}/reactions/useful`,headers:ch,payload:{request_id:randomUUID()}}); assert.equal(reactDeleted.statusCode,409);

    const world=await app.inject({method:'GET',url:'/v1/world/signals'}); assert.equal(world.statusCode,200); const mine=world.json().filter((s)=>s.project_id===first.projectId); assert.ok(mine.some((s)=>s.kind==='HELP_BEACON_OPENED'&&s.truth_state==='CLAIMED')); assert.ok(mine.some((s)=>s.kind==='ASSIST_ACCEPTED'&&s.truth_state==='OBSERVED'));
    assert.equal(JSON.stringify(world.json()).includes('The onboarding copy is ambiguous.'),false); assert.equal(JSON.stringify(world.json()).includes('USEFUL'),false);
    assert.equal(world.json().every((s)=>['HELP_BEACON_OPENED','ASSIST_ACCEPTED'].includes(s.kind)),true);

    const gates=await db.selectFrom('mission_gates').selectAll().where('mission_id','=',first.missionId).execute(); assert.equal(gates.every((g)=>g.signal_state==='UNKNOWN'),true);
    const projectEvents=await db.selectFrom('history_events').selectAll().where('subject_id','=',first.projectId).execute(); assert.equal(JSON.stringify(projectEvents).includes('PROVEN'),false);
  } finally { await app.close(); await db.destroy(); }
});
''')

print('Phase 5 discussion/world slice applied')
