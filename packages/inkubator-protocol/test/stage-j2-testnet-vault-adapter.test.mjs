import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILD_CONTRACT_SCHEMA_VERSION,
  IP_TERMS_VERSION,
  MECHANISM_VERSION,
  SETTLEMENT_POLICY_VERSION,
  freezeBuildContract,
} from '../src/challenge.mjs';
import {bindStageJ0SettlementAdapter} from '../src/settlement-adapter.mjs';
import {
  STAGE_J2_NETWORK,
  buildStageJ2FundingFact,
  buildStageJ2PayoutRoster,
  buildStageJ2VaultPlan,
  assertStageJ2VaultSnapshotMatchesPlan,
  stageJ2ReviewDeadlineSeconds,
} from '../src/testnet-vault-adapter.mjs';

const addresses = {
  token: '0x1000000000000000000000000000000000000001',
  refund: '0x2000000000000000000000000000000000000002',
  outcome: '0x3000000000000000000000000000000000000003',
  organizer: '0x4000000000000000000000000000000000000004',
  resolver: '0x5000000000000000000000000000000000000005',
  alice: '0x6000000000000000000000000000000000000006',
  bob: '0x7000000000000000000000000000000000000007',
  carol: '0x8000000000000000000000000000000000000008',
  vault: '0x9000000000000000000000000000000000000009',
};

function contract() {
  const t0 = 1_900_000_000_000;
  return freezeBuildContract({
    schema_version: BUILD_CONTRACT_SCHEMA_VERSION,
    challenge_id: 'CH-J2-REHEARSAL',
    contract_version: '1',
    mechanism_version: MECHANISM_VERSION,
    settlement_policy_version: SETTLEMENT_POLICY_VERSION,
    ip_terms_version: IP_TERMS_VERSION,
    title: 'J2',
    brief: 'Public testnet rehearsal',
    outcome_contract: {criteria: []},
    production_envelope: {criteria: []},
    delivery_contract: {criteria: []},
    preferences: {},
    reference_architecture: {},
    normative_constraints: [],
    normative_references: [],
    informational_references: [],
    knowledge: [],
    slot_limit: 3,
    activation_minimum: 1,
    entry_deadline: t0 + 1_000,
    build_start: t0 + 1_000,
    submission_deadline: t0 + 2_000,
    appeal_window_ms: 1_000,
    review_deadline: t0 + 2_001,
    prize_minor_units: 250_000_000,
    prize_display: '250 TEST USDC',
    settlement_asset: 'USDC_TEST',
  });
}

function binding(c = contract()) {
  return bindStageJ0SettlementAdapter({
    contract: c,
    adapter_kind: 'TESTNET_CHALLENGE_VAULT',
    adapter_ref: 'ink-sepolia:j2-rehearsal:challenge-vault-v1',
    network_id: STAGE_J2_NETWORK.network_id,
  });
}

function plan() {
  const c = contract();
  return buildStageJ2VaultPlan({
    contract: c,
    binding: binding(c),
    token_address: addresses.token,
    refund_recipient: addresses.refund,
    outcome_authority: addresses.outcome,
    organizer_selection_authority: addresses.organizer,
    resolver_authority: addresses.resolver,
    entries: [
      {entry_id: 'E-C', payout_address: addresses.carol},
      {entry_id: 'E-A', payout_address: addresses.alice},
      {entry_id: 'E-B', payout_address: addresses.bob},
    ],
  });
}

test('J2 pins the official Ink Sepolia public testnet', () => {
  assert.equal(STAGE_J2_NETWORK.chain_id, 763373);
  assert.equal(STAGE_J2_NETWORK.network_id, 'ink-sepolia:763373');
  assert.equal(STAGE_J2_NETWORK.rpc_url, 'https://rpc-gel-sepolia.inkonchain.com');
  assert.equal(STAGE_J2_NETWORK.explorer_url, 'https://explorer-sepolia.inkonchain.com');
});

test('J2 rounds review deadline upward so frozen default cannot start early', () => {
  assert.equal(stageJ2ReviewDeadlineSeconds(1_900_000_002_001), 1_900_000_003);
  assert.equal(stageJ2ReviewDeadlineSeconds(1_900_000_003_000), 1_900_000_003);
});

test('J2 derives payout order from canonical entry IDs and never caller order', () => {
  const roster = buildStageJ2PayoutRoster([
    {entry_id: 'E-C', payout_address: addresses.carol},
    {entry_id: 'E-A', payout_address: addresses.alice},
    {entry_id: 'E-B', payout_address: addresses.bob},
  ]);
  assert.deepEqual(roster.map(({entry_id, payout_order}) => ({entry_id, payout_order})), [
    {entry_id: 'E-A', payout_order: 0},
    {entry_id: 'E-B', payout_order: 1},
    {entry_id: 'E-C', payout_order: 2},
  ]);
  roster.forEach((entry) => assert.match(entry.entry_digest, /^0x[0-9a-f]{64}$/));
});

