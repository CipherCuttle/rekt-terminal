import {randomUUID} from 'node:crypto';
import {sql, type Kysely} from 'kysely';
import {canonicalizeJson} from './canonical-json.js';
import {readDatabaseNow} from './database.js';
import type {
  DatabaseSchema,
  GitHubRepositoryRow,
  MissionGateRow,
  MissionGateState,
  MissionRow,
  MissionState,
  PlayerProfileRow,
  ProjectRow,
  RoundRow,
} from './database.js';
import {appendHistoryEvent, HISTORY_EVENT_VERSION} from './events.js';
import {classifyGitHubPushEvidence, deriveDaemonAdvisory, type DaemonAdvisory, type GitHubEvidenceSnapshot} from './evidence.js';

const PROJECT_SCHEMA_VERSION = 'project.current.v1';
const MISSION_SCHEMA_VERSION = 'mission.current.v1';
const PROFILE_SCHEMA_VERSION = 'player.profile.v1';
const ROUND_MEMBERSHIP_SCHEMA_VERSION = 'round.membership.v1';
const PROGRESS_MODEL_VERSION = 'mission.progress.v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_GATES = [
  {gate_key: 'FOUNDATION', label: 'FOUNDATION', position: 0},
  {gate_key: 'CORE_EXPERIENCE', label: 'CORE EXPERIENCE', position: 1},
  {gate_key: 'QUALITY_TESTING', label: 'QUALITY / TESTING', position: 2},
  {gate_key: 'SHIPABILITY', label: 'SHIPABILITY', position: 3},
] as const;

const PARTICIPANT_GATE_STATES = new Set<MissionGateState>([
  'UNKNOWN', 'CLAIMED', 'ACTIVE', 'ATTENTION', 'BLOCKED', 'STALE', 'FAILED',
]);

const TERMINAL_STATES = new Set<MissionState>(['SHIPPED', 'CLOSED_NOT_SHIPPED', 'ARCHIVED']);
const PARTICIPANT_TRANSITIONS: Record<MissionState, ReadonlySet<MissionState>> = {
  DRAFT: new Set(['DECLARED']),
  DECLARED: new Set(['BUILDING', 'BLOCKED', 'CLOSED_NOT_SHIPPED']),
  BUILDING: new Set(['BLOCKED', 'SHIP_READY', 'CLOSED_NOT_SHIPPED']),
  BLOCKED: new Set(['BUILDING', 'CLOSED_NOT_SHIPPED']),
  SHIP_READY: new Set(['BUILDING', 'BLOCKED', 'CLOSED_NOT_SHIPPED']),
  SUBMITTED: new Set(),
  SHIPPED: new Set(),
  CLOSED_NOT_SHIPPED: new Set(),
  ARCHIVED: new Set(),
};

export interface PlayerProfileInput {
  requestId: string;
  bio?: string | null;
  characterName?: string | null;
  characterArchetype?: string | null;
}

export interface MissionCreateInput {
  requestId: string;
  roundId: string;
  projectName: string;
  goal: string;
  shipCondition: string;
  currentFocus: string;
  nextMove: string;
  stackLabels?: string[];
}

export interface MissionUpdateInput {
  requestId: string;
  state?: MissionState;
  currentFocus?: string;
  nextMove?: string;
  blocker?: string | null;
  stackLabels?: string[];
}

export interface MissionGateUpdateInput {
  requestId: string;
  signalState: MissionGateState;
}

export interface CommandSnapshot {
  project: ProjectRow;
  mission: MissionRow;
  round: RoundRow | null;
  gates: MissionGateRow[];
  repository: GitHubRepositoryRow | null;
  githubEvidence: GitHubEvidenceSnapshot;
  daemonAdvisory: DaemonAdvisory;
}

function requireUuid(value: string, name: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new Error(`invalid_${name}`);
  return value.toLowerCase();
}

