import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page} from '@playwright/test';
import type {ProjectDiscoveryList, PublicPlayerList, WorldSignalList} from '../src/generated/inkubator-api-client';

const projects: ProjectDiscoveryList = [
  {
    schema_version: 'project.discovery.v1',
    project: {schema_version: 'project.public.v2', project_id: 'P-W-1', name: 'WEIRD LITTLE THING', mission_id: 'M-W-1', mission_state: 'BUILDING', source_connected: true, source_visibility: 'PRIVATE', observation_state: 'OBSERVED'},
    owner: {schema_version: 'player.public.v2', player_id: 'PLAYER-W-1', display_name: 'Builder', skills_needed: ['QA'], can_help_with: ['UI']},
    open_help_beacon: {schema_version: 'help_beacon.public.v1', beacon_id: 'B-W-1', project_id: 'P-W-1', summary: 'Need an external tester.', skills_needed: ['QA'], state: 'OPEN'},
  },
  {
    schema_version: 'project.discovery.v1',
    project: {schema_version: 'project.public.v2', project_id: 'P-W-2', name: 'TINY RELAY', mission_id: 'M-W-2', mission_state: 'BLOCKED', source_connected: true, source_visibility: 'PUBLIC', observation_state: 'STALE'},
    owner: {schema_version: 'player.public.v2', player_id: 'PLAYER-W-2', display_name: 'Relay Kid', skills_needed: [], can_help_with: ['RUST']},
  },
];

const players: PublicPlayerList = [
  {schema_version: 'player.public.v2', player_id: 'PLAYER-W-1', display_name: 'Builder', skills_needed: ['QA'], can_help_with: ['UI']},
  {schema_version: 'player.public.v2', player_id: 'PLAYER-W-2', display_name: 'Relay Kid', skills_needed: [], can_help_with: ['RUST']},
];

const initialSignals: WorldSignalList = [
  {schema_version: 'world.signal.public.v1', signal_id: 'SIG-W-1', kind: 'HELP_BEACON_OPENED', project_id: 'P-W-1', project_name: 'WEIRD LITTLE THING', truth_state: 'CLAIMED', occurred_at: '2026-09-08T13:00:00Z'},
  {schema_version: 'world.signal.public.v1', signal_id: 'SIG-W-2', kind: 'EXTERNAL_TEST_RECORDED', project_id: 'P-W-2', project_name: 'TINY RELAY', truth_state: 'OBSERVED', occurred_at: '2026-09-08T13:10:00Z'},
];

type RouteResponse = {status: number; body: unknown};

async function routeWorld(page: Page, getSignals: () => WorldSignalList, overrides: Partial<Record<string, RouteResponse>> = {}) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const defaults: Record<string, RouteResponse> = {
      '/v1/discover/projects': {status: 200, body: projects},
      '/v1/discover/players': {status: 200, body: players},
      '/v1/world/signals': {status: 200, body: getSignals()},
    };
    const response = overrides[url.pathname] ?? defaults[url.pathname];
    if (!response) {
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

test('LIVE WORLD renders the v2 public pulse/radar and animates only a newly observed feed signal', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  let currentSignals = initialSignals;
  await routeWorld(page, () => currentSignals);

  await page.goto('/?mode=world');
  await expect(page.getByRole('heading', {name: 'UNDERGROUND BUILD NETWORK'})).toBeVisible();
  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-mode', 'world');
  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-shell-variant', 'v2');
  await expect(page.getByRole('region', {name: 'Public network pulse'})).toBeVisible();
  await expect(page.getByText('1 OPEN HELP BEACON')).toBeVisible();
  await expect(page.getByRole('img', {name: 'Public Inkubator project and signal radar'})).toBeVisible();
  await expect(page.getByText('Need an external tester.')).toHaveCount(2);
  await expect(page.getByText('EXTERNAL TEST RECORDED')).toHaveCount(2);
  await expect(page.locator('[data-truth="proven"]')).toHaveCount(0);
  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-event-sequence', '0');

  currentSignals = [
    {schema_version: 'world.signal.public.v1', signal_id: 'SIG-W-3', kind: 'ASSIST_ACCEPTED', project_id: 'P-W-1', project_name: 'WEIRD LITTLE THING', truth_state: 'OBSERVED', occurred_at: '2026-09-08T13:20:00Z'},
    ...initialSignals,
  ];
  await expect(page.getByText('ASSIST ACCEPTED')).toHaveCount(2, {timeout: 6000});
  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-event-sequence', '1');
  await expect(page.locator('[data-signal-id="SIG-W-3"]')).toHaveCount(2);
  await expectNoHorizontalOverflow(page);

  const results = await new AxeBuilder({page}).analyze();
  expect(results.violations).toEqual([]);
});

test('LIVE WORLD keeps available public projects visible when other feeds fail on mobile', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await routeWorld(page, () => initialSignals, {
    '/v1/discover/players': {status: 503, body: {error: 'players_unavailable'}},
    '/v1/world/signals': {status: 503, body: {error: 'signals_unavailable'}},
  });

  await page.goto('/?mode=world');
  await expect(page.getByRole('heading', {name: 'UNDERGROUND BUILD NETWORK'})).toBeVisible();
  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-shell-variant', 'v2');
  await expect(page.getByText('Need an external tester.')).toHaveCount(2);
  await expect(page.getByText('PLAYER FEED UNAVAILABLE')).toBeVisible({timeout: 6000});
  await expect(page.getByText('SIGNAL FEED UNAVAILABLE')).toBeVisible();
  await expect(page.locator('.world-radar')).toHaveAttribute('data-motion-policy', 'reduced');
  await expectNoHorizontalOverflow(page);
});
