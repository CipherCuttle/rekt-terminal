import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page} from '@playwright/test';
import type {PlayerHistoryView, PlayerProfileView, PlayerReputationView, PrivatePlayer} from '../src/generated/inkubator-api-client';
import {fixtureConnectionContext} from './fixture-connection';

const INKUBATOR_VIEW_MODE_KEY = 'rekt.inkubator.ui-mode.v1';
const me: PrivatePlayer = {schema_version: 'player.private.v1', player_id: 'PLAYER-E2E', display_name: 'CipherCuttle', created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-10T08:00:00Z'};
const profile: PlayerProfileView = {schema_version: 'player.profile.v2', player_id: 'PLAYER-E2E', bio: 'Builds strange useful things.', character_name: 'ink.operator', character_archetype: 'BUILDER', skills_needed: ['QA'], can_help_with: ['UI', 'SYSTEMS']};
const history: PlayerHistoryView = {schema_version: 'player.history.private.v1', player_id: 'PLAYER-E2E', entries: [
  {entry_id: 'H-E2E-1', kind: 'MISSION_BLOCKED', truth_state: 'CLAIMED', occurred_at: '2026-09-08T10:00:00Z', project_id: 'P-1', project_name: 'REKT MACHINE', mission_id: 'M-1'},
  {entry_id: 'H-E2E-2', kind: 'EXTERNAL_TEST_RECORDED', truth_state: 'OBSERVED', occurred_at: '2026-09-09T10:00:00Z', project_id: 'P-1', project_name: 'REKT MACHINE', test_result_id: 'TEST-1', outcome: 'PASS'},
  {entry_id: 'H-E2E-3', kind: 'SHIP_ACCEPTED', truth_state: 'PROVEN', occurred_at: '2026-09-10T10:00:00Z', project_id: 'P-1', project_name: 'REKT MACHINE', mission_id: 'M-1', receipt_id: 'R-1', artifact_title: 'REKT MACHINE', role: 'OWNER'},
]};
const reputation: PlayerReputationView = {schema_version: 'player.reputation.public.v1', rule_version: 'reputation.rules.v1', player: {player_id: 'PLAYER-E2E', display_name: 'CipherCuttle'}, metrics: {ships: 1, shipped_assists: 2, shipped_projects_assisted: 1, collaborative_ships: 1, tested_shipped_projects: 3}, cheevos: [{key: 'WORKING_URL_OR_GTFO', label: 'Working URL or GTFO', description: 'Accepted Ship backed by the versioned rule.', rule_version: 'cheevo.rules.v1', truth_state: 'PROVEN', earned_at: '2026-09-10T10:00:01Z', evidence: {source_type: 'RECEIPT', source_id: 'R-1'}}]};

async function routePlayer(page: Page, overrides: Partial<Record<string, {status: number; body: unknown}>> = {}) {
  await page.route('**/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const defaults: Record<string, {status: number; body: unknown}> = {
      '/v1/me': {status: 200, body: me},
      '/v1/me/connection': {status: 200, body: fixtureConnectionContext},
      '/v1/me/profile': {status: 200, body: profile},
      '/v1/me/history': {status: 200, body: history},
      '/v1/players/PLAYER-E2E/reputation': {status: 200, body: reputation},
    };
    const response = overrides[pathname] ?? defaults[pathname];
    if (!response) return route.fulfill({status: 500, contentType: 'application/json', body: JSON.stringify({error: 'unmocked_v1_route'})});
    await route.fulfill({status: response.status, contentType: 'application/json', body: JSON.stringify(response.body)});
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth}));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test.beforeEach(async ({page}) => {
  await page.addInitScript((key) => window.localStorage.setItem(key, 'ADVANCED'), INKUBATOR_VIEW_MODE_KEY);
});

test('LIVE PLAYER renders the approved durable-record composition from canonical projections', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await routePlayer(page);
  await page.goto('/?mode=player');

  await expect(page.getByRole('heading', {name: 'Builder history.'})).toBeVisible();
  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-shell-variant', 'v2');
  await expect(page.getByRole('heading', {name: 'ink.operator'})).toBeVisible();
  await expect(page.getByText('Builds strange useful things.')).toBeVisible();
  await expect(page.getByText('BUILDER', {exact: true})).toBeVisible();
  await expect(page.getByText('Working URL or GTFO')).toBeVisible();
  await expect(page.getByText('RECEIPT:R-1')).toBeVisible();
  await expect(page.getByText('SEQUENCE, NOT A PROGRESS SCORE')).toBeVisible();
  await expect(page.locator('[data-truth="proven"]')).not.toHaveCount(0);

  const first = page.locator('[data-player-history-id="H-E2E-1"]');
  await first.focus();
  await page.keyboard.press('End');
  await expect(page.locator('[data-player-history-id="H-E2E-3"]')).toBeFocused();
  await expect(page.locator('[data-player-history-id="H-E2E-3"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('complementary', {name: 'Selected builder record'}).getByText('R-1')).toBeVisible();

  await expectNoHorizontalOverflow(page);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test('LIVE PLAYER keeps optional failures isolated on mobile and never substitutes fixture career state', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await routePlayer(page, {
    '/v1/me/profile': {status: 503, body: {error: 'profile_offline'}},
    '/v1/me/history': {status: 503, body: {error: 'history_offline'}},
    '/v1/players/PLAYER-E2E/reputation': {status: 503, body: {error: 'reputation_offline'}},
  });
  await page.goto('/?mode=player');

  await expect(page.getByRole('heading', {name: 'CipherCuttle'})).toBeVisible();
  await expect(page.getByText('PROFILE LINK UNAVAILABLE')).toBeVisible();
  await expect(page.getByText('HISTORY LINK UNAVAILABLE')).toBeVisible();
  await expect(page.getByText('REPUTATION LINK UNAVAILABLE')).toBeVisible();
  await expect(page.getByText('Working URL or GTFO')).toHaveCount(0);
  await expect(page.getByText('REKT MACHINE')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test('LIVE PLAYER presents GitHub identity bootstrap when private identity is unavailable', async ({page}) => {
  await routePlayer(page, {
    '/v1/me': {status: 401, body: {error: 'session_required'}},
    '/v1/me/connection': {status: 401, body: {error: 'session_required'}},
  });
  await page.goto('/?mode=player');

  await expect(page.getByLabel('PLAYER workspace').getByRole('heading', {name: 'KEEP YOUR RECORD.'})).toBeVisible();
  await expect(page.getByRole('link', {name: /ENTER WITH GITHUB/})).toHaveAttribute('href', '/v1/auth/github/start');
  await expect(page.getByRole('heading', {name: 'Builder history.'})).toHaveCount(0);
  await expect(page.getByText(/Repository access is a separate read-only GitHub App permission after sign-in/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
