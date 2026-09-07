import {randomUUID} from 'node:crypto';
import {sql, type Kysely, type Selectable} from 'kysely';
import type {DatabaseSchema, HelpBeaconTable, AssistOfferTable} from './database.js';
import {appendHistoryEvent} from './events.js';
import {getDevelopmentProject, toPublicDevelopmentProject} from './projects.js';
import {toPublicPlayer} from './projection.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DISCOVERY_LIMIT = 50;

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

function labels(value: string[] | undefined): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) throw new Error('invalid_skills_needed');
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    const label = text(raw, 'skill', 40);
    const key = label.toLocaleLowerCase('en-US');
    if (!seen.has(key)) { seen.add(key); out.push(label); }
  }
  return out;
}

function readLabels(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return [];
  return (value as string[]).slice(0, 8);
}

function sameLabels(value: unknown, expected: string[]): boolean {
  const current = readLabels(value);
  return current.length === expected.length && current.every((label, index) => label === expected[index]);
}

function beaconView(beacon: Selectable<HelpBeaconTable>) {
  return {
    schema_version: 'help_beacon.public.v1' as const,
    beacon_id: beacon.beacon_id,
    project_id: beacon.project_id,
    summary: beacon.summary,
    skills_needed: readLabels(beacon.skills_needed),
    state: beacon.state,
  };
}

function assistView(assist: Selectable<AssistOfferTable>) {
  return {
    schema_version: 'assist.private.v1' as const,
    assist_id: assist.assist_id,
    beacon_id: assist.beacon_id,
    project_id: assist.project_id,
    offered_by_player_id: assist.offered_by_player_id,
    message: assist.message,
    state: assist.state,
  };
}

export async function listDiscoverablePlayers(db: Kysely<DatabaseSchema>) {
  const players = await db.selectFrom('players').selectAll().orderBy('created_at', 'asc').limit(DISCOVERY_LIMIT).execute();
  if (players.length === 0) return [];
  const profiles = await db.selectFrom('player_profiles').selectAll().where('player_id', 'in', players.map((p) => p.player_id)).execute();
  const byPlayer = new Map(profiles.map((p) => [p.player_id, p]));
  return players.map((player) => toPublicPlayer(player, byPlayer.get(player.player_id) ?? null));
}

export async function listDiscoverableProjects(db: Kysely<DatabaseSchema>) {
  const rows = await db.selectFrom('projects').select(['project_id', 'owner_player_id']).orderBy('updated_at', 'desc').limit(DISCOVERY_LIMIT).execute();
  const result = [];
  for (const row of rows) {
    const project = await getDevelopmentProject(db, row.project_id);
    if (!project) continue;
    const owner = await db.selectFrom('players').selectAll().where('player_id', '=', row.owner_player_id).executeTakeFirstOrThrow();
    const profile = (await db.selectFrom('player_profiles').selectAll().where('player_id', '=', row.owner_player_id).executeTakeFirst()) ?? null;
    const beacon = await db.selectFrom('help_beacons').selectAll().where('project_id', '=', row.project_id).where('state', '=', 'OPEN').executeTakeFirst();
    result.push({
      schema_version: 'project.discovery.v1' as const,
      project: toPublicDevelopmentProject(project),
      owner: toPublicPlayer(owner, profile),
      ...(beacon ? {open_help_beacon: beaconView(beacon)} : {}),
    });
  }
  return result;
}

export async function followPlayer(db: Kysely<DatabaseSchema>, actorIdInput: string, targetIdInput: string, requestIdInput: string) {
  const actorId = uuid(actorIdInput, 'player_id');
  const targetId = uuid(targetIdInput, 'player_id');
  const requestId = uuid(requestIdInput, 'request_id');
  if (actorId === targetId) throw new Error('follow_self_forbidden');
  return db.transaction().execute(async (tx) => {
    const target = await tx.selectFrom('players').select('player_id').where('player_id', '=', targetId).executeTakeFirst();
    if (!target) throw new Error('player_not_found');
    if (await interactionBlocked(tx, actorId, targetId)) throw new Error('social_interaction_blocked');
    const inserted = await tx.insertInto('player_follows').values({follower_player_id: actorId, followed_player_id: targetId})
      .onConflict((c) => c.columns(['follower_player_id', 'followed_player_id']).doNothing()).returning('followed_player_id').executeTakeFirst();
    if (inserted) await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'player.followed', dedupeKey: `activity:player.followed:${actorId}:${targetId}:${requestId}`,
      actorPlayerId: actorId, subjectType: 'player', subjectId: targetId,
      payload: {schema_version: 'player.followed.v1', request_id: requestId, follower_player_id: actorId, followed_player_id: targetId},
    });
    return {schema_version: 'player.follow.v1' as const, follower_player_id: actorId, followed_player_id: targetId, active: true};
  });
}

