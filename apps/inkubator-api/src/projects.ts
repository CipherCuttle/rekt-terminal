import {randomUUID} from 'node:crypto';
import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema, GitHubRepositoryRow, HistoryEventRow} from './database.js';
import {appendHistoryEvent} from './events.js';

const PROJECT_SCHEMA_VERSION = 'project.development.v1';
const MISSION_SCHEMA_VERSION = 'mission.development.v1';
const PROJECT_LINK_SCHEMA_VERSION = 'project.github_repository_link.v1';
const PROJECT_OBSERVATION_EVENT = 'project.github_repository_push.observed';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  missionState: 'DECLARED';
  goal: string;
  shipCondition: string;
  currentFocus: string;
  nextMove: string;
  repository: GitHubRepositoryRow | null;
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

async function projectCreatedEvent(db: Kysely<DatabaseSchema>, projectId: string): Promise<HistoryEventRow | null> {
  return (
    (await db
      .selectFrom('history_events')
      .selectAll()
      .where('event_type', '=', 'project.created')
      .where('subject_type', '=', 'project')
      .where('subject_id', '=', projectId)
      .executeTakeFirst()) ?? null
  );
}

async function missionDeclaredEvent(db: Kysely<DatabaseSchema>, projectId: string): Promise<HistoryEventRow> {
  const result = await sql<HistoryEventRow>`
    select *
    from history_events
    where event_type = 'mission.declared'
      and subject_type = 'mission'
      and payload ->> 'project_id' = ${projectId}
    order by occurred_at asc
    limit 2
  `.execute(db);
  if (result.rows.length !== 1) throw new Error('project_mission_history_invalid');
  return result.rows[0];
}

async function projectLinkEvent(db: Kysely<DatabaseSchema>, projectId: string): Promise<HistoryEventRow | null> {
  return (
    (await db
      .selectFrom('history_events')
      .selectAll()
      .where('event_type', '=', 'project.github_repository.linked')
      .where('subject_type', '=', 'project')
      .where('subject_id', '=', projectId)
      .executeTakeFirst()) ?? null
  );
}

async function latestProjectObservation(db: Kysely<DatabaseSchema>, projectId: string): Promise<HistoryEventRow | null> {
  return (
    (await db
      .selectFrom('history_events')
      .selectAll()
      .where('event_type', '=', PROJECT_OBSERVATION_EVENT)
      .where('subject_type', '=', 'project')
      .where('subject_id', '=', projectId)
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
    await appendHistoryEvent(transaction, {
      eventFamily: 'activity',
      eventType: 'project.created',
      dedupeKey: `activity:project.created:${projectId}`,
      actorPlayerId: ownerPlayerId,
      subjectType: 'project',
      subjectId: projectId,
      payload: {
        schema_version: PROJECT_SCHEMA_VERSION,
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
        schema_version: MISSION_SCHEMA_VERSION,
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
  const result = await sql<{project_id: string}>`
    select subject_id as project_id
    from history_events
    where event_type = 'project.github_repository.linked'
      and subject_type = 'project'
      and payload ->> 'repository_id' = ${repositoryId}
    order by occurred_at asc
    limit 2
  `.execute(db);
  if (result.rows.length > 1) throw new Error('project_repository_link_invariant_violation');
  return result.rows[0]?.project_id ?? null;
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

    const project = await getDevelopmentProject(transaction, projectId);
    if (!project) throw new Error('project_not_found');
    if (project.ownerPlayerId !== ownerPlayerId) throw new Error('authorization_denied');

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

    const existingProjectLink = await projectLinkEvent(transaction, projectId);
    if (existingProjectLink) {
      const linkedId = requiredString(objectPayload(existingProjectLink.payload), 'repository_id');
      if (linkedId !== repositoryId) throw new Error('project_repository_already_linked');
      const snapshot = await getDevelopmentProject(transaction, projectId);
      if (!snapshot) throw new Error('project_not_found');
      return snapshot;
    }

    const existingProjectId = await findLinkedProjectIdForRepository(transaction, repositoryId);
    if (existingProjectId && existingProjectId !== projectId) throw new Error('github_repository_already_linked');

    await appendHistoryEvent(transaction, {
      eventFamily: 'activity',
      eventType: 'project.github_repository.linked',
      dedupeKey: `activity:project.github_repository.linked:${projectId}`,
      actorPlayerId: ownerPlayerId,
      subjectType: 'project',
      subjectId: projectId,
      payload: {
        schema_version: PROJECT_LINK_SCHEMA_VERSION,
        repository_id: repositoryId,
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
  const projectEvent = await projectCreatedEvent(db, projectId);
  if (!projectEvent) return null;
  const projectPayload = objectPayload(projectEvent.payload);
  if (requiredString(projectPayload, 'schema_version') !== PROJECT_SCHEMA_VERSION) throw new Error('project_history_version_unsupported');
  const ownerPlayerId = requiredString(projectPayload, 'owner_player_id');
  const name = requiredString(projectPayload, 'name');

  const missionEvent = await missionDeclaredEvent(db, projectId);
  const missionPayload = objectPayload(missionEvent.payload);
  if (requiredString(missionPayload, 'schema_version') !== MISSION_SCHEMA_VERSION) throw new Error('mission_history_version_unsupported');
  const missionId = requiredString(missionPayload, 'mission_id');
  if (missionEvent.subject_id !== missionId) throw new Error('project_mission_history_invalid');
  if (requiredString(missionPayload, 'owner_player_id') !== ownerPlayerId) throw new Error('project_mission_history_invalid');
  if (requiredString(missionPayload, 'project_id') !== projectId) throw new Error('project_mission_history_invalid');
  if (requiredString(missionPayload, 'state') !== 'DECLARED') throw new Error('project_mission_history_invalid');

  const link = await projectLinkEvent(db, projectId);
  let repository: GitHubRepositoryRow | null = null;
  if (link) {
    const linkPayload = objectPayload(link.payload);
    if (requiredString(linkPayload, 'schema_version') !== PROJECT_LINK_SCHEMA_VERSION) throw new Error('project_link_history_version_unsupported');
    const repositoryId = requiredString(linkPayload, 'repository_id');
    repository =
      (await db.selectFrom('github_repositories').selectAll().where('repository_id', '=', repositoryId).executeTakeFirst()) ?? null;
    if (!repository) throw new Error('project_repository_link_invalid');
  }

  const observationEvent = await latestProjectObservation(db, projectId);
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

  return {
    projectId,
    ownerPlayerId,
    name,
    missionId,
    missionState: 'DECLARED',
    goal: requiredString(missionPayload, 'goal'),
    shipCondition: requiredString(missionPayload, 'ship_condition'),
    currentFocus: requiredString(missionPayload, 'current_focus'),
    nextMove: requiredString(missionPayload, 'next_move'),
    repository,
    observation,
  };
}

export function toPublicDevelopmentProject(project: DevelopmentProjectSnapshot) {
  return {
    schema_version: 'project.public.v1' as const,
    project_id: project.projectId,
    name: project.name,
    mission_id: project.missionId,
    mission_state: project.missionState,
    source_connected: Boolean(project.repository?.active),
    source_visibility: project.repository ? (project.repository.private ? 'PRIVATE' : 'PUBLIC') : 'NONE',
    observation_state: project.observation ? 'OBSERVED' : 'UNKNOWN',
  };
}

export function toPrivateDevelopmentProject(project: DevelopmentProjectSnapshot) {
  return {
    schema_version: 'project.private.v1' as const,
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
    observation_state: project.observation ? 'OBSERVED' : 'UNKNOWN',
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
