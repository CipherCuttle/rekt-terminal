import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page} from '@playwright/test';
import type {CommandView} from '../src/generated/inkubator-api-client';

function commandView(overrides: Partial<CommandView> = {}): CommandView {
  return {
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
      ship_condition: 'A working link exists and the verifier agrees.',
      current_focus: 'Wire the canonical command projection.',
      next_move: 'CONNECT THE LIVE COMMAND BUS',
      progress_model_version: 'mission.progress.v1',
      stack_labels: ['TYPESCRIPT'],
      stack_source: 'PLAYER_CONFIRMED',
    },
    round: {
      round_id: 'R-LIVE-001',
      code: 'R1',
      title: 'FOUNDING',
      constraint: 'Ship one working thing.',
      state: 'OPEN',
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
      latest_observation: {
        observation_id: 'OBS-LIVE-001',
        kind: 'WORKFLOW',
        outcome: 'SUCCEEDED',
        observed_at: '2026-09-08T13:00:00Z',
      },
    },
    daemon: {
      rule_version: 'daemon-advisory.v1',
      authority: 'ADVISORY_ONLY',
      what_changed: 'Workflow evidence advanced.',
      proposed_next_move: 'Keep the current slice bounded.',
    },
    ...overrides,
  };
}

type CommandRouteResponse = {status: number; body: unknown};

const authenticatedMe = {
  schema_version: 'player.private.v1',
  player_id: 'PLAYER-LIVE-001',
  display_name: 'Builder',
  created_at: '2026-09-01T08:00:00Z',
  updated_at: '2026-09-10T08:00:00Z',
};

async function routeCommand(page: Page, respond: () => CommandRouteResponse) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/v1/me/command') {
      // Never leak an unmocked /v1 route to the (absent) backend proxy: fail closed instead.
      if (url.pathname.startsWith('/v1/')) {
        await route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({error: 'unmocked_v1_route'})});
        return;
      }
      await route.continue();
      return;
    }
    const response = respond();
    await route.fulfill({status: response.status, contentType: 'application/json', body: JSON.stringify(response.body)});
  });
  await page.route('**/v1/me', async (route) => {
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(authenticatedMe)});
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth}));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test('LIVE COMMAND renders one Living Thread and ripples canonical deltas without recreating Pixi', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  let current = commandView();
  await routeCommand(page, () => ({status: 200, body: current}));

  await page.goto('/?mode=command');
  await expect(page.getByRole('heading', {name: 'WEIRD LITTLE THING'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Ship one real working thing.'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'CONNECT THE LIVE COMMAND BUS'})).toBeVisible();
  await expect(page.getByText('GITHUB / PRIVATE')).toBeVisible();
  await expect(page.getByText('ADVISORY ONLY')).toBeVisible();
  await expect(page.getByText('CLAIMED ≠ OBSERVED ≠ PROVEN')).toBeVisible();
  await expect(page.getByLabel('Living Thread mission instrument')).toBeVisible();
  // One retained instrument shell: canonical deltas ripple in place, no surface recreation.
  await expect(page.locator('[data-shell="terminal"]')).toHaveCount(1);

  const provenGate = page.locator('.command-thread-gates [data-truth="proven"]');
  await expect(provenGate).toHaveCount(1);
  await expect(provenGate.getByText('PROVEN')).toBeVisible();

  current = commandView({
    mission: {...current.mission, state: 'BLOCKED', blocker: 'Need an external tester before ship.'},
    gates: current.gates.map((gate) => gate.key === 'QUALITY_TESTING' ? {...gate, state: 'BLOCKED'} : gate),
    daemon: {
      ...current.daemon,
      what_changed: 'Testing evidence stopped advancing.',
      likely_blocker: 'No external test result has been observed.',
      proposed_next_move: 'Ask for one external test.',
    },
  });

  await expect.poll(async () => page.locator('.command-live').getAttribute('data-event-sequence'), {timeout: 7000}).toBe('1');
  await expect(page.getByText(/EVENT \/\/ GATE:QUALITY_TESTING → BLOCKER → MISSION → DAEMON/i)).toBeVisible();
  await expect(page.getByText('Need an external tester before ship.')).toBeVisible();
  await expect(page.locator('.command-thread-break')).toBeVisible();
  await expect(page.getByText('ADVISORY ONLY')).toBeVisible();
  await expect(page.locator('[data-shell="terminal"]')).toHaveCount(1);

  const results = await new AxeBuilder({page}).analyze();
  expect(results.violations).toEqual([]);
  await expectNoHorizontalOverflow(page);
});

test('LIVE COMMAND proof projection stays readable on mobile and reduced motion', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  const base = commandView();
  const shipReady = commandView({
    mission: {
      ...base.mission,
      state: 'SHIP_READY',
      current_focus: 'Verifier accepted the current evidence.',
      next_move: 'OPEN SHIP REVIEW',
    },
    gates: base.gates.map((gate) => ({...gate, state: 'PROVEN'})),
  });
  await routeCommand(page, () => ({status: 200, body: shipReady}));

  await page.goto('/?mode=command');
  await expect(page.getByRole('heading', {name: 'OPEN SHIP REVIEW'})).toBeVisible();
  await expect(page.locator('.command-live')).toHaveAttribute('data-motion-policy', 'reduced');
  await expect(page.locator('.command-thread-gates [data-truth="proven"]')).toHaveCount(4);
  await expect(page.getByRole('link', {name: 'OPEN SHIP →'})).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('LIVE COMMAND fails closed when the canonical command endpoint is unavailable', async ({page}) => {
  await routeCommand(page, () => ({status: 401, body: {error: 'session_required'}}));

  await page.goto('/?mode=command');
  await expect(page.getByRole('heading', {name: 'COMMAND LINK UNAVAILABLE'})).toBeVisible({timeout: 6000});
  await expect(page.getByText('session_required')).toBeVisible();
  await expect(page.getByText('No development fixture fallback is permitted.')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'WEIRD LITTLE THING'})).toHaveCount(0);
});
