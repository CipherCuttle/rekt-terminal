import Fastify, {type FastifyReply, type FastifyRequest} from 'fastify';
import {authorize, type Actor} from './authorization.js';
import {componentSchemas, openapiDocument} from './contract.js';
import type {InkubatorDatabase, MissionGateRow} from './database.js';
import {appendHistoryEvent} from './events.js';
import {
  buildGitHubInstallUrl,
  claimGitHubSetupState,
  createGitHubSetupState,
  finalizeGitHubSetup,
  processGitHubWebhook,
  validateDeliveryId,
  verifyGitHubWebhookSignature,
  type GitHubRuntimeOptions,
  type GitHubUserVerifier,
} from './github.js';
import {enqueueOutboxJob, SESSION_EXPIRY_JOB_TYPE} from './jobs.js';
import {
  commandToPrivateView,
  createMission,
  getCurrentCommand,
  getPlayerProfile,
  joinRound,
  listRounds,
  updateMission,
  updateMissionGate,
  updatePlayerProfile,
} from './mission-command.js';
import {createPlayer, getPlayer, normalizeDisplayName} from './players.js';
import {
  createDevelopmentProject,
  getDevelopmentProject,
  linkDevelopmentProjectRepository,
  toPrivateDevelopmentProject,
  toPublicDevelopmentProject,
} from './projects.js';
import {toPrivatePlayer, toPublicPlayer} from './projection.js';
import {acceptAssist, createHelpBeacon, createProjectComment, deleteOwnProjectComment, followPlayer, getProjectHelpLoop, listDiscoverablePlayers, listDiscoverableProjects, listProjectComments, listWorldSignals, offerAssist, reactUsefulToComment, setProjectDiscussionLock, watchProject} from './social.js';
import {
  clearSessionCookie,
  createSession,
  readSessionToken,
  resolveSessionActor,
  revokeSession,
  serializeSessionCookie,
} from './session.js';

export interface BuildAppOptions {
  db: InkubatorDatabase;
  appOrigin: string;
  allowDevAuth: boolean;
  sessionTtlSeconds: number;
  github?: {runtime: GitHubRuntimeOptions; verifier: GitHubUserVerifier} | null;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CORS_METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE']);
const CORS_HEADERS = new Set(['content-type']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GATE_KEYS = new Set<MissionGateRow['gate_key']>(['FOUNDATION', 'CORE_EXPERIENCE', 'QUALITY_TESTING', 'SHIPABILITY']);

function error(reply: FastifyReply, statusCode: number, message: string) {
  return reply.code(statusCode).send({error: message});
}

function setCorsHeaders(reply: FastifyReply, appOrigin: string): void {
  reply.header('access-control-allow-origin', appOrigin);
  reply.header('access-control-allow-credentials', 'true');
  reply.header('vary', 'Origin');
}

function requestedCorsHeaders(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(',') : value ?? '';
  return raw.split(',').map((header) => header.trim().toLowerCase()).filter(Boolean);
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function authenticate(request: FastifyRequest, db: InkubatorDatabase): Promise<{actor: Actor; token: string} | null> {
  const token = readSessionToken(request.headers.cookie);
  if (!token) return null;
  const actor = await resolveSessionActor(db, token);
  return actor ? {actor, token} : null;
}

function claimedLabels(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : [];
}

function profileView(playerId: string, profile: Awaited<ReturnType<typeof getPlayerProfile>>) {
  return {
    schema_version: 'player.profile.v2' as const,
    player_id: playerId,
    ...(profile?.bio ? {bio: profile.bio} : {}),
    ...(profile?.character_name ? {character_name: profile.character_name} : {}),
    ...(profile?.character_archetype ? {character_archetype: profile.character_archetype} : {}),
    skills_needed: claimedLabels(profile?.skills_needed),
    can_help_with: claimedLabels(profile?.can_help_with),
  };
}

function roundView(round: Awaited<ReturnType<typeof joinRound>>, joined = true) {
  return {
    schema_version: 'round.private.v1' as const,
    round_id: round.round_id,
    code: round.code,
    title: round.title,
    constraint: round.constraint_text,
    state: round.state,
    joined,
  };
}

function phase5Error(reply: FastifyReply, cause: unknown) {
  const message = cause instanceof Error ? cause.message : 'phase5_mutation_failed';
  if (message === 'authorization_denied' || message.endsWith('_self_forbidden')) return error(reply, 403, message);
  if (message.endsWith('_not_found') || message === 'project_not_found' || message === 'player_not_found') return error(reply, 404, message);
  if (message.includes('idempotency_conflict') || message.endsWith('_already_open') || message.endsWith('_already_offered') || message === 'help_beacon_not_open' || message === 'assist_not_offerable' || message === 'project_discussion_locked' || message.endsWith('_not_active') || message === 'parent_comment_project_mismatch') return error(reply, 409, message);
  if (message.startsWith('invalid_')) return error(reply, 400, message);
  throw cause;
}

function phase3Error(reply: FastifyReply, cause: unknown) {
  const message = cause instanceof Error ? cause.message : 'phase3_mutation_failed';
  if (message === 'authorization_denied' || message.endsWith('_not_participant_authorized')) return error(reply, 403, message);
  if (message === 'round_not_found' || message === 'mission_not_found' || message === 'mission_gate_not_found') return error(reply, 404, message);
  if (message.includes('idempotency_conflict') || message === 'mission_transition_invalid' || message === 'mission_terminal') return error(reply, 409, message);
  if (message.startsWith('invalid_') || message === 'round_membership_required' || message === 'round_not_open' || message.endsWith('_required') || message.endsWith('_empty')) {
    return error(reply, 400, message);
  }
  throw cause;
}

const FASTIFY_SCHEMA_ID = 'inkubator-component-schemas-v1';

function rewriteFastifyRefs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewriteFastifyRefs);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    key === '$ref' && typeof child === 'string' && child.startsWith('#/components/schemas/')
      ? child.replace('#/components/schemas/', `${FASTIFY_SCHEMA_ID}#/definitions/`)
      : rewriteFastifyRefs(child),
  ]));
}