export async function watchProject(db: Kysely<DatabaseSchema>, actorIdInput: string, projectIdInput: string, requestIdInput: string) {
  const actorId = uuid(actorIdInput, 'player_id');
  const projectId = uuid(projectIdInput, 'project_id');
  const requestId = uuid(requestIdInput, 'request_id');
  return db.transaction().execute(async (tx) => {
    const project = await tx.selectFrom('projects').select('project_id').where('project_id', '=', projectId).executeTakeFirst();
    if (!project) throw new Error('project_not_found');
    const inserted = await tx.insertInto('project_watches').values({player_id: actorId, project_id: projectId})
      .onConflict((c) => c.columns(['player_id', 'project_id']).doNothing()).returning('project_id').executeTakeFirst();
    if (inserted) await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.watched', dedupeKey: `activity:project.watched:${actorId}:${projectId}:${requestId}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: projectId,
      payload: {schema_version: 'project.watched.v1', request_id: requestId, player_id: actorId, project_id: projectId},
    });
    return {schema_version: 'project.watch.v1' as const, player_id: actorId, project_id: projectId, active: true};
  });
}

export async function createHelpBeacon(db: Kysely<DatabaseSchema>, actorIdInput: string, projectIdInput: string, input: {requestId: string; summary: string; skillsNeeded?: string[]}) {
  const actorId = uuid(actorIdInput, 'player_id');
  const projectId = uuid(projectIdInput, 'project_id');
  const requestId = uuid(input.requestId, 'request_id');
  const summary = text(input.summary, 'help_beacon_summary', 240);
  const skillsNeeded = labels(input.skillsNeeded);
  return db.transaction().execute(async (tx) => {
    const replay = await tx.selectFrom('help_beacons').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (replay) {
      if (replay.project_id !== projectId || replay.owner_player_id !== actorId || replay.summary !== summary || !sameLabels(replay.skills_needed, skillsNeeded)) throw new Error('help_beacon_idempotency_conflict');
      return beaconView(replay);
    }
    const project = await tx.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', projectId).forUpdate().executeTakeFirst();
    if (!project) throw new Error('project_not_found');
    const lockedReplay = await tx.selectFrom('help_beacons').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (lockedReplay) {
      if (lockedReplay.project_id !== projectId || lockedReplay.owner_player_id !== actorId || lockedReplay.summary !== summary || !sameLabels(lockedReplay.skills_needed, skillsNeeded)) throw new Error('help_beacon_idempotency_conflict');
      return beaconView(lockedReplay);
    }
    if (project.owner_player_id !== actorId) throw new Error('authorization_denied');
    const open = await tx.selectFrom('help_beacons').select('beacon_id').where('project_id', '=', projectId).where('state', '=', 'OPEN').executeTakeFirst();
    if (open) throw new Error('help_beacon_already_open');
    const row = await tx.insertInto('help_beacons').values({
      beacon_id: randomUUID(), project_id: projectId, owner_player_id: actorId, creation_request_id: requestId,
      summary, skills_needed: skillsNeeded, state: 'OPEN', closed_at: null,
    }).returningAll().executeTakeFirstOrThrow();
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.help_beacon.opened', dedupeKey: `activity:project.help_beacon.opened:${row.beacon_id}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: projectId,
      payload: {schema_version: 'project.help_beacon.opened.v1', beacon_id: row.beacon_id, project_id: projectId, summary, skills_needed: skillsNeeded, truth_state: 'CLAIMED'},
    });
    return beaconView(row);
  });
}

