import {createHash} from 'node:crypto';
import {assertFrozenBuildContract} from './challenge.mjs';
import {
  SETTLEMENT_FUNDING_FACT_SCHEMA_VERSION,
  assertStageJ0FundingFactMatchesBinding,
  assertStageJ0SettlementAdapterBindingMatchesContract,
} from './settlement-adapter.mjs';
import {digestRecord} from './index.mjs';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function byteCompare(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

function assertString(value, label) {
  invariant(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
}

function assertAddress(value, label) {
  invariant(typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value), `${label} must be an EVM address`);
  return value.toLowerCase();
}

function assertHexDigest(value, label) {
  invariant(typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value), `${label} must be a 32-byte hex digest`);
  return value.toLowerCase();
}

function sha256Hex(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

export const STAGE_J2_VAULT_PLAN_SCHEMA_VERSION = 'inkubator.testnet-vault-plan/1.0';
export const STAGE_J2_VAULT_SNAPSHOT_SCHEMA_VERSION = 'inkubator.testnet-vault-snapshot/1.0';
export const STAGE_J2_NETWORK = Object.freeze({
  network_id: 'ink-sepolia:763373',
  network_name: 'Ink Sepolia',
  chain_id: 763373,
  rpc_url: 'https://rpc-gel-sepolia.inkonchain.com',
  explorer_url: 'https://explorer-sepolia.inkonchain.com',
});
export const STAGE_J2_ALLOWED_TEST_ASSETS = Object.freeze(['USDC_TEST', 'TEST']);
export const STAGE_J2_MAX_PAYOUT_RECIPIENTS = 3;

export function stageJ2ReviewDeadlineSeconds(reviewDeadlineMs) {
  invariant(Number.isSafeInteger(reviewDeadlineMs) && reviewDeadlineMs >= 0, 'review deadline must be a non-negative safe integer');
  const seconds = Math.ceil(reviewDeadlineMs / 1000);
  invariant(Number.isSafeInteger(seconds), 'review deadline seconds must be a safe integer');
  return seconds;
}

export function stageJ2ChallengeDigest(challengeId) {
  assertString(challengeId, 'challenge id');
  return `0x${sha256Hex(challengeId)}`;
}

export function buildStageJ2PayoutRoster(entries) {
  invariant(Array.isArray(entries) && entries.length > 0, 'J2 payout entries must be a non-empty array');
  invariant(entries.length <= STAGE_J2_MAX_PAYOUT_RECIPIENTS, `J2 supports at most ${STAGE_J2_MAX_PAYOUT_RECIPIENTS} payout recipients`);

  const normalized = entries.map((entry, index) => {
    invariant(entry && typeof entry === 'object' && !Array.isArray(entry), `J2 payout entry[${index}] must be an object`);
    assertString(entry.entry_id, `J2 payout entry[${index}].entry_id`);
    return {
      entry_id: entry.entry_id,
      payout_address: assertAddress(entry.payout_address, `J2 payout entry[${index}].payout_address`),
    };
  }).sort((left, right) => byteCompare(left.entry_id, right.entry_id));

  invariant(new Set(normalized.map((entry) => entry.entry_id)).size === normalized.length, 'J2 payout entry ids must be unique');
  invariant(new Set(normalized.map((entry) => entry.payout_address)).size === normalized.length, 'J2 payout addresses must be unique');

  return freeze(normalized.map((entry, payoutOrder) => ({
    ...entry,
    entry_digest: `0x${sha256Hex(entry.entry_id)}`,
    payout_order: payoutOrder,
  })));
}

export function buildStageJ2VaultPlan({
  contract,
  binding,
  token_address,
  refund_recipient,
  outcome_authority,
  organizer_selection_authority,
  resolver_authority,
  entries,
}) {
  assertFrozenBuildContract(contract);
  assertStageJ0SettlementAdapterBindingMatchesContract(contract, binding);

  invariant(binding.adapter_kind === 'TESTNET_CHALLENGE_VAULT', 'J2 requires TESTNET_CHALLENGE_VAULT adapter kind');
  invariant(binding.network_id === STAGE_J2_NETWORK.network_id, 'J2 binding must target Ink Sepolia chain 763373');
  invariant(STAGE_J2_ALLOWED_TEST_ASSETS.includes(contract.settlement_asset), 'J2 settlement asset must be an allowlisted synthetic test asset');
  invariant(contract.prize_minor_units === binding.amount_minor_units, 'J2 prize amount must equal J0 binding amount');

  const tokenAddress = assertAddress(token_address, 'J2 token address');
  const refundRecipient = assertAddress(refund_recipient, 'J2 refund recipient');
  const outcomeAuthority = assertAddress(outcome_authority, 'J2 outcome authority');
  const organizerSelectionAuthority = assertAddress(organizer_selection_authority, 'J2 organizer-selection authority');
  const resolverAuthority = assertAddress(resolver_authority, 'J2 resolver authority');
  invariant(new Set([outcomeAuthority, organizerSelectionAuthority, resolverAuthority]).size === 3, 'J2 authority addresses must be pairwise independent');

  const payoutRoster = buildStageJ2PayoutRoster(entries);
  const payload = {
    schema_version: STAGE_J2_VAULT_PLAN_SCHEMA_VERSION,
    value_mode: 'TEST_ONLY',
    network: STAGE_J2_NETWORK,
    challenge_id: contract.challenge_id,
    challenge_digest: stageJ2ChallengeDigest(contract.challenge_id),
    terms_digest: `0x${contract.terms_digest}`,
    binding_digest: `0x${binding.binding_digest}`,
    adapter_ref: binding.adapter_ref,
    asset: contract.settlement_asset,
    token_address: tokenAddress,
    prize_minor_units: contract.prize_minor_units,
    review_deadline_ms: contract.review_deadline,
    organizer_selection_deadline_seconds: stageJ2ReviewDeadlineSeconds(contract.review_deadline),
    refund_recipient: refundRecipient,
    outcome_authority: outcomeAuthority,
    organizer_selection_authority: organizerSelectionAuthority,
    resolver_authority: resolverAuthority,
    payout_roster: payoutRoster,
  };

  return freeze({...payload, plan_digest: digestRecord(payload)});
}

export function assertStageJ2VaultSnapshotMatchesPlan(plan, snapshot) {
  invariant(plan && plan.schema_version === STAGE_J2_VAULT_PLAN_SCHEMA_VERSION, 'invalid J2 vault plan');
  invariant(snapshot && snapshot.schema_version === STAGE_J2_VAULT_SNAPSHOT_SCHEMA_VERSION, 'invalid J2 vault snapshot');
  assertAddress(snapshot.vault_address, 'J2 snapshot vault address');

  const exact = [
    ['chain_id', plan.network.chain_id],
    ['token_address', plan.token_address],
    ['challenge_digest', plan.challenge_digest],
    ['terms_digest', plan.terms_digest],
    ['binding_digest', plan.binding_digest],
    ['prize_minor_units', plan.prize_minor_units],
    ['organizer_selection_deadline_seconds', plan.organizer_selection_deadline_seconds],
    ['refund_recipient', plan.refund_recipient],
    ['outcome_authority', plan.outcome_authority],
    ['organizer_selection_authority', plan.organizer_selection_authority],
    ['resolver_authority', plan.resolver_authority],
  ];

  for (const [key, expected] of exact) {
    const actual = typeof expected === 'string' ? String(snapshot[key]).toLowerCase() : snapshot[key];
    const normalizedExpected = typeof expected === 'string' ? expected.toLowerCase() : expected;
    invariant(actual === normalizedExpected, `J2 vault snapshot ${key} mismatch`);
  }

  invariant(snapshot.plan_digest === plan.plan_digest, 'J2 vault snapshot plan digest mismatch');
  return snapshot;
}

export function buildStageJ2FundingFact({contract, binding, vault_address, funding_tx_hash}) {
  assertFrozenBuildContract(contract);
  assertStageJ0SettlementAdapterBindingMatchesContract(contract, binding);
  const vaultAddress = assertAddress(vault_address, 'J2 funding vault address');
  invariant(typeof funding_tx_hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(funding_tx_hash), 'J2 funding transaction hash must be 32-byte hex');

  const fact = {
    schema_version: SETTLEMENT_FUNDING_FACT_SCHEMA_VERSION,
    value_mode: 'TEST_ONLY',
    binding_digest: binding.binding_digest,
    challenge_id: contract.challenge_id,
    terms_digest: contract.terms_digest,
    asset: contract.settlement_asset,
    amount_minor_units: contract.prize_minor_units,
    status: 'CONFIRMED_TEST',
    funding_ref: `${STAGE_J2_NETWORK.network_id}:tx:${funding_tx_hash.toLowerCase()}:vault:${vaultAddress}`,
  };
  assertStageJ0FundingFactMatchesBinding(contract, binding, fact);
  return freeze(fact);
}
