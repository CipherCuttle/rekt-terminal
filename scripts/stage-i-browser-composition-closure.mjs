import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const base = process.env.TARGET_URL;
const sessionFile = process.env.SESSION_FILE;
const expectedProductSha = process.env.EXPECTED_PRODUCT_SHA;
if (!base || !sessionFile || !expectedProductSha) throw new Error('stage_i_browser_closure_environment_missing');

const bootstrap = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
const loopProof = JSON.parse(fs.readFileSync('stage-i-remote-multibuilder-loop-proof.json', 'utf8'));
assert.equal(loopProof.expected_product_sha, expectedProductSha);
assert.equal(loopProof.verdict, 'PASS_PRE_MONEY_THROUGH_SELECTION');
assert.equal(loopProof.builder_count, 3);
const testStage = loopProof.stages.find((item) => item.name === 'TEST');
assert.equal(testStage?.inference_calls_required, 0);
const challengeId = loopProof.challenge_id;
assert.match(challengeId, /^[0-9a-f-]{36}$/i);

const [organizer, ...builders] = bootstrap.identities;
assert.equal(builders.length, 3);
const hostname = new URL(base).hostname;
const browser = await chromium.launch();
const actors = [];
const browserSubmissionPosts = [];

async function actorFor(identity) {
  const context = await browser.newContext();
  await context.addCookies([{
    name: '__Host-rekt_session', value: identity.session_token, domain: hostname,
    path: '/', httpOnly: true, secure: true, sameSite: 'Lax',
  }]);
  const page = await context.newPage();
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname === `/v1/challenges/${challengeId}/submissions`) {
      browserSubmissionPosts.push({player_id: identity.player_id, url: url.pathname});
    }
  });
  actors.push({context, page, identity});
  return page;
}

async function gotoSurface(page, surface) {
  const response = await page.goto(`${base}/?challenge=${challengeId}&surface=${surface}`, {
    waitUntil: 'domcontentloaded', timeout: 60_000,
  });
  assert.equal(response?.status(), 200);
  await page.locator('main.challenge-product').waitFor({state: 'visible', timeout: 30_000});
}

try {
  const organizerPage = await actorFor(organizer);
  const builderPages = [];
  for (const builder of builders) builderPages.push(await actorFor(builder));

  const entryIds = [];
  for (const page of builderPages) {
    await gotoSurface(page, 'challenge');
    await page.getByRole('heading', {name: 'JOIN FROZEN CHALLENGE'}).waitFor({state: 'visible'});
    const challengeText = await page.locator('#challenge-workspace').innerText();
    assert.match(challengeText, /PUBLIC PROJECTION ONLY/);

    await gotoSurface(page, 'my-build');
    const capsule = page.locator('[aria-label="Canonical Builder Capsule"]');
    await capsule.waitFor({state: 'visible', timeout: 30_000});
    const rows = capsule.locator('div');
    const entryRow = rows.filter({hasText: /^ENTRY/}).first();
    const entryId = (await entryRow.locator('dd').innerText()).trim();
    assert.match(entryId, /^[0-9a-f-]{36}$/i);
    entryIds.push(entryId);
    await page.getByText('The browser does not perform immutable final submission.', {exact: false}).waitFor({state: 'visible'});
    assert.equal(await page.locator('[data-stage-i-submit-credential="issued"]').count(), 0);
  }
  assert.equal(new Set(entryIds).size, 3);

  await gotoSurface(organizerPage, 'review');
  await organizerPage.getByRole('heading', {name: 'Organizer Reveal / Test Arena / Selection.'}).waitFor({state: 'visible', timeout: 30_000});
  const reviewText = await organizerPage.locator('#challenge-workspace').innerText();
  assert.match(reviewText, /REVEAL ARENA/);
  assert.match(reviewText, /FINAL QUALIFIERS \/ SELECTION/);
  assert.match(reviewText, /3 FINAL QUALIFIERS/);
  assert.match(reviewText, /no hidden criteria, no LLM judge/i);

  await gotoSurface(organizerPage, 'history');
  const historyState = organizerPage.locator('#challenge-workspace [data-surface-state]').first();
  await historyState.waitFor({state: 'visible'});
  assert.equal(await historyState.getAttribute('data-surface-state'), 'empty');
  const historyText = await organizerPage.locator('#challenge-workspace').innerText();
  assert.match(historyText, /No durable Challenge receipts yet/);
  assert.match(historyText, /does not infer settlement or selection/i);

  await gotoSurface(organizerPage, 'operator');
  const operatorState = organizerPage.locator('#challenge-workspace [data-surface-state]').first();
  await operatorState.waitFor({state: 'visible'});
  assert.equal(await operatorState.getAttribute('data-surface-state'), 'unauthorized');
  const operatorText = await organizerPage.locator('#challenge-workspace').innerText();
  assert.match(operatorText, /UNAUTHORIZED \/ FAIL CLOSED/);
  assert.match(operatorText, /Exception handling is fail-closed/);

  const degradedPage = builderPages[0];
  const myBuildPattern = `**/v1/challenges/${challengeId}/my-build`;
  await degradedPage.route(myBuildPattern, async (route) => {
    await route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({error: 'stage_i_rehearsal_injected_unavailable'})});
  });
  await gotoSurface(degradedPage, 'my-build');
  const degradedState = degradedPage.locator('#challenge-workspace [data-surface-state="error"]');
  await degradedState.waitFor({state: 'visible', timeout: 30_000});
  const degradedText = await degradedState.innerText();
  assert.match(degradedText, /Builder Capsule unavailable/);
  assert.match(degradedText, /No private entry data is guessed or substituted/);
  await degradedPage.unroute(myBuildPattern);

  assert.deepEqual(browserSubmissionPosts, []);

  const proof = {
    schema_version: 'stage-i.browser-composition-closure/1.0',
    expected_product_sha: expectedProductSha,
    challenge_id: challengeId,
    builder_contexts: 3,
    distinct_builder_entries: new Set(entryIds).size,
    traversed_surfaces: ['CHALLENGE', 'MY_BUILD', 'REVIEW', 'HISTORY', 'OPERATOR'],
    browser_immutable_submission_posts: browserSubmissionPosts.length,
    operator_fail_closed: true,
    injected_transport_degradation_fail_closed: true,
    inference_calls_required: 0,
    real_value_moved: false,
    verdict: 'PASS_STAGE_I_BROWSER_AND_DEGRADED_COMPOSITION',
  };
  fs.writeFileSync('stage-i-browser-composition-closure-proof.json', JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof));
} finally {
  for (const actor of actors) await actor.context.close().catch(() => {});
  await browser.close();
}
