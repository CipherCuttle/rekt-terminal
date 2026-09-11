import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page, type Route} from '@playwright/test';

const command = {
  schema_version: 'command.private.v2',
  project: {
    project_id: 'P-LIVE-001',
    name: 'WEIRD LITTLE THING',
    source_connected: true,
    source_visibility: 'PRIVATE',
    observation_state: 'OBSERVED',
  },
  mission: {
    mission_id: 'M-LIVE-001',
    state: 'BUILDING',
    goal: 'Ship one real working thing.',
    ship_condition: 'A working link exists.',
    current_focus: 'Wire project.',
    next_move: 'PROVE PROJECT',
    progress_model_version: 'mission.progress.v1',
    stack_labels: ['TYPESCRIPT'],
    stack_source: 'PLAYER_CONFIRMED',
  },
  gates: [
    {key: 'FOUNDATION', label: 'FOUNDATION', state: 'PROVEN', position: 1},
    {key: 'CORE_EXPERIENCE', label: 'CORE EXPERIENCE', state: 'OBSERVED', position: 2},
    {key: 'QUALITY_TESTING', label: 'QUALITY TESTING', state: 'ACTIVE', position: 3},
    {key: 'SHIPABILITY', label: 'SHIPABILITY', state: 'UNKNOWN', position: 4},
  ],
  github_evidence: {
    rule_version: 'github-evidence.v1',
    source_state: 'AVAILABLE',
    signal_state: 'OBSERVED',
    stale_after_ms: 300000,
    invalid_observation_count: 0,
    reason_code: 'latest_observation_current',
    observed_stacks: ['JAVASCRIPT_TYPESCRIPT'],
  },
  daemon: {
    rule_version: 'daemon-advisory.v1',
    authority: 'ADVISORY_ONLY',
    what_changed: 'Project changed.',
    proposed_next_move: 'Keep scope bounded.',
  },
};

const project = {
  schema_version: 'project.private.v2',
  project_id: 'P-LIVE-001',
  owner_player_id: 'PLAYER-1',
  name: 'WEIRD LITTLE THING',
  mission_id: 'M-LIVE-001',
  mission_state: 'BUILDING',
  goal: 'Ship one real working thing.',
  ship_condition: 'A working link exists.',
  current_focus: 'Wire project.',
  next_move: 'PROVE PROJECT',
  source_connected: true,
  source_visibility: 'PRIVATE',
  observation_state: 'OBSERVED',
  repository_id: '123',
  repository_full_name: 'CipherCuttle/weird-little-thing',
  repository_private: true,
  repository_active: true,
  last_ref: 'refs/heads/main',
};

const help = {
  schema_version: 'project.help_loop.public.v1',
  project_id: 'P-LIVE-001',
  owner: {schema_version: 'player.public.v2', player_id: 'PLAYER-1', display_name: 'Builder', skills_needed: [], can_help_with: []},
  open_help_beacon: {schema_version: 'help_beacon.public.v1', beacon_id: 'B-1', project_id: 'P-LIVE-001', summary: 'Need one external tester.', skills_needed: ['QA'], state: 'OPEN'},
  party_members: [{player_id: 'PLAYER-2', display_name: 'Helper', role: 'ASSIST'}],
};

const externalTests = {
  schema_version: 'project.external_tests.public.v1',
  project_id: 'P-LIVE-001',
  requests: [],
  results: [],
};

const ship = {schema_version: 'project.ship.public.v2', project_id: 'P-LIVE-001'};

const projects = [{
  schema_version: 'project.discovery.v1',
  project: {schema_version: 'project.public.v2', project_id: 'P-LIVE-001', name: 'WEIRD LITTLE THING', mission_id: 'M-LIVE-001', mission_state: 'BUILDING', source_connected: true, source_visibility: 'PRIVATE', observation_state: 'OBSERVED'},
  owner: {schema_version: 'player.public.v2', player_id: 'PLAYER-1', display_name: 'Builder', skills_needed: ['QA'], can_help_with: ['UI']},
  open_help_beacon: {schema_version: 'help_beacon.public.v1', beacon_id: 'B-1', project_id: 'P-LIVE-001', summary: 'Need one external tester.', skills_needed: ['QA'], state: 'OPEN'},
}];
const players = [{schema_version: 'player.public.v2', player_id: 'PLAYER-1', display_name: 'Builder', skills_needed: ['QA'], can_help_with: ['UI']}];
const signals = [{schema_version: 'world.signal.public.v1', signal_id: 'SIG-1', kind: 'HELP_BEACON_OPENED', project_id: 'P-LIVE-001', project_name: 'WEIRD LITTLE THING', truth_state: 'CLAIMED', occurred_at: '2026-09-10T10:00:00Z'}];

