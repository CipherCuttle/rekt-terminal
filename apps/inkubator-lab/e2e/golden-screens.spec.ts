import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page} from '@playwright/test';

const screens = ['world', 'command', 'project', 'player', 'ship'] as const;
type GoldenScreen = (typeof screens)[number];

async function waitForGoldenScreen(page: Page, screen: GoldenScreen) {
  await expect(page.getByRole('navigation', {name: 'Golden screen navigation'})).toBeVisible();
  switch (screen) {
    case 'world':
      await expect(page.getByRole('heading', {name: 'BUILD SOMETHING WEIRD. SHIP IT.'})).toBeVisible();
      break;
    case 'command':
      await expect(page.getByRole('heading', {name: 'SHIP THE WEIRD LITTLE THING'})).toBeVisible();
      break;
    case 'project':
      await expect(page.getByRole('heading', {name: 'REKT MACHINE'})).toBeVisible();
      break;
    case 'player':
      await expect(page.getByRole('heading', {name: 'CIPHERCUTTLE'})).toBeVisible();
      break;
    case 'ship':
      await expect(page.getByLabel(/SHIP ACCEPTED, source SHIP RULE V1/i)).toBeVisible();
      break;
  }
}

for (const screen of screens) {
  test(`${screen} has no automated accessibility violations`, async ({page}) => {
    await page.goto(`/?lab=signals&screen=${screen}`);
    await waitForGoldenScreen(page, screen);
    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations).toEqual([]);
  });

  test(`${screen} visual baseline`, async ({page}) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto(`/?lab=signals&screen=${screen}`);
    await waitForGoldenScreen(page, screen);
    await expect(page).toHaveScreenshot(`${screen}.png`, {fullPage: true, animations: 'disabled'});
  });
}

test('keyboard navigation reaches the screen switcher and primary Command action', async ({page}) => {
  await page.goto('/?lab=signals&screen=command');
  await waitForGoldenScreen(page, 'command');
  const world = page.getByRole('link', {name: 'WORLD'});
  await world.focus();
  await expect(world).toBeFocused();

  for (const label of ['COMMAND', 'PROJECT', 'PLAYER', 'SHIP']) {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', {name: label})).toBeFocused();
  }

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', {name: 'EDIT FOCUS'})).toBeFocused();
});

test('World live signal columns never overlap', async ({page}) => {
  await page.goto('/?lab=signals&screen=world');
  await waitForGoldenScreen(page, 'world');
  const pulses = page.getByLabel('World signals').locator(':scope > div');
  await expect(pulses).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    const pulse = pulses.nth(index);
    const signalBox = await pulse.locator(':scope > span').first().boundingBox();
    const copy = pulse.locator(':scope > div');
    const copyBox = await copy.boundingBox();
    const nameBox = await copy.locator('strong').boundingBox();
    const detailBox = await copy.locator('span').boundingBox();
    expect(signalBox).not.toBeNull();
    expect(copyBox).not.toBeNull();
    expect(nameBox).not.toBeNull();
    expect(detailBox).not.toBeNull();
    expect(signalBox!.x + signalBox!.width).toBeLessThanOrEqual(copyBox!.x);
    expect(nameBox!.y + nameBox!.height).toBeLessThanOrEqual(detailBox!.y + 1);
  }
});

test('World development fixture marker stays visible after scrolling below the hero', async ({page}) => {
  await page.goto('/?lab=signals&screen=world');
  await waitForGoldenScreen(page, 'world');
  const marker = page.getByText('BROADCAST / DEVELOPMENT FIXTURE', {exact: true});
  await expect(marker).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(marker).toBeVisible();
  const markerBox = await marker.boundingBox();
  const viewport = page.viewportSize();
  expect(markerBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(markerBox!.y).toBeGreaterThanOrEqual(0);
  expect(markerBox!.y + markerBox!.height).toBeLessThanOrEqual(viewport!.height);
});

test('reduced motion disables ambient World orbit', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/?lab=signals&screen=world');
  await waitForGoldenScreen(page, 'world');
  const animation = await page.locator('main').evaluate((element) => getComputedStyle(element, '::before').animationName);
  expect(animation).toBe('none');
});

test('mobile Command keeps Mission, Next Move, Thread and blocker in readable order', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/?lab=signals&screen=command');
  await waitForGoldenScreen(page, 'command');
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
  await waitForGoldenScreen(page, 'command');
  await page.waitForLoadState('networkidle');
  expect(loaded.some((url) => /reactbits|three|fiber/i.test(url))).toBe(false);
});