export async function closeHelpBeacon(db: Kysely<DatabaseSchema>, actorIdInput: string, beaconIdInput: string, requestIdInput: string) {
  const actorId = uuid(actorIdInput, 'player_id');
  const beaconId = uuid(beaconIdInput, 'beacon_id');
  const requestId = uuid(requestIdInput, 'request_id');
  return db.transaction().execute(async (tx) => {
    const beacon = await tx.selectFrom('help_beacons').selectAll().where('beacon_id', '=', beaconId).forUpdate().executeTakeFirst();
    if (!beacon) throw new Error('help_beacon_not_found');
    if (beacon.owner_player_id !== actorId) throw new Error('authorization_denied');
    if (beacon.state === 'CLOSED') return beaconView(beacon);
    const closed = await tx.updateTable('help_beacons').set({state: 'CLOSED', closed_at: sql`clock_timestamp()`})
      .where('beacon_id', '=', beaconId).where('state', '=', 'OPEN').returningAll().executeTakeFirstOrThrow();
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.help_beacon.closed', dedupeKey: `activity:project.help_beacon.closed:${beaconId}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: beacon.project_id,
      payload: {schema_version: 'project.help_beacon.closed.v1', beacon_id: beaconId, project_id: beacon.project_id, request_id: requestId, truth_state: 'CLAIMED'},
    });
    return beaconView(closed);
  });
}

export async function offerAssist(db: Kysely<DatabaseSchema>, actorIdInput: string, beaconIdInput: string, input: {requestId: string; message: string}) {
  const actorId = uuid(actorIdInput, 'player_id');
  const beaconId = uuid(beaconIdInput, 'beacon_id');
  const requestId = uuid(input.requestId, 'request_id');
  const message = text(input.message, 'assist_message', 240);
  return db.transaction().execute(async (tx) => {
    const replay = await tx.selectFrom('assist_offers').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (replay) {
      if (replay.beacon_id !== beaconId || replay.offered_by_player_id !== actorId || replay.message !== message) throw new Error('assist_idempotency_conflict');
      return assistView(replay);
    }
    const beacon = await tx.selectFrom('help_beacons').selectAll().where('beacon_id', '=', beaconId).forUpdate().executeTakeFirst();
    if (!beacon) throw new Error('help_beacon_not_found');
    const lockedReplay = await tx.selectFrom('assist_offers').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (lockedReplay) {
      if (lockedReplay.beacon_id !== beaconId || lockedReplay.offered_by_player_id !== actorId || lockedReplay.message !== message) throw new Error('assist_idempotency_conflict');
      return assistView(lockedReplay);
    }
    if (beacon.state !== 'OPEN') throw new Error('help_beacon_not_open');
    if (beacon.owner_player_id === actorId) throw new Error('assist_self_forbidden');
    if (await interactionBlocked(tx, actorId, beacon.owner_player_id)) throw new Error('social_interaction_blocked');
    const existing = await tx.selectFrom('assist_offers').selectAll().where('beacon_id', '=', beaconId).where('offered_by_player_id', '=', actorId).executeTakeFirst();
    if (existing) throw new Error('assist_already_offered');
    const row = await tx.insertInto('assist_offers').values({
      assist_id: randomUUID(), beacon_id: beaconId, project_id: beacon.project_id, offered_by_player_id: actorId,
      creation_request_id: requestId, message, state: 'OFFERED', acceptance_request_id: null, accepted_at: null,
    }).returningAll().executeTakeFirstOrThrow();
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.assist.offered', dedupeKey: `activity:project.assist.offered:${row.assist_id}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: beacon.project_id,
      payload: {schema_version: 'project.assist.offered.v1', assist_id: row.assist_id, beacon_id: beaconId, project_id: beacon.project_id, offered_by_player_id: actorId, truth_state: 'CLAIMED'},
    });
    return assistView(row);
  });
}

export async function acceptAssist(db: Kysely<DatabaseSchema>, actorIdInput: string, assistIdInput: string, requestIdInput: string) {
  const actorId = uuid(actorIdInput, 'player_id');
  const assistId = uuid(assistIdInput, 'assist_id');
  const requestId = uuid(requestIdInput, 'request_id');
  return db.transaction().execute(async (tx) => {
    const assist = await tx.selectFrom('assist_offers').selectAll().where('assist_id', '=', assistId).forUpdate().executeTakeFirst();
    if (!assist) throw new Error('assist_not_found');
    const project = await tx.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', assist.project_id).forUpdate().executeTakeFirstOrThrow();
    if (project.owner_player_id !== actorId) throw new Error('authorization_denied');
    if (assist.state === 'ACCEPTED') return assistView(assist);
    if (assist.state !== 'OFFERED') throw new Error('assist_not_offerable');
    const accepted = await tx.updateTable('assist_offers').set({state: 'ACCEPTED', acceptance_request_id: requestId, accepted_at: sql`clock_timestamp()`})
      .where('assist_id', '=', assistId).where('state', '=', 'OFFERED').returningAll().executeTakeFirstOrThrow();
    await tx.insertInto('project_party_members').values({
      project_id: assist.project_id, player_id: assist.offered_by_player_id, role: 'ASSIST', source_type: 'ASSIST', source_id: assistId,
    }).onConflict((c) => c.columns(['project_id', 'player_id']).doNothing()).execute();
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.assist.accepted', dedupeKey: `activity:project.assist.accepted:${assistId}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: assist.project_id,
      payload: {schema_version: 'project.assist.accepted.v1', assist_id: assistId, project_id: assist.project_id, helper_player_id: assist.offered_by_player_id, truth_state: 'OBSERVED'},
    });
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.party_member.joined', dedupeKey: `activity:project.party_member.joined:assist:${assistId}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: assist.project_id,
      payload: {schema_version: 'project.party_member.joined.v1', project_id: assist.project_id, player_id: assist.offered_by_player_id, role: 'ASSIST', source_type: 'ASSIST', source_id: assistId, truth_state: 'OBSERVED'},
    });
    return assistView(accepted);
  });
}

