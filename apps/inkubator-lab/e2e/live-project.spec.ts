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
      await route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html lang="en"><title>Test artifact</title><body style="margin:0;background:#0b0b0e;color:#99959f;font:12px monospace;padding:24px"><main><p style="font-size:10px;letter-spacing:.12em">TEST ARTIFACT / SYNTHETIC</p><p style="color:#e8e4da;font:24px Arial">Weird Little Thing v1</p><p>Sandboxed preview response. No deployment proof.</p></main></body></html>'});
      return;
    }
    const response = responses[url.pathname];
    if (!response) {
      await route.continue();
      return;
    }
    await route.fulfill({status: response.status, contentType: 'application/json', body: JSON.stringify(response.body)});
  });
  return responses;
}

async function captureEvidence(page: Page, name: string) {
  const preview = page.getByTitle('Weird Little Thing v1 artifact preview');
  if (await preview.count()) {
    await preview.scrollIntoViewIfNeeded();
    await expect(page.frameLocator('iframe').getByText('TEST ARTIFACT / SYNTHETIC')).toBeVisible();
    // Chromium can omit offscreen cross-origin frame pixels in a full-page
    // capture. Keep a real viewport capture of the loaded artifact as well.
    await page.screenshot({path: `/tmp/rekt-project-v1-evidence/${name}-artifact-detail.png`});
    await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
  }
  // Evidence labeling belongs to the browser harness, never the live route.
  await page.evaluate(() => {
    const label = document.createElement('aside');
    label.setAttribute('aria-label', 'Browser test evidence');
    label.textContent = 'BROWSER TEST / SYNTHETIC API RESPONSES';
    label.style.cssText = 'padding:6px 22px;background:#050506;color:#e7b16b;font:10px monospace;letter-spacing:.06em';
    document.body.prepend(label);
  });
  await page.screenshot({path: `/tmp/rekt-project-v1-evidence/${name}-viewport.png`});
  await page.screenshot({path: `/tmp/rekt-project-v1-evidence/${name}.png`, fullPage: true});
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth}));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test('LIVE PROJECT renders canonical workstation projections without promoting observed ship state', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await routeProject(page);

  await page.goto('/?mode=project');
  await expect(page.getByRole('heading', {name: 'WEIRD LITTLE THING'})).toBeVisible();
  await expect(page.getByRole('main', {name: 'Project instrument'})).toHaveCount(1);
  await expect(page.getByRole('region', {name: 'Living Project Thread'})).toHaveCount(1);
  await expect(page.getByRole('region', {name: 'Current locus'})).toHaveCount(1);
  await expect(page.getByRole('region', {name: 'Current locus'})).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('region', {name: 'Next Move'})).toHaveCount(1);
  await expect(page.getByRole('region', {name: 'Next Move'}).getByRole('heading')).toHaveText(project.next_move);
  await expect(page.getByText('CipherCuttle/weird-little-thing')).toBeVisible();
  await expect(page.getByText('Need one external tester.')).toBeVisible();
  await expect(page.getByText('Helper')).toBeVisible();
  await expect(page.getByText('Core flow works.')).toBeVisible();
  await expect(page.locator('.project-artifact')).toHaveAttribute('data-truth', 'unproven');
  await expect(page.locator('.project-artifact iframe')).toBeVisible();
  await expect(page.locator('.project-artifact [data-truth="proven"]')).toHaveCount(0);
  await expect(page.getByText('CLAIMED ≠ OBSERVED ≠ PROVEN')).toBeVisible();
  await expect(page.getByText('URL SUPPLIED / CLAIMED')).toBeVisible();
  await expect(page.getByText('ACCEPTANCE NOT ESTABLISHED')).toBeVisible();
  await expect(page.getByText('Verifier response ≠ accepted Ship.')).toBeVisible();
  await expect(page.getByTitle('Weird Little Thing v1 artifact preview')).toHaveAttribute('sandbox', 'allow-scripts allow-forms allow-popups');
  await expect(page.getByTitle('Weird Little Thing v1 artifact preview')).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expectNoHorizontalOverflow(page);

  const results = await new AxeBuilder({page}).analyze();
  expect(results.violations).toEqual([]);
  await captureEvidence(page, 'desktop-1440x900');
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
  await expect(page.getByText('HELP LINK UNAVAILABLE')).toBeVisible({timeout: 6000});
  await expect(page.getByText('TEST LINK UNAVAILABLE')).toBeVisible();
  await expect(page.getByText('SHIP LINK UNAVAILABLE').first()).toBeVisible();
  await expect(page.getByText('CipherCuttle/weird-little-thing')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await captureEvidence(page, 'mobile-unavailable-390x844');
});

