import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STAGE_J4_EXCLUDED_USDC_E,
  STAGE_J4_FINALITY_PROVIDERS,
  STAGE_J4_NATIVE_USDC,
  appendStageJ4ReconciliationReceipt,
  buildStageJ4DeploymentPlan,
  buildStageJ4SigningRequest,
  buildStageJ4ReleaseCandidateReceipt,
  evaluateStageJ4Finality,
  registerStageJ4SigningRequest,
  stageJ4DeadlineSeconds,
} from '../src/production-candidate-vault-adapter.mjs';

const DIGEST_A = '0x' + '11'.repeat(32);
const DIGEST_B = '0x' + '22'.repeat(32);
const DIGEST_C = '0x' + '33'.repeat(32);
const DIGEST_D = '0x' + '44'.repeat(32);
const DIGEST_E = '0x' + '55'.repeat(32);
const DIGEST_F = '0x' + '66'.repeat(32);

test('ceil millisecond deadlines never authorize early', () => {
  assert.equal(stageJ4DeadlineSeconds(1_000), 1);
  assert.equal(stageJ4DeadlineSeconds(1_001), 2);
  assert.equal(stageJ4DeadlineSeconds(1_999), 2);
  assert.equal(stageJ4DeadlineSeconds(2_000), 2);
});

test('deadline conversion is monotonic and never floors sub-second remainder', () => {
  let previous = -1;
  for (let ms = 0; ms <= 10_000; ms += 137) {
    const seconds = stageJ4DeadlineSeconds(ms);
    assert.ok(seconds >= previous);
    assert.ok(seconds * 1000 >= ms);
    if (ms > 0) assert.ok((seconds - 1) * 1000 < ms || ms % 1000 === 0);
    previous = seconds;
  }
});

test('deployment plan freezes exact Ink/native-USDC tuple and recovery offsets', () => {
  const plan = buildStageJ4DeploymentPlan({
    source_commit: 'a'.repeat(40),
    challenge_digest: DIGEST_A,
    terms_digest: DIGEST_B,
    binding_digest: DIGEST_C,
    token_address: STAGE_J4_NATIVE_USDC.address,
    refund_recipient: '0x' + '10'.repeat(20),
    outcome_authority: '0x' + '20'.repeat(20),
    organizer_selection_authority: '0x' + '30'.repeat(20),
    resolver_authority: '0x' + '40'.repeat(20),
    resolver_signer_set_digest: DIGEST_D,
    prize_minor_units: 250_000_000,
    activation_deadline_ms: 10_001,
    organizer_selection_deadline_ms: 20_999,
    prebuild_refund_manifest_digest: DIGEST_E,
    terminal_refund_manifest_digest: DIGEST_F,
  });

  assert.equal(plan.network.chain_id, 57073);
  assert.equal(plan.token_address ?? plan.asset.address, STAGE_J4_NATIVE_USDC.address);
  assert.equal(plan.activation_deadline_seconds, 11);
  assert.equal(plan.organizer_selection_deadline_seconds, 21);
  assert.equal(plan.resolution_deadline_seconds, 21 + 72 * 60 * 60);
  assert.equal(plan.terminal_long_stop_seconds, 21 + 30 * 24 * 60 * 60);
  assert.equal(plan.authority, 'NO_MAINNET_NO_MONEY');
});

test('deployment plan rejects bridged/wrong token identity', () => {
  assert.throws(() => buildStageJ4DeploymentPlan({
    source_commit: 'a'.repeat(40),
    challenge_digest: DIGEST_A,
    terms_digest: DIGEST_B,
    binding_digest: DIGEST_C,
    token_address: STAGE_J4_EXCLUDED_USDC_E.address,
    refund_recipient: '0x' + '10'.repeat(20),
    outcome_authority: '0x' + '20'.repeat(20),
    organizer_selection_authority: '0x' + '30'.repeat(20),
    resolver_authority: '0x' + '40'.repeat(20),
    resolver_signer_set_digest: DIGEST_D,
    prize_minor_units: 1,
    activation_deadline_ms: 1_000,
    organizer_selection_deadline_ms: 2_000,
    prebuild_refund_manifest_digest: DIGEST_E,
    terminal_refund_manifest_digest: DIGEST_F,
  }), /exact native Ink USDC/);
});

