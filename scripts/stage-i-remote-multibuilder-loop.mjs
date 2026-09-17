import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from '@playwright/test';
import {
  ACCEPTANCE_MANIFEST_REFERENCE_KIND,
  ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
  digestAcceptanceManifest,
} from '../packages/inkubator-protocol/src/acceptance-manifest.mjs';

const base = process.env.TARGET_URL;
const sessionFile = process.env.SESSION_FILE;
const expectedProductSha = process.env.EXPECTED_PRODUCT_SHA;
if (!base || !sessionFile || !expectedProductSha) throw new Error('stage_i_remote_environment_missing');
const bootstrap = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
assert.equal(bootstrap.identities.length, 4);
const [organizer, ...builders] = bootstrap.identities;
assert.equal(builders.length, 3);
const baseUrl = new URL(base);
const acceptanceReferenceId = 'REF-STAGE-I-REMOTE-ACCEPTANCE';
const contractVersion = 'stage-i-remote-v1';

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function browserJson(page, method, path, body) {
  return page.evaluate(async ({method, path, body}) => {
    const response = await fetch(path, {
      method,
      credentials: 'include',
      ...(body === undefined ? {} : {
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(body),
      }),
    });
    const text = await response.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return {status: response.status, body: parsed};
  }, {method, path, body});
}

function assertStatus(response, expected, label) {
  assert.equal(response.status, expected, `${label}: ${JSON.stringify(response.body)}`);
  return response.body;
}

async function waitForChallengeStatus(page, challengeId, accepted, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const response = await browserJson(page, 'GET', `/v1/challenges/${challengeId}`);
    if (response.status === 200) {
      last = response.body;
      if (accepted.includes(last.status)) return last;
    }
    await sleep(1000);
  }
  throw new Error(`challenge_status_timeout_${accepted.join('_')}_last_${last?.status ?? 'unknown'}`);
}

async function contextFor(browser, identity) {
  const context = await browser.newContext();
  await context.addCookies([{
    name: '__Host-rekt_session',
    value: identity.session_token,
    domain: baseUrl.hostname,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  }]);
  const page = await context.newPage();
  const root = await page.goto(base, {waitUntil: 'domcontentloaded', timeout: 60_000});
  assert.equal(root?.status(), 200);
  const me = assertStatus(await browserJson(page, 'GET', '/v1/me'), 200, 'identity');
  assert.equal(me.player_id, identity.player_id);
  return {context, page};
}

