import {buildApp} from './app.js';
import {loadRuntimeConfig} from './config.js';
import {createDatabase} from './database.js';
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