function finalityObservation(provider, overrides = {}) {
  return {
    provider_id: provider,
    chain_id: 57073,
    tx_hash: DIGEST_A,
    tx_success: true,
    block_number: 100,
    block_hash: DIGEST_B,
    canonical_block_hash: DIGEST_B,
    finalized_head_number: 120,
    ...overrides,
  };
}

function evaluate(observations, expectedTxHash = DIGEST_A) {
  return evaluateStageJ4Finality({
    expected_tx_hash: expectedTxHash,
    observations,
  });
}

test('finality requires two distinct agreeing providers at finalized canonical heads', () => {
  const result = evaluate([
    finalityObservation('gelato'),
    finalityObservation('quicknode'),
  ]);
  assert.equal(result.state, 'FINALIZED');
  assert.equal(result.block_number, 100);
});

test('finality reconciliation is idempotent for identical evidence', () => {
  const input = [
    finalityObservation('gelato'),
    finalityObservation('quicknode'),
  ];
  assert.deepEqual(evaluate(input), evaluate(input));
});

test('provider disagreement, lag, missing evidence and reorg stay reconciling', () => {
  assert.equal(evaluate([finalityObservation('gelato')]).state, 'RECONCILING');

  assert.equal(evaluate([
    finalityObservation('gelato'),
    finalityObservation('quicknode', {block_hash: DIGEST_C, canonical_block_hash: DIGEST_C}),
  ]).state, 'RECONCILING');

  assert.equal(evaluate([
    finalityObservation('gelato'),
    finalityObservation('quicknode', {finalized_head_number: 99}),
  ]).state, 'RECONCILING');

  assert.equal(evaluate([
    finalityObservation('gelato'),
    finalityObservation('quicknode', {canonical_block_hash: DIGEST_C}),
  ]).state, 'RECONCILING');
});

test('finality is bound to the expected Ink settlement tx and frozen provider set', () => {
  assert.deepEqual([...STAGE_J4_FINALITY_PROVIDERS].sort(), ['gelato', 'quicknode']);

  assert.equal(evaluate([
    finalityObservation('gelato'),
    finalityObservation('quicknode'),
  ], DIGEST_C).state, 'RECONCILING');

  assert.equal(evaluate([
    finalityObservation('gelato', {chain_id: 1}),
    finalityObservation('quicknode'),
  ]).state, 'RECONCILING');

  assert.equal(evaluate([
    finalityObservation('gelato'),
    finalityObservation('unknown-provider'),
  ]).state, 'RECONCILING');

  assert.equal(evaluate([
    finalityObservation('gelato'),
    finalityObservation('gelato'),
  ]).state, 'RECONCILING');
});

test('release receipt pins toolchain, hashes, tuple and remains non-production', () => {
  const receipt = buildStageJ4ReleaseCandidateReceipt({
    source_commit: 'b'.repeat(40),
    foundry_toml_digest: DIGEST_A,
    artifact_digest: DIGEST_B,
    constructor_abi_digest: DIGEST_C,
    vault_creation_bytecode_hash: DIGEST_D,
    vault_runtime_bytecode_hash: DIGEST_E,
    resolver_creation_bytecode_hash: DIGEST_F,
    resolver_runtime_bytecode_hash: DIGEST_A,
    resolver_signer_set_digest: DIGEST_B,
  });

  assert.equal(receipt.toolchain.foundry, '1.8.3');
  assert.equal(receipt.toolchain.solc, '0.8.37');
  assert.equal(receipt.chain_id, 57073);
  assert.equal(receipt.token_address, STAGE_J4_NATIVE_USDC.address);
  assert.equal(receipt.external_audit, 'NOT_STARTED');
  assert.equal(receipt.production_money, 'NOT_AUTHORIZED');
  assert.match(receipt.release_digest, /^[0-9a-f]{64}$/);
});