const fastifyComponentSchemas = rewriteFastifyRefs(componentSchemas) as Record<string, object>;

function fastifyBodySchema(name: keyof typeof componentSchemas) {
  return {$ref: `${FASTIFY_SCHEMA_ID}#/definitions/${name}`};
}

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({logger: false});

  app.addSchema({$id: FASTIFY_SCHEMA_ID, definitions: fastifyComponentSchemas});

  app.addHook('onRequest', async (request, reply) => {
    if (request.headers.origin === options.appOrigin) setCorsHeaders(reply, options.appOrigin);
  });

  app.options('/*', async (request, reply) => {
    if (request.headers.origin !== options.appOrigin) return error(reply, 403, 'origin_not_allowed');
    const requestedMethod = request.headers['access-control-request-method']?.toUpperCase();
    if (!requestedMethod || !CORS_METHODS.has(requestedMethod)) return error(reply, 403, 'cors_method_not_allowed');
    const requestedHeaders = requestedCorsHeaders(request.headers['access-control-request-headers']);
    if (requestedHeaders.some((header) => !CORS_HEADERS.has(header))) return error(reply, 403, 'cors_header_not_allowed');
    setCorsHeaders(reply, options.appOrigin);
    reply.header('access-control-allow-methods', [...CORS_METHODS].join(', '));
    reply.header('access-control-allow-headers', [...CORS_HEADERS].join(', '));
    reply.header('access-control-max-age', '600');
    return reply.code(204).send();
  });

  app.addHook('preHandler', async (request, reply) => {
    if (!MUTATING_METHODS.has(request.method)) return;
    if (request.url === '/v1/github/webhook') return;
    if (request.headers.origin !== options.appOrigin) return error(reply, 403, 'origin_not_allowed');
  });

  app.get('/health', async () => ({status: 'ok', service: 'inkubator-api'}));
  app.get('/openapi.json', async () => openapiDocument);

  if (options.allowDevAuth) {
    app.post('/v1/dev/session', {schema: {body: fastifyBodySchema('DevSessionRequest')}}, async (request, reply) => {
      const body = request.body as {display_name: string};
      let displayName: string;
      try { displayName = normalizeDisplayName(body.display_name); } catch { return error(reply, 400, 'invalid_display_name'); }
      const result = await options.db.transaction().execute(async (transaction) => {
        const player = await createPlayer(transaction, displayName);
        const session = await createSession(transaction, player.player_id, options.sessionTtlSeconds);
        await appendHistoryEvent(transaction, {
          eventFamily: 'activity', eventType: 'player.created', dedupeKey: `activity:player.created:${player.player_id}`,
          actorPlayerId: null, subjectType: 'player', subjectId: player.player_id, payload: {display_name: player.display_name},
        });
        await enqueueOutboxJob(transaction, {
          jobType: SESSION_EXPIRY_JOB_TYPE, idempotencyKey: `session.expiry:${session.sessionId}`,
          payload: {session_id: session.sessionId}, nextAttemptAt: session.expiresAt,
        });
        return {player, session};
      });
      reply.header('set-cookie', serializeSessionCookie(result.session.token, options.sessionTtlSeconds));
      return reply.code(201).send({schema_version: 'session.private.v1', player: toPrivatePlayer(result.player), expires_at: result.session.expiresAt.toISOString()});
    });

    app.post('/v1/development/projects', {schema: {body: fastifyBodySchema('DevelopmentProjectRequest')}}, async (request, reply) => {
      const authenticated = await authenticate(request, options.db);
      if (!authenticated) return error(reply, 401, 'authentication_required');
      const body = request.body as {name: string; goal: string; ship_condition: string; current_focus: string; next_move: string};
      try {
        const project = await createDevelopmentProject(options.db, authenticated.actor.playerId, {
          name: body.name,
          goal: body.goal,
          shipCondition: body.ship_condition,
          currentFocus: body.current_focus,
          nextMove: body.next_move,
        });
        reply.header('cache-control', 'no-store');
        return reply.code(201).send(toPrivateDevelopmentProject(project));
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'project_create_failed';
        if (message.startsWith('invalid_')) return error(reply, 400, message);
        throw cause;
      }
    });
  }

  app.get('/v1/me', async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const player = await getPlayer(options.db, authenticated.actor.playerId);
    if (!player) return error(reply, 401, 'authentication_required');
    reply.header('cache-control', 'no-store');
    return toPrivatePlayer(player);
  });

  app.get('/v1/me/profile', async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    reply.header('cache-control', 'no-store');
    return profileView(authenticated.actor.playerId, await getPlayerProfile(options.db, authenticated.actor.playerId));
  });

  app.patch('/v1/me/profile', {schema: {body: fastifyBodySchema('PlayerProfileUpdateRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const actor = authenticated.actor;
    if (!authorize(actor, 'player.update', {kind: 'player', playerId: actor.playerId})) return error(reply, 403, 'authorization_denied');
    const body = request.body as {request_id: string; bio?: string | null; character_name?: string | null; character_archetype?: string | null; skills_needed?: string[]; can_help_with?: string[]};
    try {
      const profile = await updatePlayerProfile(options.db, actor.playerId, {
        requestId: body.request_id, bio: body.bio, characterName: body.character_name, characterArchetype: body.character_archetype, skillsNeeded: body.skills_needed, canHelpWith: body.can_help_with,
      });
      reply.header('cache-control', 'no-store');
      return profileView(actor.playerId, profile);
    } catch (cause) { return phase3Error(reply, cause); }
  });

  app.get('/v1/discover/players', async (_request, reply) => {
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

  app.get('/v1/projects/:projectId/comments', async (request, reply) => {
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

  app.get('/v1/rounds', async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    reply.header('cache-control', 'no-store');
    const rounds = await listRounds(options.db, authenticated.actor.playerId);
    return rounds.map((round) => roundView(round, round.joined));
  });

  app.post('/v1/rounds/:roundId/join', async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {roundId} = request.params as {roundId: string};
    try {
      const round = await joinRound(options.db, authenticated.actor.playerId, roundId);
      reply.header('cache-control', 'no-store');
      return roundView(round, true);
    } catch (cause) { return phase3Error(reply, cause); }
  });

  app.post('/v1/missions', {schema: {body: fastifyBodySchema('MissionCreateRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const body = request.body as {
      request_id: string; round_id: string; project_name: string; goal: string; ship_condition: string;
      current_focus: string; next_move: string; stack_labels?: string[];
    };
    try {
      const command = await createMission(options.db, authenticated.actor.playerId, {
        requestId: body.request_id, roundId: body.round_id, projectName: body.project_name, goal: body.goal,
        shipCondition: body.ship_condition, currentFocus: body.current_focus, nextMove: body.next_move, stackLabels: body.stack_labels,
      });
      reply.header('cache-control', 'no-store');
      return reply.code(201).send(commandToPrivateView(command));
    } catch (cause) { return phase3Error(reply, cause); }
  });

  app.get('/v1/me/command', async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const command = await getCurrentCommand(options.db, authenticated.actor.playerId);
    if (!command) return error(reply, 404, 'active_mission_not_found');
    reply.header('cache-control', 'no-store');
    return commandToPrivateView(command);
  });

  app.patch('/v1/missions/:missionId', {schema: {body: fastifyBodySchema('MissionUpdateRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {missionId} = request.params as {missionId: string};
    const body = request.body as {request_id: string; state?: any; current_focus?: string; next_move?: string; blocker?: string | null; stack_labels?: string[]};
    try {
      const command = await updateMission(options.db, authenticated.actor.playerId, missionId, {
        requestId: body.request_id, state: body.state, currentFocus: body.current_focus, nextMove: body.next_move,
        blocker: body.blocker, stackLabels: body.stack_labels,
      });
      if (!authorize(authenticated.actor, 'mission.update', {kind: 'mission', ownerPlayerId: command.mission.owner_player_id})) return error(reply, 403, 'authorization_denied');
      reply.header('cache-control', 'no-store');
      return commandToPrivateView(command);
    } catch (cause) { return phase3Error(reply, cause); }
  });

  app.patch('/v1/missions/:missionId/gates/:gateKey', {schema: {body: fastifyBodySchema('MissionGateUpdateRequest')}}, async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const {missionId, gateKey} = request.params as {missionId: string; gateKey: string};
    if (!GATE_KEYS.has(gateKey as MissionGateRow['gate_key'])) return error(reply, 400, 'invalid_gate_key');
    const body = request.body as {request_id: string; state: any};
    try {
      const command = await updateMissionGate(options.db, authenticated.actor.playerId, missionId, gateKey as MissionGateRow['gate_key'], {
        requestId: body.request_id, signalState: body.state,
      });
      if (!authorize(authenticated.actor, 'mission.update', {kind: 'mission', ownerPlayerId: command.mission.owner_player_id})) return error(reply, 403, 'authorization_denied');
      reply.header('cache-control', 'no-store');
      return commandToPrivateView(command);
    } catch (cause) { return phase3Error(reply, cause); }
  });

  app.get('/v1/projects/:projectId', async (request, reply) => {
    const {projectId} = request.params as {projectId: string};
    if (!isUuid(projectId)) return error(reply, 400, 'invalid_project_id');
    const project = await getDevelopmentProject(options.db, projectId);
    if (!project) return error(reply, 404, 'project_not_found');
    return toPublicDevelopmentProject(project);
  });

  app.get('/v1/projects/:projectId/private', async (request, reply) => {
    const {projectId} = request.params as {projectId: string};
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    if (!isUuid(projectId)) return error(reply, 400, 'invalid_project_id');
    const project = await getDevelopmentProject(options.db, projectId);
    if (!project) return error(reply, 404, 'project_not_found');
    if (!authorize(authenticated.actor, 'project.read_private', {kind: 'project', ownerPlayerId: project.ownerPlayerId})) {
      return error(reply, 403, 'authorization_denied');
    }
    reply.header('cache-control', 'no-store');
    return toPrivateDevelopmentProject(project);
  });

  app.post('/v1/projects/:projectId/github-repositories', {schema: {body: componentSchemas.ProjectGitHubRepositoryLinkRequest}}, async (request, reply) => {
    const {projectId} = request.params as {projectId: string};
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    if (!isUuid(projectId)) return error(reply, 400, 'invalid_project_id');
    const project = await getDevelopmentProject(options.db, projectId);
    if (!project) return error(reply, 404, 'project_not_found');
    if (!authorize(authenticated.actor, 'project.link_repository', {kind: 'project', ownerPlayerId: project.ownerPlayerId})) {
      return error(reply, 403, 'authorization_denied');
    }
    const body = request.body as {repository_id: string};
    try {
      const linked = await linkDevelopmentProjectRepository(options.db, projectId, authenticated.actor.playerId, body.repository_id);
      reply.header('cache-control', 'no-store');
      return toPrivateDevelopmentProject(linked);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'project_repository_link_failed';
      if (message === 'project_not_found') return error(reply, 404, message);
      if (message === 'authorization_denied' || message === 'github_repository_not_available') return error(reply, 403, message);
      if (message === 'project_repository_already_linked' || message === 'github_repository_already_linked') return error(reply, 409, message);
      if (message === 'invalid_repository_id') return error(reply, 400, message);
      throw cause;
    }
  });

  app.delete('/v1/session', async (request, reply) => {
    const token = readSessionToken(request.headers.cookie);
    if (token) await revokeSession(options.db, token);
    reply.header('set-cookie', clearSessionCookie());
    return reply.code(204).send();
  });

  app.get('/v1/players/:playerId', async (request, reply) => {
    const {playerId} = request.params as {playerId: string};
    if (!isUuid(playerId)) return error(reply, 400, 'invalid_player_id');
    const player = await getPlayer(options.db, playerId);
    if (!player) return error(reply, 404, 'player_not_found');
    return toPublicPlayer(player, await getPlayerProfile(options.db, playerId));
  });

  app.get('/v1/players/:playerId/private', async (request, reply) => {
    const {playerId} = request.params as {playerId: string};
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    if (!isUuid(playerId)) return error(reply, 400, 'invalid_player_id');
    if (!authorize(authenticated.actor, 'player.read_private', {kind: 'player', playerId})) return error(reply, 403, 'authorization_denied');
    const player = await getPlayer(options.db, playerId);
    if (!player) return error(reply, 404, 'player_not_found');
    reply.header('cache-control', 'no-store');
    return toPrivatePlayer(player);
  });

  if (options.github) {
    app.post('/v1/github/install', async (request, reply) => {
      const authenticated = await authenticate(request, options.db);
      if (!authenticated) return error(reply, 401, 'authentication_required');
      const setup = await createGitHubSetupState(options.db, authenticated.actor.playerId);
      reply.header('cache-control', 'no-store');
      return reply.code(201).send({
        schema_version: 'github.install.v1',
        install_url: buildGitHubInstallUrl(options.github!.runtime.appSlug, setup.state),
        expires_at: setup.expiresAt.toISOString(),
      });
    });

    app.get('/v1/github/setup', async (request, reply) => {
      const authenticated = await authenticate(request, options.db);
      if (!authenticated) return error(reply, 401, 'authentication_required');
      const query = request.query as {code?: string; installation_id?: string; state?: string};
      if (!query.code || !query.installation_id || !/^\d+$/.test(query.installation_id) || !query.state) {
        return error(reply, 400, 'github_setup_invalid');
      }
      try {
        const claimed = await claimGitHubSetupState(options.db, query.state, authenticated.actor.playerId);
        const verified = await options.github!.verifier.verifyInstallation(query.code, query.installation_id);
        const finalized = await finalizeGitHubSetup(options.db, authenticated.actor.playerId, claimed.createdAt, verified);
        reply.header('cache-control', 'no-store');
        return {
          schema_version: 'github.installation.private.v1',
          installation_id: verified.installationId,
          repositories_connected: finalized.repositoriesConnected,
        };
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'github_setup_failed';
        if (message.startsWith('github_')) return error(reply, 400, message.split(':')[0]);
        throw cause;
      }
    });

    app.register(async (githubRoutes) => {
      githubRoutes.addContentTypeParser('application/json', {parseAs: 'buffer'}, (_request, body, done) => done(null, body));
      githubRoutes.post('/v1/github/webhook', async (request, reply) => {
        const rawBody = request.body;
        if (!Buffer.isBuffer(rawBody)) return error(reply, 400, 'github_raw_body_required');
        const signature = headerValue(request.headers['x-hub-signature-256']);
        if (!verifyGitHubWebhookSignature(options.github!.runtime.webhookSecret, rawBody, signature)) {
          return error(reply, 401, 'github_signature_invalid');
        }
        const delivery = headerValue(request.headers['x-github-delivery']);
        const eventName = headerValue(request.headers['x-github-event']);
        try {
          validateDeliveryId(delivery);
          if (!eventName) throw new Error('github_event_name_invalid');
          const result = await processGitHubWebhook(options.db, {deliveryId: delivery!, eventName, rawBody});
          return reply.code(result.status === 'observed' ? 202 : 200).send(result);
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'github_webhook_failed';
          if (message === 'github_delivery_conflict') return error(reply, 409, message);
          if (message === 'github_repository_not_bound') return error(reply, 403, message);
          if (message.startsWith('github_')) return error(reply, 400, message.split(':')[0]);
          throw cause;
        }
      });
    });
  }

  return app;
}
