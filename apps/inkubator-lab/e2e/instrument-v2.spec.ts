import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

test('keyboard inspection preserves truth, provenance and owning context', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('/?lab=instrument-v2');
  const records = page.locator('.iv2-event');
  const inspector = page.locator('.iv2-inspector-desktop');
  await expect(page.locator('.iv2-calibration-label')).toContainText('CALIBRATION FIXTURE');
  await expect(page.getByText('NO LIVE DATA', {exact: true})).toBeVisible();
  await expect(records).toHaveCount(8);
  await records.nth(0).focus();
  await page.keyboard.press('Enter');
  await expect(inspector.getByText('CLAIMED', {exact: true})).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(records.nth(1)).toBeFocused();
  await expect(inspector.getByText('CONNECTED', {exact: true})).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(inspector.getByText('fixture:observation-01', {exact: true})).toBeVisible();
  await expect(inspector.getByText('OBSERVED', {exact: true})).toBeVisible();
  await page.keyboard.press('End');
  await expect(records.nth(7)).toBeFocused();
  await expect(inspector.getByRole('heading', {name: 'Cheevo earned'})).toBeVisible();
  await inspector.getByText('Supporting references', {exact: false}).click();
  await expect(inspector.getByText('fixture:award-rule-v1')).toBeVisible();
  await inspector.getByRole('link', {name: 'PLAYER context'}).click();
  await expect(page.locator('#owner-player')).toBeVisible();
  await page.getByRole('button', {name: /ACCEPTED ARTIFACT Field Notes/}).click();
  await expect(records.nth(6)).toBeFocused();
  await expect(inspector.getByText('PROVEN', {exact: true})).toBeVisible();
  await expect(inspector.getByText(/simulated receipt-backed/)).toBeVisible();
  await page.keyboard.press('Home');
  await expect(records.first()).toBeFocused();
  await expect(inspector.getByText('CLAIMED', {exact: true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('empty, stale, failed and unsupported scenarios remain distinct and fail closed', async ({page}) => {
  await page.goto('/?lab=instrument-v2');
  const scenario = page.getByRole('combobox', {name: 'SCENARIO'});
  await scenario.selectOption('stale');
  await expect(page.getByText('Historical snapshot · stale')).toBeVisible();
  await expect(page.locator('.iv2-event')).toHaveCount(8);
  await expect(page.getByText('STALE FIXTURE SNAPSHOT')).toBeVisible();
  for (const [value, title] of [['empty', 'No history recorded'], ['unavailable', 'History unavailable'], ['unsupported', 'Unsupported history format']]) {
    await scenario.selectOption(value);
    await expect(page.getByText(title, {exact: true})).toBeVisible();
    await expect(page.locator('.iv2-event')).toHaveCount(0);
    await expect(page.locator('[data-truth="PROVEN"]')).toHaveCount(0);
    await expect(page.getByText('No record selected.')).toBeVisible();
  }
  await scenario.selectOption('record');
  await expect(page.locator('.iv2-event')).toHaveCount(8);
  await expect(page.locator('.iv2-inspector-desktop').getByRole('heading', {name: 'Work observed'})).toBeVisible();
});

for (const viewport of [{width: 1440, height: 1000}, {width: 1280, height: 800}, {width: 390, height: 844}, {width: 430, height: 932}]) {
  test(`history composition ${viewport.width}×${viewport.height} has accessible raw and cathode modes`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto('/?lab=instrument-v2');
    await expect(page.getByRole('heading', {name: 'Builder history.', exact: true})).toBeVisible();
    await expect(page.locator('.iv2-mascot img')).toBeVisible();
    expect(await page.locator('.iv2-mascot img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page).toHaveScreenshot(`builder-history-${viewport.width}.png`, {fullPage: true});
    await page.getByRole('button', {name: 'CRT ON'}).click();
    await expect(page.locator('.iv2-page')).toHaveAttribute('data-crt', 'off');
    await page.getByRole('button', {name: /Ship submitted/}).click();
    const inspector = page.locator(viewport.width < 761 ? '.iv2-inspector-mobile' : '.iv2-inspector-desktop');
    await expect(inspector.getByText('SUBMITTED', {exact: true})).toBeVisible();
    await expect(inspector.getByText(/Verifier PASS would still not establish acceptance/)).toBeVisible();
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
    await expect(page).toHaveScreenshot(`builder-history-raw-${viewport.width}.png`, {fullPage: true});
  });
}

test('unavailable mascot art keeps neutral identity and never substitutes imagery', async ({page}) => {
  await page.route('**/assets/rekt-mascot.png', route => route.abort());
  await page.goto('/?lab=instrument-v2');
  await expect(page.getByText('ART UNAVAILABLE')).toBeVisible();
  await expect(page.locator('.iv2-mascot img')).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Builder history.', exact: true})).toBeVisible();
});
