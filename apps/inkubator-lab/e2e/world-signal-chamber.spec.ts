import {expect, test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const evidence = '/tmp/rekt-world-signal-chamber-v0';

async function advance(page: import('@playwright/test').Page, count: number) {
  for (let index = 0; index < count; index += 1) {
    await page.getByRole('button', {name: 'NEXT EVENT'}).click();
    await page.waitForTimeout(260);
  }
}

test.describe('WORLD signal chamber evidence', () => {
  test('desktop A/B/C comparison and burst evidence', async ({page}) => {
    await mkdir(evidence, {recursive: true});
    await page.setViewportSize({width: 1440, height: 900});
    await page.goto('/world-signal-chamber.html');
    await expect(page.getByRole('heading', {name: 'BLACKWATER SIGNAL CHAMBER'})).toBeVisible();
    for (const mode of ['STATIC', 'GSAP', 'MATTER']) {
      await page.getByRole('button', {name: mode, exact: true}).click();
      await advance(page, 3);
      await expect(page.locator('[data-testid="signal-lab"]')).toHaveAttribute('data-ledger-count', '3');
      await page.screenshot({path: `${evidence}/${mode.toLowerCase()}-after-3.png`});
      await page.screenshot({path: `${evidence}/${mode.toLowerCase()}-after-3-full.png`, fullPage: true});
    }
    await page.getByRole('button', {name: 'BURST TEST'}).click();
    await expect(page.locator('[data-testid="signal-lab"]')).toHaveAttribute('data-ledger-count', '10');
    await expect(page.locator('[data-testid="signal-lab"]')).toHaveAttribute('data-active-body-count', /[0-8]/);
    await page.waitForTimeout(1000);
    await page.screenshot({path: `${evidence}/matter-burst.png`});
    await page.screenshot({path: `${evidence}/matter-burst-full.png`, fullPage: true});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('mobile Matter and reduced-motion evidence', async ({page}) => {
    await mkdir(evidence, {recursive: true});
    await page.setViewportSize({width: 390, height: 844});
    await page.goto('/world-signal-chamber.html');
    await advance(page, 3);
    await page.screenshot({path: `${evidence}/matter-mobile-after-3.png`});
    await page.screenshot({path: `${evidence}/matter-mobile-after-3-full.png`, fullPage: true});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.reload();
    await advance(page, 3);
    await expect(page.locator('[data-testid="signal-lab"]')).toHaveAttribute('data-reduced-motion', 'true');
    await expect(page.locator('[data-testid="signal-lab"]')).toHaveAttribute('data-active-body-count', '0');
    await page.screenshot({path: `${evidence}/matter-mobile-reduced.png`});
    await page.screenshot({path: `${evidence}/matter-mobile-reduced-full.png`, fullPage: true});
  });

  test('Matter ordered frame sequence is deterministic and bounded', async ({page}) => {
    await mkdir(evidence, {recursive: true});
    await page.setViewportSize({width: 1440, height: 900});
    await page.goto('/world-signal-chamber.html');
    await advance(page, 3);
    let initialTransform = '';
    for (const [label, wait] of [['t000', 0], ['t250', 250], ['t750', 500], ['t1500', 750], ['t3000', 1500]] as const) {
      if (wait) await page.waitForTimeout(wait);
      await page.screenshot({path: `${evidence}/matter-${label}.png`, fullPage: true});
      expect(Number(await page.locator('[data-testid="signal-lab"]').getAttribute('data-active-body-count'))).toBeLessThanOrEqual(8);
      const currentTransform = await page.locator('.signal-capsule-shell').first().evaluate((node) => node.style.transform);
      if (label === 't000') initialTransform = currentTransform;
      if (label === 't1500') expect(currentTransform).not.toBe(initialTransform);
    }
  });
});
