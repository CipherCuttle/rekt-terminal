import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page} from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test('Stage I default root exposes one white Challenge front door without reviving legacy navigation', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/');

  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-shell-variant', 'v2');
  await expect(page.getByRole('heading', {name: 'WHAT ARE YOU HERE TO DO?', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'ONE FRONT DOOR.', exact: true})).toBeVisible();
  const nav = page.getByRole('navigation', {name: 'Inkubator journey'});
  await expect(nav.getByText('DISCOVER / START', {exact: true})).toBeVisible();
  await expect(nav.getByText('COMPILER / CREATE', {exact: true})).toBeVisible();
  await expect(nav.getByText('CHALLENGE', {exact: true})).toBeVisible();
  await expect(nav.getByText('MY BUILD', {exact: true})).toBeVisible();
  await expect(nav.getByText('REVIEW / TEST ARENA', {exact: true})).toBeVisible();
  await expect(nav.getByText('RECEIPT / HISTORY', {exact: true})).toBeVisible();
  await expect(page.getByRole('link', {name: /CREATE A CHALLENGE/i})).toBeVisible();
  await expect(page.getByLabel(/CHALLENGE LINK OR ID/i)).toBeVisible();
  await expect(page.getByText(/^WORLD$/i)).toHaveCount(0);
  await expect(page.getByText(/^COMMAND$/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const accessibility = await new AxeBuilder({page}).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('Stage I Compiler/Create is usable on mobile and keeps uncompiled source truthful', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/?surface=compiler');

  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-shell-variant', 'v2');
  await expect(page.locator('main.challenge-product')).toHaveAttribute('data-challenge-surface', 'compiler');
  await expect(page.getByRole('heading', {name: 'COMPILER / CREATE'})).toBeVisible();
  const sourceIntent = page.getByLabel('SOURCE INTENT');
  await sourceIntent.fill('Build a realtime public launch dashboard');
  await expect(page.getByText('SOURCE DRAFT / UNCOMPILED')).toBeVisible();
  await expect(page.getByText(/Unknown requirements stay UNKNOWN/i)).toBeVisible();
  await expect(page.getByRole('button', {name: /COMPILE DETERMINISTIC STATE/i})).toBeEnabled();
  await expect(page.getByText('REALTIME', {exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'NEGOTIATED BUILD CONTRACT'})).toBeVisible();
  await expect(page.getByText(/SELECT A DRAFT CHALLENGE/i)).toBeVisible();
  await expect(page.getByRole('button', {name: /FREEZE NONCANONICAL PREVIEW/i})).toBeDisabled();
  await expect(page.getByRole('button', {name: /PERSIST CANONICAL CONTRACT/i})).toBeDisabled();
  await expectNoHorizontalOverflow(page);

  const accessibility = await new AxeBuilder({page}).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('Stage I remains legible with reduced motion requested', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/?surface=challenge');

  const reduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(reduced).toBe(true);
  await expect(page.getByRole('heading', {name: 'CHALLENGE', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'No Challenge selected.', exact: true})).toBeVisible();
  await expect(page.locator('[data-surface-state="empty"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});