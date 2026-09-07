from pathlib import Path

def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"anchor not found in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))

migration = r"""import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const phase5CommunityLoopMigration: Migration = {
  async up(db) {
    await db.schema.createTable('project_comments')
      .addColumn('comment_id', 'uuid', (column) => column.primaryKey())
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('author_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('parent_comment_id', 'uuid', (column) => column.references('project_comments.comment_id').onDelete('restrict'))
      .addColumn('creation_request_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('body', 'text', (column) => column.notNull())
      .addColumn('state', 'text', (column) => column.notNull().defaultTo('ACTIVE'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('moderated_at', 'timestamptz')
      .addCheckConstraint('project_comments_body_length', sql`char_length(body) between 1 and 1200`)
      .addCheckConstraint('project_comments_state', sql`state in ('ACTIVE', 'DELETED', 'REMOVED')`)
      .execute();
    await db.schema.createIndex('project_comments_project_idx').on('project_comments').columns(['project_id', 'created_at']).execute();

    await db.schema.createTable('project_comment_reactions')
      .addColumn('comment_id', 'uuid', (column) => column.notNull().references('project_comments.comment_id').onDelete('cascade'))
      .addColumn('player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('reaction', 'text', (column) => column.notNull().defaultTo('HELPFUL'))
      .addColumn('creation_request_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('project_comment_reactions_pk', ['comment_id', 'player_id', 'reaction'])
      .addCheckConstraint('project_comment_reactions_reaction', sql`reaction = 'HELPFUL'`)
      .execute();

    await db.schema.createTable('project_comment_controls')
      .addColumn('project_id', 'uuid', (column) => column.primaryKey().references('projects.project_id').onDelete('cascade'))
      .addColumn('comments_locked', 'boolean', (column) => column.notNull().defaultTo(false))
      .addColumn('updated_by_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('last_request_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .execute();

    await db.schema.createTable('project_moderation_reports')
      .addColumn('report_id', 'uuid', (column) => column.primaryKey())
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('comment_id', 'uuid', (column) => column.notNull().references('project_comments.comment_id').onDelete('cascade'))
      .addColumn('reporter_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('reason', 'text', (column) => column.notNull())
      .addColumn('state', 'text', (column) => column.notNull().defaultTo('OPEN'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('project_moderation_reports_reason_length', sql`char_length(reason) between 1 and 500`)
      .addCheckConstraint('project_moderation_reports_state', sql`state = 'OPEN'`)
      .execute();

    await db.schema.createTable('player_blocks')
      .addColumn('blocker_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('blocked_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('player_blocks_pk', ['blocker_player_id', 'blocked_player_id'])
      .addCheckConstraint('player_blocks_not_self', sql`blocker_player_id <> blocked_player_id`)
      .execute();

    await db.schema.createTable('project_test_requests')
      .addColumn('test_request_id', 'uuid', (column) => column.primaryKey())
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('owner_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('summary', 'text', (column) => column.notNull())
      .addColumn('state', 'text', (column) => column.notNull().defaultTo('OPEN'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('observed_at', 'timestamptz')
      .addCheckConstraint('project_test_requests_summary_length', sql`char_length(summary) between 1 and 240`)
      .addCheckConstraint('project_test_requests_state', sql`state in ('OPEN', 'OBSERVED', 'CLOSED')`)
      .execute();
    await sql`create unique index project_test_requests_one_open_per_project on project_test_requests(project_id) where state = 'OPEN'`.execute(db);

    await db.schema.createTable('project_test_actions')
      .addColumn('test_action_id', 'uuid', (column) => column.primaryKey())
      .addColumn('test_request_id', 'uuid', (column) => column.notNull().references('project_test_requests.test_request_id').onDelete('cascade'))
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('tester_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('outcome', 'text', (column) => column.notNull())
      .addColumn('notes', 'text', (column) => column.notNull())
      .addColumn('observed_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addUniqueConstraint('project_test_actions_request_tester_unique', ['test_request_id', 'tester_player_id'])
      .addCheckConstraint('project_test_actions_outcome', sql`outcome in ('PASS', 'FAIL', 'MIXED')`)
      .addCheckConstraint('project_test_actions_notes_length', sql`char_length(notes) between 1 and 500`)
      .execute();
  },
  async down(db) {
    await db.schema.dropTable('project_test_actions').execute();
    await sql`drop index if exists project_test_requests_one_open_per_project`.execute(db);
    await db.schema.dropTable('project_test_requests').execute();
    await db.schema.dropTable('player_blocks').execute();
    await db.schema.dropTable('project_moderation_reports').execute();
    await db.schema.dropTable('project_comment_controls').execute();
    await db.schema.dropTable('project_comment_reactions').execute();
    await db.schema.dropTable('project_comments').execute();
  },
};
"""
Path('apps/inkubator-api/src/migrations/011-phase5-community-loop.ts').write_text(migration)

database_types = r"""
export type ProjectCommentState = 'ACTIVE' | 'DELETED' | 'REMOVED';
export interface ProjectCommentTable {
  comment_id: string;
  project_id: string;
  author_player_id: string;
  parent_comment_id: string | null;
  creation_request_id: string;
  body: string;
  state: ProjectCommentState;
  created_at: Generated<Date>;
  moderated_at: Date | null;
}

export interface ProjectCommentReactionTable {
  comment_id: string;
  player_id: string;
  reaction: 'HELPFUL';
  creation_request_id: string;
  created_at: Generated<Date>;
}

export interface ProjectCommentControlTable {
  project_id: string;
  comments_locked: Generated<boolean>;
  updated_by_player_id: string;
  last_request_id: string;
  updated_at: Generated<Date>;
}

export interface ProjectModerationReportTable {
  report_id: string;
  project_id: string;
  comment_id: string;
  reporter_player_id: string;
  creation_request_id: string;
  reason: string;
  state: 'OPEN';
  created_at: Generated<Date>;
}

export interface PlayerBlockTable {
  blocker_player_id: string;
  blocked_player_id: string;
  creation_request_id: string;
  created_at: Generated<Date>;
}

export type ProjectTestRequestState = 'OPEN' | 'OBSERVED' | 'CLOSED';
export interface ProjectTestRequestTable {
  test_request_id: string;
  project_id: string;
  owner_player_id: string;
  creation_request_id: string;
  summary: string;
  state: ProjectTestRequestState;
  created_at: Generated<Date>;
  observed_at: Date | null;
}

export interface ProjectTestActionTable {
  test_action_id: string;
  test_request_id: string;
  project_id: string;
  tester_player_id: string;
  creation_request_id: string;
  outcome: 'PASS' | 'FAIL' | 'MIXED';
  notes: string;
  observed_at: Generated<Date>;
}

"""
replace_once('apps/inkubator-api/src/database.ts',
             'export interface GitHubSetupStateTable {',
             database_types + 'export interface GitHubSetupStateTable {')
