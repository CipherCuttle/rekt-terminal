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

const commandEndpoint = /\/v1\/me\/command(?:\?.*)?$/;

async function routeCommand(page: Page, read: () => CommandView) {
  await page.route(commandEndpoint, async (route) => {
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(read())});
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth}));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test('LIVE COMMAND renders canonical backend state and ripples projection deltas without recreating Pixi', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  let current = commandView();
  await routeCommand(page, () => current);

  await page.goto('/?mode=command');
  await expect(page.getByRole('heading', {name: 'WEIRD LITTLE THING'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'CONNECT THE LIVE COMMAND BUS'})).toBeVisible();
  await expect(page.getByText('PRIVATE')).toBeVisible();
  await expect(page.getByText('ADVISORY ONLY')).toBeVisible();
  await expect(page.getByText('CLAIMED ≠ OBSERVED ≠ PROVEN')).toBeVisible();
  await expect(page.locator('[data-renderer="pixi"] canvas')).toBeVisible();
  await expect(page.locator('[data-renderer="pixi"]')).toHaveAttribute('data-app-generation', '1');

  const provenGate = page.locator('.command-gates [data-truth="proven"]');
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
  await expect(page.getByText('ADVISORY ONLY')).toBeVisible();
  await expect(page.locator('[data-renderer="pixi"]')).toHaveAttribute('data-app-generation', '1');

  const results = await new AxeBuilder({page}).analyze();
  expect(results.violations).toEqual([]);
});

test('LIVE COMMAND ship-ready projection stays readable on mobile and reduced motion', async ({page}) => {
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
  await routeCommand(page, () => shipReady);

  await page.goto('/?mode=command');
  await expect(page.getByRole('heading', {name: 'OPEN SHIP REVIEW'})).toBeVisible();
  await expect(page.locator('.command-live')).toHaveAttribute('data-motion-policy', 'reduced');
  await expect(page.locator('[data-renderer="pixi"]')).toHaveAttribute('data-motion-policy', 'reduced');
  await expect(page.locator('.command-gates [data-truth="proven"]')).toHaveCount(4);
  await expect(page.locator('[data-renderer="pixi"] canvas')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('LIVE COMMAND fails closed when the canonical command endpoint is unavailable', async ({page}) => {
  await page.route(commandEndpoint, async (route) => {
    await route.fulfill({status: 401, contentType: 'application/json', body: JSON.stringify({error: 'session_required'})});
  });

  await page.goto('/?mode=command');
  await expect(page.getByRole('heading', {name: 'COMMAND LINK UNAVAILABLE'})).toBeVisible({timeout: 6000});
  await expect(page.getByText('session_required')).toBeVisible();
  await expect(page.getByText('No development fixture fallback is permitted.')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'WEIRD LITTLE THING'})).toHaveCount(0);
});
