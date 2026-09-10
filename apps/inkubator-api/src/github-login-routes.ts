import type {FastifyInstance} from 'fastify';
import type {InkubatorDatabase} from './database.js';
import type {GitHubRuntimeOptions} from './github.js';
import {
  buildGitHubLoginUrl,
  claimGitHubLoginAttempt,
  clearGitHubOauthCookie,
  createGitHubLoginAttempt,
  establishGitHubLoginSession,
  GITHUB_OAUTH_STATE_COOKIE,
  GITHUB_OAUTH_VERIFIER_COOKIE,
  serializeGitHubOauthCookie,
  verifyGitHubLoginIdentity,
} from './github-login.js';
import {serializeSessionCookie} from './session.js';

export interface RegisterGitHubLoginRoutesOptions {
  db: InkubatorDatabase;
  appOrigin: string;
  sessionTtlSeconds: number;
  github: GitHubRuntimeOptions;
}

export function registerGitHubLoginRoutes(app: FastifyInstance, options: RegisterGitHubLoginRoutesOptions): void {
  app.get('/v1/auth/github/start', async (_request, reply) => {
    const attempt = createGitHubLoginAttempt();
    reply.header('cache-control', 'no-store');
    reply.header('set-cookie', [
      serializeGitHubOauthCookie(GITHUB_OAUTH_STATE_COOKIE, attempt.state),
      serializeGitHubOauthCookie(GITHUB_OAUTH_VERIFIER_COOKIE, attempt.verifier),
    ]);
    return reply.redirect(buildGitHubLoginUrl(options.github, options.appOrigin, attempt));
  });

  app.get('/v1/auth/github/callback', async (request, reply) => {
    const query = request.query as {code?: string; state?: string; error?: string};
    const failure = new URL('/', options.appOrigin);
    failure.searchParams.set('mode', 'command');
    failure.searchParams.set('auth', 'github_failed');
    reply.header('cache-control', 'no-store');

    if (query.error || !query.code || !query.state) {
      reply.header('set-cookie', [
        clearGitHubOauthCookie(GITHUB_OAUTH_STATE_COOKIE),
        clearGitHubOauthCookie(GITHUB_OAUTH_VERIFIER_COOKIE),
      ]);
      reply.redirect(failure.toString());
      return;
    }

    try {
      const {verifier} = claimGitHubLoginAttempt(request.headers.cookie, query.state);
      const identity = await verifyGitHubLoginIdentity(options.github, options.appOrigin, query.code, verifier);
      const result = await establishGitHubLoginSession(options.db, identity, options.sessionTtlSeconds);
      const success = new URL('/', options.appOrigin);
      success.searchParams.set('mode', 'command');
      success.searchParams.set('auth', 'github');
      reply.header('set-cookie', [
        serializeSessionCookie(result.session.token, options.sessionTtlSeconds),
        clearGitHubOauthCookie(GITHUB_OAUTH_STATE_COOKIE),
        clearGitHubOauthCookie(GITHUB_OAUTH_VERIFIER_COOKIE),
      ]);
      reply.redirect(success.toString());
    } catch {
      reply.header('set-cookie', [
        clearGitHubOauthCookie(GITHUB_OAUTH_STATE_COOKIE),
        clearGitHubOauthCookie(GITHUB_OAUTH_VERIFIER_COOKIE),
      ]);
      reply.redirect(failure.toString());
    }
  });
}
