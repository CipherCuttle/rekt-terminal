import Fastify, {type FastifyReply, type FastifyRequest} from 'fastify';
import {authorize, type Actor} from './authorization.js';
import {componentSchemas, openapiDocument} from './contract.js';
import type {InkubatorDatabase} from './database.js';
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
import {createPlayer, getPlayer, normalizeDisplayName} from './players.js';
import {toPrivatePlayer, toPublicPlayer} from './projection.js';
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
const CORS_METHODS = new Set(['GET', 'POST', 'DELETE']);
const CORS_HEADERS = new Set(['content-type']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({logger: false});

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
    app.post('/v1/dev/session', {schema: {body: componentSchemas.DevSessionRequest}}, async (request, reply) => {
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
  }

  app.get('/v1/me', async (request, reply) => {
    const authenticated = await authenticate(request, options.db);
    if (!authenticated) return error(reply, 401, 'authentication_required');
    const player = await getPlayer(options.db, authenticated.actor.playerId);
    if (!player) return error(reply, 401, 'authentication_required');
    reply.header('cache-control', 'no-store');
    return toPrivatePlayer(player);
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
    return toPublicPlayer(player);
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
