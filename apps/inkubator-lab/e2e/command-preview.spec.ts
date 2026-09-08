import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const states = ['building', 'rx', 'blocked', 'help', 'proven'] as const;
const evidence = '/tmp/rekt-command-v11-evidence';
for (const width of [1440, 390]) {
  for (const reduced of [false, true]) {
    test(`COMMAND five states / ${width} / motion ${reduced ? 'reduced' : 'full'}`, async ({page}) => {
      await mkdir(evidence, {recursive: true});
      await page.setViewportSize({width, height: width === 1440 ? 900 : 844});
      await page.emulateMedia({reducedMotion: reduced ? 'reduce' : 'no-preference'});
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/?preview=command&state=building');
      await expect(page.getByRole('heading', {name: 'Build verifiers for open-source agents.'})).toBeVisible();
      await page.waitForTimeout(900);
      for (const state of states) {
        await page.getByRole('button', {name: state.toUpperCase(), exact: true}).click();
        await expect(page.locator('.command-live')).toHaveAttribute('data-state', state === 'rx' ? 'building' : state);
        await page.waitForTimeout(1200);
        await expect(page.locator('.command-ship')).toHaveAttribute('data-proven', String(state === 'proven'));
        await expect(page.locator('.command-action h2')).toHaveCount(1);
        await expect(page.locator('[data-rekt-state]')).toHaveText(state === 'help' ? 'BEACON' : state === 'blocked' ? 'BLOCKED' : state === 'proven' ? 'PROVEN' : 'WORKING');
        await expect(page.locator('.command-ripple')).toHaveCSS('opacity', '0');
        await expect(page.locator('.command-packet')).toHaveCSS('opacity', '0');
        await expect(page.locator('.command-live')).toHaveAttribute('data-motion-policy', reduced ? 'reduced' : 'full');
        if (state === 'help') await expect(page.locator('.command-locus')).toContainText('HELP ACTIVE');
        if (state === 'blocked') await expect(page.locator('.command-locus')).toContainText('BLOCKED');
        if (state === 'rx') {
          await expect(page.getByRole('status')).toContainText('SOURCE CHANGED');
          await expect(page.getByRole('status')).toContainText('NEXT MOVE CHANGED');
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const greenLeak = await page.locator('.command-live').evaluate(root => [...root.querySelectorAll('*')].filter(el => {
          const style = getComputedStyle(el);
          const green = 'rgb(183, 255, 69)';
          return [style.color, style.fill, style.stroke, style.backgroundColor].includes(green)
            && !el.closest('[data-truth="proven"], .command-ship[data-proven="true"]')
            && !(root.getAttribute('data-state') === 'proven' && el.closest('.command-locus, .command-proof-segment, .command-ripple'));
        }).map(el => el.className));
        expect(greenLeak).toEqual([]);
        expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({path: `${evidence}/final-${state}-${width}${reduced ? '-reduced' : ''}.png`, fullPage: width === 390});
      }
      expect(errors).toEqual([]);
      const action = page.locator('.command-action summary');
      await action.focus(); await page.keyboard.press('Enter');
      await expect(page.locator('.command-action')).toHaveAttribute('open', '');
      await expect(page.locator('.command-action-detail')).toBeVisible();
      await expect(action).toBeFocused();
    });
  }
}

test('RX is staged once, then still', async ({page}) => {
  await page.goto('/?preview=command&state=building');
  await expect(page.locator('.command-live')).toHaveAttribute('data-event-sequence', '0');
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const root = document.querySelector('.command-live')!;
    (window as unknown as {effectPhases: string[]}).effectPhases = [];
    new MutationObserver(records => {
      for (const record of records) if (record.attributeName === 'data-effect')
        (window as unknown as {effectPhases: string[]}).effectPhases.push(root.getAttribute('data-effect')!);
    }).observe(root, {attributes: true});
  });
  await page.getByRole('button', {name: 'RX', exact: true}).click();
  await expect(page.locator('.command-live')).toHaveAttribute('data-effect', 'settled');
  const phases = await page.evaluate(() => (window as unknown as {effectPhases: string[]}).effectPhases);
  expect(phases).toEqual(expect.arrayContaining(['source-wake', 'packet', 'received', 'settled']));
  await expect(page.locator('[data-rekt-state]')).toHaveText('WORKING');
  const sequence = await page.locator('.command-live').getAttribute('data-event-sequence');
  await page.getByRole('button', {name: 'RX', exact: true}).click();
  await page.waitForTimeout(1000);
  await expect(page.locator('.command-live')).toHaveAttribute('data-event-sequence', sequence!);
});
