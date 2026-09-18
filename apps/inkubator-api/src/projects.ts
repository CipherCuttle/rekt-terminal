import {randomUUID} from 'node:crypto';
import {sql, type Kysely} from 'kysely';
import {readDatabaseNow, type DatabaseSchema, type GitHubRepositoryRow, type MissionState} from './database.js';
import {appendHistoryEvent} from './events.js';
import {classifyGitHubPushEvidence, type GitHubEvidenceSnapshot} from './evidence.js';

const PROJECT_HISTORY_SCHEMA_VERSION = 'project.development.v1';
const MISSION_HISTORY_SCHEMA_VERSION = 'mission.development.v1';
const PROJECT_CURRENT_SCHEMA_VERSION = 'project.current.v1';
const MISSION_CURRENT_SCHEMA_VERSION = 'mission.current.v1';
const PROJECT_LINK_SCHEMA_VERSION = 'project.github_repository_link.v1';
const PROJECT_OBSERVATION_EVENT = 'project.github_repository_push.observed';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE_CHANGEABLE_MISSION_STATES = new Set<MissionState>(['DECLARED', 'BUILDING', 'BLOCKED', 'SHIP_READY']);

const DEFAULT_GATES = [
  {gate_key: 'FOUNDATION', label: 'FOUNDATION', position: 0},
  {gate_key: 'CORE_EXPERIENCE', label: 'CORE EXPERIENCE', position: 1},
  {gate_key: 'QUALITY_TESTING', label: 'QUALITY / TESTING', position: 2},
  {gate_key: 'SHIPABILITY', label: 'SHIPABILITY', position: 3},
] as const;

export interface DevelopmentProjectInput {
  name: string;
  goal: string;
  shipCondition: string;
  currentFocus: string;
  nextMove: string;
}

export interface DevelopmentProjectSnapshot {
  projectId: string;
  ownerPlayerId: string;
  name: string;
  missionId: string;
  missionState: MissionState;
  goal: string;
  shipCondition: string;
  currentFocus: string;
  nextMove: string;
  repository: GitHubRepositoryRow | null;
  githubEvidence: GitHubEvidenceSnapshot;
  observation: {
    deliveryId: string;
    repositoryId: string;
    ref: string;
    before: string;
    after: string;
    repositoryPrivate: boolean;
  } | null;
}

function objectPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('project_history_payload_invalid');
  return payload as Record<string, unknown>;
}

function requiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error('project_history_payload_invalid');
  return value;
}

function normalizeText(value: string, name: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`invalid_${name}`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 1 || normalized.length > maxLength) throw new Error(`invalid_${name}`);
  return normalized;
}

function positiveIntegerId(value: string): string {
  if (!/^[1-9]\d*$/.test(value)) throw new Error('invalid_repository_id');
  return value;
}

async function lockKeys(db: Kysely<DatabaseSchema>, keys: string[]): Promise<void> {
  for (const key of [...keys].sort()) {
    await sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(db);
  }
}

async function latestProjectObservation(db: Kysely<DatabaseSchema>, projectId: string, repositoryId: string | null) {
  if (!repositoryId) return null;
  return (
    (await db
      .selectFrom('history_events')
      .selectAll()
      .where('event_type', '=', PROJECT_OBSERVATION_EVENT)
      .where('subject_type', '=', 'project')
      .where('subject_id', '=', projectId)
      .where(sql<string>`payload ->> 'repository_id'`, '=', repositoryId)
      .orderBy('occurred_at', 'desc')
      .executeTakeFirst()) ?? null
  );
}