export async function getProjectHelpLoop(db: Kysely<DatabaseSchema>, projectIdInput: string) {
  const projectId = uuid(projectIdInput, 'project_id');
  const project = await db.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', projectId).executeTakeFirst();
  if (!project) throw new Error('project_not_found');
  const owner = await db.selectFrom('players').selectAll().where('player_id', '=', project.owner_player_id).executeTakeFirstOrThrow();
  const ownerProfile = (await db.selectFrom('player_profiles').selectAll().where('player_id', '=', project.owner_player_id).executeTakeFirst()) ?? null;
  const beacon = await db.selectFrom('help_beacons').selectAll().where('project_id', '=', projectId).where('state', '=', 'OPEN').executeTakeFirst();
  const members = await db.selectFrom('project_party_members as party').innerJoin('players as player', 'player.player_id', 'party.player_id')
    .select(['party.player_id', 'party.role', 'player.display_name']).where('party.project_id', '=', projectId).orderBy('party.joined_at', 'asc').execute();
  return {
    schema_version: 'project.help_loop.public.v1' as const,
    project_id: projectId,
    owner: toPublicPlayer(owner, ownerProfile),
    ...(beacon ? {open_help_beacon: beaconView(beacon)} : {}),
    party_members: members.map((member) => ({player_id: member.player_id, display_name: member.display_name, role: member.role})),
  };
}


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

async function interactionBlocked(db: Kysely<DatabaseSchema>, leftPlayerId: string, rightPlayerId: string): Promise<boolean> {
  if (leftPlayerId === rightPlayerId) return false;
  const direct = await db.selectFrom('player_blocks').select('blocker_player_id').where('blocker_player_id', '=', leftPlayerId).where('blocked_player_id', '=', rightPlayerId).executeTakeFirst();
  if (direct) return true;
  const reverse = await db.selectFrom('player_blocks').select('blocker_player_id').where('blocker_player_id', '=', rightPlayerId).where('blocked_player_id', '=', leftPlayerId).executeTakeFirst();
  return Boolean(reverse);
}

async function discussionLocked(db: Kysely<DatabaseSchema>, projectId: string): Promise<boolean> {
  const setting = await db.selectFrom('project_discussion_settings').select('locked').where('project_id', '=', projectId).executeTakeFirst();
  return setting?.locked ?? false;
}

