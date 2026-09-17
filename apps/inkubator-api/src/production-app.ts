import Fastify, {type FastifyInstance, type FastifyReply, type FastifyRequest} from 'fastify';
import {registerStageG3Routes} from './challenge-g3-api.js';
import {registerStageEChallengeProductRoutes} from './challenge-product-api.js';
import {registerStageGRevealArenaRoutes} from './challenge-reveal-api.js';
import {registerStageG2BTestArenaRoutes} from './challenge-test-arena-api.js';
import type {InkubatorDatabase} from './database.js';
import type {GitHubAppServerAuthOptions} from './github-app-auth.js';
import {registerGitHubLoginRoutes} from './github-login-routes.js';
import {
  processGitHubWebhook,
  validateDeliveryId,
  verifyGitHubWebhookSignature,
  type GitHubRuntimeOptions,
} from './github.js';
import {getPlayer} from './players.js';
import {toPrivatePlayer} from './projection.js';
import {
  assertProductionRouteInventory,
  type ProductionRouteSignature,
} from './production-route-manifest.js';
import {
  clearSessionCookie,
  readSessionToken,
  resolveSessionActor,
  revokeAllPlayerSessions,
  revokeSession,
} from './session.js';
import {registerStageIAlphaRoutes} from './stage-i-alpha-api.js';