test('reconciliation corrections append and supersede without mutating prior facts', () => {
  const first = appendStageJ4ReconciliationReceipt([], {
    record_id: 'settlement-1',
    kind: 'FINALIZED',
    expected_tx_hash: DIGEST_A,
    evidence_digest: DIGEST_B,
    recorded_at_ms: 1_000,
  });
  assert.equal(first.length, 1);
  assert.equal(first[0].supersedes_record_id, null);

  const corrected = appendStageJ4ReconciliationReceipt(first, {
    record_id: 'settlement-1-correction-1',
    kind: 'CORRECTION',
    expected_tx_hash: DIGEST_A,
    evidence_digest: DIGEST_C,
    recorded_at_ms: 2_000,
    supersedes_record_id: 'settlement-1',
  });

  assert.equal(corrected.length, 2);
  assert.deepEqual(corrected[0], first[0]);
  assert.equal(corrected[1].supersedes_record_id, 'settlement-1');
  assert.equal(corrected[1].expected_tx_hash, DIGEST_A);

  const replay = appendStageJ4ReconciliationReceipt(corrected, corrected[1]);
  assert.deepEqual(replay, corrected);

  assert.throws(() => appendStageJ4ReconciliationReceipt(corrected, {
    ...corrected[1],
    evidence_digest: DIGEST_D,
  }), /record id conflict/);

  assert.throws(() => appendStageJ4ReconciliationReceipt(corrected, {
    record_id: 'settlement-1-correction-2',
    kind: 'CORRECTION',
    expected_tx_hash: DIGEST_E,
    evidence_digest: DIGEST_F,
    recorded_at_ms: 3_000,
    supersedes_record_id: 'settlement-1-correction-1',
  }), /cannot change settlement transaction identity/);

  assert.throws(() => appendStageJ4ReconciliationReceipt(corrected, {
    record_id: 'settlement-1-correction-fork',
    kind: 'CORRECTION',
    expected_tx_hash: DIGEST_A,
    evidence_digest: DIGEST_F,
    recorded_at_ms: 3_000,
    supersedes_record_id: 'settlement-1',
  }), /must supersede latest receipt/);
});


test('signing requests bind human fields to typed digest and reject semantic reuse', () => {
  const request = buildStageJ4SigningRequest({
    request_id: 'qualifier-freeze-1',
    authority_role: 'OUTCOME',
    action: 'QUALIFIER_SET',
    vault_address: '0x1111111111111111111111111111111111111111',
    typed_data_digest: '0xfd1656fab8c2c886907ad90e2653f37eafd7da10244871054c8dea25ac7cf138',
    display_fields: {
      challenge_digest: '0x' + 'aa'.repeat(32),
      terms_digest: '0x' + 'bb'.repeat(32),
      binding_digest: '0x' + 'cc'.repeat(32),
      payout_set_root: '0x0195b69843ca1d3cc2e4bfdb67b9a5d3c0719929a033f045db6d90095cf0312d',
      qualifier_set_root: '0x281a7222c0e843ba2a41febded46e963bf6cde4ba6697bcfa51c6537e7b8f643',
      qualifier_count: 1,
      default_manifest_digest: '0x' + 'ee'.repeat(32),
      recovery_evidence_digest: '0x' + '00'.repeat(32),
      mode: 'NORMAL',
    },
  });

  assert.equal(request.chain_id, 57073);
  assert.equal(request.typed_data_digest, '0xfd1656fab8c2c886907ad90e2653f37eafd7da10244871054c8dea25ac7cf138');
  assert.match(request.display_fields_digest, /^[0-9a-f]{64}$/);
  assert.match(request.request_digest, /^[0-9a-f]{64}$/);

  const once = registerStageJ4SigningRequest([], request);
  const replay = registerStageJ4SigningRequest(once, request);
  assert.deepEqual(replay, once);

  assert.throws(() => registerStageJ4SigningRequest(once, {
    ...request,
    display_fields: {...request.display_fields, qualifier_count: 2},
  }), /signing request id conflict/);
});