const me = {schema_version: 'player.private.v1', player_id: 'PLAYER-1', display_name: 'CipherCuttle', created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-10T08:00:00Z'};
const profile = {schema_version: 'player.profile.v2', player_id: 'PLAYER-1', bio: 'Builds strange useful things.', character_name: 'ink.operator', character_archetype: 'BUILDER', skills_needed: ['QA'], can_help_with: ['UI', 'SYSTEMS']};
const history = {schema_version: 'player.history.private.v1', player_id: 'PLAYER-1', entries: []};
const reputation = {schema_version: 'player.reputation.public.v1', rule_version: 'reputation.rules.v1', player: {player_id: 'PLAYER-1', display_name: 'CipherCuttle'}, metrics: {ships: 0, shipped_assists: 0, shipped_projects_assisted: 0, collaborative_ships: 0, tested_shipped_projects: 0}, cheevos: []};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});
}

async function routeIntegratedApp(page: Page) {
  const responses: Record<string, unknown> = {
    '/v1/me/command': command,
    '/v1/projects/P-LIVE-001/private': project,
    '/v1/projects/P-LIVE-001/help-loop': help,
    '/v1/projects/P-LIVE-001/external-tests': externalTests,
    '/v1/projects/P-LIVE-001/ship': ship,
    '/v1/discover/projects': projects,
    '/v1/discover/players': players,
    '/v1/world/signals': signals,
    '/v1/me': me,
    '/v1/me/profile': profile,
    '/v1/me/history': history,
    '/v1/players/PLAYER-1/reputation': reputation,
  };

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'artifact.example') {
      await route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><title>Artifact</title><div>artifact preview</div>'});
      return;
    }
    if (url.pathname in responses) {
      await fulfillJson(route, responses[url.pathname]);
      return;
    }
    await route.continue();
  });
}

async function expectMode(page: Page, mode: 'world' | 'command' | 'project' | 'player' | 'ship') {
  const shell = page.locator('[data-shell="terminal"]');
  await expect(shell).toHaveAttribute('data-shell-variant', 'v2');
  await expect(shell).toHaveAttribute('data-mode', mode);
  await expect(page).toHaveURL(new RegExp(`[?&]mode=${mode}(?:&|$)`));
  await expect(page.locator(`button[data-mode="${mode}"]`)).toHaveAttribute('aria-pressed', 'true');
  for (const candidate of ['world', 'command', 'project', 'player', 'ship']) {
    await expect(page.locator(`button[data-mode="${candidate}"]`)).toBeEnabled();
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth}));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test('integrated Instrument OS switches all five live surfaces in-place and preserves browser history', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await routeIntegratedApp(page);

  await page.goto('/?mode=command');
  await expectMode(page, 'command');
  await expect(page.getByRole('heading', {name: 'WEIRD LITTLE THING'}).first()).toBeVisible();

  await page.locator('button[data-mode="project"]').click();
  await expectMode(page, 'project');
  await expect(page.getByRole('heading', {name: 'Current records'})).toBeVisible();

  await page.locator('button[data-mode="world"]').click();
  await expectMode(page, 'world');
  await expect(page.getByRole('heading', {name: 'Public signal.'})).toBeVisible();

  await page.locator('button[data-mode="player"]').click();
  await expectMode(page, 'player');
  await expect(page.getByRole('heading', {name: 'Builder history.'})).toBeVisible();

  await page.locator('button[data-mode="ship"]').click();
  await expectMode(page, 'ship');
  await expect(page.getByRole('heading', {name: 'WEIRD LITTLE THING'})).toBeVisible();

  await page.evaluate(() => window.history.back());
  await expectMode(page, 'player');
  await page.evaluate(() => window.history.forward());
  await expectMode(page, 'ship');

  await expectNoHorizontalOverflow(page);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test('integrated Instrument OS keeps every live mode usable on the 390px rehearsal viewport', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await routeIntegratedApp(page);

  await page.goto('/?mode=world');
  for (const mode of ['world', 'command', 'project', 'player', 'ship'] as const) {
    if (mode !== 'world') await page.locator(`button[data-mode="${mode}"]`).click();
    await expectMode(page, mode);
    await expectNoHorizontalOverflow(page);
  }

  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