replace_once('apps/inkubator-api/src/database.ts',
             '  project_party_members: ProjectPartyMemberTable;\n',
             '  project_party_members: ProjectPartyMemberTable;\n'
             '  project_comments: ProjectCommentTable;\n'
             '  project_comment_reactions: ProjectCommentReactionTable;\n'
             '  project_comment_controls: ProjectCommentControlTable;\n'
             '  project_moderation_reports: ProjectModerationReportTable;\n'
             '  player_blocks: PlayerBlockTable;\n'
             '  project_test_requests: ProjectTestRequestTable;\n'
             '  project_test_actions: ProjectTestActionTable;\n')

replace_once('apps/inkubator-api/src/migrations.ts',
             "import {phase5HelpLoopCoreMigration} from './migrations/010-phase5-help-loop-core.js';\n",
             "import {phase5HelpLoopCoreMigration} from './migrations/010-phase5-help-loop-core.js';\n"
             "import {phase5CommunityLoopMigration} from './migrations/011-phase5-community-loop.js';\n")
replace_once('apps/inkubator-api/src/migrations.ts',
             "      '010_phase5_help_loop_core': phase5HelpLoopCoreMigration,\n",
             "      '010_phase5_help_loop_core': phase5HelpLoopCoreMigration,\n"
             "      '011_phase5_community_loop': phase5CommunityLoopMigration,\n")

