import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import type {InkubatorDatabase} from './database.js';
import {
  reconcileKnownGitHubAppInstallations,
  type GitHubAppServerAuthOptions,
} from './github-app-auth.js';
import {
  buildGitHubInstallUrl,
  claimGitHubSetupState,
  createGitHubSetupState,
  type GitHubRuntimeOptions,
} from './github.js';
import {
  buildGitHubLoginUrl,
  claimGitHubLoginAttempt,
  clearGitHubOauthCookie,
  createGitHubLoginAttempt,
  establishGitHubLoginSession,
  GITHUB_OAUTH_STATE_COOKIE,
  GITHUB_OAUTH_VERIFIER_COOKIE,
  serializeGitHubOauthCookie,
  verifyGitHubLoginWithToken,
} from './github-login.js';
import {reconcileGitHubAppInstallations} from './github-reconcile.js';
import {getPlayer} from './players.js';
import {readSessionToken, resolveSessionActor, serializeSessionCookie} from './session.js';

export interface RegisterGitHubLoginRoutesOptions {
  db: InkubatorDatabase;
  appOrigin: string;
  sessionTtlSeconds: number;
  github: GitHubRuntimeOptions;
  githubAppAuth?: GitHubAppServerAuthOptions | null;
}

const FLOW_TTL_SECONDS = 10 * 60;
const GITHUB_FLOW_COOKIE = '__Host-rekt_github_oauth_flow';
const GITHUB_PENDING_INSTALLATION_COOKIE = '__Host-rekt_github_pending_installation';
type GitHubOAuthFlow = 'login' | 'install';

