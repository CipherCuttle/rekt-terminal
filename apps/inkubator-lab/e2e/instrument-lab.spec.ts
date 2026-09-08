import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

test('Instrument Lab proves causal motion, retained Pixi and scarce proof green on desktop', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/?lab=instrument');
  await expect(page.getByRole('heading', {name: 'INSTRUMENT / MOTION LAB'})).toBeVisible();
  await expect(page.getByText(/Synthetic state only/i)).toBeVisible();
  await expect(page.locator('[data-testid="instrument-primitive"]')).toHaveCount(10);
  await expect(page.locator('.ios-lab')).toHaveAttribute('data-motion', 'gsap');
  await expect(page.locator('.ios-lab')).toHaveAttribute('data-crt', 'off');
  await expect(page.locator('[data-renderer="pixi"]')).toHaveAttribute('data-renderer-lifecycle', 'retained');
  await expect(page.locator('[data-renderer="pixi"] canvas')).toBeVisible();
  await expect(page.getByText('LAST RX AGE')).toBeVisible();
  await expect(page.getByText(/CANONICAL PIXEL SPRITE NOT FROZEN/i)).toBeVisible();

  const generationBefore = await page.locator('[data-renderer="pixi"]').getAttribute('data-app-generation');
  expect(generationBefore).toBe('1');

  await page.getByRole('button', {name: 'ERROR'}).click();
  await expect(page.locator('.ios-lab')).toHaveAttribute('data-state', 'error');
  await expect(page.getByText('RATCHET JAMMED / BLOCKER')).toBeVisible();
  await expect(page.getByText(/FAILED OBSERVATION RECEIVED/i)).toBeVisible();
  await expect.poll(async () => page.locator('.ios-signal-pulse').getAttribute('cx')).toBe('252');

  await page.getByRole('button', {name: 'SUCCESS'}).click();
  await expect(page.getByText('PROOF RECEIVED / RELEASE')).toBeVisible();
  await expect(page.locator('.ios-thread').getByText('PROVEN')).toBeVisible();
  await expect(page.locator('.ios-verifier').getByText('PROVEN')).toBeVisible();
  await expect(page.locator('[data-renderer="pixi"]')).toHaveAttribute('data-app-generation', generationBefore ?? '1');

  const colors = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('.ios-lab')!;
    const signal = document.querySelector<SVGElement>('.ios-signal circle')!;
    const proof = document.querySelector<SVGElement>('.ios-ratchet-proof')!;
    return {
      cyanToken: getComputedStyle(root).getPropertyValue('--ios-cyan').trim(),
      signalFill: getComputedStyle(signal).fill,
      proofFill: getComputedStyle(proof).fill,
    };
  });
  expect(colors.cyanToken.toLowerCase()).toBe('#65dcff');
  expect(colors.signalFill).not.toBe(colors.proofFill);

  const results = await new AxeBuilder({page}).analyze();
  expect(results.violations).toEqual([]);
});

test('Instrument Lab raw UI remains readable on mobile/reduced-motion with CRT disabled', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/?lab=instrument');
  await expect(page.getByRole('heading', {name: 'INSTRUMENT / MOTION LAB'})).toBeVisible();
  await expect(page.locator('.ios-lab')).toHaveAttribute('data-motion-policy', 'reduced');
  await expect(page.locator('.ios-lab')).toHaveAttribute('data-crt', 'off');
  await expect(page.locator('[data-renderer="pixi"]')).toHaveAttribute('data-motion-policy', 'reduced');
  await expect(page.locator('[data-renderer="pixi"] canvas')).toBeVisible();

  const overflow = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth}));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

  await page.getByRole('button', {name: 'SUCCESS'}).click();
  await expect(page.getByText('PROOF RECEIVED / RELEASE')).toBeVisible();
  await expect(page.locator('.ios-signal-pulse')).toHaveAttribute('cx', '8');

  await page.getByRole('button', {name: 'SHIP'}).click();
  await expect(page.locator('.ios-lab')).toHaveAttribute('data-mode', 'ship');
});