community = r"""import {randomUUID} from 'node:crypto';
import {sql, type Kysely, type Selectable} from 'kysely';
import type {
  DatabaseSchema,
  ProjectCommentTable,
  ProjectTestRequestTable,
} from './database.js';
import {appendHistoryEvent} from './events.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMMENT_LIMIT = 100;
const WORLD_SIGNAL_LIMIT = 50;

function uuid(value: string, name: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new Error(`invalid_${name}`);
  return value.toLowerCase();
}

function text(value: string, name: string, max: number): string {
  if (typeof value !== 'string') throw new Error(`invalid_${name}`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 1 || normalized.length > max) throw new Error(`invalid_${name}`);
  return normalized;
}

async function projectOwner(db: Kysely<DatabaseSchema>, projectId: string): Promise<string> {
  const project = await db.selectFrom('projects').select('owner_player_id').where('project_id', '=', projectId).executeTakeFirst();
  if (!project) throw new Error('project_not_found');
  return project.owner_player_id;
}

async function interactionBlocked(db: Kysely<DatabaseSchema>, a: string, b: string): Promise<boolean> {
  const forward = await db.selectFrom('player_blocks').select('blocked_player_id')
    .where('blocker_player_id', '=', a).where('blocked_player_id', '=', b).executeTakeFirst();
  if (forward) return true;
  return Boolean(await db.selectFrom('player_blocks').select('blocked_player_id')
    .where('blocker_player_id', '=', b).where('blocked_player_id', '=', a).executeTakeFirst());
}

async function commentView(db: Kysely<DatabaseSchema>, comment: Selectable<ProjectCommentTable>) {
  const author = await db.selectFrom('players').select(['player_id', 'display_name']).where('player_id', '=', comment.author_player_id).executeTakeFirstOrThrow();
  const reactions = await db.selectFrom('project_comment_reactions').select('comment_id').where('comment_id', '=', comment.comment_id).where('reaction', '=', 'HELPFUL').execute();
  return {
    schema_version: 'project.comment.public.v1' as const,
    comment_id: comment.comment_id,
    project_id: comment.project_id,
    author,
    ...(comment.parent_comment_id ? {parent_comment_id: comment.parent_comment_id} : {}),
    state: comment.state,
    ...(comment.state === 'ACTIVE' ? {body: comment.body} : {}),
    helpful_reactions: reactions.length,
    created_at: comment.created_at.toISOString(),
  };
}

export async function listProjectComments(db: Kysely<DatabaseSchema>, projectIdInput: string) {
  const projectId = uuid(projectIdInput, 'project_id');
  await projectOwner(db, projectId);
  const comments = await db.selectFrom('project_comments').selectAll().where('project_id', '=', projectId)
    .orderBy('created_at', 'asc').limit(COMMENT_LIMIT).execute();
  return Promise.all(comments.map((comment) => commentView(db, comment)));
}

export async function createProjectComment(
  db: Kysely<DatabaseSchema>,
  actorIdInput: string,
  projectIdInput: string,
  input: {requestId: string; body: string; parentCommentId?: string},
) {
  const actorId = uuid(actorIdInput, 'player_id');
  const projectId = uuid(projectIdInput, 'project_id');
  const requestId = uuid(input.requestId, 'request_id');
  const body = text(input.body, 'comment_body', 1200);
  const parentCommentId = input.parentCommentId ? uuid(input.parentCommentId, 'parent_comment_id') : null;

  return db.transaction().execute(async (tx) => {
    const replay = await tx.selectFrom('project_comments').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (replay) {
      if (replay.author_player_id !== actorId || replay.project_id !== projectId || replay.body !== body || replay.parent_comment_id !== parentCommentId) {
        throw new Error('comment_idempotency_conflict');
      }
      return commentView(tx, replay);
    }

    const ownerId = await projectOwner(tx, projectId);
    if (await interactionBlocked(tx, actorId, ownerId)) throw new Error('interaction_blocked');
    const control = await tx.selectFrom('project_comment_controls').select('comments_locked').where('project_id', '=', projectId).executeTakeFirst();
    if (control?.comments_locked) throw new Error('project_comments_locked');

    if (parentCommentId) {
      const parent = await tx.selectFrom('project_comments').select(['project_id', 'state']).where('comment_id', '=', parentCommentId).executeTakeFirst();
      if (!parent) throw new Error('parent_comment_not_found');
      if (parent.project_id !== projectId) throw new Error('parent_comment_project_mismatch');
      if (parent.state !== 'ACTIVE') throw new Error('parent_comment_not_active');
    }

    const row = await tx.insertInto('project_comments').values({
      comment_id: randomUUID(), project_id: projectId, author_player_id: actorId, parent_comment_id: parentCommentId,
      creation_request_id: requestId, body, state: 'ACTIVE', moderated_at: null,
    }).returningAll().executeTakeFirstOrThrow();

    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.comment.posted', dedupeKey: `activity:project.comment.posted:${row.comment_id}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: projectId,
      payload: {schema_version: 'project.comment.posted.v1', comment_id: row.comment_id, project_id: projectId, truth_state: 'CLAIMED'},
    });
    return commentView(tx, row);
  });
}

export async function reactHelpful(
  db: Kysely<DatabaseSchema>,
  actorIdInput: string,
  commentIdInput: string,
  requestIdInput: string,
) {
  const actorId = uuid(actorIdInput, 'player_id');
  const commentId = uuid(commentIdInput, 'comment_id');
  const requestId = uuid(requestIdInput, 'request_id');
  return db.transaction().execute(async (tx) => {
    const replay = await tx.selectFrom('project_comment_reactions').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (replay) {
      if (replay.player_id !== actorId || replay.comment_id !== commentId) throw new Error('reaction_idempotency_conflict');
      return {schema_version: 'project.comment.reaction.v1' as const, comment_id: commentId, player_id: actorId, reaction: 'HELPFUL' as const, active: true};
    }
    const comment = await tx.selectFrom('project_comments').select(['comment_id', 'state']).where('comment_id', '=', commentId).executeTakeFirst();
    if (!comment) throw new Error('comment_not_found');
    if (comment.state !== 'ACTIVE') throw new Error('comment_not_active');
    await tx.insertInto('project_comment_reactions').values({
      comment_id: commentId, player_id: actorId, reaction: 'HELPFUL', creation_request_id: requestId,
    }).onConflict((c) => c.columns(['comment_id', 'player_id', 'reaction']).doNothing()).execute();
    return {schema_version: 'project.comment.reaction.v1' as const, comment_id: commentId, player_id: actorId, reaction: 'HELPFUL' as const, active: true};
  });
}

export async function deleteOwnProjectComment(db: Kysely<DatabaseSchema>, actorIdInput: string, commentIdInput: string) {
  const actorId = uuid(actorIdInput, 'player_id');
  const commentId = uuid(commentIdInput, 'comment_id');
  return db.transaction().execute(async (tx) => {
    const comment = await tx.selectFrom('project_comments').selectAll().where('comment_id', '=', commentId).forUpdate().executeTakeFirst();
    if (!comment) throw new Error('comment_not_found');
    if (comment.author_player_id !== actorId) throw new Error('authorization_denied');
    if (comment.state === 'REMOVED') return commentView(tx, comment);
    if (comment.state === 'DELETED') return commentView(tx, comment);
    const updated = await tx.updateTable('project_comments').set({state: 'DELETED', moderated_at: sql`clock_timestamp()`})
      .where('comment_id', '=', commentId).returningAll().executeTakeFirstOrThrow();
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.comment.deleted', dedupeKey: `activity:project.comment.deleted:${commentId}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: comment.project_id,
      payload: {schema_version: 'project.comment.deleted.v1', comment_id: commentId, project_id: comment.project_id, truth_state: 'CLAIMED'},
    });
    return commentView(tx, updated);
  });
}

export async function setProjectCommentsLocked(
  db: Kysely<DatabaseSchema>,
  actorIdInput: string,
  projectIdInput: string,
  requestIdInput: string,
  locked: boolean,
) {
  const actorId = uuid(actorIdInput, 'player_id');
  const projectId = uuid(projectIdInput, 'project_id');
  const requestId = uuid(requestIdInput, 'request_id');
  if (typeof locked !== 'boolean') throw new Error('invalid_comments_locked');
  return db.transaction().execute(async (tx) => {
    const reused = await tx.selectFrom('project_comment_controls').selectAll().where('last_request_id', '=', requestId).executeTakeFirst();
    if (reused) {
      if (reused.project_id !== projectId || reused.updated_by_player_id !== actorId || reused.comments_locked !== locked) throw new Error('comment_control_idempotency_conflict');
      return {schema_version: 'project.comment.control.v1' as const, project_id: projectId, comments_locked: reused.comments_locked};
    }
    const ownerId = await projectOwner(tx, projectId);
    if (ownerId !== actorId) throw new Error('authorization_denied');
    await tx.insertInto('project_comment_controls').values({
      project_id: projectId, comments_locked: locked, updated_by_player_id: actorId, last_request_id: requestId,
    }).onConflict((c) => c.column('project_id').doUpdateSet({
      comments_locked: locked, updated_by_player_id: actorId, last_request_id: requestId, updated_at: sql`clock_timestamp()`,
    })).execute();
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: locked ? 'project.comments.locked' : 'project.comments.unlocked',
      dedupeKey: `activity:project.comments.control:${requestId}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: projectId,
      payload: {schema_version: 'project.comments.control.v1', project_id: projectId, comments_locked: locked, truth_state: 'CLAIMED'},
    });
    return {schema_version: 'project.comment.control.v1' as const, project_id: projectId, comments_locked: locked};
  });
}

export async function reportProjectComment(
  db: Kysely<DatabaseSchema>,
  actorIdInput: string,
  commentIdInput: string,
  input: {requestId: string; reason: string},
) {
  const actorId = uuid(actorIdInput, 'player_id');
  const commentId = uuid(commentIdInput, 'comment_id');
  const requestId = uuid(input.requestId, 'request_id');
  const reason = text(input.reason, 'report_reason', 500);
  return db.transaction().execute(async (tx) => {
    const replay = await tx.selectFrom('project_moderation_reports').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (replay) {
      if (replay.comment_id !== commentId || replay.reporter_player_id !== actorId || replay.reason !== reason) throw new Error('report_idempotency_conflict');
      return {schema_version: 'project.comment.report.v1' as const, report_id: replay.report_id, comment_id: commentId, state: replay.state};
    }
    const comment = await tx.selectFrom('project_comments').select(['project_id']).where('comment_id', '=', commentId).executeTakeFirst();
    if (!comment) throw new Error('comment_not_found');
    const report = await tx.insertInto('project_moderation_reports').values({
      report_id: randomUUID(), project_id: comment.project_id, comment_id: commentId, reporter_player_id: actorId,
      creation_request_id: requestId, reason, state: 'OPEN',
    }).returningAll().executeTakeFirstOrThrow();
    return {schema_version: 'project.comment.report.v1' as const, report_id: report.report_id, comment_id: commentId, state: report.state};
  });
}

export async function blockPlayer(db: Kysely<DatabaseSchema>, actorIdInput: string, targetIdInput: string, requestIdInput: string) {
  const actorId = uuid(actorIdInput, 'player_id');
  const targetId = uuid(targetIdInput, 'player_id');
  const requestId = uuid(requestIdInput, 'request_id');
  if (actorId === targetId) throw new Error('block_self_forbidden');
  return db.transaction().execute(async (tx) => {
    const replay = await tx.selectFrom('player_blocks').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (replay) {
      if (replay.blocker_player_id !== actorId || replay.blocked_player_id !== targetId) throw new Error('block_idempotency_conflict');
      return {schema_version: 'player.block.v1' as const, blocker_player_id: actorId, blocked_player_id: targetId, active: true};
    }
    if (!await tx.selectFrom('players').select('player_id').where('player_id', '=', targetId).executeTakeFirst()) throw new Error('player_not_found');
    await tx.insertInto('player_blocks').values({blocker_player_id: actorId, blocked_player_id: targetId, creation_request_id: requestId})
      .onConflict((c) => c.columns(['blocker_player_id', 'blocked_player_id']).doNothing()).execute();
    return {schema_version: 'player.block.v1' as const, blocker_player_id: actorId, blocked_player_id: targetId, active: true};
  });
}

export async function operatorRemoveProjectComment(db: Kysely<DatabaseSchema>, commentIdInput: string) {
  const commentId = uuid(commentIdInput, 'comment_id');
  return db.transaction().execute(async (tx) => {
    const comment = await tx.selectFrom('project_comments').selectAll().where('comment_id', '=', commentId).forUpdate().executeTakeFirst();
    if (!comment) throw new Error('comment_not_found');
    if (comment.state === 'REMOVED') return commentView(tx, comment);
    const updated = await tx.updateTable('project_comments').set({state: 'REMOVED', moderated_at: sql`clock_timestamp()`})
      .where('comment_id', '=', commentId).returningAll().executeTakeFirstOrThrow();
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.comment.removed', dedupeKey: `activity:project.comment.removed:${commentId}`,
      actorPlayerId: null, subjectType: 'project', subjectId: comment.project_id,
      payload: {schema_version: 'project.comment.removed.v1', comment_id: commentId, project_id: comment.project_id, moderation_source: 'OPERATOR'},
    });
    return commentView(tx, updated);
  });
}

async function testRequestView(db: Kysely<DatabaseSchema>, request: Selectable<ProjectTestRequestTable>) {
  const action = await db.selectFrom('project_test_actions as action')
    .innerJoin('players as tester', 'tester.player_id', 'action.tester_player_id')
    .select(['action.test_action_id', 'action.outcome', 'action.notes', 'action.observed_at', 'tester.player_id', 'tester.display_name'])
    .where('action.test_request_id', '=', request.test_request_id).executeTakeFirst();
  return {
    schema_version: 'project.external_test.public.v1' as const,
    test_request_id: request.test_request_id,
    project_id: request.project_id,
    summary: request.summary,
    state: request.state,
    created_at: request.created_at.toISOString(),
    ...(action ? {
      observation: {
        test_action_id: action.test_action_id,
        outcome: action.outcome,
        notes: action.notes,
        tester: {player_id: action.player_id, display_name: action.display_name},
        observed_at: action.observed_at.toISOString(),
        signal_state: 'OBSERVED' as const,
      },
    } : {}),
  };
}

export async function createExternalTestRequest(
  db: Kysely<DatabaseSchema>,
  actorIdInput: string,
  projectIdInput: string,
  input: {requestId: string; summary: string},
) {
  const actorId = uuid(actorIdInput, 'player_id');
  const projectId = uuid(projectIdInput, 'project_id');
  const requestId = uuid(input.requestId, 'request_id');
  const summary = text(input.summary, 'test_summary', 240);
  return db.transaction().execute(async (tx) => {
    const replay = await tx.selectFrom('project_test_requests').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (replay) {
      if (replay.project_id !== projectId || replay.owner_player_id !== actorId || replay.summary !== summary) throw new Error('test_request_idempotency_conflict');
      return testRequestView(tx, replay);
    }
    const ownerId = await projectOwner(tx, projectId);
    if (ownerId !== actorId) throw new Error('authorization_denied');
    const open = await tx.selectFrom('project_test_requests').select('test_request_id').where('project_id', '=', projectId).where('state', '=', 'OPEN').executeTakeFirst();
    if (open) throw new Error('test_request_already_open');
    const row = await tx.insertInto('project_test_requests').values({
      test_request_id: randomUUID(), project_id: projectId, owner_player_id: actorId, creation_request_id: requestId,
      summary, state: 'OPEN', observed_at: null,
    }).returningAll().executeTakeFirstOrThrow();
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.external_test.requested', dedupeKey: `activity:project.external_test.requested:${row.test_request_id}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: projectId,
      payload: {schema_version: 'project.external_test.requested.v1', test_request_id: row.test_request_id, project_id: projectId, truth_state: 'CLAIMED'},
    });
    return testRequestView(tx, row);
  });
}

export async function recordExternalTestAction(
  db: Kysely<DatabaseSchema>,
  actorIdInput: string,
  testRequestIdInput: string,
  input: {requestId: string; outcome: string; notes: string},
) {
  const actorId = uuid(actorIdInput, 'player_id');
  const testRequestId = uuid(testRequestIdInput, 'test_request_id');
  const requestId = uuid(input.requestId, 'request_id');
  const outcome = input.outcome;
  if (!['PASS', 'FAIL', 'MIXED'].includes(outcome)) throw new Error('invalid_test_outcome');
  const typedOutcome = outcome as 'PASS' | 'FAIL' | 'MIXED';
  const notes = text(input.notes, 'test_notes', 500);
  return db.transaction().execute(async (tx) => {
    const replay = await tx.selectFrom('project_test_actions').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (replay) {
      if (replay.test_request_id !== testRequestId || replay.tester_player_id !== actorId || replay.outcome !== typedOutcome || replay.notes !== notes) {
        throw new Error('test_action_idempotency_conflict');
      }
      const request = await tx.selectFrom('project_test_requests').selectAll().where('test_request_id', '=', testRequestId).executeTakeFirstOrThrow();
      return testRequestView(tx, request);
    }
    const request = await tx.selectFrom('project_test_requests').selectAll().where('test_request_id', '=', testRequestId).forUpdate().executeTakeFirst();
    if (!request) throw new Error('test_request_not_found');
    if (request.owner_player_id === actorId) throw new Error('test_self_forbidden');
    if (request.state !== 'OPEN') throw new Error('test_request_not_open');
    if (await interactionBlocked(tx, actorId, request.owner_player_id)) throw new Error('interaction_blocked');
    const action = await tx.insertInto('project_test_actions').values({
      test_action_id: randomUUID(), test_request_id: testRequestId, project_id: request.project_id, tester_player_id: actorId,
      creation_request_id: requestId, outcome: typedOutcome, notes,
    }).returningAll().executeTakeFirstOrThrow();
    const updated = await tx.updateTable('project_test_requests').set({state: 'OBSERVED', observed_at: action.observed_at})
      .where('test_request_id', '=', testRequestId).returningAll().executeTakeFirstOrThrow();
    await appendHistoryEvent(tx, {
      eventFamily: 'evidence', eventType: 'project.external_test.observed', dedupeKey: `evidence:project.external_test.observed:${action.test_action_id}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: request.project_id,
      payload: {
        schema_version: 'project.external_test.observed.v1', test_request_id: testRequestId, test_action_id: action.test_action_id,
        project_id: request.project_id, outcome: typedOutcome, truth_state: 'OBSERVED',
      },
    });
    return testRequestView(tx, updated);
  });
}

export async function listExternalTestRequests(db: Kysely<DatabaseSchema>, projectIdInput: string) {
  const projectId = uuid(projectIdInput, 'project_id');
  await projectOwner(db, projectId);
  const requests = await db.selectFrom('project_test_requests').selectAll().where('project_id', '=', projectId)
    .orderBy('created_at', 'desc').limit(20).execute();
  return Promise.all(requests.map((request) => testRequestView(db, request)));
}

const WORLD_SIGNAL_TYPES = new Map<string, {kind: string; state: 'CLAIMED' | 'OBSERVED'}>([
  ['project.help_beacon.opened', {kind: 'HELP_BEACON', state: 'CLAIMED'}],
  ['project.assist.accepted', {kind: 'ASSIST_ACCEPTED', state: 'OBSERVED'}],
  ['project.external_test.requested', {kind: 'TEST_REQUESTED', state: 'CLAIMED'}],
  ['project.external_test.observed', {kind: 'TEST_OBSERVED', state: 'OBSERVED'}],
]);

export async function listWorldSignals(db: Kysely<DatabaseSchema>) {
  const events = await db.selectFrom('history_events').selectAll()
    .where('event_type', 'in', [...WORLD_SIGNAL_TYPES.keys()])
    .where('subject_type', '=', 'project')
    .orderBy('occurred_at', 'desc').limit(WORLD_SIGNAL_LIMIT).execute();
  const result = [];
  for (const event of events) {
    const meta = WORLD_SIGNAL_TYPES.get(event.event_type);
    if (!meta) continue;
    const project = await db.selectFrom('projects').select(['project_id', 'name']).where('project_id', '=', event.subject_id).executeTakeFirst();
    if (!project) continue;
    const actor = event.actor_player_id
      ? await db.selectFrom('players').select(['player_id', 'display_name']).where('player_id', '=', event.actor_player_id).executeTakeFirst()
      : null;
    result.push({
      schema_version: 'world.signal.v1' as const,
      signal_id: event.history_event_id,
      kind: meta.kind,
      signal_state: meta.state,
      project_id: project.project_id,
      project_name: project.name,
      ...(actor ? {actor} : {}),
      occurred_at: event.occurred_at.toISOString(),
    });
  }
  return result;
}
"""
Path('apps/inkubator-api/src/community.ts').write_text(community)

