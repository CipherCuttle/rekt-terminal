import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {
  FORBIDDEN_PRODUCTION_ROUTE_PREFIXES,
  FUNDED_CHALLENGE_CORE_ROUTES,
  FUNDED_CHALLENGE_GITHUB_ROUTES,
  PRODUCTION_PRIVILEGED_OPERATIONS,
  assertProductionRouteInventory,
} from '../../dist/production-route-manifest.js';
import {buildFundedChallengeProductionApp} from '../../dist/production-app.js';

const fakeDb = {};
const appOrigin = 'https://inkubator.example.test';

function buildOptions(github = false) {
  return {
    db: fakeDb,
    appOrigin,
    sessionTtlSeconds: 3600,
    github: github
      ? {
          runtime: {
            appSlug: 'rekt-inkubator-test',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
            webhookSecret: 'test-webhook-secret',
          },
          githubAppAuth: null,
        }
      : null,
  };
}

test('production route manifest rejects legacy or missing routes', () => {
  assert.doesNotThrow(() => assertProductionRouteInventory(FUNDED_CHALLENGE_CORE_ROUTES, false));
  assert.doesNotThrow(() => assertProductionRouteInventory(
    [...FUNDED_CHALLENGE_CORE_ROUTES, ...FUNDED_CHALLENGE_GITHUB_ROUTES],
    true,
  ));
  assert.throws(
    () => assertProductionRouteInventory([...FUNDED_CHALLENGE_CORE_ROUTES, 'GET /v1/world/signals'], false),
    /inkubator_production_route_inventory_invalid.*unexpected=.*world\/signals.*forbidden=/,
  );
  assert.throws(
    () => assertProductionRouteInventory(FUNDED_CHALLENGE_CORE_ROUTES.slice(1), false),
    /inkubator_production_route_inventory_invalid.*missing=/,
  );
});

test('privileged production inventory has organizer authority and no resolver/admin surface', () => {
  assert.ok(PRODUCTION_PRIVILEGED_OPERATIONS.length > 0);
  for (const operation of PRODUCTION_PRIVILEGED_OPERATIONS) {
    assert.equal(operation.authority, 'CHALLENGE_ORGANIZER');
    assert.ok(FUNDED_CHALLENGE_CORE_ROUTES.includes(operation.route));
  }
  assert.ok(FORBIDDEN_PRODUCTION_ROUTE_PREFIXES.includes('/v1/admin'));
  assert.ok(FORBIDDEN_PRODUCTION_ROUTE_PREFIXES.includes('/v1/resolver'));
  assert.ok(FORBIDDEN_PRODUCTION_ROUTE_PREFIXES.includes('/v1/moderation'));
});

test('canonical production builder boots with and without GitHub routes', async () => {
  for (const github of [false, true]) {
    const app = buildFundedChallengeProductionApp(buildOptions(github));
    await app.ready();
    const health = await app.inject({method: 'GET', url: '/health'});
    assert.equal(health.statusCode, 200);

    const legacy = await app.inject({method: 'GET', url: '/v1/world/signals'});
    assert.equal(legacy.statusCode, 404);

    const privileged = await app.inject({
      method: 'POST',
      url: '/v1/challenges/00000000-0000-4000-8000-000000000001/selection',
      headers: {origin: appOrigin, 'content-type': 'application/json'},
      payload: {},
    });
    assert.equal(privileged.statusCode, 401);
    assert.deepEqual(privileged.json(), {error: 'authentication_required'});

    await app.close();
  }
});

test('production route inventory rejects caller plugins added after builder creation', async () => {
  const app = buildFundedChallengeProductionApp(buildOptions(false));
  app.register(async (latePlugin) => {
    latePlugin.get('/v1/world/signals', async () => ({ok: true}));
  });

  await assert.rejects(
    () => app.ready(),
    /inkubator_production_route_inventory_invalid.*unexpected=.*world\/signals.*forbidden=/,
  );
  await app.close();
});

test('both production entrypoints delegate to the same canonical builder', async () => {
  const server = await readFile(new URL('../../src/server.ts', import.meta.url), 'utf8');
  const renderServer = await readFile(new URL('../../src/render-server.ts', import.meta.url), 'utf8');

  for (const source of [server, renderServer]) {
    assert.match(source, /buildFundedChallengeProductionApp/);
    assert.doesNotMatch(source, /\bbuildApp\b/);
    assert.doesNotMatch(source, /registerStageEChallengeProductRoutes|registerStageGRevealArenaRoutes|registerStageG2BTestArenaRoutes|registerStageG3Routes/);
  }
});