function normalizeText(value: string, name: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`invalid_${name}`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 1 || normalized.length > maxLength) throw new Error(`invalid_${name}`);
  return normalized;
}

function normalizeOptionalText(value: string | null | undefined, name: string, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return normalizeText(value, name, maxLength);
}

function normalizeStackLabels(value: string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 8) throw new Error('invalid_stack_labels');
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of value) {
    const label = normalizeText(raw, 'stack_label', 40);
    const key = label.toLocaleLowerCase('en-US');
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(label);
    }
  }
  return normalized;
}

function parseStackLabels(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((label) => typeof label !== 'string')) throw new Error('mission_stack_invalid');
  return value as string[];
}

async function existingRequest(
  db: Kysely<DatabaseSchema>,
  dedupeKey: string,
  eventType: string,
  actorPlayerId: string,
  subjectType: string,
  subjectId: string,
  payload: unknown,
): Promise<boolean> {
  const existing = await db.selectFrom('history_events').selectAll().where('dedupe_key', '=', dedupeKey).executeTakeFirst();
  if (!existing) return false;
  const normalized = canonicalizeJson(payload);
  if (
    existing.event_family !== 'activity' ||
    existing.event_version !== HISTORY_EVENT_VERSION ||
    existing.event_type !== eventType ||
    existing.payload_hash !== normalized.sha256 ||
    existing.actor_player_id !== actorPlayerId ||
    existing.subject_type !== subjectType ||
    existing.subject_id !== subjectId
  ) {
    throw new Error(`history_event_idempotency_conflict:${dedupeKey}`);
  }
  return true;
}

export async function listRounds(db: Kysely<DatabaseSchema>, playerId?: string): Promise<Array<RoundRow & {joined: boolean}>> {
  const rows = await db.selectFrom('rounds').selectAll().orderBy('created_at', 'asc').execute();
  if (!playerId) return rows.map((row) => ({...row, joined: false}));
  const memberships = await db.selectFrom('round_memberships').select('round_id').where('player_id', '=', playerId).execute();
  const joined = new Set(memberships.map((row) => row.round_id));
  return rows.map((row) => ({...row, joined: joined.has(row.round_id)}));
}

export async function joinRound(db: Kysely<DatabaseSchema>, playerId: string, roundIdInput: string): Promise<RoundRow> {
  const roundId = requireUuid(roundIdInput, 'round_id');
  return db.transaction().execute(async (transaction) => {
    const round = await transaction.selectFrom('rounds').selectAll().where('round_id', '=', roundId).executeTakeFirst();
    if (!round) throw new Error('round_not_found');
    if (round.state !== 'OPEN') throw new Error('round_not_open');

    await transaction
      .insertInto('round_memberships')
      .values({round_id: roundId, player_id: playerId})
      .onConflict((conflict) => conflict.columns(['round_id', 'player_id']).doUpdateSet({selected_at: sql`clock_timestamp()`}))
      .execute();

    await appendHistoryEvent(transaction, {
      eventFamily: 'activity',
      eventType: 'round.joined',
      dedupeKey: `activity:round.joined:${roundId}:${playerId}`,
      actorPlayerId: playerId,
      subjectType: 'round',
      subjectId: roundId,
      payload: {schema_version: ROUND_MEMBERSHIP_SCHEMA_VERSION, round_id: roundId, player_id: playerId},
    });
    return round;
  });
}

export async function getPlayerProfile(db: Kysely<DatabaseSchema>, playerId: string): Promise<PlayerProfileRow | null> {
  return (await db.selectFrom('player_profiles').selectAll().where('player_id', '=', playerId).executeTakeFirst()) ?? null;
}