social = Path('apps/inkubator-api/src/social.ts')
social_text = social.read_text()
social_text = social_text.replace(
    "helper_player_id: assist.offered_by_player_id, truth_state: 'CLAIMED'",
    "helper_player_id: assist.offered_by_player_id, truth_state: 'OBSERVED'",
    1,
)
social_text = social_text.replace(
    "source_type: 'ASSIST', source_id: assistId, truth_state: 'CLAIMED'",
    "source_type: 'ASSIST', source_id: assistId, truth_state: 'OBSERVED'",
    1,
)
social.write_text(social_text)

contract_schemas = r"""  ProjectCommentCreateRequest: {
    type: 'object', additionalProperties: false, required: ['request_id', 'body'],
    properties: {
      request_id: {$ref: '#/components/schemas/RequestId'},
      body: {type: 'string', minLength: 1, maxLength: 1200},
      parent_comment_id: {type: 'string', format: 'uuid'},
    },
  },
  ProjectCommentView: {
    type: 'object', additionalProperties: false,
    required: ['schema_version', 'comment_id', 'project_id', 'author', 'state', 'helpful_reactions', 'created_at'],
    properties: {
      schema_version: {type: 'string', const: 'project.comment.public.v1'},
      comment_id: {type: 'string', format: 'uuid'},
      project_id: {$ref: '#/components/schemas/ProjectId'},
      author: {type: 'object', additionalProperties: false, required: ['player_id', 'display_name'], properties: {player_id: {$ref: '#/components/schemas/PlayerId'}, display_name: {type: 'string'}}},
      parent_comment_id: {type: 'string', format: 'uuid'},
      state: {type: 'string', enum: ['ACTIVE', 'DELETED', 'REMOVED']},
      body: {type: 'string'},
      helpful_reactions: {type: 'integer', minimum: 0},
      created_at: {type: 'string', format: 'date-time'},
    },
  },
  ProjectCommentList: {type: 'array', items: {$ref: '#/components/schemas/ProjectCommentView'}},
  ProjectCommentReactionView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'comment_id', 'player_id', 'reaction', 'active'],
    properties: {
      schema_version: {type: 'string', const: 'project.comment.reaction.v1'},
      comment_id: {type: 'string', format: 'uuid'}, player_id: {$ref: '#/components/schemas/PlayerId'},
      reaction: {type: 'string', const: 'HELPFUL'}, active: {type: 'boolean'},
    },
  },
  ProjectCommentControlRequest: {
    type: 'object', additionalProperties: false, required: ['request_id', 'locked'],
    properties: {request_id: {$ref: '#/components/schemas/RequestId'}, locked: {type: 'boolean'}},
  },
  ProjectCommentControlView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'project_id', 'comments_locked'],
    properties: {schema_version: {type: 'string', const: 'project.comment.control.v1'}, project_id: {$ref: '#/components/schemas/ProjectId'}, comments_locked: {type: 'boolean'}},
  },
  ProjectCommentReportRequest: {
    type: 'object', additionalProperties: false, required: ['request_id', 'reason'],
    properties: {request_id: {$ref: '#/components/schemas/RequestId'}, reason: {type: 'string', minLength: 1, maxLength: 500}},
  },
  ProjectCommentReportView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'report_id', 'comment_id', 'state'],
    properties: {schema_version: {type: 'string', const: 'project.comment.report.v1'}, report_id: {type: 'string', format: 'uuid'}, comment_id: {type: 'string', format: 'uuid'}, state: {type: 'string', const: 'OPEN'}},
  },
  PlayerBlockView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'blocker_player_id', 'blocked_player_id', 'active'],
    properties: {schema_version: {type: 'string', const: 'player.block.v1'}, blocker_player_id: {$ref: '#/components/schemas/PlayerId'}, blocked_player_id: {$ref: '#/components/schemas/PlayerId'}, active: {type: 'boolean'}},
  },
  ExternalTestRequestCreateRequest: {
    type: 'object', additionalProperties: false, required: ['request_id', 'summary'],
    properties: {request_id: {$ref: '#/components/schemas/RequestId'}, summary: {type: 'string', minLength: 1, maxLength: 240}},
  },
  ExternalTestActionCreateRequest: {
    type: 'object', additionalProperties: false, required: ['request_id', 'outcome', 'notes'],
    properties: {
      request_id: {$ref: '#/components/schemas/RequestId'},
      outcome: {type: 'string', enum: ['PASS', 'FAIL', 'MIXED']},
      notes: {type: 'string', minLength: 1, maxLength: 500},
    },
  },
  ExternalTestRequestView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'test_request_id', 'project_id', 'summary', 'state', 'created_at'],
    properties: {
      schema_version: {type: 'string', const: 'project.external_test.public.v1'},
      test_request_id: {type: 'string', format: 'uuid'}, project_id: {$ref: '#/components/schemas/ProjectId'},
      summary: {type: 'string'}, state: {type: 'string', enum: ['OPEN', 'OBSERVED', 'CLOSED']}, created_at: {type: 'string', format: 'date-time'},
      observation: {
        type: 'object', additionalProperties: false,
        required: ['test_action_id', 'outcome', 'notes', 'tester', 'observed_at', 'signal_state'],
        properties: {
          test_action_id: {type: 'string', format: 'uuid'}, outcome: {type: 'string', enum: ['PASS', 'FAIL', 'MIXED']},
          notes: {type: 'string'}, tester: {type: 'object', additionalProperties: false, required: ['player_id', 'display_name'], properties: {player_id: {$ref: '#/components/schemas/PlayerId'}, display_name: {type: 'string'}}},
          observed_at: {type: 'string', format: 'date-time'}, signal_state: {type: 'string', const: 'OBSERVED'},
        },
      },
    },
  },
  ExternalTestRequestList: {type: 'array', items: {$ref: '#/components/schemas/ExternalTestRequestView'}},
  WorldSignalView: {
    type: 'object', additionalProperties: false, required: ['schema_version', 'signal_id', 'kind', 'signal_state', 'project_id', 'project_name', 'occurred_at'],
    properties: {
      schema_version: {type: 'string', const: 'world.signal.v1'}, signal_id: {type: 'string', format: 'uuid'},
      kind: {type: 'string', enum: ['HELP_BEACON', 'ASSIST_ACCEPTED', 'TEST_REQUESTED', 'TEST_OBSERVED']},
      signal_state: {type: 'string', enum: ['CLAIMED', 'OBSERVED']},
      project_id: {$ref: '#/components/schemas/ProjectId'}, project_name: {type: 'string'},
      actor: {type: 'object', additionalProperties: false, required: ['player_id', 'display_name'], properties: {player_id: {$ref: '#/components/schemas/PlayerId'}, display_name: {type: 'string'}}},
      occurred_at: {type: 'string', format: 'date-time'},
    },
  },
  WorldSignalList: {type: 'array', items: {$ref: '#/components/schemas/WorldSignalView'}},
"""
replace_once('apps/inkubator-api/src/contract.ts', '  RoundView: {\n', contract_schemas + '  RoundView: {\n')

