import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page} from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test('Stage E default root exposes Challenge-first IA without reviving legacy navigation', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/');

  await expect(page.locator('main.challenge-product')).toHaveAttribute('data-challenge-surface', 'discover');
  await expect(page.getByRole('heading', {name: 'CHALLENGES', exact: true})).toBeVisible();
  const nav = page.getByRole('navigation', {name: 'Challenge product'});
  await expect(nav.getByRole('button')).toHaveCount(2);
  await expect(nav.getByRole('button', {name: /CREATE/i})).toBeVisible();
  await expect(nav.getByRole('button', {name: /OPERATOR/i})).toHaveCount(0);
  await expect(nav.getByRole('button', {name: /^WORLD$/i})).toHaveCount(0);
  await expect(nav.getByRole('button', {name: /^COMMAND$/i})).toHaveCount(0);
  await expect(page.getByText(/No open challenges to show yet/i)).toBeVisible();
  await expect(page.locator('[data-surface-state="unavailable_or_stale"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const accessibility = await new AxeBuilder({page}).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('Stage E Compiler/Create is usable on mobile and keeps uncompiled source truthful', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/?surface=compiler');

  await expect(page.locator('main.challenge-product')).toHaveAttribute('data-challenge-surface', 'compiler');
  await expect(page.getByRole('heading', {name: 'CREATE A CHALLENGE'})).toBeVisible();
  const sourceIntent = page.getByLabel('WHAT DO YOU WANT BUILT?');
  await sourceIntent.fill('Build a realtime public launch dashboard');
  await expect(page.getByText('SOURCE DRAFT / UNCOMPILED')).toBeVisible();
  await expect(page.getByText(/Unknown requirements stay UNKNOWN/i)).toBeVisible();
  await expect(page.getByRole('button', {name: /CHECK THE SPEC/i})).toBeEnabled();
  await expect(page.getByText('REALTIME', {exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'WHAT COUNTS AS DONE'})).toBeVisible();
  await expect(page.getByText(/A DRAFT CHALLENGE IS REQUIRED/i)).toBeVisible();
  await expect(page.getByRole('button', {name: /REVIEW LOCKED VERSION/i})).toBeDisabled();
  await expect(page.getByRole('button', {name: /LOCK CHALLENGE RULES/i})).toBeDisabled();
  await expectNoHorizontalOverflow(page);

  const accessibility = await new AxeBuilder({page}).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('Stage E remains legible with reduced motion requested', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/?surface=challenge');

  const reduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(reduced).toBe(true);
  await expect(page.getByRole('heading', {name: 'CHALLENGE', exact: true})).toBeVisible();
  await expect(page.getByText(/No Challenge selected/i)).toBeVisible();
  await expect(page.locator('[data-surface-state="empty"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});