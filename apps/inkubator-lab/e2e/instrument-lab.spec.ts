import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

test('Instrument Lab proves GSAP event choreography and Pixi scope on desktop', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/?lab=instrument');
  await expect(page.getByRole('heading', {name: 'INSTRUMENT / MOTION LAB'})).toBeVisible();
  await expect(page.getByText(/Synthetic state only/i)).toBeVisible();
  await expect(page.locator('[data-testid="instrument-primitive"]')).toHaveCount(10);
  await expect(page.locator('.ios-lab')).toHaveAttribute('data-motion', 'gsap');
  await expect(page.locator('[data-renderer="pixi"] canvas')).toBeVisible();

  await page.getByRole('button', {name: 'ERROR'}).click();
  await expect(page.locator('.ios-lab')).toHaveAttribute('data-state', 'error');
  await expect(page.getByText('BLOCKER DETECTED')).toBeVisible();
  await expect(page.getByText(/EVENT \/\/ ERROR/i)).toBeVisible();
  await expect.poll(async () => page.locator('.ios-signal-pulse').getAttribute('cx')).toBe('252');

  const results = await new AxeBuilder({page}).analyze();
  expect(results.violations).toEqual([]);
});

test('Instrument Lab projects static truthful state on mobile/reduced-motion', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/?lab=instrument');
  await expect(page.getByRole('heading', {name: 'INSTRUMENT / MOTION LAB'})).toBeVisible();
  await expect(page.locator('.ios-lab')).toHaveAttribute('data-motion-policy', 'reduced');
  await expect(page.locator('[data-renderer="pixi"]')).toHaveAttribute('data-motion-policy', 'reduced');
  await expect(page.locator('[data-renderer="pixi"] canvas')).toBeVisible();

  const overflow = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth}));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

  await page.getByRole('button', {name: 'SUCCESS'}).click();
  await expect(page.getByText('READY TO SHIP')).toBeVisible();
  await expect(page.locator('.ios-signal-pulse')).toHaveAttribute('cx', '8');

  await page.getByRole('button', {name: 'SHIP'}).click();
  await expect(page.locator('.ios-lab')).toHaveAttribute('data-mode', 'ship');
});