export async function updatePlayerProfile(
  db: Kysely<DatabaseSchema>,
  playerId: string,
  input: PlayerProfileInput,
): Promise<PlayerProfileRow> {
  const requestId = requireUuid(input.requestId, 'request_id');
  const bio = normalizeOptionalText(input.bio, 'bio', 280);
  const characterName = normalizeOptionalText(input.characterName, 'character_name', 80);
  const characterArchetype = normalizeOptionalText(input.characterArchetype, 'character_archetype', 80);
  if (bio === undefined && characterName === undefined && characterArchetype === undefined) throw new Error('profile_update_empty');
  const payload = {
    schema_version: PROFILE_SCHEMA_VERSION,
    request_id: requestId,
    ...(bio !== undefined ? {bio} : {}),
    ...(characterName !== undefined ? {character_name: characterName} : {}),
    ...(characterArchetype !== undefined ? {character_archetype: characterArchetype} : {}),
  };
  const dedupeKey = `activity:player.profile.updated:${playerId}:${requestId}`;

  return db.transaction().execute(async (transaction) => {
    await transaction.selectFrom('players').select('player_id').where('player_id', '=', playerId).forUpdate().executeTakeFirstOrThrow();
    if (await existingRequest(transaction, dedupeKey, 'player.profile.updated', playerId, 'player', playerId, payload)) {
      return transaction.selectFrom('player_profiles').selectAll().where('player_id', '=', playerId).executeTakeFirstOrThrow();
    }
    const existing = await transaction.selectFrom('player_profiles').selectAll().where('player_id', '=', playerId).executeTakeFirst();
    if (existing) {
      await transaction.updateTable('player_profiles').set({
        ...(bio !== undefined ? {bio} : {}),
        ...(characterName !== undefined ? {character_name: characterName} : {}),
        ...(characterArchetype !== undefined ? {character_archetype: characterArchetype} : {}),
        updated_at: sql`clock_timestamp()`,
      }).where('player_id', '=', playerId).execute();
    } else {
      await transaction.insertInto('player_profiles').values({
        player_id: playerId,
        bio: bio ?? null,
        character_name: characterName ?? null,
        character_archetype: characterArchetype ?? null,
      }).execute();
    }
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity', eventType: 'player.profile.updated', dedupeKey,
      actorPlayerId: playerId, subjectType: 'player', subjectId: playerId, payload,
    });
    return transaction.selectFrom('player_profiles').selectAll().where('player_id', '=', playerId).executeTakeFirstOrThrow();
  });
}

async function commandByMissionId(db: Kysely<DatabaseSchema>, missionId: string): Promise<CommandSnapshot | null> {
  const mission = await db.selectFrom('missions').selectAll().where('mission_id', '=', missionId).executeTakeFirst();
  if (!mission) return null;
  const project = await db.selectFrom('projects').selectAll().where('project_id', '=', mission.project_id).executeTakeFirstOrThrow();
  const round = mission.round_id
    ? (await db.selectFrom('rounds').selectAll().where('round_id', '=', mission.round_id).executeTakeFirst()) ?? null
    : null;
  const gates = await db.selectFrom('mission_gates').selectAll().where('mission_id', '=', missionId).orderBy('position', 'asc').execute();
  const repository = project.repository_id
    ? (await db.selectFrom('github_repositories').selectAll().where('repository_id', '=', project.repository_id).executeTakeFirst()) ?? null
    : null;
  const observation = await db.selectFrom('history_events')
    .select(['history_event_id', 'occurred_at'])
    .where('event_type', '=', 'project.github_repository_push.observed')
    .where('subject_type', '=', 'project')
    .where('subject_id', '=', project.project_id)
    .orderBy('occurred_at', 'desc')
    .orderBy('history_event_id', 'desc')
    .executeTakeFirst();
  const githubEvidence = classifyGitHubPushEvidence({
    ...(observation ? {observationId: observation.history_event_id, observedAt: observation.occurred_at} : {}),
    sourceAvailable: Boolean(repository?.active),
    now: await readDatabaseNow(db),
  });
  const daemonAdvisory = deriveDaemonAdvisory({snapshot: githubEvidence, detectedStacks: []});
  return {project, mission, round, gates, repository, githubEvidence, daemonAdvisory};
}

