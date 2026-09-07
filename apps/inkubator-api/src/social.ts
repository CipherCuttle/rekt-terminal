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
      if (replay.project_id !== projectId || replay.owner_player_id !== actorId || replay.summary !== summary) throw new Error('help_beacon_idempotency_conflict');
      return beaconView(replay);
    }
    const project = await tx.selectFrom('projects').select(['project_id', 'owner_player_id']).where('project_id', '=', projectId).forUpdate().executeTakeFirst();
    if (!project) throw new Error('project_not_found');
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
    if (beacon.state !== 'OPEN') throw new Error('help_beacon_not_open');
    if (beacon.owner_player_id === actorId) throw new Error('assist_self_forbidden');
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
      payload: {schema_version: 'project.assist.accepted.v1', assist_id: assistId, project_id: assist.project_id, helper_player_id: assist.offered_by_player_id, truth_state: 'CLAIMED'},
    });
    await appendHistoryEvent(tx, {
      eventFamily: 'activity', eventType: 'project.party_member.joined', dedupeKey: `activity:project.party_member.joined:assist:${assistId}`,
      actorPlayerId: actorId, subjectType: 'project', subjectId: assist.project_id,
      payload: {schema_version: 'project.party_member.joined.v1', project_id: assist.project_id, player_id: assist.offered_by_player_id, role: 'ASSIST', source_type: 'ASSIST', source_id: assistId, truth_state: 'CLAIMED'},
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
