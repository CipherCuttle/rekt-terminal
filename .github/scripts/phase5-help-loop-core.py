from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing anchor in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


# --- Database types.
db = "apps/inkubator-api/src/database.ts"
replace_once(db, "  character_archetype: string | null;\n  created_at: Generated<Date>;", "  character_archetype: string | null;\n  skills_needed: Generated<unknown>;\n  can_help_with: Generated<unknown>;\n  created_at: Generated<Date>;")
replace_once(db, "export interface GitHubSetupStateTable {", """export interface PlayerFollowTable {
  follower_player_id: string;
  followed_player_id: string;
  created_at: Generated<Date>;
}

export interface ProjectWatchTable {
  player_id: string;
  project_id: string;
  created_at: Generated<Date>;
}

export type HelpBeaconState = 'OPEN' | 'CLOSED';
export interface HelpBeaconTable {
  beacon_id: string;
  project_id: string;
  owner_player_id: string;
  creation_request_id: string;
  summary: string;
  skills_needed: unknown;
  state: HelpBeaconState;
  opened_at: Generated<Date>;
  closed_at: Date | null;
}

export type AssistOfferState = 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
export interface AssistOfferTable {
  assist_id: string;
  beacon_id: string;
  project_id: string;
  offered_by_player_id: string;
  creation_request_id: string;
  message: string;
  state: AssistOfferState;
  acceptance_request_id: string | null;
  offered_at: Generated<Date>;
  accepted_at: Date | null;
}

export interface ProjectPartyMemberTable {
  project_id: string;
  player_id: string;
  role: 'ASSIST';
  source_type: 'ASSIST';
  source_id: string;
  joined_at: Generated<Date>;
}

export interface GitHubSetupStateTable {""")
replace_once(db, "  outbox_jobs: OutboxJobTable;\n  github_setup_states:", "  outbox_jobs: OutboxJobTable;\n  player_follows: PlayerFollowTable;\n  project_watches: ProjectWatchTable;\n  help_beacons: HelpBeaconTable;\n  assist_offers: AssistOfferTable;\n  project_party_members: ProjectPartyMemberTable;\n  github_setup_states:")

# --- Migration 010.
Path("apps/inkubator-api/src/migrations/010-phase5-help-loop-core.ts").write_text("""import {sql} from 'kysely';
import type {Migration} from 'kysely/migration';

export const phase5HelpLoopCoreMigration: Migration = {
  async up(db) {
    await db.schema.alterTable('player_profiles')
      .addColumn('skills_needed', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('can_help_with', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .execute();
    await sql`alter table player_profiles add constraint player_profiles_skills_needed_array check (jsonb_typeof(skills_needed) = 'array' and jsonb_array_length(skills_needed) <= 8)`.execute(db);
    await sql`alter table player_profiles add constraint player_profiles_can_help_with_array check (jsonb_typeof(can_help_with) = 'array' and jsonb_array_length(can_help_with) <= 8)`.execute(db);

    await db.schema.createTable('player_follows')
      .addColumn('follower_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('followed_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('player_follows_pk', ['follower_player_id', 'followed_player_id'])
      .addCheckConstraint('player_follows_not_self', sql`follower_player_id <> followed_player_id`)
      .execute();

    await db.schema.createTable('project_watches')
      .addColumn('player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('project_watches_pk', ['player_id', 'project_id'])
      .execute();

    await db.schema.createTable('help_beacons')
      .addColumn('beacon_id', 'uuid', (column) => column.primaryKey())
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('owner_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('summary', 'text', (column) => column.notNull())
      .addColumn('skills_needed', 'jsonb', (column) => column.notNull().defaultTo(sql`'[]'::jsonb`))
      .addColumn('state', 'text', (column) => column.notNull().defaultTo('OPEN'))
      .addColumn('opened_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('closed_at', 'timestamptz')
      .addCheckConstraint('help_beacons_summary_length', sql`char_length(summary) between 1 and 240`)
      .addCheckConstraint('help_beacons_skills_array', sql`jsonb_typeof(skills_needed) = 'array' and jsonb_array_length(skills_needed) <= 8`)
      .addCheckConstraint('help_beacons_state', sql`state in ('OPEN', 'CLOSED')`)
      .execute();
    await sql`create unique index help_beacons_one_open_per_project on help_beacons(project_id) where state = 'OPEN'`.execute(db);

    await db.schema.createTable('assist_offers')
      .addColumn('assist_id', 'uuid', (column) => column.primaryKey())
      .addColumn('beacon_id', 'uuid', (column) => column.notNull().references('help_beacons.beacon_id').onDelete('cascade'))
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('offered_by_player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id', 'uuid', (column) => column.notNull().unique())
      .addColumn('message', 'text', (column) => column.notNull())
      .addColumn('state', 'text', (column) => column.notNull().defaultTo('OFFERED'))
      .addColumn('acceptance_request_id', 'uuid', (column) => column.unique())
      .addColumn('offered_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('accepted_at', 'timestamptz')
      .addUniqueConstraint('assist_offers_beacon_helper_unique', ['beacon_id', 'offered_by_player_id'])
      .addCheckConstraint('assist_offers_message_length', sql`char_length(message) between 1 and 240`)
      .addCheckConstraint('assist_offers_state', sql`state in ('OFFERED', 'ACCEPTED', 'DECLINED', 'CANCELLED')`)
      .execute();

    await db.schema.createTable('project_party_members')
      .addColumn('project_id', 'uuid', (column) => column.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('player_id', 'uuid', (column) => column.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('role', 'text', (column) => column.notNull())
      .addColumn('source_type', 'text', (column) => column.notNull())
      .addColumn('source_id', 'uuid', (column) => column.notNull())
      .addColumn('joined_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`clock_timestamp()`))
      .addPrimaryKeyConstraint('project_party_members_pk', ['project_id', 'player_id'])
      .addUniqueConstraint('project_party_members_source_unique', ['source_type', 'source_id'])
      .addCheckConstraint('project_party_members_role', sql`role = 'ASSIST'`)
      .addCheckConstraint('project_party_members_source_type', sql`source_type = 'ASSIST'`)
      .execute();
  },
  async down(db) {
    await db.schema.dropTable('project_party_members').execute();
    await db.schema.dropTable('assist_offers').execute();
    await sql`drop index if exists help_beacons_one_open_per_project`.execute(db);
    await db.schema.dropTable('help_beacons').execute();
    await db.schema.dropTable('project_watches').execute();
    await db.schema.dropTable('player_follows').execute();
    await db.schema.alterTable('player_profiles').dropColumn('can_help_with').dropColumn('skills_needed').execute();
  },
};
""")

