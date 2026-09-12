import {readFile} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildApp} from './app.js';
import {loadRuntimeConfig} from './config.js';
import {createDatabase} from './database.js';
import {registerGitHubLoginRoutes} from './github-login-routes.js';
import {createGitHubUserVerifier} from './github.js';

const config = loadRuntimeConfig();
const db = createDatabase(config.databaseUrl);
const app = buildApp({
  db,
  appOrigin: config.appOrigin,
  allowDevAuth: config.allowDevAuth,
  sessionTtlSeconds: config.sessionTtlSeconds,
  github: config.github
    ? {runtime: config.github, verifier: createGitHubUserVerifier(config.github)}
    : null,
});

if (config.github) {
  registerGitHubLoginRoutes(app, {
    db,
    appOrigin: config.appOrigin,
    sessionTtlSeconds: config.sessionTtlSeconds,
    github: config.github,
  });
}

const staticRoot = resolve(fileURLToPath(new URL('../../inkubator-lab/dist/', import.meta.url)));
const indexPath = resolve(staticRoot, 'index.html');
const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

app.get('/*', async (request, reply) => {
  const pathname = new URL(request.url, config.appOrigin).pathname;
  if (pathname.startsWith('/v1/') || pathname === '/openapi.json' || pathname === '/health') {
    return reply.code(404).send({error: 'not_found'});
  }

  let requestedPath: string;
  try {
    requestedPath = decodeURIComponent(pathname);
  } catch {
    return reply.code(400).send({error: 'invalid_path'});
  }

  const relative = requestedPath.replace(/^\/+/, '');
  const candidate = resolve(staticRoot, relative);
  if (candidate !== staticRoot && !candidate.startsWith(`${staticRoot}${sep}`)) {
    return reply.code(400).send({error: 'invalid_path'});
  }

  const hasExtension = extname(candidate) !== '';
  const filePath = hasExtension ? candidate : indexPath;
  try {
    const body = await readFile(filePath);
    reply.type(mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream');
    if (filePath === indexPath) reply.header('cache-control', 'no-store');
    else reply.header('cache-control', 'public, max-age=31536000, immutable');
    return reply.send(body);
  } catch (cause) {
    if (hasExtension && cause && typeof cause === 'object' && 'code' in cause && cause.code === 'ENOENT') {
      return reply.code(404).send({error: 'not_found'});
    }
    throw cause;
  }
});

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app.close();
  await db.destroy();
}

process.once('SIGTERM', () => void close().finally(() => process.exit(0)));
process.once('SIGINT', () => void close().finally(() => process.exit(0)));

try {
  await app.listen({host: config.host, port: config.port});
} catch (error) {
  await close();
  throw error;
}
