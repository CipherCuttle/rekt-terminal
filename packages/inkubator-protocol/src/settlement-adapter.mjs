import {digestRecord} from './index.mjs';
import {assertFrozenBuildContract, assertSettlementIntentMatchesContract} from './challenge.mjs';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, label) {
  invariant(isObject(value), `${label} must be an object`);
  return value;
}

function assertString(value, label) {
  invariant(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
}

function assertSafeInt(value, label, {min = Number.MIN_SAFE_INTEGER} = {}) {
  invariant(Number.isSafeInteger(value) && !Object.is(value, -0), `${label} must be a safe integer`);
  invariant(value >= min, `${label} out of range`);
}

function assertHexDigest(value, label) {
  invariant(typeof value === 'string' && /^[0-9a-f]{64}$/.test(value), `${label} must be a lowercase sha256 hex digest`);
}

function assertAllowedKeys(value, allowed, label) {
  for (const key of Object.keys(value)) invariant(allowed.has(key), `${label} contains undeclared property ${key}`);
}

function deepClone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function stableUnique(values, label) {
  const unique = new Set(values);
  invariant(unique.size === values.length, `${label} must be unique`);
  return [...values].sort();
}

export const SETTLEMENT_ADAPTER_BINDING_SCHEMA_VERSION = 'inkubator.settlement-adapter-binding/1.0';
export const SETTLEMENT_FUNDING_FACT_SCHEMA_VERSION = 'inkubator.settlement-funding-fact/1.0';
export const SETTLEMENT_MANIFEST_SCHEMA_VERSION = 'inkubator.settlement-manifest/1.0';
export const SETTLEMENT_AUTHORIZATION_SCHEMA_VERSION = 'inkubator.settlement-authorization/1.0';
export const SETTLEMENT_EXECUTION_ENVELOPE_SCHEMA_VERSION = 'inkubator.settlement-execution-envelope/1.0';

export const STAGE_J0_ADAPTER_KINDS = Object.freeze(['MOCK', 'TESTNET_CHALLENGE_VAULT']);
export const SETTLEMENT_AUTHORITIES = Object.freeze([
  'INKUBATOR_OUTCOME',
  'ORGANIZER_SELECTION',
  'FROZEN_POLICY',
  'RESOLVER_THRESHOLD',
]);
export const SETTLEMENT_ADAPTER_STATES = Object.freeze([
  'UNBOUND',
  'BOUND',
  'FUNDED',
  'AUTHORIZED',
  'EXECUTION_PENDING',
  'RECONCILING',
  'FINALIZED',
]);

const BINDING_KEYS = new Set([
  'schema_version',
  'value_mode',
  'adapter_kind',
  'adapter_ref',
  'network_id',
  'challenge_id',
  'terms_digest',
  'settlement_policy_version',
  'asset',
  'amount_minor_units',
  'binding_digest',
]);
const FUNDING_FACT_KEYS = new Set([
  'schema_version',
  'value_mode',
  'binding_digest',
  'challenge_id',
  'terms_digest',
  'asset',
  'amount_minor_units',
  'status',
  'funding_ref',
]);
const MANIFEST_KEYS = new Set([
  'schema_version',
  'value_mode',
  'challenge_id',
  'terms_digest',
  'settlement_policy_version',
  'adapter_kind',
  'binding_digest',
  'intent_digest',
  'intent_type',
  'asset',
  'total_minor_units',
  'recipients',
  'winner_entry_id',
  'required_authorities',
  'delivery_mode',
  'manifest_digest',
]);
const AUTHORIZATION_KEYS = new Set([
  'schema_version',
  'value_mode',
  'manifest_digest',
  'authority',
  'actor_id',
  'verification_ref',
]);
const ENVELOPE_KEYS = new Set([
  'schema_version',
  'value_mode',
  'manifest_digest',
  'binding_digest',
  'adapter_kind',
  'challenge_id',
  'terms_digest',
  'asset',
  'total_minor_units',
  'recipients',
  'delivery_mode',
  'execution_digest',
]);

const LEGAL_ADAPTER_TRANSITIONS = Object.freeze({
  UNBOUND: Object.freeze(['BOUND']),
  BOUND: Object.freeze(['FUNDED']),
  FUNDED: Object.freeze(['AUTHORIZED']),
  AUTHORIZED: Object.freeze(['EXECUTION_PENDING']),
  EXECUTION_PENDING: Object.freeze(['RECONCILING', 'FINALIZED']),
  RECONCILING: Object.freeze(['EXECUTION_PENDING', 'FINALIZED']),
  FINALIZED: Object.freeze([]),
});

function digestPayload(record, digestKey) {
  const payload = deepClone(record);
  delete payload[digestKey];
  return digestRecord(payload);
}

function canonicalRecipients(recipients) {
  invariant(Array.isArray(recipients) && recipients.length > 0, 'settlement recipients must be a non-empty array');
  const normalized = recipients.map((recipient) => {
    assertObject(recipient, 'settlement recipient');
    assertAllowedKeys(recipient, new Set(['recipient_id', 'amount_minor_units']), 'settlement recipient');
    assertString(recipient.recipient_id, 'settlement recipient.recipient_id');
    assertSafeInt(recipient.amount_minor_units, 'settlement recipient.amount_minor_units', {min: 0});
    return {recipient_id: recipient.recipient_id, amount_minor_units: recipient.amount_minor_units};
  }).sort((a, b) => a.recipient_id.localeCompare(b.recipient_id));
  stableUnique(normalized.map((recipient) => recipient.recipient_id), 'settlement recipient ids');
  return normalized;
}

function requiredAuthoritiesForIntent(intent) {
  if (intent.type === 'WINNER_PAYOUT') return ['INKUBATOR_OUTCOME', 'ORGANIZER_SELECTION'];
  if (intent.type === 'DEFAULT_DISTRIBUTION' || intent.type === 'REFUND_NO_QUALIFIER') {
    return ['FROZEN_POLICY', 'INKUBATOR_OUTCOME'];
  }
  if (intent.type === 'REFUND_PRE_BUILD') return ['FROZEN_POLICY'];
  if (intent.type === 'CANCELLED_BY_RESOLUTION') return ['FROZEN_POLICY', 'RESOLVER_THRESHOLD'];
  throw new Error(`unsupported settlement intent type ${intent.type}`);
}

export function bindStageJ0SettlementAdapter({contract, adapter_kind, adapter_ref, network_id = null}) {
  assertFrozenBuildContract(contract);
  invariant(STAGE_J0_ADAPTER_KINDS.includes(adapter_kind), `Stage J0 adapter kind not authorized: ${adapter_kind}`);
  assertString(adapter_ref, 'adapter_ref');
  if (adapter_kind === 'MOCK') {
    invariant(network_id === null, 'MOCK adapter must not declare a network_id');
  } else {
    assertString(network_id, 'network_id');
  }
  const payload = {
    schema_version: SETTLEMENT_ADAPTER_BINDING_SCHEMA_VERSION,
    value_mode: 'TEST_ONLY',
    adapter_kind,
    adapter_ref,
    network_id,
    challenge_id: contract.challenge_id,
    terms_digest: contract.terms_digest,
    settlement_policy_version: contract.settlement_policy_version,
    asset: contract.settlement_asset,
    amount_minor_units: contract.prize_minor_units,
  };
  return deepFreeze({...payload, binding_digest: digestRecord(payload)});
}

export function assertStageJ0SettlementAdapterBinding(binding) {
  assertObject(binding, 'settlement adapter binding');
  assertAllowedKeys(binding, BINDING_KEYS, 'settlement adapter binding');
  invariant(binding.schema_version === SETTLEMENT_ADAPTER_BINDING_SCHEMA_VERSION, 'settlement adapter binding schema mismatch');
  invariant(binding.value_mode === 'TEST_ONLY', 'Stage J0 settlement adapter must be TEST_ONLY');
  invariant(STAGE_J0_ADAPTER_KINDS.includes(binding.adapter_kind), `Stage J0 adapter kind not authorized: ${binding.adapter_kind}`);
  assertString(binding.adapter_ref, 'settlement adapter binding.adapter_ref');
  if (binding.adapter_kind === 'MOCK') invariant(binding.network_id === null, 'MOCK adapter must not declare a network_id');
  else assertString(binding.network_id, 'settlement adapter binding.network_id');
  for (const key of ['challenge_id', 'terms_digest', 'settlement_policy_version', 'asset']) {
    assertString(binding[key], `settlement adapter binding.${key}`);
  }
  assertHexDigest(binding.terms_digest, 'settlement adapter binding.terms_digest');
  assertSafeInt(binding.amount_minor_units, 'settlement adapter binding.amount_minor_units', {min: 0});
  assertHexDigest(binding.binding_digest, 'settlement adapter binding.binding_digest');
  invariant(binding.binding_digest === digestPayload(binding, 'binding_digest'), 'settlement adapter binding digest mismatch');
  return binding;
}

export function assertStageJ0SettlementAdapterBindingMatchesContract(contract, binding) {
  assertFrozenBuildContract(contract);
  assertStageJ0SettlementAdapterBinding(binding);
  invariant(binding.challenge_id === contract.challenge_id, 'settlement adapter Challenge mismatch');
  invariant(binding.terms_digest === contract.terms_digest, 'settlement adapter terms digest mismatch');
  invariant(binding.settlement_policy_version === contract.settlement_policy_version, 'settlement adapter policy mismatch');
  invariant(binding.asset === contract.settlement_asset, 'settlement adapter asset mismatch');
  invariant(binding.amount_minor_units === contract.prize_minor_units, 'settlement adapter amount mismatch');
  return binding;
}

export function assertStageJ0FundingFactMatchesBinding(contract, binding, fact) {
  assertStageJ0SettlementAdapterBindingMatchesContract(contract, binding);
  assertObject(fact, 'settlement funding fact');
  assertAllowedKeys(fact, FUNDING_FACT_KEYS, 'settlement funding fact');
  invariant(fact.schema_version === SETTLEMENT_FUNDING_FACT_SCHEMA_VERSION, 'settlement funding fact schema mismatch');
  invariant(fact.value_mode === 'TEST_ONLY', 'Stage J0 funding fact must be TEST_ONLY');
  invariant(fact.status === 'CONFIRMED_TEST', 'Stage J0 funding fact is not confirmed test value');
  assertHexDigest(fact.binding_digest, 'settlement funding fact.binding_digest');
  assertString(fact.funding_ref, 'settlement funding fact.funding_ref');
  assertSafeInt(fact.amount_minor_units, 'settlement funding fact.amount_minor_units', {min: 0});
  invariant(fact.binding_digest === binding.binding_digest, 'settlement funding fact binding mismatch');
  invariant(fact.challenge_id === binding.challenge_id, 'settlement funding fact Challenge mismatch');
  invariant(fact.terms_digest === binding.terms_digest, 'settlement funding fact terms digest mismatch');
  invariant(fact.asset === binding.asset, 'settlement funding fact asset mismatch');
  invariant(fact.amount_minor_units === binding.amount_minor_units, 'settlement funding fact amount mismatch');
  return fact;
}

export function buildStageJ0SettlementManifest({contract, settlementIntent, binding}) {
  assertStageJ0SettlementAdapterBindingMatchesContract(contract, binding);
  assertSettlementIntentMatchesContract(contract, settlementIntent);
  const recipients = canonicalRecipients(settlementIntent.recipients);
  const payload = {
    schema_version: SETTLEMENT_MANIFEST_SCHEMA_VERSION,
    value_mode: 'TEST_ONLY',
    challenge_id: contract.challenge_id,
    terms_digest: contract.terms_digest,
    settlement_policy_version: contract.settlement_policy_version,
    adapter_kind: binding.adapter_kind,
    binding_digest: binding.binding_digest,
    intent_digest: digestRecord(settlementIntent),
    intent_type: settlementIntent.type,
    asset: settlementIntent.asset,
    total_minor_units: settlementIntent.total_minor_units,
    recipients,
    winner_entry_id: settlementIntent.winner_entry_id,
    required_authorities: requiredAuthoritiesForIntent(settlementIntent),
    delivery_mode: 'CLAIMABLE',
  };
  return deepFreeze({...payload, manifest_digest: digestRecord(payload)});
}

export function assertStageJ0SettlementManifest(manifest) {
  assertObject(manifest, 'settlement manifest');
  assertAllowedKeys(manifest, MANIFEST_KEYS, 'settlement manifest');
  invariant(manifest.schema_version === SETTLEMENT_MANIFEST_SCHEMA_VERSION, 'settlement manifest schema mismatch');
  invariant(manifest.value_mode === 'TEST_ONLY', 'Stage J0 settlement manifest must be TEST_ONLY');
  invariant(STAGE_J0_ADAPTER_KINDS.includes(manifest.adapter_kind), `Stage J0 adapter kind not authorized: ${manifest.adapter_kind}`);
  for (const key of ['challenge_id', 'terms_digest', 'settlement_policy_version', 'binding_digest', 'intent_digest', 'intent_type', 'asset', 'manifest_digest']) {
    assertString(manifest[key], `settlement manifest.${key}`);
  }
  assertHexDigest(manifest.terms_digest, 'settlement manifest.terms_digest');
  assertHexDigest(manifest.binding_digest, 'settlement manifest.binding_digest');
  assertHexDigest(manifest.intent_digest, 'settlement manifest.intent_digest');
  assertHexDigest(manifest.manifest_digest, 'settlement manifest.manifest_digest');
  assertSafeInt(manifest.total_minor_units, 'settlement manifest.total_minor_units', {min: 0});
  const recipients = canonicalRecipients(manifest.recipients);
  const total = recipients.reduce((sum, recipient) => sum + recipient.amount_minor_units, 0);
  invariant(total === manifest.total_minor_units, 'settlement manifest recipients do not conserve total');
  invariant(manifest.delivery_mode === 'CLAIMABLE', 'Stage J0 settlement delivery mode must be CLAIMABLE');
  invariant(Array.isArray(manifest.required_authorities) && manifest.required_authorities.length > 0, 'settlement manifest requires authorities');
  const authorities = stableUnique(manifest.required_authorities, 'settlement manifest authorities');
  authorities.forEach((authority) => invariant(SETTLEMENT_AUTHORITIES.includes(authority), `unknown settlement authority ${authority}`));
  invariant(manifest.manifest_digest === digestPayload(manifest, 'manifest_digest'), 'settlement manifest digest mismatch');
  return manifest;
}

export function assertStageJ0SettlementManifestMatchesIntent(contract, settlementIntent, binding, manifest) {
  assertStageJ0SettlementAdapterBindingMatchesContract(contract, binding);
  assertSettlementIntentMatchesContract(contract, settlementIntent);
  assertStageJ0SettlementManifest(manifest);
  invariant(manifest.challenge_id === contract.challenge_id, 'settlement manifest Challenge mismatch');
  invariant(manifest.terms_digest === contract.terms_digest, 'settlement manifest terms digest mismatch');
  invariant(manifest.settlement_policy_version === contract.settlement_policy_version, 'settlement manifest policy mismatch');
  invariant(manifest.adapter_kind === binding.adapter_kind, 'settlement manifest adapter kind mismatch');
  invariant(manifest.binding_digest === binding.binding_digest, 'settlement manifest binding mismatch');
  invariant(manifest.intent_digest === digestRecord(settlementIntent), 'settlement manifest intent digest mismatch');
  invariant(manifest.intent_type === settlementIntent.type, 'settlement manifest intent type mismatch');
  invariant(manifest.asset === settlementIntent.asset, 'settlement manifest asset mismatch');
  invariant(manifest.total_minor_units === settlementIntent.total_minor_units, 'settlement manifest amount mismatch');
  invariant(digestRecord(canonicalRecipients(manifest.recipients)) === digestRecord(canonicalRecipients(settlementIntent.recipients)), 'settlement manifest recipients mismatch');
  invariant(manifest.winner_entry_id === settlementIntent.winner_entry_id, 'settlement manifest winner mismatch');
  invariant(digestRecord(manifest.required_authorities) === digestRecord(requiredAuthoritiesForIntent(settlementIntent)), 'settlement manifest authority set mismatch');
  return manifest;
}

export function assertRecordedStageJ0AuthorizationSet(manifest, authorizationFacts) {
  assertStageJ0SettlementManifest(manifest);
  invariant(Array.isArray(authorizationFacts), 'settlement authorization facts must be an array');
  const seen = [];
  for (const fact of authorizationFacts) {
    assertObject(fact, 'settlement authorization fact');
    assertAllowedKeys(fact, AUTHORIZATION_KEYS, 'settlement authorization fact');
    invariant(fact.schema_version === SETTLEMENT_AUTHORIZATION_SCHEMA_VERSION, 'settlement authorization schema mismatch');
    invariant(fact.value_mode === 'TEST_ONLY', 'Stage J0 settlement authorization must be TEST_ONLY');
    assertHexDigest(fact.manifest_digest, 'settlement authorization.manifest_digest');
    invariant(fact.manifest_digest === manifest.manifest_digest, 'settlement authorization manifest mismatch');
    invariant(SETTLEMENT_AUTHORITIES.includes(fact.authority), `unknown settlement authority ${fact.authority}`);
    assertString(fact.actor_id, 'settlement authorization.actor_id');
    assertString(fact.verification_ref, 'settlement authorization.verification_ref');
    seen.push(fact.authority);
  }
  const actual = stableUnique(seen, 'settlement authorization authorities');
  const expected = stableUnique(manifest.required_authorities, 'settlement manifest authorities');
  invariant(digestRecord(actual) === digestRecord(expected), 'settlement authorization set does not satisfy manifest');
  return authorizationFacts;
}

export function buildStageJ0ExecutionEnvelope({manifest, authorizationFacts}) {
  assertRecordedStageJ0AuthorizationSet(manifest, authorizationFacts);
  const payload = {
    schema_version: SETTLEMENT_EXECUTION_ENVELOPE_SCHEMA_VERSION,
    value_mode: 'TEST_ONLY',
    manifest_digest: manifest.manifest_digest,
    binding_digest: manifest.binding_digest,
    adapter_kind: manifest.adapter_kind,
    challenge_id: manifest.challenge_id,
    terms_digest: manifest.terms_digest,
    asset: manifest.asset,
    total_minor_units: manifest.total_minor_units,
    recipients: canonicalRecipients(manifest.recipients),
    delivery_mode: 'CLAIMABLE',
  };
  return deepFreeze({...payload, execution_digest: digestRecord(payload)});
}

export function assertStageJ0ExecutionEnvelopeMatchesManifest(manifest, envelope) {
  assertStageJ0SettlementManifest(manifest);
  assertObject(envelope, 'settlement execution envelope');
  assertAllowedKeys(envelope, ENVELOPE_KEYS, 'settlement execution envelope');
  invariant(envelope.schema_version === SETTLEMENT_EXECUTION_ENVELOPE_SCHEMA_VERSION, 'settlement execution envelope schema mismatch');
  invariant(envelope.value_mode === 'TEST_ONLY', 'Stage J0 settlement execution envelope must be TEST_ONLY');
  invariant(envelope.delivery_mode === 'CLAIMABLE', 'Stage J0 settlement execution envelope must be CLAIMABLE');
  assertHexDigest(envelope.execution_digest, 'settlement execution envelope.execution_digest');
  invariant(envelope.execution_digest === digestPayload(envelope, 'execution_digest'), 'settlement execution envelope digest mismatch');
  for (const key of ['manifest_digest', 'binding_digest', 'adapter_kind', 'challenge_id', 'terms_digest', 'asset', 'total_minor_units', 'delivery_mode']) {
    invariant(envelope[key] === manifest[key], `settlement execution envelope ${key} mismatch`);
  }
  invariant(digestRecord(canonicalRecipients(envelope.recipients)) === digestRecord(canonicalRecipients(manifest.recipients)), 'settlement execution envelope recipients mismatch');
  return envelope;
}

export function canTransitionSettlementAdapterState(from, to) {
  invariant(SETTLEMENT_ADAPTER_STATES.includes(from), `unknown settlement adapter state ${from}`);
  invariant(SETTLEMENT_ADAPTER_STATES.includes(to), `unknown settlement adapter state ${to}`);
  return LEGAL_ADAPTER_TRANSITIONS[from].includes(to);
}

export function transitionSettlementAdapterState(from, to) {
  invariant(canTransitionSettlementAdapterState(from, to), `illegal settlement adapter transition ${from} -> ${to}`);
  return to;
}