contract_paths = r"""    '/v1/world/signals': {get: {operationId: 'listWorldSignals', responses: {'200': {description: 'Public-safe meaningful World Signals', content: {'application/json': {schema: ref('WorldSignalList')}}}}}},
    '/v1/projects/{projectId}/comments': {
      get: {operationId: 'listProjectComments', parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], responses: {'200': {description: 'Project comment thread', content: {'application/json': {schema: ref('ProjectCommentList')}}}, '400': errorResponse('Invalid Project ID'), '404': errorResponse('Project not found')}},
      post: {operationId: 'createProjectComment', security: [{sessionCookie: []}], parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], requestBody: {required: true, content: {'application/json': {schema: ref('ProjectCommentCreateRequest')}}}, responses: {'201': {description: 'Project comment or reply created', content: {'application/json': {schema: ref('ProjectCommentView')}}}, '400': errorResponse('Invalid comment'), '401': errorResponse('Authentication required'), '403': errorResponse('Interaction blocked'), '404': errorResponse('Project or parent not found'), '409': errorResponse('Comments locked or idempotency conflict')}},
    },
    '/v1/comments/{commentId}': {delete: {operationId: 'deleteOwnProjectComment', security: [{sessionCookie: []}], parameters: [{name: 'commentId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], responses: {'200': {description: 'Own comment soft-deleted', content: {'application/json': {schema: ref('ProjectCommentView')}}}, '401': errorResponse('Authentication required'), '403': errorResponse('Author required'), '404': errorResponse('Comment not found')}}},
    '/v1/comments/{commentId}/reactions/helpful': {post: {operationId: 'reactHelpful', security: [{sessionCookie: []}], parameters: [{name: 'commentId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Helpful reaction recorded idempotently', content: {'application/json': {schema: ref('ProjectCommentReactionView')}}}, '401': errorResponse('Authentication required'), '404': errorResponse('Comment not found'), '409': errorResponse('Comment inactive or idempotency conflict')}}},
    '/v1/comments/{commentId}/report': {post: {operationId: 'reportProjectComment', security: [{sessionCookie: []}], parameters: [{name: 'commentId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('ProjectCommentReportRequest')}}}, responses: {'201': {description: 'Moderation report recorded', content: {'application/json': {schema: ref('ProjectCommentReportView')}}}, '401': errorResponse('Authentication required'), '404': errorResponse('Comment not found'), '409': errorResponse('Idempotency conflict')}}},
    '/v1/projects/{projectId}/comments/control': {post: {operationId: 'setProjectCommentsLocked', security: [{sessionCookie: []}], parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], requestBody: {required: true, content: {'application/json': {schema: ref('ProjectCommentControlRequest')}}}, responses: {'200': {description: 'Project comment lock updated', content: {'application/json': {schema: ref('ProjectCommentControlView')}}}, '401': errorResponse('Authentication required'), '403': errorResponse('Project owner required'), '404': errorResponse('Project not found'), '409': errorResponse('Idempotency conflict')}}},
    '/v1/players/{playerId}/block': {post: {operationId: 'blockPlayer', security: [{sessionCookie: []}], parameters: [{name: 'playerId', in: 'path', required: true, schema: ref('PlayerId')}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Player interaction block recorded', content: {'application/json': {schema: ref('PlayerBlockView')}}}, '401': errorResponse('Authentication required'), '403': errorResponse('Self-block forbidden'), '404': errorResponse('Player not found'), '409': errorResponse('Idempotency conflict')}}},
    '/v1/projects/{projectId}/test-requests': {
      get: {operationId: 'listExternalTestRequests', parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], responses: {'200': {description: 'External test history', content: {'application/json': {schema: ref('ExternalTestRequestList')}}}, '404': errorResponse('Project not found')}},
      post: {operationId: 'createExternalTestRequest', security: [{sessionCookie: []}], parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], requestBody: {required: true, content: {'application/json': {schema: ref('ExternalTestRequestCreateRequest')}}}, responses: {'201': {description: 'External test requested', content: {'application/json': {schema: ref('ExternalTestRequestView')}}}, '401': errorResponse('Authentication required'), '403': errorResponse('Project owner required'), '404': errorResponse('Project not found'), '409': errorResponse('Existing open test or idempotency conflict')}},
    },
    '/v1/test-requests/{testRequestId}/actions': {post: {operationId: 'recordExternalTestAction', security: [{sessionCookie: []}], parameters: [{name: 'testRequestId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('ExternalTestActionCreateRequest')}}}, responses: {'201': {description: 'Bounded external tester observation recorded', content: {'application/json': {schema: ref('ExternalTestRequestView')}}}, '401': errorResponse('Authentication required'), '403': errorResponse('Self-test or blocked interaction forbidden'), '404': errorResponse('Test request not found'), '409': errorResponse('Test request state or idempotency conflict')}}},
"""
replace_once('apps/inkubator-api/src/contract.ts', "    '/v1/rounds': {\n", contract_paths + "    '/v1/rounds': {\n")

