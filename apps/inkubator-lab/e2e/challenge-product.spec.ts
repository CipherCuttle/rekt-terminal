import AxeBuilder from '@axe-core/playwright';
import {expect, test, type Page} from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
}

test('Stage I default root exposes one white Challenge front door without reviving legacy navigation', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/');

  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-shell-variant', 'v2');
  await expect(page.getByRole('heading', {name: 'WHAT ARE YOU HERE TO DO?', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: /LAUNCH A CHALLENGE.*PROVE WHAT GETS BUILT/i})).toBeVisible();
  const nav = page.getByRole('navigation', {name: 'Inkubator journey'});
  await expect(nav.getByText('DISCOVER / START', {exact: true})).toBeVisible();
  await expect(nav.getByText('COMPILER / CREATE', {exact: true})).toBeVisible();
  await expect(nav.getByText('CHALLENGE', {exact: true})).toBeVisible();
  await expect(nav.getByText('MY BUILD', {exact: true})).toBeVisible();
  await expect(nav.getByText('REVIEW / TEST ARENA', {exact: true})).toBeVisible();
  await expect(nav.getByText('RECEIPT / HISTORY', {exact: true})).toBeVisible();
  await expect(page.getByRole('link', {name: /CREATE A CHALLENGE/i})).toBeVisible();
  await expect(page.getByRole('heading', {name: "WHAT'S BUILDING?"})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Realtime Launch Radar'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Wallet Safety Check'})).toBeVisible();
  await expect(page.getByLabel(/CHALLENGE LINK OR ID/i)).toBeVisible();
  await expect(page.getByText(/^WORLD$/i)).toHaveCount(0);
  await expect(page.getByText(/^COMMAND$/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const accessibility = await new AxeBuilder({page}).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('Discover demo challenge can seed a readable Compiler draft', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/');

  const demo = page.getByRole('article').filter({has: page.getByRole('heading', {name: 'Realtime Launch Radar'})});
  await expect(demo.getByText(/EXAMPLE ONLY · NOT A LIVE CHALLENGE/i)).toBeVisible();
  await demo.getByRole('link', {name: 'START FROM THIS IDEA →'}).click();

  await expect(page).toHaveURL(/surface=compiler/);
  await expect(page.getByLabel('YOUR IDEA')).toHaveValue(/realtime public launch dashboard/i);
  const ideaFontSize = await page.getByLabel('YOUR IDEA').evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(ideaFontSize).toBeGreaterThanOrEqual(15);
});

test('Stage I Discover becomes a phone-first step flow instead of a squeezed desktop faceplate', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/');

  const rail = page.getByRole('navigation', {name: 'Inkubator journey'});
  const railStyle = await rail.evaluate((element) => {
    const style = getComputedStyle(element);
    return {display: style.display, overflowX: style.overflowX, width: element.getBoundingClientRect().width};
  });
  expect(railStyle.display).toBe('flex');
  expect(['auto', 'scroll']).toContain(railStyle.overflowX);
  expect(railStyle.width).toBeLessThanOrEqual(390);

  const title = page.getByRole('heading', {name: 'WHAT ARE YOU HERE TO DO?', exact: true});
  const titleSize = await title.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(titleSize).toBeLessThanOrEqual(40);

  const launch = page.getByRole('link', {name: /LAUNCH YOUR OWN/i});
  const launchBox = await launch.boundingBox();
  expect(launchBox).not.toBeNull();
  expect(launchBox!.width).toBeGreaterThan(300);

  await expect(page.getByText('WHAT ARE YOU DOING RIGHT NOW?', {exact: true})).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const accessibility = await new AxeBuilder({page}).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('Stage I Compiler/Create guides a first-time organizer one decision at a time on mobile', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/?surface=compiler');

  await expect(page.locator('[data-shell="terminal"]')).toHaveAttribute('data-shell-variant', 'v2');
  await expect(page.locator('main.challenge-product')).toHaveAttribute('data-challenge-surface', 'compiler');
  await expect(page.getByRole('heading', {name: 'COMPILER / CREATE'})).toBeVisible();

  const guide = page.locator('[data-journey-role="organizer"]');
  await expect(guide).toHaveAttribute('data-journey-step', '1');
  await expect(guide.getByText('DESCRIBE WHAT YOU WANT BUILT', {exact: true})).toBeVisible();

  const sourceIntent = page.getByLabel('YOUR IDEA');
  await sourceIntent.fill('Build a realtime public launch dashboard');
  await expect(guide).toHaveAttribute('data-journey-step', '2');
  await expect(page.getByText('DETAIL 1 OF 11', {exact: false})).toBeVisible();
  await expect(page.getByRole('button', {name: 'NOT SURE'})).toBeVisible();
  await expect(page.getByText('REALTIME', {exact: true})).toHaveCount(0);

  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('button', {name: 'NEXT DETAIL →'}).click();
  }
  await expect(page.getByText('DETAIL 11 OF 11', {exact: false})).toBeVisible();
  await page.getByRole('button', {name: 'DONE WITH DETAILS ✓'}).click();

  await expect(guide).toHaveAttribute('data-journey-step', '3');
  await expect(guide.getByText('DEFINE WHAT COUNTS AS DONE', {exact: true})).toBeVisible();
  const criterion = page.getByPlaceholder(/The dashboard always shows the current launch state after reload/i);
  await criterion.fill('The dashboard clearly shows the current launch state after reload.');
  await expect(guide.getByText('CHECK YOUR CHALLENGE RULES', {exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'CHECK MY CHALLENGE'})).toBeEnabled();
  await expect(page.getByRole('heading', {name: 'REVIEW AND LOCK THE RULES'})).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  const accessibility = await new AxeBuilder({page}).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('Stage I remains legible with reduced motion requested', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/?surface=challenge');

  const reduced = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(reduced).toBe(true);
  await expect(page.getByRole('heading', {name: 'CHALLENGE', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'No Challenge selected.', exact: true})).toBeVisible();
  await expect(page.locator('[data-surface-state="empty"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});