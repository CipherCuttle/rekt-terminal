import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const address = process.env.J2_FAUCET_ADDRESS;
const faucetUrl = process.env.J2_FAUCET_URL;
const rpcUrl = 'https://rpc-gel-sepolia.inkonchain.com';
if (!address) throw new Error('J2_FAUCET_ADDRESS is required');
if (!faucetUrl) throw new Error('J2_FAUCET_URL is required');

async function balanceWei(page) {
  const response = await page.request.post(rpcUrl, {
    data: { jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] },
  });
  if (!response.ok()) throw new Error(`RPC_BALANCE_HTTP_${response.status()}`);
  const json = await response.json();
  return BigInt(json.result);
}

async function saveState(page, verdict, extra = {}) {
  fs.mkdirSync('j2-faucet-playwright', { recursive: true });
  let bodyText = '';
  try { bodyText = (await page.locator('body').innerText()).slice(0, 8000); } catch {}
  try { await page.screenshot({ path: 'j2-faucet-playwright/faucet-after-request.png', fullPage: true }); } catch {}
  fs.writeFileSync('j2-faucet-playwright/result.json', JSON.stringify({
    verdict,
    address,
    faucet_url: faucetUrl,
    body_text: bodyText,
    ...extra,
  }, null, 2) + '\n');
  return bodyText;
}

test('request one QuickNode Ink Sepolia drip and verify balance onchain', async ({ page }) => {
  const before = await balanceWei(page);
  if (before > 0n) {
    await saveState(page, 'ALREADY_FUNDED', { balance_wei: before.toString() });
    return;
  }

  await page.goto(faucetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  const input = page.getByPlaceholder(/0x/i).first();
  await expect(input).toBeVisible({ timeout: 15000 });
  await input.fill(address);

  const continueButton = page.getByRole('button', { name: /^continue$/i }).first();
  await expect(continueButton).toBeEnabled({ timeout: 15000 });
  await continueButton.click();
  await page.waitForTimeout(2500);

  let bodyText = (await page.locator('body').innerText()).slice(0, 8000);
  const lower = bodyText.toLowerCase();

  if (/captcha|verify you are human|cloudflare|turnstile|hcaptcha|robot/.test(lower)) {
    await saveState(page, 'HUMAN_VERIFICATION_REQUIRED');
    throw new Error('HUMAN_VERIFICATION_REQUIRED');
  }

  // QuickNode may show an optional bonus step; never post to X or connect a wallet.
  // Click at most one final free/base-drip action.
  const finalCandidates = [
    page.getByRole('button', { name: /claim|request|receive|send|drip|get.*eth/i }).first(),
    page.getByRole('button', { name: /^continue$/i }).first(),
  ];

  let clickedFinal = false;
  for (const candidate of finalCandidates) {
    if (await candidate.isVisible().catch(() => false) && await candidate.isEnabled().catch(() => false)) {
      await candidate.click();
      clickedFinal = true;
      break;
    }
  }

  if (!clickedFinal) {
    await saveState(page, 'NO_FINAL_FREE_DRIP_ACTION');
    throw new Error('NO_FINAL_FREE_DRIP_ACTION');
  }

  let finalBalance = 0n;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.waitForTimeout(1500);
    finalBalance = await balanceWei(page);
    if (finalBalance > 0n) break;
  }

  bodyText = await saveState(page, finalBalance > 0n ? 'FUNDED' : 'NOT_FUNDED', {
    balance_before_wei: before.toString(),
    balance_after_wei: finalBalance.toString(),
  });

  if (finalBalance === 0n) {
    if (/captcha|verify you are human|cloudflare|turnstile|hcaptcha|robot|verification/.test(bodyText.toLowerCase())) {
      throw new Error('HUMAN_VERIFICATION_REQUIRED');
    }
    throw new Error('FAUCET_DID_NOT_FUND_ADDRESS');
  }
});
