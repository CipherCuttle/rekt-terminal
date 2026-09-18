// Captures the fail-closed UNAVAILABLE state of every lab surface with the API
// unreachable (no API on 8788): a legitimate error-state capture, never fabricated.
// Usage: node scripts/inkubator/product-coherence-unavailable-capture.mjs
// Requires the production lab preview on http://127.0.0.1:5184 and NO API on 8788.
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const origin = 'http://127.0.0.1:5184';
const evidence = 'artifacts/product-coherence';
await mkdir(evidence, {recursive: true});
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1440, height: 900}});
const page = await context.newPage();
try {
  for (const [width, height, label] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
    await page.setViewportSize({width, height});
    for (const mode of ['command', 'project', 'player', 'ship']) {
      await page.goto(`${origin}/?mode=${mode}`, {waitUntil: 'networkidle'}).catch(() => {});
      await page.waitForTimeout(400);
      await page.screenshot({path: `${evidence}/${mode}-unavailable-${label}.png`, fullPage: true});
      console.log('EVIDENCE', `${mode}-unavailable-${label}`);
    }
  }
} finally {
  await browser.close();
}