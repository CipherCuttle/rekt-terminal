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
  await expect(page.getByRole('heading', {name: 'DISCOVER'})).toBeVisible();
  const nav = page.getByRole('navigation', {name: 'Challenge product'});
  await expect(nav.getByRole('button')).toHaveCount(7);
  await expect(nav.getByRole('button', {name: /COMPILER \/ CREATE/i})).toBeVisible();
  await expect(nav.getByRole('button', {name: /OPERATOR EXCEPTIONS/i})).toBeVisible();
  await expect(nav.getByRole('button', {name: /^WORLD$/i})).toHaveCount(0);
  await expect(nav.getByRole('button', {name: /^COMMAND$/i})).toHaveCount(0);
  await expect(page.getByText(/Challenge discovery transport is not exposed yet/i)).toBeVisible();
  await expect(page.locator('[data-surface-state="unavailable_or_stale"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const accessibility = await new AxeBuilder({page}).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('Stage E Compiler/Create is usable on mobile without inventing a compile result', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/?surface=compiler');

  await expect(page.locator('main.challenge-product')).toHaveAttribute('data-challenge-surface', 'compiler');
  await expect(page.getByRole('heading', {name: 'COMPILER / CREATE'})).toBeVisible();
  const sourceIntent = page.getByLabel('SOURCE INTENT');
  await sourceIntent.fill('Build a realtime public launch dashboard');
  await expect(page.getByText('DRAFT CAPTURED LOCALLY')).toBeVisible();
  await expect(page.getByText(/Compiler state is not generated yet/i)).toBeVisible();
  await expect(page.getByRole('button', {name: /COMPILE — TRANSPORT WIRING NEXT/i})).toBeDisabled();
  await expectNoHorizontalOverflow(page);
});

test('Stage E remains legible with reduced motion requested', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/?surface=challenge');

  const reduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(reduced).toBe(true);
  await expect(page.getByRole('heading', {name: 'CHALLENGE'})).toBeVisible();
  await expect(page.getByText(/No Challenge selected/i)).toBeVisible();
  await expect(page.locator('[data-surface-state="empty"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