export async function listProjectComments(db: Kysely<DatabaseSchema>, projectIdInput: string) {
  const projectId = uuid(projectIdInput, 'project_id');
  const project = await db.selectFrom('projects').select('project_id').where('project_id', '=', projectId).executeTakeFirst();
  if (!project) throw new Error('project_not_found');
  const newestRows = await db.selectFrom('project_comments as comment')
    .innerJoin('players as author', 'author.player_id', 'comment.author_player_id')
    .select(['comment.comment_id', 'comment.project_id', 'comment.author_player_id', 'comment.parent_comment_id', 'comment.body', 'comment.state', 'comment.created_at', 'author.display_name'])
    .where('comment.project_id', '=', projectId)
    .orderBy('comment.created_at', 'desc').orderBy('comment.comment_id', 'desc').limit(200).execute();
  const rows = [...newestRows].reverse();
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
    const project = await tx.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', projectId).forUpdate().executeTakeFirst();
    if (!project) throw new Error('project_not_found');
    const lockedReplay = await tx.selectFrom('project_comments').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (lockedReplay) {
      if (lockedReplay.project_id !== projectId || lockedReplay.author_player_id !== actorId || lockedReplay.parent_comment_id !== parentCommentId || lockedReplay.body !== body) throw new Error('comment_idempotency_conflict');
      const author = await tx.selectFrom('players').select('display_name').where('player_id', '=', actorId).executeTakeFirstOrThrow();
      const count = await tx.selectFrom('project_comment_reactions').select(({fn}) => fn.countAll<number>().as('count')).where('comment_id', '=', lockedReplay.comment_id).where('reaction', '=', 'USEFUL').executeTakeFirstOrThrow();
      return commentView(lockedReplay, author.display_name, Number(count.count));
    }
    if (await interactionBlocked(tx, actorId, project.owner_player_id)) throw new Error('social_interaction_blocked');
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
    const comment = await tx.selectFrom('project_comments').select(['comment_id', 'project_id', 'author_player_id', 'state']).where('comment_id', '=', commentId).executeTakeFirst();
    if (!comment) throw new Error('comment_not_found');
    if (comment.state !== 'ACTIVE') throw new Error('comment_not_active');
    if (await interactionBlocked(tx, actorId, comment.author_player_id)) throw new Error('social_interaction_blocked');
    const project = await tx.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', comment.project_id).forUpdate().executeTakeFirstOrThrow();
    if (await interactionBlocked(tx, actorId, project.owner_player_id)) throw new Error('social_interaction_blocked');
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
    .where('event_type', 'in', ['project.help_beacon.opened', 'project.assist.accepted', 'project.external_test.observed'])
    .orderBy('occurred_at', 'desc').orderBy('history_event_id', 'desc').limit(50).execute();
  const projectIds = [...new Set(events.map((event) => event.subject_id))];
  const projects = projectIds.length === 0 ? [] : await db.selectFrom('projects').select(['project_id', 'name']).where('project_id', 'in', projectIds).execute();
  const names = new Map(projects.map((project) => [project.project_id, project.name]));
  const signals: Array<{
    schema_version: 'world.signal.public.v1';
    signal_id: string;
    kind: 'HELP_BEACON_OPENED' | 'ASSIST_ACCEPTED' | 'EXTERNAL_TEST_RECORDED';
    project_id: string;
    project_name: string;
    truth_state: 'CLAIMED' | 'OBSERVED';
    occurred_at: string;
  }> = [];
  for (const event of events) {
    const projectName = names.get(event.subject_id);
    if (!projectName) continue;
    if (event.event_type === 'project.help_beacon.opened') {
      signals.push({schema_version: 'world.signal.public.v1', signal_id: event.history_event_id, kind: 'HELP_BEACON_OPENED', project_id: event.subject_id, project_name: projectName, truth_state: 'CLAIMED', occurred_at: event.occurred_at.toISOString()});
    } else if (event.event_type === 'project.assist.accepted') {
      signals.push({schema_version: 'world.signal.public.v1', signal_id: event.history_event_id, kind: 'ASSIST_ACCEPTED', project_id: event.subject_id, project_name: projectName, truth_state: 'OBSERVED', occurred_at: event.occurred_at.toISOString()});
    } else if (event.event_type === 'project.external_test.observed') {
      signals.push({schema_version: 'world.signal.public.v1', signal_id: event.history_event_id, kind: 'EXTERNAL_TEST_RECORDED', project_id: event.subject_id, project_name: projectName, truth_state: 'OBSERVED', occurred_at: event.occurred_at.toISOString()});
    }
  }
  return signals;
}


export async function blockPlayer(db: Kysely<DatabaseSchema>, actorIdInput: string, targetIdInput: string, requestIdInput: string) {
  const actorId=uuid(actorIdInput,'player_id'), targetId=uuid(targetIdInput,'player_id'), requestId=uuid(requestIdInput,'request_id');
  if (actorId===targetId) throw new Error('block_self_forbidden');
  return db.transaction().execute(async(tx)=>{
    const target=await tx.selectFrom('players').select('player_id').where('player_id','=',targetId).executeTakeFirst(); if(!target) throw new Error('player_not_found');
    const inserted=await tx.insertInto('player_blocks').values({blocker_player_id:actorId,blocked_player_id:targetId}).onConflict((c)=>c.columns(['blocker_player_id','blocked_player_id']).doNothing()).returning('blocked_player_id').executeTakeFirst();
    await tx.deleteFrom('player_follows').where((eb)=>eb.or([eb.and([eb('follower_player_id','=',actorId),eb('followed_player_id','=',targetId)]),eb.and([eb('follower_player_id','=',targetId),eb('followed_player_id','=',actorId)])])).execute();
    if(inserted) await appendHistoryEvent(tx,{eventFamily:'activity',eventType:'player.blocked',dedupeKey:`activity:player.blocked:${actorId}:${targetId}`,actorPlayerId:actorId,subjectType:'player',subjectId:targetId,payload:{schema_version:'player.blocked.v1',blocker_player_id:actorId,blocked_player_id:targetId}});
    return {schema_version:'player.block.v1' as const,blocker_player_id:actorId,blocked_player_id:targetId,active:true};
  });
}

