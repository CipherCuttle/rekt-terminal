import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

const screens = ['world', 'command', 'project', 'player', 'ship'] as const;

for (const screen of screens) {
  test(`${screen} has no automated accessibility violations`, async ({page}) => {
    await page.goto(`/?lab=signals&screen=${screen}`);
    await expect(page.getByRole('navigation', {name: 'Golden screen navigation'})).toBeVisible();
    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations).toEqual([]);
  });

  test(`${screen} visual baseline`, async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto(`/?lab=signals&screen=${screen}`);
    await expect(page).toHaveScreenshot(`${screen}.png`, {fullPage: true, animations: 'disabled'});
  });
}

test('keyboard navigation reaches the screen switcher and primary Command action', async ({page}) => {
  await page.goto('/?lab=signals&screen=command');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', {name: 'WORLD'})).toBeFocused();
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('Tab');
  await expect(page.getByRole('button', {name: 'EDIT FOCUS'})).toBeFocused();
});

test('reduced motion disables ambient World orbit', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/?lab=signals&screen=world');
  const animation = await page.locator('main').evaluate((element) => getComputedStyle(element, '::before').animationName);
  expect(animation).toBe('none');
});

test('mobile Command keeps Mission, Next Move, Thread and blocker in readable order', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/?lab=signals&screen=command');
  const mission = page.getByText('CURRENT MISSION').first();
  const next = page.getByText('OPEN TEST REQUEST').first();
  const thread = page.getByText('THE THREAD').first();
  const blocker = page.getByText('BLOCKER').first();
  for (const locator of [mission, next, thread, blocker]) await expect(locator).toBeVisible();
  const boxes = await Promise.all([mission, next, thread, blocker].map((locator) => locator.boundingBox()));
  expect(boxes.every(Boolean)).toBe(true);
  expect(boxes[0]!.y).toBeLessThan(boxes[1]!.y);
  expect(boxes[1]!.y).toBeLessThan(boxes[2]!.y);
  expect(boxes[2]!.y).toBeLessThan(boxes[3]!.y);
});

test('Cockpit screens do not load React Bits or Three chunks', async ({page}) => {
  const loaded: string[] = [];
  page.on('response', (response) => loaded.push(response.url()));
  await page.goto('/?lab=signals&screen=command');
  await page.waitForLoadState('networkidle');
  expect(loaded.some((url) => /reactbits|three|fiber/i.test(url))).toBe(false);
});