export async function getCurrentCommand(db: Kysely<DatabaseSchema>, playerId: string): Promise<CommandSnapshot | null> {
  const mission = await db.selectFrom('missions')
    .selectAll()
    .where('owner_player_id', '=', playerId)
    .where('state', 'not in', [...TERMINAL_STATES])
    .orderBy('updated_at', 'desc')
    .executeTakeFirst();
  return mission ? commandByMissionId(db, mission.mission_id) : null;
}

export async function getCommandForMission(
  db: Kysely<DatabaseSchema>,
  playerId: string,
  missionIdInput: string,
): Promise<CommandSnapshot | null> {
  const missionId = requireUuid(missionIdInput, 'mission_id');
  const snapshot = await commandByMissionId(db, missionId);
  if (!snapshot) return null;
  if (snapshot.mission.owner_player_id !== playerId) throw new Error('authorization_denied');
  return snapshot;
}

export async function createMission(
  db: Kysely<DatabaseSchema>,
  playerId: string,
  input: MissionCreateInput,
): Promise<CommandSnapshot> {
  const requestId = requireUuid(input.requestId, 'request_id');
  const roundId = requireUuid(input.roundId, 'round_id');
  const projectName = normalizeText(input.projectName, 'project_name', 120);
  const goal = normalizeText(input.goal, 'mission_goal', 240);
  const shipCondition = normalizeText(input.shipCondition, 'ship_condition', 240);
  const currentFocus = normalizeText(input.currentFocus, 'current_focus', 240);
  const nextMove = normalizeText(input.nextMove, 'next_move', 240);
  const stackLabels = normalizeStackLabels(input.stackLabels) ?? [];

  return db.transaction().execute(async (transaction) => {
    await transaction.selectFrom('players').select('player_id').where('player_id', '=', playerId).forUpdate().executeTakeFirstOrThrow();
    const existing = await transaction.selectFrom('missions').selectAll().where('creation_request_id', '=', requestId).executeTakeFirst();
    if (existing) {
  const project = await transaction.selectFrom('projects').selectAll().where('project_id', '=', existing.project_id).executeTakeFirstOrThrow();
  const projectPayload = {schema_version: PROJECT_SCHEMA_VERSION, owner_player_id: playerId, name: projectName};
  const missionPayload = {
    schema_version: MISSION_SCHEMA_VERSION,
    creation_request_id: requestId,
    mission_id: existing.mission_id,
    owner_player_id: playerId,
    project_id: existing.project_id,
    round_id: roundId,
    goal,
    ship_condition: shipCondition,
    state: 'DECLARED',
    current_focus: currentFocus,
    next_move: nextMove,
    progress_model_version: PROGRESS_MODEL_VERSION,
    stack_labels: stackLabels,
    stack_source: stackLabels.length ? 'PLAYER_CONFIRMED' : 'UNKNOWN',
  };
  try {
    const projectReceiptMatches = await existingRequest(
      transaction,
      `activity:project.created:${project.project_id}`,
      'project.created',
      playerId,
      'project',
      project.project_id,
      projectPayload,
    );
    const missionReceiptMatches = await existingRequest(
      transaction,
      `activity:mission.declared:${existing.mission_id}`,
      'mission.declared',
      playerId,
      'mission',
      existing.mission_id,
      missionPayload,
    );
    if (!projectReceiptMatches || !missionReceiptMatches) throw new Error('mission_creation_idempotency_conflict');
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith('history_event_idempotency_conflict:')) {
      throw new Error('mission_creation_idempotency_conflict');
    }
    throw cause;
  }
  const snapshot = await commandByMissionId(transaction, existing.mission_id);
  if (!snapshot) throw new Error('mission_creation_failed');
  return snapshot;
}

    const membership = await transaction.selectFrom('round_memberships as membership')
      .innerJoin('rounds as round', 'round.round_id', 'membership.round_id')
      .select(['round.round_id', 'round.state'])
      .where('membership.player_id', '=', playerId)
      .where('membership.round_id', '=', roundId)
      .executeTakeFirst();
    if (!membership) throw new Error('round_membership_required');
    if (membership.state !== 'OPEN') throw new Error('round_not_open');

    const projectId = randomUUID();
    const missionId = randomUUID();
    await transaction.insertInto('projects').values({
      project_id: projectId,
      schema_version: PROJECT_SCHEMA_VERSION,
      owner_player_id: playerId,
      name: projectName,
      repository_id: null,
    }).execute();
    await transaction.insertInto('missions').values({
      mission_id: missionId,
      schema_version: MISSION_SCHEMA_VERSION,
      creation_request_id: requestId,
      project_id: projectId,
      owner_player_id: playerId,
      round_id: roundId,
      goal,
      ship_condition: shipCondition,
      state: 'DECLARED',
      current_focus: currentFocus,
      next_move: nextMove,
      blocker: null,
      progress_model_version: PROGRESS_MODEL_VERSION,
      stack_labels: stackLabels,
      stack_source: stackLabels.length ? 'PLAYER_CONFIRMED' : 'UNKNOWN',
    }).execute();
    await transaction.insertInto('mission_gates').values(DEFAULT_GATES.map((gate) => ({
      mission_id: missionId,
      gate_key: gate.gate_key,
      label: gate.label,
      signal_state: 'UNKNOWN' as const,
      position: gate.position,
    }))).execute();

    await appendHistoryEvent(transaction, {
      eventFamily: 'activity', eventType: 'project.created', dedupeKey: `activity:project.created:${projectId}`,
      actorPlayerId: playerId, subjectType: 'project', subjectId: projectId,
      payload: {schema_version: PROJECT_SCHEMA_VERSION, owner_player_id: playerId, name: projectName},
    });
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity', eventType: 'mission.declared', dedupeKey: `activity:mission.declared:${missionId}`,
      actorPlayerId: playerId, subjectType: 'mission', subjectId: missionId,
      payload: {
        schema_version: MISSION_SCHEMA_VERSION,
        creation_request_id: requestId,
        mission_id: missionId,
        owner_player_id: playerId,
        project_id: projectId,
        round_id: roundId,
        goal,
        ship_condition: shipCondition,
        state: 'DECLARED',
        current_focus: currentFocus,
        next_move: nextMove,
        progress_model_version: PROGRESS_MODEL_VERSION,
        stack_labels: stackLabels,
        stack_source: stackLabels.length ? 'PLAYER_CONFIRMED' : 'UNKNOWN',
      },
    });

    const snapshot = await commandByMissionId(transaction, missionId);
    if (!snapshot) throw new Error('mission_creation_failed');
    return snapshot;
  });
}

