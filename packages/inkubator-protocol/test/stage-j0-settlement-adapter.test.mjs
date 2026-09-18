import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILD_CONTRACT_SCHEMA_VERSION,
  MECHANISM_VERSION,
  SETTLEMENT_POLICY_VERSION,
  IP_TERMS_VERSION,
  freezeBuildContract,
  buildSettlementIntent,
  computeDefaultResolution,
} from '../src/challenge.mjs';
import {
  SETTLEMENT_AUTHORIZATION_SCHEMA_VERSION,
  SETTLEMENT_FUNDING_FACT_SCHEMA_VERSION,
  bindStageJ0SettlementAdapter,
  assertStageJ0SettlementAdapterBinding,
  assertStageJ0FundingFactMatchesBinding,
  buildStageJ0SettlementManifest,
  assertStageJ0SettlementManifest,
  assertStageJ0SettlementManifestMatchesIntent,
  assertRecordedStageJ0AuthorizationSet,
  buildStageJ0ExecutionEnvelope,
  assertStageJ0ExecutionEnvelopeMatchesManifest,
  canTransitionSettlementAdapterState,
  transitionSettlementAdapterState,
} from '../src/settlement-adapter.mjs';

const t0 = 1_800_000_000_000;

function contract() {
  return freezeBuildContract({
    schema_version: BUILD_CONTRACT_SCHEMA_VERSION,
    challenge_id: 'CH-J0',
    contract_version: '1',
    mechanism_version: MECHANISM_VERSION,
    settlement_policy_version: SETTLEMENT_POLICY_VERSION,
    ip_terms_version: IP_TERMS_VERSION,
    title: 'J0',
    brief: 'Test-only settlement adapter',
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
    entry_deadline: t0 + 10,
    build_start: t0 + 10,
    submission_deadline: t0 + 20,
    appeal_window_ms: 10,
    review_deadline: t0 + 40,
    prize_minor_units: 250_000_000,
    prize_display: '250 TEST USDC',
    settlement_asset: 'USDC_TEST',
  });
}

function binding(c = contract()) {
  return bindStageJ0SettlementAdapter({
    contract: c,
    adapter_kind: 'TESTNET_CHALLENGE_VAULT',
    adapter_ref: 'vault:test:CH-J0',
    network_id: 'ink-testnet',
  });
}

function winnerIntent(c = contract()) {
  return buildSettlementIntent({
    contract: c,
    resolution: {
      type: 'WINNER_PAYOUT',
      winner_entry_id: 'E1',
      distributions: [{entry_id: 'E1', amount_minor_units: c.prize_minor_units}],
    },
    recipientByEntryId: {E1: 'wallet:alice', E2: 'wallet:bob'},
  });
}

function auth(manifest, authority, actor) {
  return {
    schema_version: SETTLEMENT_AUTHORIZATION_SCHEMA_VERSION,
    value_mode: 'TEST_ONLY',
    manifest_digest: manifest.manifest_digest,
    authority,
    actor_id: actor,
    verification_ref: `verified:${authority}:${actor}`,
  };
}

test('J0 allows only test-only mock/testnet adapters and binds exact frozen economics', () => {
  const c = contract();
  const b = binding(c);
  assert.equal(assertStageJ0SettlementAdapterBinding(b), b);
  assert.equal(b.value_mode, 'TEST_ONLY');
  assert.equal(b.amount_minor_units, c.prize_minor_units);
  assert.throws(() => bindStageJ0SettlementAdapter({
    contract: c,
    adapter_kind: 'AUDITED_CHALLENGE_VAULT',
    adapter_ref: 'mainnet:vault',
    network_id: 'ink-mainnet',
  }), /not authorized/);
});

test('J0 funding fact must match exact binding, terms, asset and amount', () => {
  const c = contract();
  const b = binding(c);
  const fact = {
    schema_version: SETTLEMENT_FUNDING_FACT_SCHEMA_VERSION,
    value_mode: 'TEST_ONLY',
    binding_digest: b.binding_digest,
    challenge_id: c.challenge_id,
    terms_digest: c.terms_digest,
    asset: c.settlement_asset,
    amount_minor_units: c.prize_minor_units,
    status: 'CONFIRMED_TEST',
    funding_ref: 'testnet:funding:1',
  };
  assert.equal(assertStageJ0FundingFactMatchesBinding(c, b, fact), fact);
  assert.throws(() => assertStageJ0FundingFactMatchesBinding(c, b, {...fact, amount_minor_units: c.prize_minor_units - 1}), /amount mismatch/);
  assert.throws(() => assertStageJ0FundingFactMatchesBinding(c, b, {...fact, asset: 'OTHER'}), /asset mismatch/);
});

test('winner settlement requires independent outcome and organizer-selection authorization', () => {
  const c = contract();
  const b = binding(c);
  const intent = winnerIntent(c);
  const manifest = buildStageJ0SettlementManifest({contract: c, settlementIntent: intent, binding: b});
  assert.deepEqual(manifest.required_authorities, ['INKUBATOR_OUTCOME', 'ORGANIZER_SELECTION']);
  const facts = [
    auth(manifest, 'INKUBATOR_OUTCOME', 'outcome-authority'),
    auth(manifest, 'ORGANIZER_SELECTION', 'organizer'),
  ];
  assert.equal(assertRecordedStageJ0AuthorizationSet(manifest, facts), facts);
  assert.throws(() => assertRecordedStageJ0AuthorizationSet(manifest, facts.slice(0, 1)), /does not satisfy manifest/);
  assert.throws(() => assertRecordedStageJ0AuthorizationSet(manifest, [
    auth(manifest, 'INKUBATOR_OUTCOME', 'same-actor'),
    auth(manifest, 'ORGANIZER_SELECTION', 'same-actor'),
  ]), /must be independent/);
});