test('mobile preserves identity, current locus, Next Move, and attached evidence ordering with reduced motion', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  const responses = await routeProject(page);
  await page.goto('/?mode=project');
  const identity = page.getByRole('heading', {name: project.name});
  const thread = page.getByRole('region', {name: 'Living Project Thread'});
  const locus = page.getByRole('region', {name: 'Current locus'});
  const next = page.getByRole('region', {name: 'Next Move'});
  const artifact = page.getByRole('region', {name: 'Artifact and deployment'});
  await expect(page.getByText('Core flow works.')).toBeVisible();
  const boxes = await Promise.all([identity, thread, locus, next, artifact].map(locator => locator.boundingBox()));
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y);
  expect(boxes[3]!.y).toBeLessThan(844);
  await expect(page.getByRole('region', {name: 'Ship boundary'})).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await captureEvidence(page, 'mobile-390x844');

  const summary = next.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(next.getByText(/This control opens context/)).toBeVisible();
  await expect(next.getByRole('list', {name: 'Mission gates'})).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(next.getByRole('list', {name: 'Mission gates'})).not.toBeVisible();
  responses['/v1/projects/P-LIVE-001/private'] = {status: 200, body: {...project, current_focus: 'Inspect the returned test.', next_move: 'Review external feedback'}};
  await expect(locus.getByRole('heading')).toHaveText('Inspect the returned test.');
  await expect(next.getByRole('heading')).toHaveText('Review external feedback');
  await expect(locus).toHaveCount(1);
  await expect(page.getByText('ACCEPTED / PROVEN')).toHaveCount(0);
});

for (const endpoint of ['/v1/me/command', '/v1/projects/P-LIVE-001/private']) {
  test(`core failure closes PROJECT after cached success: ${endpoint}`, async ({page}) => {
    const responses = await routeProject(page);
    await page.goto('/?mode=project');
    await expect(page.getByRole('region', {name: 'Living Project Thread'})).toBeVisible();
    responses[endpoint] = {status: 503, body: {error: 'core_unavailable'}};
    await expect(page.getByRole('heading', {name: 'PROJECT LINK UNAVAILABLE'})).toBeVisible();
    await expect(page.getByRole('region', {name: 'Living Project Thread'})).toHaveCount(0);
    await expect(page.getByRole('region', {name: 'Next Move'})).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.getByText('No development fixture fallback is permitted.')).toBeVisible();
  });
}

test('optional failures remove cached results and artifact throughout the instrument', async ({page}) => {
  const responses = await routeProject(page);
  await page.goto('/?mode=project');
  await expect(page.getByText('Core flow works.')).toBeVisible();
  for (const endpoint of ['help-loop', 'external-tests', 'ship']) {
    responses[`/v1/projects/P-LIVE-001/${endpoint}`] = {status: 503, body: {error: 'link_unavailable'}};
  }
  await expect(page.getByText('SHIP LINK UNAVAILABLE', {exact: true})).toBeVisible();
  await expect(page.getByText('HELP LINK UNAVAILABLE')).toBeVisible();
  await expect(page.getByText('TEST LINK UNAVAILABLE')).toBeVisible();
  await expect(page.getByText('Core flow works.')).toHaveCount(0);
  await expect(page.getByText('Need one external tester.')).toHaveCount(0);
  await expect(page.getByText('VERIFIER / PASS')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('status', {name: 'Latest recorded signal'})).not.toContainText('VERIFIER');
  await expect(page.getByRole('region', {name: 'Next Move'}).getByRole('heading')).toHaveText(project.next_move);
});

test('a test request and a Ship request remain unproven during projection updates', async ({page}) => {
  const responses = await routeProject(page, {
    '/v1/projects/P-LIVE-001/external-tests': {status: 200, body: {...externalTests, results: [], requests: [{...externalTests.requests[0], state: 'OPEN'}]}},
    '/v1/projects/P-LIVE-001/ship': {status: 200, body: {...ship, latest_submission: {...ship.latest_submission, state: 'SUBMITTED', verifier_observation: undefined}}},
  });
  await page.goto('/?mode=project');
  await expect(page.getByText('REQUEST OPEN / NO RESULT')).toBeVisible();
  await expect(page.getByRole('region', {name: 'Ship boundary'})).toContainText('SUBMITTED');
  await expect(page.getByText('PASS / OBSERVED')).toHaveCount(0);
  responses['/v1/projects/P-LIVE-001/external-tests'] = {status: 200, body: externalTests};
  responses['/v1/projects/P-LIVE-001/ship'] = {status: 200, body: ship};
  await expect(page.getByText('PASS / OBSERVED', {exact: true})).toBeVisible();
  await expect(page.getByText('VERIFIER / PASS', {exact: true})).toBeVisible();
  await expect(page.getByText('ACCEPTED / PROVEN')).toHaveCount(0);
  await expect(page.getByRole('region', {name: 'Current locus'})).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('heading', {name: project.next_move})).toBeVisible();
});