export async function createDevelopmentProject(
  db: Kysely<DatabaseSchema>,
  ownerPlayerId: string,
  input: DevelopmentProjectInput,
): Promise<DevelopmentProjectSnapshot> {
  const name = normalizeText(input.name, 'project_name', 120);
  const goal = normalizeText(input.goal, 'mission_goal', 240);
  const shipCondition = normalizeText(input.shipCondition, 'ship_condition', 240);
  const currentFocus = normalizeText(input.currentFocus, 'current_focus', 240);
  const nextMove = normalizeText(input.nextMove, 'next_move', 240);
  const projectId = randomUUID();
  const missionId = randomUUID();

  return db.transaction().execute(async (transaction) => {
    await transaction.insertInto('projects').values({
      project_id: projectId,
      schema_version: PROJECT_CURRENT_SCHEMA_VERSION,
      owner_player_id: ownerPlayerId,
      name,
      repository_id: null,
    }).execute();
    await transaction.insertInto('missions').values({
      mission_id: missionId,
      schema_version: MISSION_CURRENT_SCHEMA_VERSION,
      creation_request_id: null,
      project_id: projectId,
      owner_player_id: ownerPlayerId,
      round_id: null,
      goal,
      ship_condition: shipCondition,
      state: 'DECLARED',
      current_focus: currentFocus,
      next_move: nextMove,
      blocker: null,
      progress_model_version: 'mission.progress.v1',
      stack_labels: [],
      stack_source: 'UNKNOWN',
    }).execute();
    await transaction.insertInto('mission_gates').values(DEFAULT_GATES.map((gate) => ({
      mission_id: missionId,
      gate_key: gate.gate_key,
      label: gate.label,
      signal_state: 'UNKNOWN' as const,
      position: gate.position,
    }))).execute();

    await appendHistoryEvent(transaction, {
      eventFamily: 'activity',
      eventType: 'project.created',
      dedupeKey: `activity:project.created:${projectId}`,
      actorPlayerId: ownerPlayerId,
      subjectType: 'project',
      subjectId: projectId,
      payload: {
        schema_version: PROJECT_HISTORY_SCHEMA_VERSION,
        owner_player_id: ownerPlayerId,
        name,
      },
    });
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity',
      eventType: 'mission.declared',
      dedupeKey: `activity:mission.declared:${missionId}`,
      actorPlayerId: ownerPlayerId,
      subjectType: 'mission',
      subjectId: missionId,
      payload: {
        schema_version: MISSION_HISTORY_SCHEMA_VERSION,
        mission_id: missionId,
        owner_player_id: ownerPlayerId,
        project_id: projectId,
        goal,
        ship_condition: shipCondition,
        state: 'DECLARED',
        current_focus: currentFocus,
        next_move: nextMove,
      },
    });
    const snapshot = await getDevelopmentProject(transaction, projectId);
    if (!snapshot) throw new Error('project_creation_failed');
    return snapshot;
  });
}

export async function findLinkedProjectIdForRepository(
  db: Kysely<DatabaseSchema>,
  repositoryId: string,
): Promise<string | null> {
  const rows = await db.selectFrom('projects').select('project_id').where('repository_id', '=', repositoryId).limit(2).execute();
  if (rows.length > 1) throw new Error('project_repository_link_invariant_violation');
  return rows[0]?.project_id ?? null;
}

export async function linkDevelopmentProjectRepository(
  db: Kysely<DatabaseSchema>,
  projectId: string,
  ownerPlayerId: string,
  repositoryIdInput: string,
): Promise<DevelopmentProjectSnapshot> {
  const repositoryId = positiveIntegerId(repositoryIdInput);
  return db.transaction().execute(async (transaction) => {
    await lockKeys(transaction, [
      `rekt:project-repository-link:project:${projectId}`,
      `rekt:project-repository-link:repository:${repositoryId}`,
    ]);

    const project = await transaction.selectFrom('projects').selectAll().where('project_id', '=', projectId).executeTakeFirst();
    if (!project) throw new Error('project_not_found');
    if (project.owner_player_id !== ownerPlayerId) throw new Error('authorization_denied');

    const repository = await transaction
      .selectFrom('github_repositories as repository')
      .innerJoin('github_installations as installation', 'installation.installation_id', 'repository.installation_id')
      .selectAll('repository')
      .where('repository.repository_id', '=', repositoryId)
      .where('repository.active', '=', true)
      .where('installation.player_id', '=', ownerPlayerId)
      .where('installation.revoked_at', 'is', null)
      .executeTakeFirst();
    if (!repository) throw new Error('github_repository_not_available');

    if (project.repository_id === repositoryId) {
      const snapshot = await getDevelopmentProject(transaction, projectId);
      if (!snapshot) throw new Error('project_not_found');
      return snapshot;
    }

    const replacingSource = Boolean(project.repository_id);
    if (replacingSource) {
      const mission = await transaction.selectFrom('missions')
        .select('state')
        .where('project_id', '=', projectId)
        .orderBy('updated_at', 'desc')
        .executeTakeFirst();
      if (!mission || !SOURCE_CHANGEABLE_MISSION_STATES.has(mission.state)) {
        // Keep the existing 409 contract for immutable/verification states.
        throw new Error('project_repository_already_linked');
      }
    }

    const existingProjectId = await findLinkedProjectIdForRepository(transaction, repositoryId);
    if (existingProjectId && existingProjectId !== projectId) throw new Error('github_repository_already_linked');

    const previousRepositoryId = project.repository_id;
    await transaction.updateTable('projects')
      .set({
        repository_id: repositoryId,
        ...(replacingSource
          ? {observed_stack_labels: [], observed_manifest_fingerprints: {}, observed_manifest_ref: null}
          : {}),
        updated_at: sql`clock_timestamp()`,
      })
      .where('project_id', '=', projectId)
      .execute();
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity',
      eventType: 'project.github_repository.linked',
      dedupeKey: replacingSource
        ? `activity:project.github_repository.linked:${projectId}:${repositoryId}:${randomUUID()}`
        : `activity:project.github_repository.linked:${projectId}:${repositoryId}`,
      actorPlayerId: ownerPlayerId,
      subjectType: 'project',
      subjectId: projectId,
      payload: {
        schema_version: PROJECT_LINK_SCHEMA_VERSION,
        repository_id: repositoryId,
        ...(previousRepositoryId ? {previous_repository_id: previousRepositoryId} : {}),
      },
    });

    const snapshot = await getDevelopmentProject(transaction, projectId);
    if (!snapshot) throw new Error('project_not_found');
    return snapshot;
  });
}