community_import = """import {
  blockPlayer,
  createExternalTestRequest,
  createProjectComment,
  deleteOwnProjectComment,
  listExternalTestRequests,
  listProjectComments,
  listWorldSignals,
  reactHelpful,
  recordExternalTestAction,
  reportProjectComment,
  setProjectCommentsLocked,
} from './community.js';
"""
replace_once('apps/inkubator-api/src/app.ts',
             "import {acceptAssist, createHelpBeacon, followPlayer, getProjectHelpLoop, listDiscoverablePlayers, listDiscoverableProjects, offerAssist, watchProject} from './social.js';\n",
             "import {acceptAssist, createHelpBeacon, followPlayer, getProjectHelpLoop, listDiscoverablePlayers, listDiscoverableProjects, offerAssist, watchProject} from './social.js';\n" + community_import)

replace_once('apps/inkubator-api/src/app.ts',
             "  if (message === 'authorization_denied' || message.endsWith('_self_forbidden')) return error(reply, 403, message);\n",
             "  if (message === 'authorization_denied' || message === 'interaction_blocked' || message.endsWith('_self_forbidden')) return error(reply, 403, message);\n"
             "  if (message === 'comment_not_found' || message === 'parent_comment_not_found' || message === 'test_request_not_found') return error(reply, 404, message);\n"
             "  if (message === 'project_comments_locked' || message === 'parent_comment_not_active' || message === 'parent_comment_project_mismatch' || message === 'comment_not_active' || message === 'test_request_not_open' || message === 'test_request_already_open') return error(reply, 409, message);\n")

