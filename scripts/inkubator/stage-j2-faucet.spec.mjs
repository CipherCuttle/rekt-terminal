import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const address = process.env.J2_FAUCET_ADDRESS;
const faucetUrl = process.env.J2_FAUCET_URL;
if (!address || !faucetUrl) throw new Error('J2 faucet env is required');

test.setTimeout(60000);

test('inspect QuickNode step two without claiming', async ({ page }) => {
  fs.mkdirSync('j2-faucet-playwright', { recursive: true });

  await page.goto(faucetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  const input = page.getByPlaceholder(/0x/i).first();
  await expect(input).toBeVisible({ timeout: 15000 });
  await input.fill(address);

  const continueButton = page.getByRole('button', { name: /^continue$/i }).first();
  await expect(continueButton).toBeEnabled({ timeout: 15000 });
  await continueButton.click();
  await page.waitForTimeout(3000);

  const bodyText = (await page.locator('body').innerText()).slice(0, 12000);
  const buttons = await page.getByRole('button').allTextContents().catch(() => []);
  const inputs = await page.locator('input').evaluateAll(nodes => nodes.map(node => ({
    type: node.type,
    placeholder: node.getAttribute('placeholder'),
    value: node.value,
  }))).catch(() => []);

  await page.screenshot({ path: 'j2-faucet-playwright/quicknode-step-two.png', fullPage: true });
  fs.writeFileSync('j2-faucet-playwright/result.json', JSON.stringify({
    verdict: 'DIAGNOSTIC_ONLY_NO_CLAIM',
    address,
    url: page.url(),
    body_text: bodyText,
    buttons,
    inputs,
  }, null, 2) + '\n');
});