export async function unblockPlayer(db: Kysely<DatabaseSchema>, actorIdInput:string,targetIdInput:string,requestIdInput:string){
  const actorId=uuid(actorIdInput,'player_id'),targetId=uuid(targetIdInput,'player_id'),requestId=uuid(requestIdInput,'request_id');
  if(actorId===targetId) throw new Error('block_self_forbidden');
  return db.transaction().execute(async(tx)=>{
    const removed=await tx.deleteFrom('player_blocks').where('blocker_player_id','=',actorId).where('blocked_player_id','=',targetId).returning('blocked_player_id').executeTakeFirst();
    if(removed) await appendHistoryEvent(tx,{eventFamily:'activity',eventType:'player.unblocked',dedupeKey:`activity:player.unblocked:${actorId}:${targetId}:${requestId}`,actorPlayerId:actorId,subjectType:'player',subjectId:targetId,payload:{schema_version:'player.unblocked.v1',blocker_player_id:actorId,blocked_player_id:targetId}});
    return {schema_version:'player.block.v1' as const,blocker_player_id:actorId,blocked_player_id:targetId,active:false};
  });
}

export async function reportProjectComment(db: Kysely<DatabaseSchema>,actorIdInput:string,commentIdInput:string,input:{requestId:string;reason:string;detail?:string|null}){
  const actorId=uuid(actorIdInput,'player_id'),commentId=uuid(commentIdInput,'comment_id'),requestId=uuid(input.requestId,'request_id');
  const reasons=new Set(['SPAM','ABUSE','PRIVACY','OTHER']); if(!reasons.has(input.reason)) throw new Error('invalid_report_reason');
  const detail=input.detail==null?null:text(input.detail,'report_detail',500);
  return db.transaction().execute(async(tx)=>{
    const replay=await tx.selectFrom('content_reports').selectAll().where('creation_request_id','=',requestId).executeTakeFirst();
    if(replay){if(replay.reporter_player_id!==actorId||replay.comment_id!==commentId||replay.reason!==input.reason||replay.detail!==detail) throw new Error('report_idempotency_conflict'); return {schema_version:'content.report.private.v1' as const,report_id:replay.report_id,comment_id:commentId,reason:replay.reason,state:replay.state};}
    const comment=await tx.selectFrom('project_comments').select(['comment_id','project_id']).where('comment_id','=',commentId).forUpdate().executeTakeFirst(); if(!comment) throw new Error('comment_not_found');
    const lockedReplay=await tx.selectFrom('content_reports').selectAll().where('creation_request_id','=',requestId).executeTakeFirst();
    if(lockedReplay){if(lockedReplay.reporter_player_id!==actorId||lockedReplay.comment_id!==commentId||lockedReplay.reason!==input.reason||lockedReplay.detail!==detail) throw new Error('report_idempotency_conflict'); return {schema_version:'content.report.private.v1' as const,report_id:lockedReplay.report_id,comment_id:commentId,reason:lockedReplay.reason,state:lockedReplay.state};}
    const row=await tx.insertInto('content_reports').values({report_id:randomUUID(),reporter_player_id:actorId,comment_id:commentId,creation_request_id:requestId,reason:input.reason as 'SPAM'|'ABUSE'|'PRIVACY'|'OTHER',detail,state:'OPEN'}).returningAll().executeTakeFirstOrThrow();
    await appendHistoryEvent(tx,{eventFamily:'activity',eventType:'project.comment.reported',dedupeKey:`activity:project.comment.reported:${row.report_id}`,actorPlayerId:actorId,subjectType:'project',subjectId:comment.project_id,payload:{schema_version:'project.comment.reported.v1',report_id:row.report_id,comment_id:commentId,project_id:comment.project_id,reason:row.reason}});
    return {schema_version:'content.report.private.v1' as const,report_id:row.report_id,comment_id:commentId,reason:row.reason,state:row.state};
  });
}

