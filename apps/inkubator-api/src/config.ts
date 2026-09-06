export interface RuntimeConfig {
  databaseUrl: string;
  appOrigin: string;
  allowDevAuth: boolean;
  sessionTtlSeconds: number;
  host: string;
  port: number;
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
  };
}
