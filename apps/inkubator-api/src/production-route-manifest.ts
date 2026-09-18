export type ProductionRouteSignature = `${string} ${string}`;

export const FUNDED_CHALLENGE_CORE_ROUTES = Object.freeze([
  'GET /health',
  'GET /v1/me',
  'DELETE /v1/session',
  'DELETE /v1/sessions',
  'POST /v1/challenges',
  'GET /v1/challenges/:challengeId',
  'POST /v1/compiler/compile',
  'POST /v1/challenges/:challengeId/build-contract-preview',
  'POST /v1/challenges/:challengeId/build-contract',
  'POST /v1/challenges/:challengeId/stage-i-mock-launch',
  'POST /v1/challenges/:challengeId/entries',
  'GET /v1/challenges/:challengeId/my-build',
  'POST /v1/challenges/:challengeId/submit-credential',
  'POST /v1/challenges/:challengeId/submissions',
  'GET /v1/challenges/:challengeId/reveal-arena',
  'GET /v1/test-arena/modules',
  'POST /v1/challenges/:challengeId/test-arena/entries/:entryId/qualify',
  'GET /v1/challenges/:challengeId/qualifier-comparison',
  'POST /v1/challenges/:challengeId/selection',
  'GET /v1/challenges/:challengeId/receipts',
] as const satisfies readonly ProductionRouteSignature[]);

export const FUNDED_CHALLENGE_GITHUB_ROUTES = Object.freeze([
  'GET /v1/github/repositories',
  'GET /v1/auth/github/start',
  'GET /v1/auth/github/install',
  'GET /v1/github/install/callback',
  'GET /v1/auth/github/install-complete',
  'POST /v1/github/reconcile',
  'GET /v1/auth/github/callback',
  'POST /v1/github/webhook',
] as const satisfies readonly ProductionRouteSignature[]);

export const PRODUCTION_PRIVILEGED_OPERATIONS = Object.freeze([
  {route: 'POST /v1/challenges', authority: 'AUTHENTICATED_ORGANIZER'},
  {route: 'POST /v1/challenges/:challengeId/build-contract', authority: 'CHALLENGE_ORGANIZER'},
  {route: 'POST /v1/challenges/:challengeId/stage-i-mock-launch', authority: 'CHALLENGE_ORGANIZER_TEST_ONLY'},
  {route: 'GET /v1/challenges/:challengeId/reveal-arena', authority: 'CHALLENGE_ORGANIZER'},
  {route: 'POST /v1/challenges/:challengeId/test-arena/entries/:entryId/qualify', authority: 'CHALLENGE_ORGANIZER'},
  {route: 'GET /v1/challenges/:challengeId/qualifier-comparison', authority: 'CHALLENGE_ORGANIZER'},
  {route: 'POST /v1/challenges/:challengeId/selection', authority: 'CHALLENGE_ORGANIZER'},
] as const);

export const FORBIDDEN_PRODUCTION_ROUTE_PREFIXES = Object.freeze([
  '/v1/dev',
  '/v1/devkit',
  '/v1/discover',
  '/v1/world',
  '/v1/rounds',
  '/v1/missions',
  '/v1/projects',
  '/v1/players',
  '/v1/help-beacons',
  '/v1/assists',
  '/v1/comments',
  '/v1/tester-requests',
  '/v1/ship',
  '/v1/reputation',
  '/v1/admin',
  '/v1/resolver',
  '/v1/moderation',
] as const);

function expectedProductionRoutes(githubEnabled: boolean): Set<string> {
  return new Set<string>([
    ...FUNDED_CHALLENGE_CORE_ROUTES,
    ...(githubEnabled ? FUNDED_CHALLENGE_GITHUB_ROUTES : []),
  ]);
}

function routePath(signature: string): string {
  const separator = signature.indexOf(' ');
  return separator === -1 ? signature : signature.slice(separator + 1);
}

export function assertProductionRouteInventory(
  observedRoutes: Iterable<string>,
  githubEnabled: boolean,
): void {
  const expected = expectedProductionRoutes(githubEnabled);
  const observed = new Set(observedRoutes);
  const unexpected = [...observed].filter((route) => !expected.has(route)).sort();
  const missing = [...expected].filter((route) => !observed.has(route)).sort();
  const forbidden = [...observed]
    .filter((route) => FORBIDDEN_PRODUCTION_ROUTE_PREFIXES.some((prefix) => routePath(route).startsWith(prefix)))
    .sort();

  if (unexpected.length || missing.length || forbidden.length) {
    throw new Error([
      'inkubator_production_route_inventory_invalid',
      unexpected.length ? `unexpected=${unexpected.join(',')}` : '',
      missing.length ? `missing=${missing.join(',')}` : '',
      forbidden.length ? `forbidden=${forbidden.join(',')}` : '',
    ].filter(Boolean).join(':'));
  }

  for (const privileged of PRODUCTION_PRIVILEGED_OPERATIONS) {
    if (!expected.has(privileged.route)) {
      throw new Error(`inkubator_privileged_route_not_allowlisted:${privileged.route}`);
    }
  }
}