test('J2 rejects duplicate payouts and more recipients than the bounded J1 vault', () => {
  assert.throws(() => buildStageJ2PayoutRoster([
    {entry_id: 'E-A', payout_address: addresses.alice},
    {entry_id: 'E-B', payout_address: addresses.alice},
  ]), /payout addresses must be unique/);
  assert.throws(() => buildStageJ2PayoutRoster([
    {entry_id: 'E-A', payout_address: addresses.alice},
    {entry_id: 'E-B', payout_address: addresses.bob},
    {entry_id: 'E-C', payout_address: addresses.carol},
    {entry_id: 'E-D', payout_address: addresses.vault},
  ]), /at most 3/);
});

test('J2 plan binds exact J0 economics, deadline, token and independent authorities', () => {
  const p = plan();
  assert.equal(p.prize_minor_units, 250_000_000);
  assert.equal(p.asset, 'USDC_TEST');
  assert.equal(p.network.chain_id, 763373);
  assert.equal(p.token_address, addresses.token);
  assert.equal(p.organizer_selection_deadline_seconds, stageJ2ReviewDeadlineSeconds(p.review_deadline_ms));
  assert.match(p.challenge_digest, /^0x[0-9a-f]{64}$/);
  assert.match(p.plan_digest, /^[0-9a-f]{64}$/);
});

test('J2 rejects the mainnet/wrong-network binding and collapsed authorities', () => {
  const c = contract();
  const wrongNetwork = bindStageJ0SettlementAdapter({
    contract: c,
    adapter_kind: 'TESTNET_CHALLENGE_VAULT',
    adapter_ref: 'wrong',
    network_id: 'ink-mainnet:57073',
  });
  assert.throws(() => buildStageJ2VaultPlan({
    contract: c,
    binding: wrongNetwork,
    token_address: addresses.token,
    refund_recipient: addresses.refund,
    outcome_authority: addresses.outcome,
    organizer_selection_authority: addresses.organizer,
    resolver_authority: addresses.resolver,
    entries: [{entry_id: 'E-A', payout_address: addresses.alice}],
  }), /must target Ink Sepolia/);

  assert.throws(() => buildStageJ2VaultPlan({
    contract: c,
    binding: binding(c),
    token_address: addresses.token,
    refund_recipient: addresses.refund,
    outcome_authority: addresses.outcome,
    organizer_selection_authority: addresses.outcome,
    resolver_authority: addresses.resolver,
    entries: [{entry_id: 'E-A', payout_address: addresses.alice}],
  }), /pairwise independent/);
});

test('J2 snapshot verification fails closed on any deployed immutable mismatch', () => {
  const p = plan();
  const snapshot = {
    schema_version: 'inkubator.testnet-vault-snapshot/1.0',
    plan_digest: p.plan_digest,
    vault_address: addresses.vault,
    chain_id: p.network.chain_id,
    token_address: p.token_address,
    challenge_digest: p.challenge_digest,
    terms_digest: p.terms_digest,
    binding_digest: p.binding_digest,
    prize_minor_units: p.prize_minor_units,
    organizer_selection_deadline_seconds: p.organizer_selection_deadline_seconds,
    refund_recipient: p.refund_recipient,
    outcome_authority: p.outcome_authority,
    organizer_selection_authority: p.organizer_selection_authority,
    resolver_authority: p.resolver_authority,
  };
  assert.equal(assertStageJ2VaultSnapshotMatchesPlan(p, snapshot), snapshot);
  assert.throws(() => assertStageJ2VaultSnapshotMatchesPlan(p, {...snapshot, chain_id: 57073}), /chain_id mismatch/);
  assert.throws(() => assertStageJ2VaultSnapshotMatchesPlan(p, {...snapshot, token_address: addresses.alice}), /token_address mismatch/);
  assert.throws(() => assertStageJ2VaultSnapshotMatchesPlan(p, {...snapshot, organizer_selection_deadline_seconds: p.organizer_selection_deadline_seconds - 1}), /deadline_seconds mismatch/);
});

test('J2 funding fact is J0-valid and carries only testnet transaction evidence', () => {
  const c = contract();
  const b = binding(c);
  const fact = buildStageJ2FundingFact({
    contract: c,
    binding: b,
    vault_address: addresses.vault,
    funding_tx_hash: `0x${'a'.repeat(64)}`,
  });
  assert.equal(fact.status, 'CONFIRMED_TEST');
  assert.equal(fact.amount_minor_units, c.prize_minor_units);
  assert.match(fact.funding_ref, /^ink-sepolia:763373:tx:0x[0-9a-f]{64}:vault:0x[0-9a-f]{40}$/);
});