migrations = "apps/inkubator-api/src/migrations.ts"
replace_once(migrations, "import {phase4ManifestRefScopeMigration} from './migrations/009-phase4-manifest-ref-scope.js';", "import {phase4ManifestRefScopeMigration} from './migrations/009-phase4-manifest-ref-scope.js';\nimport {phase5HelpLoopCoreMigration} from './migrations/010-phase5-help-loop-core.js';")
replace_once(migrations, "      '009_phase4_manifest_ref_scope': phase4ManifestRefScopeMigration,", "      '009_phase4_manifest_ref_scope': phase4ManifestRefScopeMigration,\n      '010_phase5_help_loop_core': phase5HelpLoopCoreMigration,")

# --- Public projection v2 carries only explicitly public claimed skills.
projection = "apps/inkubator-api/src/projection.ts"
Path(projection).write_text("""import type {PlayerProfileRow, PlayerRow} from './database.js';

function toIso(value: Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function publicLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').slice(0, 8);
}

export function toPublicPlayer(player: PlayerRow, profile: PlayerProfileRow | null = null) {
  return {
    schema_version: 'player.public.v2' as const,
    player_id: player.player_id,
    display_name: player.display_name,
    skills_needed: publicLabels(profile?.skills_needed),
    can_help_with: publicLabels(profile?.can_help_with),
  };
}

export function toPrivatePlayer(player: PlayerRow) {
  return {
    schema_version: 'player.private.v1' as const,
    player_id: player.player_id,
    display_name: player.display_name,
    created_at: toIso(player.created_at),
    updated_at: toIso(player.updated_at),
  };
}
""")

