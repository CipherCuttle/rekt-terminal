import Fastify, {type FastifyReply, type FastifyRequest} from 'fastify';
import {authorize, type Actor} from './authorization.js';
import {componentSchemas, openapiDocument} from './contract.js';
import type {InkubatorDatabase} from './database.js';
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
  return raw
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
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
    if (request.headers.origin === options.appOrigin) {
      setCorsHeaders(reply, options.appOrigin);
    }
  });

  app.options('/*', async (request, reply) => {
    if (request.headers.origin !== options.appOrigin) {
      return error(reply, 403, 'origin_not_allowed');
    }

    const requestedMethod = request.headers['access-control-request-method']?.toUpperCase();
    if (!requestedMethod || !CORS_METHODS.has(requestedMethod)) {
      return error(reply, 403, 'cors_method_not_allowed');
    }

    const requestedHeaders = requestedCorsHeaders(request.headers['access-control-request-headers']);
    if (requestedHeaders.some((header) => !CORS_HEADERS.has(header))) {
      return error(reply, 403, 'cors_header_not_allowed');
    }

    setCorsHeaders(reply, options.appOrigin);
    reply.header('access-control-allow-methods', [...CORS_METHODS].join(', '));
    reply.header('access-control-allow-headers', [...CORS_HEADERS].join(', '));
    reply.header('access-control-max-age', '600');
    return reply.code(204).send();
  });

  app.addHook('preHandler', async (request, reply) => {
    if (!MUTATING_METHODS.has(request.method)) return;
    if (request.headers.origin !== options.appOrigin) {
      return error(reply, 403, 'origin_not_allowed');
    }
  });

  app.get('/health', async () => ({status: 'ok', service: 'inkubator-api'}));
  app.get('/openapi.json', async () => openapiDocument);

  if (options.allowDevAuth) {
    app.post(
      '/v1/dev/session',
      {schema: {body: componentSchemas.DevSessionRequest}},
      async (request, reply) => {
        const body = request.body as {display_name: string};
        let displayName: string;
        try {
          displayName = normalizeDisplayName(body.display_name);
        } catch {
          return error(reply, 400, 'invalid_display_name');
        }

        const result = await options.db.transaction().execute(async (transaction) => {
          const player = await createPlayer(transaction, displayName);
          const session = await createSession(transaction, player.player_id, options.sessionTtlSeconds);
          return {player, session};
        });

        reply.header('set-cookie', serializeSessionCookie(result.session.token, options.sessionTtlSeconds));
        return reply.code(201).send({
          schema_version: 'session.private.v1',
          player: toPrivatePlayer(result.player),
          expires_at: result.session.expiresAt.toISOString(),
        });
      },
    );
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
    if (!authorize(authenticated.actor, 'player.read_private', {kind: 'player', playerId})) {
      return error(reply, 403, 'authorization_denied');
    }
    const player = await getPlayer(options.db, playerId);
    if (!player) return error(reply, 404, 'player_not_found');
    reply.header('cache-control', 'no-store');
    return toPrivatePlayer(player);
  });

  return app;
}