const browser = await chromium.launch();
const evidence = {
  schema_version: 'stage-i.remote-multibuilder-loop/1.0',
  expected_product_sha: expectedProductSha,
  participant_count: 4,
  builder_count: 3,
  stages: [],
};
const stage = (name, detail = {}) => evidence.stages.push({name, status: 'PASS', ...detail});
const browserActors = [];
try {
  browserActors.push(await contextFor(browser, organizer));
  for (const builder of builders) browserActors.push(await contextFor(browser, builder));
  const organizerPage = browserActors[0].page;
  const builderPages = browserActors.slice(1).map((actor) => actor.page);
  stage('AUTH', {distinct_players: new Set(bootstrap.identities.map((item) => item.player_id)).size});

  const challengeId = randomUUID();
  const now = Date.now();
  const challengeBody = {
    request_id: randomUUID(),
    challenge_id: challengeId,
    slot_limit: 3,
    activation_minimum: 3,
    entry_deadline_ms: now + 20_000,
    submission_deadline_ms: now + 65_000,
    appeal_window_ms: 3_000,
    review_deadline_ms: now + 240_000,
  };
  const created = assertStatus(await browserJson(organizerPage, 'POST', '/v1/challenges', challengeBody), 201, 'challenge create');
  assert.equal(created.status, 'DRAFT');
  stage('POST', {challenge_id: challengeId});

  const proposal = {
    schema_version: 'inkubator.compiler-proposal/1.0',
    source_intent: 'Build a deterministic public static launch page.',
    requirements: [
      'accounts', 'persistence', 'uploads_private', 'realtime',
      'notifications', 'onchain_read', 'wallet_transactions', 'custody_private_keys',
    ].map((key) => ({key, value: false, provenance: 'ORGANIZER_ACCEPTED'})),
    knowledge: [],
    outcome_criteria: [],
    delivery_criteria: [],
    preferences: {},
  };
  const compilerState = assertStatus(await browserJson(organizerPage, 'POST', '/v1/compiler/compile', proposal), 200, 'compile');
  assert.equal(compilerState.status, 'READY');
  stage('COMPILE');

  const acceptanceManifest = {
    schema_version: ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
    challenge_id: challengeId,
    contract_version: contractVersion,
    bindings: [],
  };
  const authority = {
    contract_version: contractVersion,
    title: 'Stage I Remote Multi-Builder Rehearsal',
    brief: 'Exercise the deployed deterministic pre-money Challenge loop with three synthetic builders.',
    preferences: {},
    normative_constraints: [],
    normative_references: [{
      id: acceptanceReferenceId,
      kind: ACCEPTANCE_MANIFEST_REFERENCE_KIND,
      content_digest: digestAcceptanceManifest(acceptanceManifest),
    }],
    informational_references: [],
    prize_minor_units: 100,
    prize_display: '100 TEST',
    settlement_asset: 'TEST',
  };
  const preview = assertStatus(await browserJson(organizerPage, 'POST', `/v1/challenges/${challengeId}/build-contract-preview`, {
    compiler_state: compilerState,
    authority,
  }), 200, 'contract preview');
  const termsDigest = preview.contract.terms_digest;
  assert.match(termsDigest, /^[0-9a-f]{64}$/);
  const frozen = assertStatus(await browserJson(organizerPage, 'POST', `/v1/challenges/${challengeId}/build-contract`, {
    request_id: randomUUID(),
    compiler_state: compilerState,
    authority,
    expected_terms_digest: termsDigest,
  }), 200, 'contract freeze');
  assert.equal(frozen.terms_digest, termsDigest);
  stage('LOCK', {terms_digest: termsDigest});

  const launched = assertStatus(await browserJson(organizerPage, 'POST', `/v1/challenges/${challengeId}/stage-i-mock-launch`, {
    request_id: randomUUID(),
  }), 200, 'mock launch');
  assert.equal(launched.status, 'ENTRY_OPEN');
  assert.equal(preview.contract.settlement_asset, 'TEST');
  stage('FUND_TEST_ONLY', {real_value_moved: false});

  const entries = [];
  for (let index = 0; index < builderPages.length; index += 1) {
    const entryId = randomUUID();
    const joined = assertStatus(await browserJson(builderPages[index], 'POST', `/v1/challenges/${challengeId}/entries`, {
      request_id: randomUUID(),
      entry_id: entryId,
      expected_terms_digest: termsDigest,
    }), 201, `builder ${index + 1} join`);
    assert.equal(joined.entry_id, entryId);
    const capsule = assertStatus(await browserJson(builderPages[index], 'GET', `/v1/challenges/${challengeId}/my-build`), 200, `builder ${index + 1} capsule`);
    assert.equal(capsule.entry_id, entryId);
    assert.equal(capsule.challenge_id, challengeId);
    assert.equal(capsule.terms_digest, termsDigest);
    entries.push({entryId, page: builderPages[index]});
  }
  stage('JOIN', {entries: entries.length});
  stage('BUILD_CAPSULE', {capsules: entries.length});

  const building = await waitForChallengeStatus(organizerPage, challengeId, ['BUILDING'], 50_000);
  assert.equal(building.entry_count, 3);
  stage('BUILD', {status: building.status});

  const submissions = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const credential = assertStatus(await browserJson(entry.page, 'POST', `/v1/challenges/${challengeId}/submit-credential`, {
      request_id: randomUUID(),
      expires_in_seconds: 600,
    }), 201, `builder ${index + 1} credential`);
    assert.equal(credential.challenge_id, challengeId);
    assert.equal(credential.purpose, 'FINAL_SUBMISSION_ONLY');
    const submissionId = randomUUID();
    const submittedResponse = await fetch(`${base}/v1/challenges/${challengeId}/submissions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${credential.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        request_id: randomUUID(),
        submission_id: submissionId,
        entry_id: entry.entryId,
        expected_terms_digest: termsDigest,
        submission_version: 1,
        immutable_source_reference: {kind: 'CONTENT_ADDRESS', value: `stage-i-remote-${index + 1}`},
        artifact_digest: String(index + 1).repeat(64),
        evidence_references: [`stage-i-remote-builder-${index + 1}`],
      }),
    });
    const submittedBody = await submittedResponse.json();
    assert.equal(submittedResponse.status, 201, `builder ${index + 1} submit: ${JSON.stringify(submittedBody)}`);
    assert.equal(submittedBody.submission_id, submissionId);
    submissions.push({entryId: entry.entryId, submissionId});
  }
  stage('CHECK', {challenge_bound_credentials: 3});
  stage('SUBMIT', {submissions: submissions.length, transport: 'external_bearer'});

  const qualificationState = await waitForChallengeStatus(organizerPage, challengeId, ['QUALIFICATION'], 90_000);
  assert.equal(qualificationState.submission_count, 3);
  const revealed = assertStatus(await browserJson(organizerPage, 'GET', `/v1/challenges/${challengeId}/reveal-arena`), 200, 'reveal');
  assert.equal(revealed.submissions.length, 3);
  assert.equal(JSON.stringify(revealed).includes('archive_reference'), false);
  stage('REVEAL', {submissions: revealed.submissions.length});

  const qualifications = [];
  for (const submission of submissions) {
    const qualified = assertStatus(await browserJson(organizerPage, 'POST', `/v1/challenges/${challengeId}/test-arena/entries/${submission.entryId}/qualify`, {
      request_id: randomUUID(),
      qualification_id: randomUUID(),
      acceptance_manifest_reference_id: acceptanceReferenceId,
      acceptance_manifest: acceptanceManifest,
      human_observations: [],
    }), 200, `qualify ${submission.entryId}`);
    assert.equal(qualified.result, 'QUALIFIED');
    qualifications.push(qualified);
  }
  stage('TEST', {qualified: qualifications.length, inference_calls_required: 0, hidden_tests: 0});

  const selectionState = await waitForChallengeStatus(organizerPage, challengeId, ['SELECTION'], 100_000);
  assert.equal(selectionState.qualification_count, 3);
  const comparison = assertStatus(await browserJson(organizerPage, 'GET', `/v1/challenges/${challengeId}/qualifier-comparison`), 200, 'comparison');
  assert.equal(comparison.final_qualifier_ids.length, 3);
  assert.equal(comparison.qualifiers.length, 3);
  stage('COMPARE', {final_qualifiers: 3});

  const selectedEntryId = [...comparison.final_qualifier_ids].sort()[0];
  const selection = assertStatus(await browserJson(organizerPage, 'POST', `/v1/challenges/${challengeId}/selection`, {
    request_id: randomUUID(),
    decision_id: randomUUID(),
    selected_entry_id: selectedEntryId,
  }), 200, 'selection');
  assert.equal(selection.selected_entry_id, selectedEntryId);
  stage('PICK', {selected_entry_id: selectedEntryId});

  const receipts = assertStatus(await browserJson(organizerPage, 'GET', `/v1/challenges/${challengeId}/receipts`), 200, 'receipt transport');
  assert.deepEqual(receipts.receipts, []);
  stage('RECEIPT_TRANSPORT_PRE_MONEY', {receipt_count: 0, reason: 'no settlement execution authorized'});

  const finalPublic = assertStatus(await browserJson(organizerPage, 'GET', `/v1/challenges/${challengeId}`), 200, 'final public challenge');
  evidence.challenge_id = challengeId;
  evidence.final_status = finalPublic.status;
  evidence.entry_count = finalPublic.entry_count;
  evidence.submission_count = finalPublic.submission_count;
  evidence.qualification_count = finalPublic.qualification_count;
  evidence.receipt_count = finalPublic.receipt_count;
  evidence.selection_recorded = true;
  evidence.real_value_moved = false;
  evidence.verdict = 'PASS_PRE_MONEY_THROUGH_SELECTION';

  fs.writeFileSync('stage-i-remote-multibuilder-loop-proof.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({
    verdict: evidence.verdict,
    challenge_id: challengeId,
    builders: 3,
    submissions: finalPublic.submission_count,
    qualifications: finalPublic.qualification_count,
    receipts: finalPublic.receipt_count,
    real_value_moved: false,
  }));
} finally {
  for (const actor of browserActors) await actor.context.close().catch(() => {});
  await browser.close();
}