# --- Profile v2: claimed skills, not evidence.
mc = "apps/inkubator-api/src/mission-command.ts"
replace_once(mc, "const PROFILE_SCHEMA_VERSION = 'player.profile.v1';", "const PROFILE_SCHEMA_VERSION = 'player.profile.v2';")
replace_once(mc, "  characterArchetype?: string | null;\n}", "  characterArchetype?: string | null;\n  skillsNeeded?: string[];\n  canHelpWith?: string[];\n}")
replace_once(mc, "function parseStackLabels(value: unknown): string[] {", """function normalizeClaimedSkillLabels(value: string[] | undefined, name: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 8) throw new Error(`invalid_${name}`);
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of value) {
    const label = normalizeText(raw, name.slice(0, -1), 40);
    const key = label.toLocaleLowerCase('en-US');
    if (!seen.has(key)) { seen.add(key); normalized.push(label); }
  }
  return normalized;
}

function parseStackLabels(value: unknown): string[] {""")
replace_once(mc, "  const characterArchetype = normalizeOptionalText(input.characterArchetype, 'character_archetype', 80);\n  if (bio === undefined && characterName === undefined && characterArchetype === undefined) throw new Error('profile_update_empty');", "  const characterArchetype = normalizeOptionalText(input.characterArchetype, 'character_archetype', 80);\n  const skillsNeeded = normalizeClaimedSkillLabels(input.skillsNeeded, 'skills_needed');\n  const canHelpWith = normalizeClaimedSkillLabels(input.canHelpWith, 'can_help_with');\n  if (bio === undefined && characterName === undefined && characterArchetype === undefined && skillsNeeded === undefined && canHelpWith === undefined) throw new Error('profile_update_empty');")
replace_once(mc, "    ...(characterArchetype !== undefined ? {character_archetype: characterArchetype} : {}),\n  };", "    ...(characterArchetype !== undefined ? {character_archetype: characterArchetype} : {}),\n    ...(skillsNeeded !== undefined ? {skills_needed: skillsNeeded} : {}),\n    ...(canHelpWith !== undefined ? {can_help_with: canHelpWith} : {}),\n  };")
replace_once(mc, "        ...(characterArchetype !== undefined ? {character_archetype: characterArchetype} : {}),\n        updated_at:", "        ...(characterArchetype !== undefined ? {character_archetype: characterArchetype} : {}),\n        ...(skillsNeeded !== undefined ? {skills_needed: skillsNeeded} : {}),\n        ...(canHelpWith !== undefined ? {can_help_with: canHelpWith} : {}),\n        updated_at:")
replace_once(mc, "        character_archetype: characterArchetype ?? null,\n      }).execute();", "        character_archetype: characterArchetype ?? null,\n        skills_needed: skillsNeeded ?? [],\n        can_help_with: canHelpWith ?? [],\n      }).execute();")

# --- Social core module.
Path("apps/inkubator-api/src/social.ts").write_text(r'''import {randomUUID} from 'node:crypto';
import {sql, type Kysely} from 'kysely';
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

function beaconView(beacon: HelpBeaconTable) {
  return {
    schema_version: 'help_beacon.public.v1' as const,
    beacon_id: beacon.beacon_id,
    project_id: beacon.project_id,
    summary: beacon.summary,
    skills_needed: readLabels(beacon.skills_needed),
    state: beacon.state,
  };
}

function assistView(assist: AssistOfferTable) {
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
''')

# --- App wiring.
app = "apps/inkubator-api/src/app.ts"
replace_once(app, "import {toPrivatePlayer, toPublicPlayer} from './projection.js';", "import {toPrivatePlayer, toPublicPlayer} from './projection.js';\nimport {acceptAssist, createHelpBeacon, followPlayer, getProjectHelpLoop, listDiscoverablePlayers, listDiscoverableProjects, offerAssist, watchProject} from './social.js';")
replace_once(app, "function profileView(playerId: string, profile: Awaited<ReturnType<typeof getPlayerProfile>>) {\n  return {\n    schema_version: 'player.profile.v1' as const,", """function claimedLabels(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : [];
}

function profileView(playerId: string, profile: Awaited<ReturnType<typeof getPlayerProfile>>) {
  return {
    schema_version: 'player.profile.v2' as const,""")