app_routes = r"""  app.get('/v1/world/signals', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=15');
    return listWorldSignals(options.db);
  });

  app.get('/v1/projects/:projectId/comments', async (request, reply) => {
    const {projectId} = request.params as {projectId: string};
    try { return await listProjectComments(options.db, projectId); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.post('/v1/projects/:projectId/comments', {schema: {body: fastifyBodySchema('ProjectCommentCreateRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {projectId} = request.params as {projectId: string};
    const body = request.body as {request_id: string; body: string; parent_comment_id?: string};
    try { return reply.code(201).send(await createProjectComment(options.db, authenticated.actor.playerId, projectId, {requestId: body.request_id, body: body.body, parentCommentId: body.parent_comment_id})); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.post('/v1/comments/:commentId/reactions/helpful', {schema: {body: fastifyBodySchema('SocialMutationRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {commentId} = request.params as {commentId: string};
    const body = request.body as {request_id: string};
    try { return await reactHelpful(options.db, authenticated.actor.playerId, commentId, body.request_id); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.delete('/v1/comments/:commentId', async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {commentId} = request.params as {commentId: string};
    try { return await deleteOwnProjectComment(options.db, authenticated.actor.playerId, commentId); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.post('/v1/comments/:commentId/report', {schema: {body: fastifyBodySchema('ProjectCommentReportRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {commentId} = request.params as {commentId: string};
    const body = request.body as {request_id: string; reason: string};
    try { return reply.code(201).send(await reportProjectComment(options.db, authenticated.actor.playerId, commentId, {requestId: body.request_id, reason: body.reason})); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.post('/v1/projects/:projectId/comments/control', {schema: {body: fastifyBodySchema('ProjectCommentControlRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {projectId} = request.params as {projectId: string};
    const body = request.body as {request_id: string; locked: boolean};
    try { return await setProjectCommentsLocked(options.db, authenticated.actor.playerId, projectId, body.request_id, body.locked); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.post('/v1/players/:playerId/block', {schema: {body: fastifyBodySchema('SocialMutationRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {playerId} = request.params as {playerId: string};
    const body = request.body as {request_id: string};
    try { return await blockPlayer(options.db, authenticated.actor.playerId, playerId, body.request_id); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.get('/v1/projects/:projectId/test-requests', async (request, reply) => {
    const {projectId} = request.params as {projectId: string};
    try { return await listExternalTestRequests(options.db, projectId); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.post('/v1/projects/:projectId/test-requests', {schema: {body: fastifyBodySchema('ExternalTestRequestCreateRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {projectId} = request.params as {projectId: string};
    const body = request.body as {request_id: string; summary: string};
    try { return reply.code(201).send(await createExternalTestRequest(options.db, authenticated.actor.playerId, projectId, {requestId: body.request_id, summary: body.summary})); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.post('/v1/test-requests/:testRequestId/actions', {schema: {body: fastifyBodySchema('ExternalTestActionCreateRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {testRequestId} = request.params as {testRequestId: string};
    const body = request.body as {request_id: string; outcome: string; notes: string};
    try { return reply.code(201).send(await recordExternalTestAction(options.db, authenticated.actor.playerId, testRequestId, {requestId: body.request_id, outcome: body.outcome, notes: body.notes})); }
    catch (cause) { return phase5Error(reply, cause); }
  });

"""
replace_once('apps/inkubator-api/src/app.ts', "  app.get('/v1/rounds', async (request, reply) => {\n", app_routes + "  app.get('/v1/rounds', async (request, reply) => {\n")

