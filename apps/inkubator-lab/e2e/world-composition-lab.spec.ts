import AxeBuilder from '@axe-core/playwright';
import {mkdirSync} from 'node:fs';
import {expect, test, type Page} from '@playwright/test';

const evidenceDir = '/tmp/rekt-world-composition-lab-v1';
test.beforeAll(() => mkdirSync(evidenceDir, {recursive: true}));

const stories = {
  tapeNormal: 'rekt-world-composition-lab--tape-normal',
  dispatchNormal: 'rekt-world-composition-lab--dispatch-normal',
  receiverNormal: 'rekt-world-composition-lab--receiver-normal',
  tapeHelpNow: 'rekt-world-composition-lab--tape-help-now',
  dispatchHelpNow: 'rekt-world-composition-lab--dispatch-help-now',
  receiverHelpNow: 'rekt-world-composition-lab--receiver-help-now',
  tapeQuiet: 'rekt-world-composition-lab--tape-quiet',
  dispatchQuiet: 'rekt-world-composition-lab--dispatch-quiet',
  receiverQuiet: 'rekt-world-composition-lab--receiver-quiet',
  tapeBurst: 'rekt-world-composition-lab--tape-burst',
  dispatchBurst: 'rekt-world-composition-lab--dispatch-burst',
  receiverBurst: 'rekt-world-composition-lab--receiver-burst',
} as const;

async function openStory(page: Page, storyId: string) {
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
  await expect(page.locator('[data-world-composition-lab]')).toBeVisible();
}

async function capture(page: Page, storyId: string, path: string) {
  await openStory(page, storyId);
  await expect(page.getByText('DEVELOPMENT FIXTURE / NOT LIVE DATA')).toBeVisible();
  await page.screenshot({path, fullPage: true, animations: 'disabled'});
}

test.describe('WORLD composition lab Storybook evidence', () => {
  test('normal and help-now variants pass accessibility on desktop', async ({page}) => {
    await page.setViewportSize({width: 1440, height: 900});
    for (const storyId of [stories.tapeNormal, stories.dispatchNormal, stories.receiverNormal, stories.tapeHelpNow, stories.dispatchHelpNow, stories.receiverHelpNow]) {
      await openStory(page, storyId);
      const results = await new AxeBuilder({page}).analyze();
      expect(results.violations, storyId).toEqual([]);
    }
  });

  test('desktop evidence: normal and help-now for all three topologies', async ({page}) => {
    await page.setViewportSize({width: 1440, height: 900});
    await capture(page, stories.tapeNormal, `${evidenceDir}/desktop-tape-normal.png`);
    await capture(page, stories.dispatchNormal, `${evidenceDir}/desktop-dispatch-normal.png`);
    await capture(page, stories.receiverNormal, `${evidenceDir}/desktop-receiver-normal.png`);
    await capture(page, stories.tapeHelpNow, `${evidenceDir}/desktop-tape-help-now.png`);
    await capture(page, stories.dispatchHelpNow, `${evidenceDir}/desktop-dispatch-help-now.png`);
    await capture(page, stories.receiverHelpNow, `${evidenceDir}/desktop-receiver-help-now.png`);
  });

  test('mobile evidence: normal and help-now for all three topologies', async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    for (const [storyId, filename] of [
      [stories.tapeNormal, 'mobile-tape-normal.png'],
      [stories.dispatchNormal, 'mobile-dispatch-normal.png'],
      [stories.receiverNormal, 'mobile-receiver-normal.png'],
      [stories.tapeHelpNow, 'mobile-tape-help-now.png'],
      [stories.dispatchHelpNow, 'mobile-dispatch-help-now.png'],
      [stories.receiverHelpNow, 'mobile-receiver-help-now.png'],
    ] as const) {
      await capture(page, storyId, `${evidenceDir}/${filename}`);
      const overflow = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth}));
      expect(overflow.scrollWidth, `${storyId} overflows mobile`).toBeLessThanOrEqual(overflow.innerWidth + 1);
    }
  });

  test('quiet and burst scenarios stay present at both viewport sizes', async ({page}) => {
    for (const [viewport, prefix] of [[[1440, 900], 'desktop'], [[390, 844], 'mobile']] as const) {
      await page.setViewportSize({width: viewport[0], height: viewport[1]});
      for (const [storyId, filename] of [
        [stories.tapeQuiet, `${prefix}-tape-quiet.png`],
        [stories.dispatchQuiet, `${prefix}-dispatch-quiet.png`],
        [stories.receiverQuiet, `${prefix}-receiver-quiet.png`],
        [stories.tapeBurst, `${prefix}-tape-burst.png`],
        [stories.dispatchBurst, `${prefix}-dispatch-burst.png`],
        [stories.receiverBurst, `${prefix}-receiver-burst.png`],
      ] as const) {
        await capture(page, storyId, `${evidenceDir}/${filename}`);
      }
    }
  });
});