replace_once(app, "    ...(profile?.character_archetype ? {character_archetype: profile.character_archetype} : {}),\n  };", "    ...(profile?.character_archetype ? {character_archetype: profile.character_archetype} : {}),\n    skills_needed: claimedLabels(profile?.skills_needed),\n    can_help_with: claimedLabels(profile?.can_help_with),\n  };")
replace_once(app, "    const body = request.body as {request_id: string; bio?: string | null; character_name?: string | null; character_archetype?: string | null};", "    const body = request.body as {request_id: string; bio?: string | null; character_name?: string | null; character_archetype?: string | null; skills_needed?: string[]; can_help_with?: string[]};")
replace_once(app, "        requestId: body.request_id, bio: body.bio, characterName: body.character_name, characterArchetype: body.character_archetype,", "        requestId: body.request_id, bio: body.bio, characterName: body.character_name, characterArchetype: body.character_archetype, skillsNeeded: body.skills_needed, canHelpWith: body.can_help_with,")
replace_once(app, "  app.get('/v1/rounds', async", """  app.get('/v1/discover/players', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=15');
    return listDiscoverablePlayers(options.db);
  });

  app.get('/v1/discover/projects', async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=15');
    return listDiscoverableProjects(options.db);
  });

  app.post('/v1/players/:playerId/follow', {schema: {body: fastifyBodySchema('SocialMutationRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {playerId} = request.params as {playerId: string};
    const body = request.body as {request_id: string};
    try { return await followPlayer(options.db, authenticated.actor.playerId, playerId, body.request_id); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.post('/v1/projects/:projectId/watch', {schema: {body: fastifyBodySchema('SocialMutationRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {projectId} = request.params as {projectId: string};
    const body = request.body as {request_id: string};
    try { return await watchProject(options.db, authenticated.actor.playerId, projectId, body.request_id); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.post('/v1/projects/:projectId/help-beacons', {schema: {body: fastifyBodySchema('HelpBeaconCreateRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {projectId} = request.params as {projectId: string};
    const body = request.body as {request_id: string; summary: string; skills_needed?: string[]};
    try { return reply.code(201).send(await createHelpBeacon(options.db, authenticated.actor.playerId, projectId, {requestId: body.request_id, summary: body.summary, skillsNeeded: body.skills_needed})); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.post('/v1/help-beacons/:beaconId/assists', {schema: {body: fastifyBodySchema('AssistOfferCreateRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {beaconId} = request.params as {beaconId: string};
    const body = request.body as {request_id: string; message: string};
    try { return reply.code(201).send(await offerAssist(options.db, authenticated.actor.playerId, beaconId, {requestId: body.request_id, message: body.message})); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.post('/v1/assists/:assistId/accept', {schema: {body: fastifyBodySchema('SocialMutationRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {assistId} = request.params as {assistId: string};
    const body = request.body as {request_id: string};
    try { return await acceptAssist(options.db, authenticated.actor.playerId, assistId, body.request_id); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.get('/v1/projects/:projectId/help-loop', async (request, reply) => {
    const {projectId} = request.params as {projectId: string};
    try { return await getProjectHelpLoop(options.db, projectId); }
    catch (cause) { return phase5Error(reply, cause); }
  });

  app.get('/v1/rounds', async""")
replace_once(app, "function phase3Error(reply: FastifyReply, cause: unknown) {", """function phase5Error(reply: FastifyReply, cause: unknown) {
  const message = cause instanceof Error ? cause.message : 'phase5_mutation_failed';
  if (message === 'authorization_denied' || message.endsWith('_self_forbidden')) return error(reply, 403, message);
  if (message.endsWith('_not_found') || message === 'project_not_found' || message === 'player_not_found') return error(reply, 404, message);
  if (message.includes('idempotency_conflict') || message.endsWith('_already_open') || message.endsWith('_already_offered') || message === 'help_beacon_not_open' || message === 'assist_not_offerable') return error(reply, 409, message);
  if (message.startsWith('invalid_')) return error(reply, 400, message);
  throw cause;
}

function phase3Error(reply: FastifyReply, cause: unknown) {""")
replace_once(app, "    return toPublicPlayer(player);", "    return toPublicPlayer(player, await getPlayerProfile(options.db, playerId));")

