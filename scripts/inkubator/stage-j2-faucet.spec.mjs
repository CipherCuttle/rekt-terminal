import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const address = process.env.J2_FAUCET_ADDRESS;
if (!address) throw new Error('J2_FAUCET_ADDRESS is required');

test('request one Ink Sepolia faucet drip', async ({ page }) => {
  const responses = [];
  const requests = [];

  page.on('request', request => {
    const url = request.url();
    if (/faucet|request|drip|claim|api/i.test(url)) {
      requests.push({ method: request.method(), url });
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (!/faucet|request|drip|claim|api/i.test(url)) return;
    let body = '';
    try {
      body = (await response.text()).slice(0, 2000);
    } catch {}
    responses.push({ status: response.status(), url, body });
  });

  await page.goto('https://inkonchain.com/faucet', { waitUntil: 'networkidle', timeout: 60000 });

  const input = page.getByPlaceholder(/address|ens/i).first();
  await expect(input).toBeVisible({ timeout: 15000 });
  await input.fill(address);

  const button = page.getByRole('button', { name: /request/i }).first();
  await expect(button).toBeEnabled({ timeout: 15000 });
  await button.click();

  await page.waitForTimeout(8000);

  const bodyText = (await page.locator('body').innerText()).slice(0, 5000);
  await page.screenshot({ path: 'j2-faucet-playwright/faucet-after-request.png', fullPage: true });

  const result = {
    address,
    body_text: bodyText,
    requests,
    responses,
    url: page.url(),
  };
  fs.writeFileSync('j2-faucet-playwright/result.json', JSON.stringify(result, null, 2) + '\n');

  const text = bodyText.toLowerCase();
  if (/captcha|cloudflare|verify you are human|turnstile/.test(text)) {
    throw new Error('HUMAN_VERIFICATION_REQUIRED');
  }

  const failedResponse = responses.find(r => r.status >= 400);
  if (failedResponse) {
    throw new Error(`FAUCET_HTTP_FAILURE_${failedResponse.status}`);
  }

  if (/failed|error|unable|try again|rate limit|cooldown/.test(text) && !/success|sent|transaction|received/.test(text)) {
    throw new Error('FAUCET_UI_REPORTED_FAILURE');
  }
});