export async function operatorRemoveProjectComment(db: Kysely<DatabaseSchema>,commentIdInput:string,input:{requestId:string;reason:string}){
  const commentId=uuid(commentIdInput,'comment_id'),requestId=uuid(input.requestId,'request_id'),reason=text(input.reason,'moderation_reason',240);
  return db.transaction().execute(async(tx)=>{
    const comment=await tx.selectFrom('project_comments').selectAll().where('comment_id','=',commentId).forUpdate().executeTakeFirst(); if(!comment) throw new Error('comment_not_found');
    if(comment.state!=='REMOVED'){
      await tx.updateTable('project_comments').set({state:'REMOVED',deleted_at:sql`clock_timestamp()`,updated_at:sql`clock_timestamp()`}).where('comment_id','=',commentId).execute();
      await appendHistoryEvent(tx,{eventFamily:'activity',eventType:'ops.project_comment.removed',dedupeKey:`activity:ops.project_comment.removed:${commentId}`,actorPlayerId:null,subjectType:'project',subjectId:comment.project_id,payload:{schema_version:'ops.project_comment.removed.v1',comment_id:commentId,project_id:comment.project_id,reason,request_id:requestId,truth_state:'OBSERVED'}});
    }
    return {schema_version:'ops.project_comment.remove.v1' as const,comment_id:commentId,state:'REMOVED' as const};
  });
}

function testRequestView(row:{test_request_id:string;project_id:string;prompt:string;state:'OPEN'|'COMPLETED'|'CLOSED'}){return {schema_version:'external_test.request.public.v1' as const,test_request_id:row.test_request_id,project_id:row.project_id,prompt:row.prompt,state:row.state};}
function testResultView(row:{test_result_id:string;test_request_id:string;project_id:string;tester_player_id:string;outcome:'PASS'|'ISSUE_FOUND'|'BLOCKED';summary:string;observed_at:Date},displayName:string){return {schema_version:'external_test.result.public.v1' as const,test_result_id:row.test_result_id,test_request_id:row.test_request_id,project_id:row.project_id,tester:{player_id:row.tester_player_id,display_name:displayName},outcome:row.outcome,summary:row.summary,observed_at:row.observed_at.toISOString()};}

export async function createExternalTestRequest(db:Kysely<DatabaseSchema>,actorIdInput:string,projectIdInput:string,input:{requestId:string;prompt:string}){
  const actorId=uuid(actorIdInput,'player_id'),projectId=uuid(projectIdInput,'project_id'),requestId=uuid(input.requestId,'request_id'),prompt=text(input.prompt,'external_test_prompt',500);
  return db.transaction().execute(async(tx)=>{
    const replay=await tx.selectFrom('external_test_requests').selectAll().where('creation_request_id','=',requestId).executeTakeFirst(); if(replay){if(replay.project_id!==projectId||replay.owner_player_id!==actorId||replay.prompt!==prompt) throw new Error('external_test_request_idempotency_conflict'); return testRequestView(replay);}
    const project=await tx.selectFrom('projects').select(['project_id','owner_player_id']).where('project_id','=',projectId).forUpdate().executeTakeFirst(); if(!project) throw new Error('project_not_found');
    const lockedReplay=await tx.selectFrom('external_test_requests').selectAll().where('creation_request_id','=',requestId).executeTakeFirst(); if(lockedReplay){if(lockedReplay.project_id!==projectId||lockedReplay.owner_player_id!==actorId||lockedReplay.prompt!==prompt) throw new Error('external_test_request_idempotency_conflict'); return testRequestView(lockedReplay);}
    if(project.owner_player_id!==actorId) throw new Error('authorization_denied');
    const open=await tx.selectFrom('external_test_requests').select('test_request_id').where('project_id','=',projectId).where('state','=','OPEN').executeTakeFirst(); if(open) throw new Error('external_test_request_already_open');
    const row=await tx.insertInto('external_test_requests').values({test_request_id:randomUUID(),project_id:projectId,owner_player_id:actorId,creation_request_id:requestId,prompt,state:'OPEN',completed_at:null}).returningAll().executeTakeFirstOrThrow();
    await appendHistoryEvent(tx,{eventFamily:'activity',eventType:'project.external_test.requested',dedupeKey:`activity:project.external_test.requested:${row.test_request_id}`,actorPlayerId:actorId,subjectType:'project',subjectId:projectId,payload:{schema_version:'project.external_test.requested.v1',test_request_id:row.test_request_id,project_id:projectId,truth_state:'CLAIMED'}});
    return testRequestView(row);
  });
}