# --- Contract schema bumps + social schemas.
contract = "apps/inkubator-api/src/contract.ts"
old_public = """  PublicPlayer: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'player_id', 'display_name'],
    properties: {
      schema_version: {type: 'string', const: 'player.public.v1'},
      player_id: {$ref: '#/components/schemas/PlayerId'},
      display_name: {type: 'string'},
    },
  },
"""
new_public = """  PublicPlayer: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'player_id', 'display_name', 'skills_needed', 'can_help_with'],
    properties: {
      schema_version: {type: 'string', const: 'player.public.v2'},
      player_id: {$ref: '#/components/schemas/PlayerId'},
      display_name: {type: 'string'},
      skills_needed: {type: 'array', maxItems: 8, items: {type: 'string', maxLength: 40}},
      can_help_with: {type: 'array', maxItems: 8, items: {type: 'string', maxLength: 40}},
    },
  },
"""
replace_once(contract, old_public, new_public)
old_profile = """  PlayerProfileView: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'player_id'],
    properties: {
      schema_version: {type: 'string', const: 'player.profile.v1'},
      player_id: {$ref: '#/components/schemas/PlayerId'},
      bio: {type: 'string'},
      character_name: {type: 'string'},
      character_archetype: {type: 'string'},
    },
  },
"""
new_profile = """  PlayerProfileView: {
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'player_id', 'skills_needed', 'can_help_with'],
    properties: {
      schema_version: {type: 'string', const: 'player.profile.v2'},
      player_id: {$ref: '#/components/schemas/PlayerId'},
      bio: {type: 'string'},
      character_name: {type: 'string'},
      character_archetype: {type: 'string'},
      skills_needed: {type: 'array', maxItems: 8, items: {type: 'string', minLength: 1, maxLength: 40}},
      can_help_with: {type: 'array', maxItems: 8, items: {type: 'string', minLength: 1, maxLength: 40}},
    },
  },
"""
replace_once(contract, old_profile, new_profile)
replace_once(contract, "      character_archetype: {type: ['string', 'null'], maxLength: 80},\n    },\n  },\n  RoundView:", "      character_archetype: {type: ['string', 'null'], maxLength: 80},\n      skills_needed: {type: 'array', maxItems: 8, items: {type: 'string', minLength: 1, maxLength: 40}},\n      can_help_with: {type: 'array', maxItems: 8, items: {type: 'string', minLength: 1, maxLength: 40}},\n    },\n  },\n  SocialMutationRequest: {\n    type: 'object', additionalProperties: false, required: ['request_id'],\n    properties: {request_id: {$ref: '#/components/schemas/RequestId'}},\n  },\n  HelpBeaconCreateRequest: {\n    type: 'object', additionalProperties: false, required: ['request_id', 'summary'],\n    properties: {request_id: {$ref: '#/components/schemas/RequestId'}, summary: {type: 'string', minLength: 1, maxLength: 240}, skills_needed: {type: 'array', maxItems: 8, items: {type: 'string', minLength: 1, maxLength: 40}}},\n  },\n  AssistOfferCreateRequest: {\n    type: 'object', additionalProperties: false, required: ['request_id', 'message'],\n    properties: {request_id: {$ref: '#/components/schemas/RequestId'}, message: {type: 'string', minLength: 1, maxLength: 240}},\n  },\n  PlayerFollowView: {\n    type: 'object', additionalProperties: false, required: ['schema_version', 'follower_player_id', 'followed_player_id', 'active'],\n    properties: {schema_version: {type: 'string', const: 'player.follow.v1'}, follower_player_id: {$ref: '#/components/schemas/PlayerId'}, followed_player_id: {$ref: '#/components/schemas/PlayerId'}, active: {type: 'boolean'}},\n  },\n  ProjectWatchView: {\n    type: 'object', additionalProperties: false, required: ['schema_version', 'player_id', 'project_id', 'active'],\n    properties: {schema_version: {type: 'string', const: 'project.watch.v1'}, player_id: {$ref: '#/components/schemas/PlayerId'}, project_id: {$ref: '#/components/schemas/ProjectId'}, active: {type: 'boolean'}},\n  },\n  HelpBeaconView: {\n    type: 'object', additionalProperties: false, required: ['schema_version', 'beacon_id', 'project_id', 'summary', 'skills_needed', 'state'],\n    properties: {schema_version: {type: 'string', const: 'help_beacon.public.v1'}, beacon_id: {type: 'string', format: 'uuid'}, project_id: {$ref: '#/components/schemas/ProjectId'}, summary: {type: 'string'}, skills_needed: {type: 'array', items: {type: 'string'}}, state: {type: 'string', enum: ['OPEN', 'CLOSED']}},\n  },\n  AssistView: {\n    type: 'object', additionalProperties: false, required: ['schema_version', 'assist_id', 'beacon_id', 'project_id', 'offered_by_player_id', 'message', 'state'],\n    properties: {schema_version: {type: 'string', const: 'assist.private.v1'}, assist_id: {type: 'string', format: 'uuid'}, beacon_id: {type: 'string', format: 'uuid'}, project_id: {$ref: '#/components/schemas/ProjectId'}, offered_by_player_id: {$ref: '#/components/schemas/PlayerId'}, message: {type: 'string'}, state: {type: 'string', enum: ['OFFERED', 'ACCEPTED', 'DECLINED', 'CANCELLED']}},\n  },\n  PartyMemberView: {\n    type: 'object', additionalProperties: false, required: ['player_id', 'display_name', 'role'],\n    properties: {player_id: {$ref: '#/components/schemas/PlayerId'}, display_name: {type: 'string'}, role: {type: 'string', const: 'ASSIST'}},\n  },\n  ProjectHelpLoopView: {\n    type: 'object', additionalProperties: false, required: ['schema_version', 'project_id', 'owner', 'party_members'],\n    properties: {schema_version: {type: 'string', const: 'project.help_loop.public.v1'}, project_id: {$ref: '#/components/schemas/ProjectId'}, owner: {$ref: '#/components/schemas/PublicPlayer'}, open_help_beacon: {$ref: '#/components/schemas/HelpBeaconView'}, party_members: {type: 'array', items: {$ref: '#/components/schemas/PartyMemberView'}}},\n  },\n  ProjectDiscoveryView: {\n    type: 'object', additionalProperties: false, required: ['schema_version', 'project', 'owner'],\n    properties: {schema_version: {type: 'string', const: 'project.discovery.v1'}, project: {$ref: '#/components/schemas/PublicProject'}, owner: {$ref: '#/components/schemas/PublicPlayer'}, open_help_beacon: {$ref: '#/components/schemas/HelpBeaconView'}},\n  },\n  PublicPlayerList: {type: 'array', items: {$ref: '#/components/schemas/PublicPlayer'}},\n  ProjectDiscoveryList: {type: 'array', items: {$ref: '#/components/schemas/ProjectDiscoveryView'}},\n  RoundView:")

