import {buildApp} from './app.js';
import {loadRuntimeConfig} from './config.js';
import {createDatabase} from './database.js';
import {registerGitHubLoginRoutes} from './github-login-routes.js';

const config = loadRuntimeConfig();
const db = createDatabase(config.databaseUrl);
const app = buildApp({
  db,
  appOrigin: config.appOrigin,
  allowDevAuth: config.allowDevAuth,
  sessionTtlSeconds: config.sessionTtlSeconds,
  github: config.github
    ? {
        runtime: config.github,
        // The legacy /v1/github/setup handler remains temporarily for contract
        // compatibility, but production cannot use it as a second authority.
        // Canonical installation binding is registerGitHubLoginRoutes() below.
        verifier: {
          async verifyInstallation() {
            throw new Error('github_legacy_setup_disabled');
          },
        },
      }
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
