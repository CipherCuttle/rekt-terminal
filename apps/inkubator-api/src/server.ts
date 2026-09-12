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
    githubAppAuth: config.githubAppAuth,
  });
}

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