export async function updateMission(
  db: Kysely<DatabaseSchema>,
  playerId: string,
  missionIdInput: string,
  input: MissionUpdateInput,
): Promise<CommandSnapshot> {
  const missionId = requireUuid(missionIdInput, 'mission_id');
  const requestId = requireUuid(input.requestId, 'request_id');
  const currentFocus = input.currentFocus === undefined ? undefined : normalizeText(input.currentFocus, 'current_focus', 240);
  const nextMove = input.nextMove === undefined ? undefined : normalizeText(input.nextMove, 'next_move', 240);
  const blocker = normalizeOptionalText(input.blocker, 'blocker', 240);
  const stackLabels = normalizeStackLabels(input.stackLabels);
  if (input.state === undefined && currentFocus === undefined && nextMove === undefined && blocker === undefined && stackLabels === undefined) {
    throw new Error('mission_update_empty');
  }
  if (input.state && ['SUBMITTED', 'SHIPPED', 'ARCHIVED', 'DRAFT'].includes(input.state)) throw new Error('mission_state_not_participant_authorized');

  const payload = {
    schema_version: 'mission.update.v1', request_id: requestId,
    ...(input.state !== undefined ? {state: input.state} : {}),
    ...(currentFocus !== undefined ? {current_focus: currentFocus} : {}),
    ...(nextMove !== undefined ? {next_move: nextMove} : {}),
    ...(blocker !== undefined ? {blocker} : {}),
    ...(stackLabels !== undefined ? {stack_labels: stackLabels, stack_source: 'PLAYER_CONFIRMED'} : {}),
  };
  const dedupeKey = `activity:mission.updated:${missionId}:${requestId}`;

  return db.transaction().execute(async (transaction) => {
    const mission = await transaction.selectFrom('missions').selectAll().where('mission_id', '=', missionId).forUpdate().executeTakeFirst();
    if (!mission) throw new Error('mission_not_found');
    if (mission.owner_player_id !== playerId) throw new Error('authorization_denied');
    if (await existingRequest(transaction, dedupeKey, 'mission.updated', playerId, 'mission', missionId, payload)) {
      const snapshot = await commandByMissionId(transaction, missionId);
      if (!snapshot) throw new Error('mission_not_found');
      return snapshot;
    }
    if (TERMINAL_STATES.has(mission.state)) throw new Error('mission_terminal');
    if (input.state && input.state !== mission.state && !PARTICIPANT_TRANSITIONS[mission.state].has(input.state)) {
      throw new Error('mission_transition_invalid');
    }
    const nextState = input.state ?? mission.state;
    const nextBlocker = blocker === undefined ? mission.blocker : blocker;
    if (nextState === 'BLOCKED' && !nextBlocker) throw new Error('mission_blocker_required');

    await transaction.updateTable('missions').set({
      ...(input.state !== undefined ? {state: input.state} : {}),
      ...(currentFocus !== undefined ? {current_focus: currentFocus} : {}),
      ...(nextMove !== undefined ? {next_move: nextMove} : {}),
      ...(blocker !== undefined ? {blocker} : {}),
      ...(stackLabels !== undefined ? {stack_labels: stackLabels, stack_source: 'PLAYER_CONFIRMED' as const} : {}),
      updated_at: sql`clock_timestamp()`,
    }).where('mission_id', '=', missionId).execute();
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity', eventType: 'mission.updated', dedupeKey,
      actorPlayerId: playerId, subjectType: 'mission', subjectId: missionId, payload,
    });
    const snapshot = await commandByMissionId(transaction, missionId);
    if (!snapshot) throw new Error('mission_not_found');
    return snapshot;
  });
}