function serializeTransientCookie(name: string, value: string): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${FLOW_TTL_SECONDS}`;
}

function clearTransientCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) return rest.join('=') || null;
  }
  return null;
}

async function currentPlayerId(request: FastifyRequest, db: InkubatorDatabase): Promise<string | null> {
  const token = readSessionToken(request.headers.cookie);
  if (!token) return null;
  return (await resolveSessionActor(db, token))?.playerId ?? null;
}

function beginOAuth(
  reply: FastifyReply,
  options: RegisterGitHubLoginRoutesOptions,
  flow: GitHubOAuthFlow,
  extraCookies: string[] = [],
  promptSelectAccount = false,
) {
  const attempt = createGitHubLoginAttempt();
  reply.header('cache-control', 'no-store');
  reply.header('set-cookie', [
    serializeGitHubOauthCookie(GITHUB_OAUTH_STATE_COOKIE, attempt.state),
    serializeGitHubOauthCookie(GITHUB_OAUTH_VERIFIER_COOKIE, attempt.verifier),
    serializeTransientCookie(GITHUB_FLOW_COOKIE, flow),
    ...extraCookies,
  ]);
  return reply.redirect(buildGitHubLoginUrl(options.github, options.appOrigin, attempt, {promptSelectAccount}));
}

function callbackCookies(extra: string[] = []): string[] {
  return [
    clearGitHubOauthCookie(GITHUB_OAUTH_STATE_COOKIE),
    clearGitHubOauthCookie(GITHUB_OAUTH_VERIFIER_COOKIE),
    clearTransientCookie(GITHUB_FLOW_COOKIE),
    clearTransientCookie(GITHUB_PENDING_INSTALLATION_COOKIE),
    ...extra,
  ];
}

function boundedReason(reason: string): string {
  return reason.replace(/[^a-z0-9_:\-.,]/gi, '_').slice(0, 160);
}

function sourceResultUrl(
  appOrigin: string,
  source: 'authorized' | 'authorization_failed',
  reason?: string,
  observationWarnings: string[] = [],
): string {
  const url = new URL('/', appOrigin);
  url.searchParams.set('mode', 'command');
  url.searchParams.set('source', source);
  if (reason) url.searchParams.set('reason', boundedReason(reason));
  if (source === 'authorized' && observationWarnings.length > 0) {
    url.searchParams.set('github_observation', 'degraded');
    url.searchParams.set('github_observation_reason', boundedReason(observationWarnings[0]!));
  }
  url.hash = 'command-source-control';
  return url.toString();
}

function syncError(reply: FastifyReply, cause: unknown) {
  const reason = cause instanceof Error ? cause.message.split(':')[0]! : 'github_reconciliation_failed';
  const status = reason === 'github_identity_missing' ? 409 : 502;
  return reply.code(status).send({error: reason});
}

export function registerGitHubLoginRoutes(app: FastifyInstance, options: RegisterGitHubLoginRoutesOptions): void {
  app.get('/v1/auth/github/start', async (request, reply) => {
    const query = request.query as {switch?: string};
    return beginOAuth(reply, options, 'login', [], query.switch === '1');
  });

  app.get('/v1/auth/github/install', async (request, reply) => {
    const playerId = await currentPlayerId(request, options.db);
    if (!playerId) return reply.redirect(new URL('/?mode=command&auth=github_required', options.appOrigin).toString());
    const setup = await createGitHubSetupState(options.db, playerId);
    reply.header('cache-control', 'no-store');
    return reply.redirect(buildGitHubInstallUrl(options.github.appSlug, setup.state));
  });

  const completeInstallation = async (request: FastifyRequest, reply: FastifyReply) => {
    const playerId = await currentPlayerId(request, options.db);
    const query = request.query as {installation_id?: string; state?: string; setup_action?: string};
    const setupActionValid = !query.setup_action || query.setup_action === 'install' || query.setup_action === 'update';
    if (!playerId || !query.installation_id || !/^\d+$/.test(query.installation_id) || !query.state || !setupActionValid) {
      return reply.redirect(sourceResultUrl(options.appOrigin, 'authorization_failed', 'github_setup_invalid'));
    }
    try {
      await claimGitHubSetupState(options.db, query.state, playerId);
      return beginOAuth(
        reply,
        options,
        'install',
        [serializeTransientCookie(GITHUB_PENDING_INSTALLATION_COOKIE, query.installation_id)],
      );
    } catch (cause) {
      const reason = cause instanceof Error && cause.message.startsWith('github_') ? cause.message : 'github_setup_failed';
      return reply.redirect(sourceResultUrl(options.appOrigin, 'authorization_failed', reason));
    }
  };

  // Canonical GitHub App Setup URL. Keep the previous path as a temporary alias
  // so provider configuration can migrate without maintaining two state machines.
  app.get('/v1/github/install/callback', completeInstallation);
  app.get('/v1/auth/github/install-complete', completeInstallation);

  app.post('/v1/github/reconcile', async (request, reply) => {
    const playerId = await currentPlayerId(request, options.db);
    if (!playerId) return reply.code(401).send({error: 'authentication_required'});
    if (!options.githubAppAuth) return reply.code(503).send({error: 'github_server_auth_unavailable'});
    reply.header('cache-control', 'no-store');
    try {
      const result = await reconcileKnownGitHubAppInstallations(
        options.db,
        options.github,
        options.githubAppAuth,
        playerId,
      );
      return reply.send({
        schema_version: 'github.reconcile.private.v1',
        installation_count: result.installationIds.length,
        repositories_connected: result.repositoriesConnected,
        warnings: result.warnings,
      });
    } catch (cause) {
      return syncError(reply, cause);
    }
  });

  app.get('/v1/auth/github/callback', async (request, reply) => {
    const query = request.query as {code?: string; state?: string; error?: string};
    const flow = (readCookie(request.headers.cookie, GITHUB_FLOW_COOKIE) ?? 'login') as GitHubOAuthFlow;
    const loginFailure = new URL('/', options.appOrigin);
    loginFailure.searchParams.set('mode', 'command');
    loginFailure.searchParams.set('auth', 'github_failed');
    const failureUrl = flow === 'login'
      ? loginFailure.toString()
      : sourceResultUrl(options.appOrigin, 'authorization_failed', query.error || 'github_oauth_failed');
    reply.header('cache-control', 'no-store');

    if (query.error || !query.code || !query.state) {
      reply.header('set-cookie', callbackCookies());
      reply.redirect(failureUrl);
      return;
    }

    try {
      const {verifier} = claimGitHubLoginAttempt(request.headers.cookie, query.state);
      const verification = await verifyGitHubLoginWithToken(options.github, options.appOrigin, query.code, verifier);

      if (flow === 'login') {
        const result = await establishGitHubLoginSession(options.db, verification.identity, options.sessionTtlSeconds);
        let syncFailed = false;
        let observationWarnings: string[] = [];
        try {
          const reconciled = await reconcileGitHubAppInstallations(
            options.db,
            options.github,
            result.player.player_id,
            verification.identity.githubUserId,
            verification.accessToken,
          );
          observationWarnings = reconciled.warnings;
        } catch {
          syncFailed = true;
        }
        const success = new URL('/', options.appOrigin);
        success.searchParams.set('mode', 'command');
        success.searchParams.set('auth', 'github');
        if (syncFailed) success.searchParams.set('github_sync', 'failed');
        if (observationWarnings.length > 0) {
          success.searchParams.set('github_observation', 'degraded');
          success.searchParams.set('github_observation_reason', boundedReason(observationWarnings[0]!));
        }
        reply.header('set-cookie', callbackCookies([
          serializeSessionCookie(result.session.token, options.sessionTtlSeconds),
        ]));
        reply.redirect(success.toString());
        return;
      }

      const playerId = await currentPlayerId(request, options.db);
      if (!playerId) throw new Error('github_reconciliation_session_missing');
      const player = await getPlayer(options.db, playerId);
      if (!player?.github_user_id || player.github_user_id !== verification.identity.githubUserId) {
        throw new Error('github_identity_conflict');
      }
      const reconciled = await reconcileGitHubAppInstallations(
        options.db,
        options.github,
        playerId,
        verification.identity.githubUserId,
        verification.accessToken,
      );
      const pendingInstallationId = readCookie(request.headers.cookie, GITHUB_PENDING_INSTALLATION_COOKIE);
      if (!pendingInstallationId || !reconciled.installationIds.includes(pendingInstallationId)) {
        throw new Error('github_installation_not_accessible_to_user');
      }
      reply.header('set-cookie', callbackCookies());
      reply.redirect(sourceResultUrl(options.appOrigin, 'authorized', undefined, reconciled.warnings));
    } catch (cause) {
      const reason = cause instanceof Error && cause.message.startsWith('github_') ? cause.message.split(':')[0] : 'github_oauth_failed';
      reply.header('set-cookie', callbackCookies());
      reply.redirect(flow === 'login' ? loginFailure.toString() : sourceResultUrl(options.appOrigin, 'authorization_failed', reason));
    }
  });
}