export async function getDevelopmentProject(
  db: Kysely<DatabaseSchema>,
  projectId: string,
): Promise<DevelopmentProjectSnapshot | null> {
  if (!UUID_PATTERN.test(projectId)) return null;
  const project = await db.selectFrom('projects').selectAll().where('project_id', '=', projectId).executeTakeFirst();
  if (!project) return null;
  const mission = await db.selectFrom('missions')
    .selectAll()
    .where('project_id', '=', projectId)
    .orderBy('updated_at', 'desc')
    .executeTakeFirst();
  if (!mission) throw new Error('project_mission_current_state_invalid');

  let repository: GitHubRepositoryRow | null = null;
  if (project.repository_id) {
    repository = (await db.selectFrom('github_repositories').selectAll().where('repository_id', '=', project.repository_id).executeTakeFirst()) ?? null;
    if (!repository) throw new Error('project_repository_link_invalid');
  }

  const observationEvent = await latestProjectObservation(db, projectId, project.repository_id);
  let observation: DevelopmentProjectSnapshot['observation'] = null;
  if (observationEvent) {
    const payload = objectPayload(observationEvent.payload);
    if (requiredString(payload, 'schema_version') !== 'project.github_repository_push.observed.v1') {
      throw new Error('project_observation_history_version_unsupported');
    }
    if (requiredString(payload, 'truth_state') !== 'OBSERVED') throw new Error('project_observation_truth_invalid');
    const repositoryPrivate = payload.repository_private;
    if (typeof repositoryPrivate !== 'boolean') throw new Error('project_history_payload_invalid');
    observation = {
      deliveryId: requiredString(payload, 'delivery_id'),
      repositoryId: requiredString(payload, 'repository_id'),
      ref: requiredString(payload, 'ref'),
      before: requiredString(payload, 'before'),
      after: requiredString(payload, 'after'),
      repositoryPrivate,
    };
  }

  const githubEvidence = classifyGitHubPushEvidence({
    ...(observationEvent ? {observationId: observationEvent.history_event_id, observedAt: observationEvent.occurred_at} : {}),
    sourceAvailable: Boolean(repository?.active),
    now: await readDatabaseNow(db),
  });

  return {
    projectId: project.project_id,
    ownerPlayerId: project.owner_player_id,
    name: project.name,
    missionId: mission.mission_id,
    missionState: mission.state,
    goal: mission.goal,
    shipCondition: mission.ship_condition,
    currentFocus: mission.current_focus,
    nextMove: mission.next_move,
    repository,
    githubEvidence,
    observation,
  };
}

export function toPublicDevelopmentProject(project: DevelopmentProjectSnapshot) {
  return {
    schema_version: 'project.public.v2' as const,
    project_id: project.projectId,
    name: project.name,
    mission_id: project.missionId,
    mission_state: project.missionState,
    source_connected: Boolean(project.repository?.active),
    source_visibility: project.repository ? (project.repository.private ? 'PRIVATE' : 'PUBLIC') : 'NONE',
    observation_state: project.githubEvidence.signalState,
  };
}

export function toPrivateDevelopmentProject(project: DevelopmentProjectSnapshot) {
  return {
    schema_version: 'project.private.v2' as const,
    project_id: project.projectId,
    owner_player_id: project.ownerPlayerId,
    name: project.name,
    mission_id: project.missionId,
    mission_state: project.missionState,
    goal: project.goal,
    ship_condition: project.shipCondition,
    current_focus: project.currentFocus,
    next_move: project.nextMove,
    source_connected: Boolean(project.repository?.active),
    source_visibility: project.repository ? (project.repository.private ? 'PRIVATE' : 'PUBLIC') : 'NONE',
    observation_state: project.githubEvidence.signalState,
    ...(project.repository
      ? {
          repository_id: project.repository.repository_id,
          repository_full_name: project.repository.full_name,
          repository_private: project.repository.private,
          repository_active: project.repository.active,
        }
      : {}),
    ...(project.observation
      ? {
          last_delivery_id: project.observation.deliveryId,
          last_ref: project.observation.ref,
          last_before: project.observation.before,
          last_after: project.observation.after,
        }
      : {}),
  };
}