export async function updateMissionGate(
  db: Kysely<DatabaseSchema>,
  playerId: string,
  missionIdInput: string,
  gateKey: MissionGateRow['gate_key'],
  input: MissionGateUpdateInput,
): Promise<CommandSnapshot> {
  const missionId = requireUuid(missionIdInput, 'mission_id');
  const requestId = requireUuid(input.requestId, 'request_id');
  if (!PARTICIPANT_GATE_STATES.has(input.signalState)) throw new Error('mission_gate_state_not_participant_authorized');
  const payload = {schema_version: 'mission.gate.update.v1', request_id: requestId, gate_key: gateKey, signal_state: input.signalState};
  const dedupeKey = `activity:mission.gate.updated:${missionId}:${gateKey}:${requestId}`;

  return db.transaction().execute(async (transaction) => {
    const mission = await transaction.selectFrom('missions').selectAll().where('mission_id', '=', missionId).forUpdate().executeTakeFirst();
    if (!mission) throw new Error('mission_not_found');
    if (mission.owner_player_id !== playerId) throw new Error('authorization_denied');
    if (await existingRequest(transaction, dedupeKey, 'mission.gate.updated', playerId, 'mission', missionId, payload)) {
      const snapshot = await commandByMissionId(transaction, missionId);
      if (!snapshot) throw new Error('mission_not_found');
      return snapshot;
    }
    if (TERMINAL_STATES.has(mission.state)) throw new Error('mission_terminal');
    const gate = await transaction.selectFrom('mission_gates').selectAll().where('mission_id', '=', missionId).where('gate_key', '=', gateKey).executeTakeFirst();
    if (!gate) throw new Error('mission_gate_not_found');
    await transaction.updateTable('mission_gates').set({signal_state: input.signalState, updated_at: sql`clock_timestamp()`})
      .where('mission_id', '=', missionId).where('gate_key', '=', gateKey).execute();
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity', eventType: 'mission.gate.updated', dedupeKey,
      actorPlayerId: playerId, subjectType: 'mission', subjectId: missionId, payload,
    });
    const snapshot = await commandByMissionId(transaction, missionId);
    if (!snapshot) throw new Error('mission_not_found');
    return snapshot;
  });
}