test('authorization facts cannot be replayed against a different settlement manifest', () => {
  const c = contract();
  const b = binding(c);
  const winner = buildStageJ0SettlementManifest({contract: c, settlementIntent: winnerIntent(c), binding: b});
  const fallbackIntent = buildSettlementIntent({
    contract: c,
    resolution: computeDefaultResolution(['E1', 'E2'], c.prize_minor_units),
    recipientByEntryId: {E1: 'wallet:alice', E2: 'wallet:bob'},
  });
  const fallback = buildStageJ0SettlementManifest({contract: c, settlementIntent: fallbackIntent, binding: b});
  assert.throws(() => assertRecordedStageJ0AuthorizationSet(fallback, [
    auth(winner, 'FROZEN_POLICY', 'policy'),
    auth(winner, 'INKUBATOR_OUTCOME', 'outcome-authority'),
  ]), /manifest mismatch/);
});

test('default distribution is policy-bound, winnerless and claimable', () => {
  const c = contract();
  const b = binding(c);
  const intent = buildSettlementIntent({
    contract: c,
    resolution: computeDefaultResolution(['E1', 'E2'], c.prize_minor_units),
    recipientByEntryId: {E1: 'wallet:alice', E2: 'wallet:bob'},
  });
  const manifest = buildStageJ0SettlementManifest({contract: c, settlementIntent: intent, binding: b});
  assert.equal(manifest.winner_entry_id, null);
  assert.deepEqual(manifest.required_authorities, ['FROZEN_POLICY', 'INKUBATOR_OUTCOME']);
  assert.equal(manifest.delivery_mode, 'CLAIMABLE');
  const total = manifest.recipients.reduce((sum, recipient) => sum + recipient.amount_minor_units, 0);
  assert.equal(total, c.prize_minor_units);
});

test('execution envelope has no caller-controlled recipient surface', () => {
  const c = contract();
  const b = binding(c);
  const intent = winnerIntent(c);
  const manifest = buildStageJ0SettlementManifest({contract: c, settlementIntent: intent, binding: b});
  const authorizationFacts = [
    auth(manifest, 'INKUBATOR_OUTCOME', 'outcome-authority'),
    auth(manifest, 'ORGANIZER_SELECTION', 'organizer'),
  ];
  const envelope = buildStageJ0ExecutionEnvelope({contract: c, settlementIntent: intent, binding: b, manifest, authorizationFacts});
  assert.equal(assertStageJ0ExecutionEnvelopeMatchesManifest(manifest, envelope), envelope);
  assert.equal(envelope.delivery_mode, 'CLAIMABLE');
  assert.deepEqual(envelope.recipients, manifest.recipients);
  const forged = structuredClone(envelope);
  forged.recipients[0].recipient_id = 'wallet:attacker';
  assert.throws(() => assertStageJ0ExecutionEnvelopeMatchesManifest(manifest, forged), /digest mismatch|recipients mismatch/);
});

test('manifest digest closes recipient and authority-set mutation', () => {
  const c = contract();
  const b = binding(c);
  const intent = winnerIntent(c);
  const manifest = buildStageJ0SettlementManifest({contract: c, settlementIntent: intent, binding: b});
  assert.equal(assertStageJ0SettlementManifestMatchesIntent(c, intent, b, manifest), manifest);
  const redirected = structuredClone(manifest);
  redirected.recipients[0].recipient_id = 'wallet:attacker';
  assert.throws(() => assertStageJ0SettlementManifest(redirected), /digest mismatch/);
  const weakened = structuredClone(manifest);
  weakened.required_authorities = ['ORGANIZER_SELECTION'];
  assert.throws(() => assertStageJ0SettlementManifest(weakened), /digest mismatch/);
});

test('settlement adapter state machine cannot jump from unfunded or bound state to settlement', () => {
  assert.equal(canTransitionSettlementAdapterState('UNBOUND', 'BOUND'), true);
  assert.equal(canTransitionSettlementAdapterState('BOUND', 'FUNDED'), true);
  assert.equal(canTransitionSettlementAdapterState('FUNDED', 'AUTHORIZED'), true);
  assert.equal(canTransitionSettlementAdapterState('AUTHORIZED', 'EXECUTION_PENDING'), true);
  assert.equal(canTransitionSettlementAdapterState('EXECUTION_PENDING', 'RECONCILING'), true);
  assert.equal(canTransitionSettlementAdapterState('RECONCILING', 'FINALIZED'), true);
  assert.throws(() => transitionSettlementAdapterState('UNBOUND', 'FINALIZED'), /illegal settlement adapter transition/);
  assert.throws(() => transitionSettlementAdapterState('BOUND', 'AUTHORIZED'), /illegal settlement adapter transition/);
  assert.throws(() => transitionSettlementAdapterState('FINALIZED', 'RECONCILING'), /illegal settlement adapter transition/);
});

test('resolution cancellation requires resolver threshold plus frozen policy, not organizer whim', () => {
  const c = contract();
  const b = binding(c);
  const intent = buildSettlementIntent({
    contract: c,
    resolution: {type: 'CANCELLED_BY_RESOLUTION', winner_entry_id: null, distributions: []},
    refundRecipientId: 'wallet:organizer',
  });
  const manifest = buildStageJ0SettlementManifest({contract: c, settlementIntent: intent, binding: b});
  assert.deepEqual(manifest.required_authorities, ['FROZEN_POLICY', 'RESOLVER_THRESHOLD']);
});