paths_anchor = "    '/v1/rounds': {"
paths_block = """    '/v1/discover/players': {get: {operationId: 'discoverPlayers', responses: {'200': {description: 'Public Player discovery', content: {'application/json': {schema: ref('PublicPlayerList')}}}}}},
    '/v1/discover/projects': {get: {operationId: 'discoverProjects', responses: {'200': {description: 'Public Project discovery', content: {'application/json': {schema: ref('ProjectDiscoveryList')}}}}}},
    '/v1/players/{playerId}/follow': {post: {operationId: 'followPlayer', security: [{sessionCookie: []}], parameters: [{name: 'playerId', in: 'path', required: true, schema: ref('PlayerId')}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Player followed', content: {'application/json': {schema: ref('PlayerFollowView')}}}, '400': errorResponse('Invalid mutation'), '401': errorResponse('Authentication required'), '403': errorResponse('Forbidden'), '404': errorResponse('Player not found')}}},
    '/v1/projects/{projectId}/watch': {post: {operationId: 'watchProject', security: [{sessionCookie: []}], parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Project watched', content: {'application/json': {schema: ref('ProjectWatchView')}}}, '400': errorResponse('Invalid mutation'), '401': errorResponse('Authentication required'), '404': errorResponse('Project not found')}}},
    '/v1/projects/{projectId}/help-beacons': {post: {operationId: 'createHelpBeacon', security: [{sessionCookie: []}], parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], requestBody: {required: true, content: {'application/json': {schema: ref('HelpBeaconCreateRequest')}}}, responses: {'201': {description: 'Help Beacon opened', content: {'application/json': {schema: ref('HelpBeaconView')}}}, '400': errorResponse('Invalid Beacon'), '401': errorResponse('Authentication required'), '403': errorResponse('Owner required'), '404': errorResponse('Project not found'), '409': errorResponse('Beacon conflict')}}},
    '/v1/help-beacons/{beaconId}/assists': {post: {operationId: 'offerAssist', security: [{sessionCookie: []}], parameters: [{name: 'beaconId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('AssistOfferCreateRequest')}}}, responses: {'201': {description: 'Assist offered', content: {'application/json': {schema: ref('AssistView')}}}, '400': errorResponse('Invalid Assist'), '401': errorResponse('Authentication required'), '403': errorResponse('Self-assist forbidden'), '404': errorResponse('Beacon not found'), '409': errorResponse('Assist conflict')}}},
    '/v1/assists/{assistId}/accept': {post: {operationId: 'acceptAssist', security: [{sessionCookie: []}], parameters: [{name: 'assistId', in: 'path', required: true, schema: {type: 'string', format: 'uuid'}}], requestBody: {required: true, content: {'application/json': {schema: ref('SocialMutationRequest')}}}, responses: {'200': {description: 'Assist accepted and Party membership recorded', content: {'application/json': {schema: ref('AssistView')}}}, '400': errorResponse('Invalid Assist'), '401': errorResponse('Authentication required'), '403': errorResponse('Project owner required'), '404': errorResponse('Assist not found'), '409': errorResponse('Assist state conflict')}}},
    '/v1/projects/{projectId}/help-loop': {get: {operationId: 'getProjectHelpLoop', parameters: [{name: 'projectId', in: 'path', required: true, schema: ref('ProjectId')}], responses: {'200': {description: 'Public Help/Party context', content: {'application/json': {schema: ref('ProjectHelpLoopView')}}}, '400': errorResponse('Invalid Project ID'), '404': errorResponse('Project not found')}}},
"""
replace_once(contract, paths_anchor, paths_block + paths_anchor)