export interface BuildFundedChallengeProductionAppOptions {
  db: InkubatorDatabase;
  appOrigin: string;
  sessionTtlSeconds: number;
  incidentWriteFreeze?: boolean;
  incidentDisableGitHub?: boolean;
  github?: {
    runtime: GitHubRuntimeOptions;
    githubAppAuth?: GitHubAppServerAuthOptions | null;
  } | null;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CORS_METHODS = new Set(['GET', 'POST', 'DELETE']);
const CORS_HEADERS = new Set(['content-type']);
const INCIDENT_REVOCATION_PATHS = new Set(['/v1/session', '/v1/sessions']);
const CHALLENGE_SUBMISSION_PATH = /^\/v1\/challenges\/[^/]+\/submissions$/;

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

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function authenticatedPlayerId(request: FastifyRequest, db: InkubatorDatabase): Promise<string | null> {
  const token = readSessionToken(request.headers.cookie);
  if (!token) return null;
  return (await resolveSessionActor(db, token))?.playerId ?? null;
}

function observeProductionRoute(
  observed: Set<ProductionRouteSignature>,
  method: string | string[],
  url: string,
): void {
  if (url !== '/health' && !url.startsWith('/v1/')) return;
  const methods = Array.isArray(method) ? method : [method];
  for (const value of methods) {
    const normalized = value.toUpperCase();
    if (normalized === 'HEAD') continue;
    observed.add(`${normalized} ${url}` as ProductionRouteSignature);
  }
}

function isBearerChallengeSubmission(request: FastifyRequest, pathname: string): boolean {
  const authorization = headerValue(request.headers.authorization);
  return request.method === 'POST'
    && CHALLENGE_SUBMISSION_PATH.test(pathname)
    && typeof authorization === 'string'
    && /^Bearer\s+\S+$/i.test(authorization.trim());
}

function registerGitHubProductionRoutes(
  app: FastifyInstance,
  options: BuildFundedChallengeProductionAppOptions & {
    github: NonNullable<BuildFundedChallengeProductionAppOptions['github']>;
  },
): void {
  registerGitHubLoginRoutes(app, {
    db: options.db,
    appOrigin: options.appOrigin,
    sessionTtlSeconds: options.sessionTtlSeconds,
    github: options.github.runtime,
    githubAppAuth: options.github.githubAppAuth,
  });

  app.get('/v1/github/repositories', async (request, reply) => {
    const playerId = await authenticatedPlayerId(request, options.db);
    if (!playerId) return error(reply, 401, 'authentication_required');
    reply.header('cache-control', 'no-store');
    const repositories = await options.db.selectFrom('github_repositories as repository')
      .innerJoin('github_installations as installation', 'installation.installation_id', 'repository.installation_id')
      .select(['repository.repository_id', 'repository.full_name', 'repository.private'])
      .where('installation.player_id', '=', playerId)
      .where('installation.revoked_at', 'is', null)
      .where('repository.active', '=', true)
      .orderBy('repository.full_name', 'asc')
      .execute();
    return repositories.map((repository) => ({
      ...repository,
      repository_id: String(repository.repository_id),
    }));
  });

  app.register(async (githubRoutes) => {
    githubRoutes.addContentTypeParser(
      'application/json',
      {parseAs: 'buffer'},
      (_request, body, done) => done(null, body),
    );
    githubRoutes.post('/v1/github/webhook', async (request, reply) => {
      const rawBody = request.body;
      if (!Buffer.isBuffer(rawBody)) return error(reply, 400, 'github_raw_body_required');
      const signature = headerValue(request.headers['x-hub-signature-256']);
      if (!verifyGitHubWebhookSignature(options.github.runtime.webhookSecret, rawBody, signature)) {
        return error(reply, 401, 'github_signature_invalid');
      }
      const delivery = headerValue(request.headers['x-github-delivery']);
      const eventName = headerValue(request.headers['x-github-event']);
      try {
        validateDeliveryId(delivery);
        if (!eventName) throw new Error('github_event_name_invalid');
        const result = await processGitHubWebhook(options.db, {
          deliveryId: delivery!,
          eventName,
          rawBody,
        });
        return reply.code(result.status === 'observed' ? 202 : 200).send(result);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'github_webhook_failed';
        if (message === 'github_delivery_conflict') return error(reply, 409, message);
        if (message === 'github_repository_not_bound') return error(reply, 403, message);
        if (message.startsWith('github_')) return error(reply, 400, message.split(':')[0]!);
        throw cause;
      }
    });
  });
}

export function buildFundedChallengeProductionApp(options: BuildFundedChallengeProductionAppOptions) {
  const app = Fastify({logger: false});
  const observedRoutes = new Set<ProductionRouteSignature>();
  const incidentWriteFreeze = options.incidentWriteFreeze === true;
  const githubEnabled = Boolean(options.github) && options.incidentDisableGitHub !== true && !incidentWriteFreeze;

  app.addHook('onRoute', (routeOptions) => {
    observeProductionRoute(observedRoutes, routeOptions.method, routeOptions.url);
  });

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
    const pathname = request.url.split('?', 1)[0];
    if (incidentWriteFreeze && !INCIDENT_REVOCATION_PATHS.has(pathname)) {
      return error(reply, 503, 'incident_write_freeze');
    }
    if (pathname === '/v1/github/webhook') return;
    if (isBearerChallengeSubmission(request, pathname)) return;
    if (request.headers.origin !== options.appOrigin) return error(reply, 403, 'origin_not_allowed');
  });

  app.get('/health', async () => ({status: 'ok', service: 'inkubator-api'}));

  app.get('/v1/me', async (request, reply) => {
    const playerId = await authenticatedPlayerId(request, options.db);
    if (!playerId) return error(reply, 401, 'authentication_required');
    const player = await getPlayer(options.db, playerId);
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

  app.delete('/v1/sessions', async (request, reply) => {
    const token = readSessionToken(request.headers.cookie);
    if (token) {
      const actor = await resolveSessionActor(options.db, token);
      if (actor) await revokeAllPlayerSessions(options.db, actor.playerId);
    }
    reply.header('set-cookie', clearSessionCookie());
    return reply.code(204).send();
  });

  registerStageEChallengeProductRoutes(app, options.db);
  registerStageIAlphaRoutes(app, options.db);
  registerStageGRevealArenaRoutes(app, options.db);
  registerStageG2BTestArenaRoutes(app, options.db);
  registerStageG3Routes(app, options.db);

  if (githubEnabled && options.github) {
    registerGitHubProductionRoutes(app, {...options, github: options.github});
  }

  app.addHook('onReady', async () => {
    assertProductionRouteInventory(observedRoutes, githubEnabled);
  });

  return app;
}
