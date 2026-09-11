import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page} from '@playwright/test';
import type {CommandView, PrivateProject, ProjectExternalTestsView, ProjectHelpLoopView, ProjectShipStateView} from '../src/generated/inkubator-api-client';

const command: CommandView = {
  schema_version: 'command.private.v2',
  project: {project_id: 'P-LIVE-001', name: 'WEIRD LITTLE THING', source_connected: true, source_visibility: 'PRIVATE', observation_state: 'OBSERVED'},
  mission: {mission_id: 'M-LIVE-001', state: 'BUILDING', goal: 'Ship one real working thing.', ship_condition: 'A working link exists.', current_focus: 'Wire project.', next_move: 'PROVE PROJECT', progress_model_version: 'mission.progress.v1', stack_labels: ['TYPESCRIPT'], stack_source: 'PLAYER_CONFIRMED'},
  gates: [
    {key: 'FOUNDATION', label: 'FOUNDATION', state: 'PROVEN', position: 1},
    {key: 'CORE_EXPERIENCE', label: 'CORE EXPERIENCE', state: 'OBSERVED', position: 2},
    {key: 'QUALITY_TESTING', label: 'QUALITY TESTING', state: 'ACTIVE', position: 3},
    {key: 'SHIPABILITY', label: 'SHIPABILITY', state: 'UNKNOWN', position: 4},
  ],
  github_evidence: {rule_version: 'github-evidence.v1', source_state: 'AVAILABLE', signal_state: 'OBSERVED', stale_after_ms: 300000, invalid_observation_count: 0, reason_code: 'latest_observation_current', observed_stacks: ['JAVASCRIPT_TYPESCRIPT']},
  daemon: {rule_version: 'daemon-advisory.v1', authority: 'ADVISORY_ONLY', what_changed: 'Project changed.', proposed_next_move: 'Keep scope bounded.'},
};

const me = {
  schema_version: 'player.private.v1',
  player_id: 'PLAYER-1',
  display_name: 'Builder',
  created_at: '2026-09-01T08:00:00Z',
  updated_at: '2026-09-10T08:00:00Z',
};

const project: PrivateProject = {
  schema_version: 'project.private.v2', project_id: 'P-LIVE-001', owner_player_id: 'PLAYER-1', name: 'WEIRD LITTLE THING', mission_id: 'M-LIVE-001', mission_state: 'BUILDING',
  goal: 'Ship one real working thing.', ship_condition: 'A working link exists.', current_focus: 'Wire project.', next_move: 'PROVE PROJECT', source_connected: true,
  source_visibility: 'PRIVATE', observation_state: 'OBSERVED', repository_id: '123', repository_full_name: 'CipherCuttle/weird-little-thing', repository_private: true, repository_active: true, last_ref: 'refs/heads/main',
};

const help: ProjectHelpLoopView = {
  schema_version: 'project.help_loop.public.v1', project_id: 'P-LIVE-001',
  owner: {schema_version: 'player.public.v2', player_id: 'PLAYER-1', display_name: 'Builder', skills_needed: [], can_help_with: []},
  open_help_beacon: {schema_version: 'help_beacon.public.v1', beacon_id: 'B-1', project_id: 'P-LIVE-001', summary: 'Need one external tester.', skills_needed: ['QA'], state: 'OPEN'},
  party_members: [{player_id: 'PLAYER-2', display_name: 'Helper', role: 'ASSIST'}],
};

const externalTests: ProjectExternalTestsView = {
  schema_version: 'project.external_tests.public.v1', project_id: 'P-LIVE-001',
  requests: [{schema_version: 'external_test.request.public.v1', test_request_id: 'T-1', project_id: 'P-LIVE-001', prompt: 'Try the main flow.', state: 'COMPLETED'}],
  results: [{schema_version: 'external_test.result.public.v1', test_result_id: 'TR-1', test_request_id: 'T-1', project_id: 'P-LIVE-001', tester: {player_id: 'PLAYER-3', display_name: 'Tester'}, outcome: 'PASS', summary: 'Core flow works.', observed_at: '2026-09-08T13:30:00Z'}],
};

