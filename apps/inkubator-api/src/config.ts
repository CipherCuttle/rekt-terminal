import type {GitHubRuntimeOptions} from './github.js';

export interface RuntimeConfig {
  databaseUrl: string;
  appOrigin: string;
  allowDevAuth: boolean;
  sessionTtlSeconds: number;
  host: string;
  port: number;
  github: GitHubRuntimeOptions | null;
}

function requireValue(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseOrigin(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('INKUBATOR_APP_ORIGIN must use http or https');
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) {
    throw new Error('INKUBATOR_APP_ORIGIN must be a bare origin');
  }
  return url.origin;
}

function parsePort(value: string | undefined): number {
  if (!value) return 8788;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');
  return port;
}

function parseSessionTtl(value: string | undefined): number {
  if (!value) return 60 * 60 * 24 * 7;
  const ttl = Number(value);
  if (!Number.isInteger(ttl) || ttl < 300 || ttl > 60 * 60 * 24 * 30) {
    throw new Error('INKUBATOR_SESSION_TTL_SECONDS must be between 300 and 2592000');
  }
  return ttl;
}

function parseGitHub(env: NodeJS.ProcessEnv): GitHubRuntimeOptions | null {
  const names = ['GITHUB_APP_SLUG', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_WEBHOOK_SECRET'] as const;
  const values = names.map((name) => env[name]?.trim() || '');
  if (values.every((value) => !value)) return null;
  if (values.some((value) => !value)) throw new Error('GitHub integration configuration must be all-or-none');
  const [appSlug, clientId, clientSecret, webhookSecret] = values;
  if (!/^[A-Za-z0-9-]{1,100}$/.test(appSlug)) throw new Error('GITHUB_APP_SLUG is invalid');
  if (clientSecret.length < 8) throw new Error('GITHUB_CLIENT_SECRET is invalid');
  if (webhookSecret.length < 16) throw new Error('GITHUB_WEBHOOK_SECRET must be at least 16 characters');
  return {appSlug, clientId, clientSecret, webhookSecret};
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const allowDevAuth = env.INKUBATOR_DEV_AUTH === '1';
  if (nodeEnv === 'production' && allowDevAuth) {
    throw new Error('INKUBATOR_DEV_AUTH must never be enabled in production');
  }

  return {
    databaseUrl: requireValue(env, 'DATABASE_URL'),
    appOrigin: parseOrigin(requireValue(env, 'INKUBATOR_APP_ORIGIN')),
    allowDevAuth,
    sessionTtlSeconds: parseSessionTtl(env.INKUBATOR_SESSION_TTL_SECONDS),
    host: env.HOST?.trim() || '127.0.0.1',
    port: parsePort(env.PORT),
    github: parseGitHub(env),
  };
}
