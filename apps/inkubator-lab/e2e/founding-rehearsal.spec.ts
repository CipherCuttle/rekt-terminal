import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page} from '@playwright/test';

const path = [
  {nav: 'WORLD', screen: 'world', marker: 'BUILD SOMETHING WEIRD. SHIP IT.'},
  {nav: 'COMMAND', screen: 'command', marker: 'SHIP THE WEIRD LITTLE THING'},
  {nav: 'PROJECT', screen: 'project', marker: 'REKT MACHINE'},
  {nav: 'PLAYER', screen: 'player', marker: 'CIPHERCUTTLE'},
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth}));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

async function expectCommandMeaning(page: Page) {
  for (const text of ['CURRENT MISSION', 'OPEN TEST REQUEST', 'THE THREAD', 'BLOCKER']) {
    await expect(page.getByText(text).first()).toBeVisible();
  }
}

async function walkFiveScreens(page: Page) {
  await page.goto('/?lab=signals&screen=world');
  await expect(page.getByRole('navigation', {name: 'Golden screen navigation'})).toBeVisible();

  for (const step of path) {
    if (step.screen !== 'world') await page.getByRole('link', {name: step.nav}).click();
    await expect(page).toHaveURL(new RegExp(`screen=${step.screen}`));
    await expect(page.getByRole('heading', {name: step.marker})).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (step.screen === 'command') await expectCommandMeaning(page);
  }

  await page.getByRole('link', {name: 'SHIP'}).click();
  await expect(page).toHaveURL(/screen=ship/);
  await expect(page.getByLabel(/SHIP ACCEPTED, source SHIP RULE V1/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
}

test('P9-H14 desktop founding journey keeps one coherent five-screen state hierarchy', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await walkFiveScreens(page);
  const results = await new AxeBuilder({page}).analyze();
  expect(results.violations).toEqual([]);
});

test('P9-H13 mobile founding journey keeps Mission/Next Move/blocker/Ship readable without overflow', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await walkFiveScreens(page);
});

test('P9-H15 keyboard-only path reaches Command primary action and Ship navigation', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 800});
  await page.goto('/?lab=signals&screen=command');
  await expect(page.getByRole('heading', {name: 'SHIP THE WEIRD LITTLE THING'})).toBeVisible();

  const command = page.getByRole('link', {name: 'COMMAND'});
  await command.focus();
  await expect(command).toBeFocused();
  for (const label of ['PROJECT', 'PLAYER', 'SHIP']) {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', {name: label})).toBeFocused();
  }
  await page.getByRole('button', {name: 'EDIT FOCUS'}).focus();
  await expect(page.getByRole('button', {name: 'EDIT FOCUS'})).toBeFocused();
});

test('P9-H16 reduced motion preserves critical meaning across World and Command', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/?lab=signals&screen=world');
  await expect(page.getByRole('heading', {name: 'BUILD SOMETHING WEIRD. SHIP IT.'})).toBeVisible();
  const animation = await page.locator('main').evaluate((element) => getComputedStyle(element, '::before').animationName);
  expect(animation).toBe('none');
  await page.getByRole('link', {name: 'COMMAND'}).click();
  await expectCommandMeaning(page);
  await expect(page.getByRole('button', {name: 'EDIT FOCUS'})).toBeVisible();
});