# --- Focused Phase 5 integration test.
Path("apps/inkubator-api/test/integration/phase5-multiplayer-help-loop.test.mjs").write_text(r'''import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../dist/app.js';
import {createDatabase} from '../../dist/database.js';
import {migrateToLatest} from '../../dist/migrations.js';

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

async function joinFounding(app, authCookie) {
  const rounds = await app.inject({method: 'GET', url: '/v1/rounds', headers: {cookie: authCookie}});
  const founding = rounds.json().find((round) => round.code === 'ROUND_01');
  assert.ok(founding);
  assert.equal((await app.inject({method: 'POST', url: `/v1/rounds/${founding.round_id}/join`, headers: {origin: appOrigin, cookie: authCookie}})).statusCode, 200);
  return founding.round_id;
}

test('Phase 5 core makes another builder materially useful without minting proof', async () => {
  const db = createDatabase(databaseUrl);
  await migrateToLatest(db);
  const app = buildApp({db, appOrigin, allowDevAuth: true, sessionTtlSeconds: 3600, github: null});
  try {
    const alice = await session(app, `Alice ${randomUUID().slice(0, 6)}`);
    const bob = await session(app, `Bob ${randomUUID().slice(0, 6)}`);
    const aliceHeaders = {origin: appOrigin, cookie: alice.cookie};
    const bobHeaders = {origin: appOrigin, cookie: bob.cookie};

    const aliceProfile = await app.inject({method: 'PATCH', url: '/v1/me/profile', headers: aliceHeaders, payload: {
      request_id: randomUUID(), skills_needed: ['TypeScript', 'testing'], can_help_with: ['art direction'],
    }});
    assert.equal(aliceProfile.statusCode, 200);
    assert.equal(aliceProfile.json().schema_version, 'player.profile.v2');
    assert.deepEqual(aliceProfile.json().skills_needed, ['TypeScript', 'testing']);
    const bobProfile = await app.inject({method: 'PATCH', url: '/v1/me/profile', headers: bobHeaders, payload: {
      request_id: randomUUID(), skills_needed: [], can_help_with: ['TypeScript', 'testing'],
    }});
    assert.equal(bobProfile.statusCode, 200);

    const roundId = await joinFounding(app, alice.cookie);
    const create = await app.inject({method: 'POST', url: '/v1/missions', headers: aliceHeaders, payload: {
      request_id: randomUUID(), round_id: roundId, project_name: 'Help Loop Project', goal: 'Get useful help from another builder',
      ship_condition: 'Accepted assist is recorded durably', current_focus: 'Need a tester', next_move: 'Open a Help Beacon',
    }});
    assert.equal(create.statusCode, 201);
    const projectId = create.json().project.project_id;
    const missionId = create.json().mission.mission_id;

    const players = await app.inject({method: 'GET', url: '/v1/discover/players'});
    assert.equal(players.statusCode, 200);
    const alicePublic = players.json().find((player) => player.player_id === alice.playerId);
    const bobPublic = players.json().find((player) => player.player_id === bob.playerId);
    assert.equal(alicePublic.schema_version, 'player.public.v2');
    assert.deepEqual(alicePublic.skills_needed, ['TypeScript', 'testing']);
    assert.deepEqual(bobPublic.can_help_with, ['TypeScript', 'testing']);

    const projects = await app.inject({method: 'GET', url: '/v1/discover/projects'});
    assert.equal(projects.statusCode, 200);
    const discovered = projects.json().find((entry) => entry.project.project_id === projectId);
    assert.ok(discovered);
    assert.equal(discovered.owner.player_id, alice.playerId);

    const followRequest = randomUUID();
    assert.equal((await app.inject({method: 'POST', url: `/v1/players/${alice.playerId}/follow`, headers: bobHeaders, payload: {request_id: followRequest}})).statusCode, 200);
    assert.equal((await app.inject({method: 'POST', url: `/v1/players/${alice.playerId}/follow`, headers: bobHeaders, payload: {request_id: followRequest}})).statusCode, 200);
    const followEvents = await db.selectFrom('history_events').select('history_event_id').where('event_type', '=', 'player.followed').where('actor_player_id', '=', bob.playerId).where('subject_id', '=', alice.playerId).execute();
    assert.equal(followEvents.length, 1);

    const watchRequest = randomUUID();
    assert.equal((await app.inject({method: 'POST', url: `/v1/projects/${projectId}/watch`, headers: bobHeaders, payload: {request_id: watchRequest}})).statusCode, 200);
    assert.equal((await app.inject({method: 'POST', url: `/v1/projects/${projectId}/watch`, headers: bobHeaders, payload: {request_id: watchRequest}})).statusCode, 200);
    const watchEvents = await db.selectFrom('history_events').select('history_event_id').where('event_type', '=', 'project.watched').where('actor_player_id', '=', bob.playerId).where('subject_id', '=', projectId).execute();
    assert.equal(watchEvents.length, 1);

    const forbiddenBeacon = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/help-beacons`, headers: bobHeaders, payload: {request_id: randomUUID(), summary: 'I should not own this'}});
    assert.equal(forbiddenBeacon.statusCode, 403);

    const beaconRequest = randomUUID();
    const beacon = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/help-beacons`, headers: aliceHeaders, payload: {
      request_id: beaconRequest, summary: 'Need someone to test the onboarding flow', skills_needed: ['testing', 'TypeScript'],
    }});
    assert.equal(beacon.statusCode, 201);
    const beaconId = beacon.json().beacon_id;
    assert.equal((await app.inject({method: 'POST', url: `/v1/projects/${projectId}/help-beacons`, headers: aliceHeaders, payload: {request_id: beaconRequest, summary: 'Need someone to test the onboarding flow', skills_needed: ['testing', 'TypeScript']}})).statusCode, 201);
    const secondBeacon = await app.inject({method: 'POST', url: `/v1/projects/${projectId}/help-beacons`, headers: aliceHeaders, payload: {request_id: randomUUID(), summary: 'Duplicate open beacon'}});
    assert.equal(secondBeacon.statusCode, 409);

    const selfAssist = await app.inject({method: 'POST', url: `/v1/help-beacons/${beaconId}/assists`, headers: aliceHeaders, payload: {request_id: randomUUID(), message: 'Self help'}});
    assert.equal(selfAssist.statusCode, 403);

    const assistRequest = randomUUID();
    const assist = await app.inject({method: 'POST', url: `/v1/help-beacons/${beaconId}/assists`, headers: bobHeaders, payload: {
      request_id: assistRequest, message: 'I can test this and send a reproducible bug list',
    }});
    assert.equal(assist.statusCode, 201);
    const assistId = assist.json().assist_id;
    assert.equal(assist.json().state, 'OFFERED');
    assert.equal((await app.inject({method: 'POST', url: `/v1/help-beacons/${beaconId}/assists`, headers: bobHeaders, payload: {request_id: assistRequest, message: 'I can test this and send a reproducible bug list'}})).statusCode, 201);

    const bobCannotAccept = await app.inject({method: 'POST', url: `/v1/assists/${assistId}/accept`, headers: bobHeaders, payload: {request_id: randomUUID()}});
    assert.equal(bobCannotAccept.statusCode, 403);

    const acceptRequest = randomUUID();
    const accepted = await app.inject({method: 'POST', url: `/v1/assists/${assistId}/accept`, headers: aliceHeaders, payload: {request_id: acceptRequest}});
    assert.equal(accepted.statusCode, 200);
    assert.equal(accepted.json().state, 'ACCEPTED');
    const retryAccepted = await app.inject({method: 'POST', url: `/v1/assists/${assistId}/accept`, headers: aliceHeaders, payload: {request_id: acceptRequest}});
    assert.equal(retryAccepted.statusCode, 200);

    const helpLoop = await app.inject({method: 'GET', url: `/v1/projects/${projectId}/help-loop`});
    assert.equal(helpLoop.statusCode, 200);
    assert.equal(helpLoop.json().owner.player_id, alice.playerId);
    assert.deepEqual(helpLoop.json().party_members, [{player_id: bob.playerId, display_name: bobPublic.display_name, role: 'ASSIST'}]);

    const acceptedEvents = await db.selectFrom('history_events').selectAll().where('event_type', '=', 'project.assist.accepted').where('subject_id', '=', projectId).execute();
    const partyEvents = await db.selectFrom('history_events').selectAll().where('event_type', '=', 'project.party_member.joined').where('subject_id', '=', projectId).execute();
    assert.equal(acceptedEvents.length, 1);
    assert.equal(partyEvents.length, 1);
    assert.equal(JSON.stringify([...acceptedEvents, ...partyEvents]).includes('PROVEN'), false);
    const gates = await db.selectFrom('mission_gates').selectAll().where('mission_id', '=', missionId).execute();
    assert.equal(gates.every((gate) => gate.signal_state === 'UNKNOWN'), true);
  } finally {
    await app.close();
    await db.destroy();
  }
});
''')

print('Phase 5 help loop core applied')
