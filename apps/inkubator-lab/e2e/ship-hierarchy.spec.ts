import {expect, test} from '@playwright/test';

test('Phase 9 Ship keeps the accepted artifact dominant in the first desktop viewport', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 900});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/?lab=signals&screen=ship');
  await expect(page.getByLabel(/SHIP ACCEPTED, source SHIP RULE V1/i)).toBeVisible();

  const artifact = page.getByLabel('Accepted shipped artifact');
  const artifactWindow = artifact.locator(':scope > div');
  const artifactBox = await artifact.boundingBox();
  const windowBox = await artifactWindow.boundingBox();
  expect(artifactBox).not.toBeNull();
  expect(windowBox).not.toBeNull();

  expect(artifactBox!.y).toBeGreaterThanOrEqual(57);
  expect(artifactBox!.y).toBeLessThanOrEqual(60);
  expect(artifactBox!.height).toBeGreaterThanOrEqual(840);
  expect(artifactBox!.height).toBeLessThanOrEqual(843);
  expect(windowBox!.y).toBeGreaterThan(artifactBox!.y);
  expect(windowBox!.y + windowBox!.height).toBeLessThanOrEqual(900);
  expect(windowBox!.width).toBeGreaterThan(artifactBox!.width * 0.78);

  await page.evaluate(() => window.scrollTo(0, 360));
  const stickyBox = await artifact.boundingBox();
  expect(stickyBox).not.toBeNull();
  expect(stickyBox!.y).toBeGreaterThanOrEqual(57);
  expect(stickyBox!.y).toBeLessThanOrEqual(60);
});

test('Phase 9 Ship returns the artifact to normal document flow on mobile', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/?lab=signals&screen=ship');
  await expect(page.getByLabel(/SHIP ACCEPTED, source SHIP RULE V1/i)).toBeVisible();

  const artifact = page.getByLabel('Accepted shipped artifact');
  const position = await artifact.evaluate((element) => getComputedStyle(element).position);
  expect(position).not.toBe('sticky');
  const artifactBox = await artifact.boundingBox();
  const receiptHeading = page.getByRole('heading', {name: /ROUND 01/});
  const receiptBox = await receiptHeading.boundingBox();
  expect(artifactBox).not.toBeNull();
  expect(receiptBox).not.toBeNull();
  expect(artifactBox!.y + artifactBox!.height).toBeLessThanOrEqual(receiptBox!.y);
});