export function commandToPrivateView(snapshot: CommandSnapshot) {
  const stackLabels = parseStackLabels(snapshot.mission.stack_labels);
  return {
    schema_version: 'command.private.v2' as const,
    project: {
      project_id: snapshot.project.project_id,
      name: snapshot.project.name,
      source_connected: Boolean(snapshot.repository?.active),
      source_visibility: snapshot.repository ? (snapshot.repository.private ? 'PRIVATE' : 'PUBLIC') : 'NONE',
      observation_state: snapshot.githubEvidence.signalState,
    },
    mission: {
      mission_id: snapshot.mission.mission_id,
      state: snapshot.mission.state,
      goal: snapshot.mission.goal,
      ship_condition: snapshot.mission.ship_condition,
      current_focus: snapshot.mission.current_focus,
      next_move: snapshot.mission.next_move,
      ...(snapshot.mission.blocker !== null ? {blocker: snapshot.mission.blocker} : {}),
      progress_model_version: snapshot.mission.progress_model_version,
      stack_labels: stackLabels,
      stack_source: snapshot.mission.stack_source,
    },
    round: snapshot.round ? {
      round_id: snapshot.round.round_id,
      code: snapshot.round.code,
      title: snapshot.round.title,
      constraint: snapshot.round.constraint_text,
      state: snapshot.round.state,
    } : null,
    github_evidence: {
      rule_version: snapshot.githubEvidence.ruleVersion,
      source_state: snapshot.githubEvidence.sourceState,
      signal_state: snapshot.githubEvidence.signalState,
      stale_after_ms: snapshot.githubEvidence.staleAfterMs,
      invalid_observation_count: snapshot.githubEvidence.invalidObservationCount,
      reason_code: snapshot.githubEvidence.reasonCode,
      ...(snapshot.githubEvidence.latestObservation ? {latest_observation: {
        observation_id: snapshot.githubEvidence.latestObservation.observationId,
        kind: snapshot.githubEvidence.latestObservation.kind,
        outcome: snapshot.githubEvidence.latestObservation.outcome,
        observed_at: snapshot.githubEvidence.latestObservation.observedAt,
      }} : {}),
    },
    daemon: {
      rule_version: snapshot.daemonAdvisory.ruleVersion,
      authority: snapshot.daemonAdvisory.authority,
      what_changed: snapshot.daemonAdvisory.whatChanged,
      ...(snapshot.daemonAdvisory.likelyBlocker ? {likely_blocker: snapshot.daemonAdvisory.likelyBlocker} : {}),
      ...(snapshot.daemonAdvisory.scopeDamageWarning ? {scope_damage_warning: snapshot.daemonAdvisory.scopeDamageWarning} : {}),
      proposed_next_move: snapshot.daemonAdvisory.proposedNextMove,
    },
    gates: snapshot.gates.map((gate) => ({key: gate.gate_key, label: gate.label, state: gate.signal_state, position: gate.position})),
  };
}
