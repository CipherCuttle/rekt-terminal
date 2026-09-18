import {loadRuntimeConfig} from './config.js';
import {createDatabase} from './database.js';
import {buildFundedChallengeProductionApp} from './production-app.js';

const config = loadRuntimeConfig();
const db = createDatabase(config.databaseUrl);
const app = buildFundedChallengeProductionApp({
  db,
  appOrigin: config.appOrigin,
  sessionTtlSeconds: config.sessionTtlSeconds,
  incidentWriteFreeze: config.incidentWriteFreeze,
  incidentDisableGitHub: config.incidentDisableGitHub,
  github: config.github
    ? {
        runtime: config.github,
        githubAppAuth: config.githubAppAuth,
      }
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
