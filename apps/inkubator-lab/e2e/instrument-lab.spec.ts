import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

test('Instrument Lab exposes the ten-primitives calibration surface on desktop', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/?lab=instrument');
  await expect(page.getByRole('heading', {name: 'INSTRUMENT / MOTION LAB'})).toBeVisible();
  await expect(page.getByText(/Synthetic state only/i)).toBeVisible();
  await expect(page.locator('[data-testid="instrument-primitive"]')).toHaveCount(10);
  await page.getByRole('button', {name: 'ERROR'}).click();
  await expect(page.locator('.ios-lab')).toHaveAttribute('data-state', 'error');
  await expect(page.getByText('BLOCKER DETECTED')).toBeVisible();
  const results = await new AxeBuilder({page}).analyze();
  expect(results.violations).toEqual([]);
});

test('Instrument Lab remains bounded and readable on mobile/reduced-motion', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/?lab=instrument');
  await expect(page.getByRole('heading', {name: 'INSTRUMENT / MOTION LAB'})).toBeVisible();
  const overflow = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth}));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
  await page.getByRole('button', {name: 'SHIP'}).click();
  await expect(page.locator('.ios-lab')).toHaveAttribute('data-mode', 'ship');
});
