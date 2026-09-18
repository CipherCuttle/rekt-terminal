import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const address = process.env.J2_FAUCET_ADDRESS;
const faucetUrl = process.env.J2_FAUCET_URL;
const rpcUrl = 'https://rpc-gel-sepolia.inkonchain.com';
if (!address) throw new Error('J2_FAUCET_ADDRESS is required');
if (!faucetUrl) throw new Error('J2_FAUCET_URL is required');

async function balanceWei(page) {
  const response = await page.request.post(rpcUrl, {
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest'],
    },
  });
  if (!response.ok()) throw new Error(`RPC_BALANCE_HTTP_${response.status()}`);
  const json = await response.json();
  return BigInt(json.result);
}

test('request one Ink Sepolia faucet drip and verify balance onchain', async ({ page }) => {
  fs.mkdirSync('j2-faucet-playwright', { recursive: true });

  const before = await balanceWei(page);
  if (before > 0n) {
    fs.writeFileSync('j2-faucet-playwright/result.json', JSON.stringify({
      verdict: 'ALREADY_FUNDED',
      address,
      faucet_url: faucetUrl,
      balance_wei: before.toString(),
    }, null, 2) + '\n');
    return;
  }

  const responses = [];
  page.on('response', async response => {
    const url = response.url();
    if (!/faucet|request|drip|claim|api|cloudflare|turnstile|captcha/i.test(url)) return;
    let body = '';
    try { body = (await response.text()).slice(0, 2000); } catch {}
    responses.push({ status: response.status(), url, body });
  });

  await page.goto(faucetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const input = page.getByPlaceholder(/0x|address|ethereum/i).first();
  await expect(input).toBeVisible({ timeout: 15000 });
  await input.fill(address);

  const button = page.getByRole('button', { name: /request funds|request|claim|send/i }).first();
  await expect(button).toBeEnabled({ timeout: 15000 });
  await button.click();

  let funded = false;
  let finalBalance = 0n;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await page.waitForTimeout(2000);
    finalBalance = await balanceWei(page);
    if (finalBalance > 0n) {
      funded = true;
      break;
    }
  }

  const bodyText = (await page.locator('body').innerText()).slice(0, 5000);
  await page.screenshot({ path: 'j2-faucet-playwright/faucet-after-request.png', fullPage: true });

  fs.writeFileSync('j2-faucet-playwright/result.json', JSON.stringify({
    verdict: funded ? 'FUNDED' : 'NOT_FUNDED',
    address,
    faucet_url: faucetUrl,
    balance_before_wei: before.toString(),
    balance_after_wei: finalBalance.toString(),
    body_text: bodyText,
    responses,
  }, null, 2) + '\n');

  if (!funded) {
    if (/captcha|cloudflare|verify you are human|turnstile|verification/i.test(bodyText.toLowerCase())) {
      throw new Error('HUMAN_VERIFICATION_REQUIRED');
    }
    throw new Error('FAUCET_DID_NOT_FUND_ADDRESS');
  }
});