const ship: ProjectShipStateView = {
  schema_version: 'project.ship.public.v2', project_id: 'P-LIVE-001',
  latest_submission: {
    schema_version: 'ship.submission.public.v2', submission_id: 'S-1', mission_id: 'M-LIVE-001', project_id: 'P-LIVE-001', artifact: {title: 'Weird Little Thing v1', url: 'https://artifact.example/app', demo_url: 'https://artifact.example/demo'}, state: 'OBSERVED', submitted_at: '2026-09-08T13:35:00Z',
    verifier_observation: {schema_version: 'ship.verifier_observation.public.v1', outcome: 'PASS', reason_code: 'reachable', duration_ms: 120, redirects: 0, observed_at: '2026-09-08T13:36:00Z'},
  },
};

type Response = {status: number; body: unknown};

async function routeProject(page: Page, override: Partial<Record<string, Response>> = {}) {
  const responses: Record<string, Response> = {
    '/v1/me': {status: 200, body: me},
    '/v1/me/command': {status: 200, body: command},
    '/v1/projects/P-LIVE-001/private': {status: 200, body: project},
    '/v1/projects/P-LIVE-001/help-loop': {status: 200, body: help},
    '/v1/projects/P-LIVE-001/external-tests': {status: 200, body: externalTests},
    '/v1/projects/P-LIVE-001/ship': {status: 200, body: ship},
    ...override,
  };

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'artifact.example') {
      await route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><title>Artifact</title><div>artifact preview</div>'});
      return;
    }
    const response = responses[url.pathname];
    if (!response) {
      // Never leak an unmocked /v1 route to the (absent) backend proxy: fail closed instead.
      if (url.pathname.startsWith('/v1/')) {
        await route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({error: 'unmocked_v1_route'})});
        return;
      }
      await route.continue();
      return;
    }
    await route.fulfill({status: response.status, contentType: 'application/json', body: JSON.stringify(response.body)});
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth}));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test('LIVE PROJECT renders canonical v2 workstation projections without promoting observed ship state', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await routeProject(page);

  await page.goto('/?mode=project');
  await expect(page.getByRole('heading', {name: 'WEIRD LITTLE THING'})).toBeVisible();
  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-mode', 'project');
  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-shell-variant', 'v2');
  await expect(page.getByText('Wire project.', {exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Current records'})).toBeVisible();
  await expect(page.getByText('CipherCuttle/weird-little-thing').first()).toBeVisible();
  await expect(page.getByText('Need one external tester.')).toBeVisible();
  await expect(page.getByText('Core flow works.')).toBeVisible();
  await page.getByRole('button', {name: /Help \/ party/}).click();
  await expect(page.getByText('Helper')).toBeVisible();
  // An observed Ship submission is never promoted to PROVEN in the project record index.
  await expect(page.locator('.project-index [data-truth="proven"]')).toHaveCount(0);
  await expect(page.getByRole('button', {name: /Ship artifact/})).toHaveAttribute('data-truth', 'observed');
  await expect(page.getByText('CLAIMED ≠ OBSERVED ≠ PROVEN')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const results = await new AxeBuilder({page}).analyze();
  expect(results.violations).toEqual([]);
});

test('LIVE PROJECT keeps optional projection failures visible and usable on mobile', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await routeProject(page, {
    '/v1/projects/P-LIVE-001/help-loop': {status: 503, body: {error: 'help_unavailable'}},
    '/v1/projects/P-LIVE-001/external-tests': {status: 503, body: {error: 'tests_unavailable'}},
    '/v1/projects/P-LIVE-001/ship': {status: 503, body: {error: 'ship_unavailable'}},
  });

  await page.goto('/?mode=project');
  await expect(page.getByRole('heading', {name: 'WEIRD LITTLE THING'})).toBeVisible();
  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-shell-variant', 'v2');
  await expect(page.getByRole('heading', {name: 'Current records'})).toBeVisible();
  await expect(page.getByText('HELP LINK UNAVAILABLE')).toBeVisible({timeout: 6000});
  await expect(page.getByText('TEST LINK UNAVAILABLE')).toBeVisible();
  await expect(page.getByText('SHIP LINK UNAVAILABLE').first()).toBeVisible();
  await expect(page.getByText('CipherCuttle/weird-little-thing').first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