export async function recordExternalTestResult(db:Kysely<DatabaseSchema>,actorIdInput:string,testRequestIdInput:string,input:{requestId:string;outcome:string;summary:string}){
  const actorId=uuid(actorIdInput,'player_id'),testRequestId=uuid(testRequestIdInput,'test_request_id'),requestId=uuid(input.requestId,'request_id'),summary=text(input.summary,'external_test_summary',500);
  const outcomes=new Set(['PASS','ISSUE_FOUND','BLOCKED']); if(!outcomes.has(input.outcome)) throw new Error('invalid_external_test_outcome');
  return db.transaction().execute(async(tx)=>{
    const replay=await tx.selectFrom('external_test_results').selectAll().where('creation_request_id','=',requestId).executeTakeFirst(); if(replay){if(replay.test_request_id!==testRequestId||replay.tester_player_id!==actorId||replay.outcome!==input.outcome||replay.summary!==summary) throw new Error('external_test_result_idempotency_conflict'); const tester=await tx.selectFrom('players').select('display_name').where('player_id','=',actorId).executeTakeFirstOrThrow(); return testResultView(replay,tester.display_name);}
    const request=await tx.selectFrom('external_test_requests').selectAll().where('test_request_id','=',testRequestId).forUpdate().executeTakeFirst(); if(!request) throw new Error('external_test_request_not_found');
    const lockedReplay=await tx.selectFrom('external_test_results').selectAll().where('creation_request_id','=',requestId).executeTakeFirst(); if(lockedReplay){if(lockedReplay.test_request_id!==testRequestId||lockedReplay.tester_player_id!==actorId||lockedReplay.outcome!==input.outcome||lockedReplay.summary!==summary) throw new Error('external_test_result_idempotency_conflict'); const tester=await tx.selectFrom('players').select('display_name').where('player_id','=',actorId).executeTakeFirstOrThrow(); return testResultView(lockedReplay,tester.display_name);}
    if(request.owner_player_id===actorId) throw new Error('external_test_self_forbidden'); if(request.state!=='OPEN') throw new Error('external_test_request_not_open');
    if(await interactionBlocked(tx,actorId,request.owner_player_id)) throw new Error('social_interaction_blocked');
    const row=await tx.insertInto('external_test_results').values({test_result_id:randomUUID(),test_request_id:testRequestId,project_id:request.project_id,tester_player_id:actorId,creation_request_id:requestId,outcome:input.outcome as 'PASS'|'ISSUE_FOUND'|'BLOCKED',summary}).returningAll().executeTakeFirstOrThrow();
    await tx.updateTable('external_test_requests').set({state:'COMPLETED',completed_at:sql`clock_timestamp()`}).where('test_request_id','=',testRequestId).execute();
    await appendHistoryEvent(tx,{eventFamily:'evidence',eventType:'project.external_test.observed',dedupeKey:`evidence:project.external_test.observed:${row.test_result_id}`,actorPlayerId:actorId,subjectType:'project',subjectId:request.project_id,payload:{schema_version:'project.external_test.observed.v1',test_result_id:row.test_result_id,test_request_id:testRequestId,project_id:request.project_id,tester_player_id:actorId,outcome:row.outcome,truth_state:'OBSERVED'}});
    const tester=await tx.selectFrom('players').select('display_name').where('player_id','=',actorId).executeTakeFirstOrThrow(); return testResultView(row,tester.display_name);
  });
}

export async function getProjectExternalTests(db:Kysely<DatabaseSchema>,projectIdInput:string){
  const projectId=uuid(projectIdInput,'project_id'); const project=await db.selectFrom('projects').select('project_id').where('project_id','=',projectId).executeTakeFirst(); if(!project) throw new Error('project_not_found');
  const requests=await db.selectFrom('external_test_requests').selectAll().where('project_id','=',projectId).orderBy('created_at','asc').execute();
  const results=await db.selectFrom('external_test_results as result').innerJoin('players as tester','tester.player_id','result.tester_player_id').select(['result.test_result_id','result.test_request_id','result.project_id','result.tester_player_id','result.outcome','result.summary','result.observed_at','tester.display_name']).where('result.project_id','=',projectId).orderBy('result.observed_at','asc').execute();
  return {schema_version:'project.external_tests.public.v1' as const,project_id:projectId,requests:requests.map(testRequestView),results:results.map((r)=>testResultView(r,r.display_name))};
}