test = r"""import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';
import {operatorRemoveProjectComment} from '../../dist/community.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for integration tests');
const appOrigin = process.env.INKUBATOR_APP_ORIGIN ?? 'http://127.0.0.1:4175';

function cookie(response) {
  const value = response.headers['set-cookie'];
  const serialized = Array.isArray(value) ? value[0] : value;
  assert.ok(serialized);
  return serialized.split(';')[0];
}

async function session(app, name) {
  const response = await app.inject({method: 'POST', url: '/v1/dev/session', headers: {origin: appOrigin}, payload: {display_name: name}});
  assert.equal(response.statusCode, 201);
  return {cookie: cookie(response), playerId: response.json().player.player_id};
}

async function projectFor(app, authCookie) {
  const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie: authCookie}});
  const founding = rounds.json().find((round) => round.code === 'ROUND_01');
  assert.ok(founding);
  assert.equal((await app.inject({method: 'POST', url: `/v1/rounds/${founding.round_id}/join`, headers: {origin: appOrigin, cookie: authCookie}})).statusCode, 200);
  const create = await app.inject({method: 'POST', url: '/v1/missions', headers: {origin: appOrigin, cookie: authCookie}, payload: {
    request_id: randomUUID(), round_id: founding.round_id, project_name: `Community ${randomUUID().slice(0, 6)}`,
    goal: 'Get real outside help', ship_condition: 'External feedback is durably recorded', current_focus: 'Testing social loop', next_move: 'Ask another builder',
  }});
  assert.equal(create.statusCode, 201);
  return {projectId: create.json().project.project_id, missionId: create.json().mission.mission_id};
}

test('Phase 5 community completion keeps social claims bounded and external testing OBSERVED-only', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const alice = await session(app, `Alice ${randomUUID().slice(0, 6)}`);
    const bob = await session(app, `Bob ${randomUUID().slice(0, 6)}`);
    const carol = await session(app, `Carol ${randomUUID().slice(0, 6)}`);
    const aliceHeaders = {origin: appOrigin, cookie: alice.cookie};
    const bobHeaders = {origin: appOrigin, cookie: bob.cookie};
    const carolHeaders = {origin: appOrigin, cookie: carol.cookie};
    const {projectId, missionId} = await projectFor(app, alice.cookie);

    const rootRequest = randomUUID();
    const root = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/comments`, headers: bobHeaders, payload: {request_id: rootRequest, body: 'I can review the onboarding.'}});
    assert.equal(root.statusCode, 201);
    const rootId = root.json().comment_id;
    const rootRetry = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/comments`, headers: bobHeaders, payload: {request_id: rootRequest, body: 'I can review the onboarding.'}});
    assert.equal(rootRetry.statusCode, 201);
    assert.equal(rootRetry.json().comment_id, rootId);

    const reply = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/comments`, headers: carolHeaders, payload: {
      request_id: randomUUID(), parent_comment_id: rootId, body: 'I can test mobile too.',
    }});
    assert.equal(reply.statusCode, 201);
    const replyId = reply.json().comment_id;

    const reactionRequest = randomUUID();
    assert.equal((await app.inject({method: 'POST', url: `/v1/comments/${rootId}/reactions/helpful`, headers: aliceHeaders, payload: {request_id: reactionRequest}})).statusCode, 200);
    assert.equal((await app.inject({method: 'POST', url: `/v1/comments/${rootId}/reactions/helpful`, headers: aliceHeaders, payload: {request_id: reactionRequest}})).statusCode, 200);
    const commentsBeforeDelete = await app.inject({method: 'GET', url: `/v1/projects/${projectId}/comments`});
    assert.equal(commentsBeforeDelete.statusCode, 200);
    assert.equal(commentsBeforeDelete.json().find((entry) => entry.comment_id === rootId).helpful_reactions, 1);

    const bobCannotDeleteCarol = await app.inject({method: 'DELETE', url: `/v1/comments/${replyId}`, headers: bobHeaders});
    assert.equal(bobCannotDeleteCarol.statusCode, 403);
    const carolDelete = await app.inject({method: 'DELETE', url: `/v1/comments/${replyId}`, headers: carolHeaders});
    assert.equal(carolDelete.statusCode, 200);
    assert.equal(carolDelete.json().state, 'DELETED');
    assert.equal('body' in carolDelete.json(), false);

    const reportRequest = randomUUID();
    const report = await app.inject({method: 'POST', url: `/v1/comments/${rootId}/report`, headers: carolHeaders, payload: {request_id: reportRequest, reason: 'Needs moderator eyes'}});
    assert.equal(report.statusCode, 201);
    const reportRetry = await app.inject({method: 'POST', url: `/v1/comments/${rootId}/report`, headers: carolHeaders, payload: {request_id: reportRequest, reason: 'Needs moderator eyes'}});
    assert.equal(reportRetry.statusCode, 201);
    assert.equal(reportRetry.json().report_id, report.json().report_id);

    const bobLockDenied = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/comments/control`, headers: bobHeaders, payload: {request_id: randomUUID(), locked: true}});
    assert.equal(bobLockDenied.statusCode, 403);
    assert.equal((await app.inject({method: 'POST', url: `/v1/projects/${projectId}/comments/control`, headers: aliceHeaders, payload: {request_id: randomUUID(), locked: true}})).statusCode, 200);
    const lockedComment = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/comments`, headers: bobHeaders, payload: {request_id: randomUUID(), body: 'Should be locked'}});
    assert.equal(lockedComment.statusCode, 409);
    assert.equal((await app.inject({method: 'POST', url: `/v1/projects/${projectId}/comments/control`, headers: aliceHeaders, payload: {request_id: randomUUID(), locked: false}})).statusCode, 200);

    const testRequestIdempotency = randomUUID();
    const testRequest = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/test-requests`, headers: aliceHeaders, payload: {request_id: testRequestIdempotency, summary: 'Test onboarding on a narrow screen'}});
    assert.equal(testRequest.statusCode, 201);
    const testRequestId = testRequest.json().test_request_id;
    assert.equal((await app.inject({method: 'POST', url: `/v1/projects/${projectId}/test-requests`, headers: aliceHeaders, payload: {request_id: testRequestIdempotency, summary: 'Test onboarding on a narrow screen'}})).statusCode, 201);

    const selfTest = await app.inject({method: 'POST', url: `/v1/test-requests/${testRequestId}/actions`, headers: aliceHeaders, payload: {request_id: randomUUID(), outcome: 'PASS', notes: 'Owner cannot self-test'}});
    assert.equal(selfTest.statusCode, 403);

    const testActionRequest = randomUUID();
    const observed = await app.inject({method: 'POST', url: `/v1/test-requests/${testRequestId}/actions`, headers: bobHeaders, payload: {request_id: testActionRequest, outcome: 'MIXED', notes: 'Works, but mobile CTA wraps.'}});
    assert.equal(observed.statusCode, 201);
    assert.equal(observed.json().state, 'OBSERVED');
    assert.equal(observed.json().observation.signal_state, 'OBSERVED');
    const observedRetry = await app.inject({method: 'POST', url: `/v1/test-requests/${testRequestId}/actions`, headers: bobHeaders, payload: {request_id: testActionRequest, outcome: 'MIXED', notes: 'Works, but mobile CTA wraps.'}});
    assert.equal(observedRetry.statusCode, 201);
    assert.equal(observedRetry.json().observation.test_action_id, observed.json().observation.test_action_id);

    const signals = await app.inject({method: 'GET', url: '/v1/world/signals'});
    assert.equal(signals.statusCode, 200);
    const testSignal = signals.json().find((entry) => entry.kind === 'TEST_OBSERVED' && entry.project_id === projectId);
    assert.ok(testSignal);
    assert.equal(testSignal.signal_state, 'OBSERVED');
    assert.equal('payload' in testSignal, false);

    const events = await db.selectFrom('history_events').selectAll().where('subject_type', '=', 'project').where('subject_id', '=', projectId).execute();
    const observedEvents = events.filter((event) => event.event_type === 'project.external_test.observed');
    assert.equal(observedEvents.length, 1);
    assert.equal(JSON.stringify(observedEvents).includes('PROVEN'), false);
    assert.equal(JSON.stringify(events.filter((event) => event.event_family === 'activity')).includes('PROVEN'), false);
    const gates = await db.selectFrom('mission_gates').selectAll().where('mission_id', '=', missionId).execute();
    assert.equal(gates.every((gate) => gate.signal_state === 'UNKNOWN'), true);

    const blockRequest = randomUUID();
    assert.equal((await app.inject({method: 'POST', url: `/v1/players/${alice.playerId}/block`, headers: bobHeaders, payload: {request_id: blockRequest}})).statusCode, 200);
    const blockedComment = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/comments`, headers: bobHeaders, payload: {request_id: randomUUID(), body: 'Blocked interaction'}});
    assert.equal(blockedComment.statusCode, 403);

    const removed = await operatorRemoveProjectComment(db, rootId);
    assert.equal(removed.state, 'REMOVED');
    assert.equal('body' in removed, false);
    const afterRemoval = await app.inject({method: 'GET', url: `/v1/projects/${projectId}/comments`});
    assert.equal(afterRemoval.json().find((entry) => entry.comment_id === rootId).state, 'REMOVED');
  } finally {
    await app.close();
    await db.destroy();
  }
});
"""
Path('apps/inkubator-api/test/integration/phase5-community-completion.test.mjs').write_text(test)

print('Phase 5 community completion patch staged')
