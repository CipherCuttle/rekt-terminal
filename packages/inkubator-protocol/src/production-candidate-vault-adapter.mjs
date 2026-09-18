import {createHash} from 'node:crypto';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertAddress(value, label) {
  invariant(typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value), `${label} must be an EVM address`);
  return value.toLowerCase();
}

function assertDigest(value, label) {
  invariant(typeof value === 'string' && /^(?:0x)?[0-9a-fA-F]{64}$/.test(value), `${label} must be a 32-byte digest`);
  return value.toLowerCase();
}

function assertSafeNonNegative(value, label) {
  invariant(Number.isSafeInteger(value) && value >= 0, `${label} must be a non-negative safe integer`);
  return value;
}

function canonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    invariant(Number.isSafeInteger(value), 'canonical numbers must be safe integers');
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  invariant(value && typeof value === 'object', 'unsupported canonical value');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

function digestRecord(value) {
  return createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export const STAGE_J4_NETWORK = Object.freeze({
  network_id: 'ink-mainnet:57073',
  network_name: 'Ink',
  chain_id: 57073,
  explorer_url: 'https://explorer.inkonchain.com',
});

export const STAGE_J4_NATIVE_USDC = Object.freeze({
  symbol: 'USDC',
  address: '0x2d270e6886d130d724215a266106e6832161eaed',
  decimals: 6,
  issuer: 'Circle',
});

export const STAGE_J4_EXCLUDED_USDC_E = Object.freeze({
  symbol: 'USDC.e',
  address: '0xf1815bd50389c46847f0bda824ec8da914045d14',
  status: 'EXCLUDED_FROM_FIRST_CANDIDATE',
});

export const STAGE_J4_TOOLCHAIN = Object.freeze({
  foundry: '1.8.3',
  solc: '0.8.37',
  evm: 'prague',
  optimizer: true,
  optimizer_runs: 200,
  bytecode_metadata_hash: 'none',
  ffi: false,
});

export const STAGE_J4_FINALITY_PROVIDERS = Object.freeze(['gelato', 'quicknode']);

export function stageJ4DeadlineSeconds(deadlineMs) {
  assertSafeNonNegative(deadlineMs, 'deadline ms');
  const seconds = Math.ceil(deadlineMs / 1000);
  invariant(Number.isSafeInteger(seconds), 'deadline seconds must be a safe integer');
  return seconds;
}

export function buildStageJ4DeploymentPlan({
  source_commit,
  challenge_digest,
  terms_digest,
  binding_digest,
  token_address,
  refund_recipient,
  outcome_authority,
  organizer_selection_authority,
  resolver_authority,
  resolver_signer_set_digest,
  prize_minor_units,
  activation_deadline_ms,
  organizer_selection_deadline_ms,
  prebuild_refund_manifest_digest,
  terminal_refund_manifest_digest,
}) {
  invariant(typeof source_commit === 'string' && /^[0-9a-f]{40}$/.test(source_commit), 'source commit must be a 40-char lowercase git SHA');
  assertDigest(challenge_digest, 'challenge digest');
  assertDigest(terms_digest, 'terms digest');
  assertDigest(binding_digest, 'binding digest');
  assertDigest(resolver_signer_set_digest, 'resolver signer-set digest');
  assertDigest(prebuild_refund_manifest_digest, 'prebuild refund manifest digest');
  assertDigest(terminal_refund_manifest_digest, 'terminal refund manifest digest');
  assertSafeNonNegative(prize_minor_units, 'prize minor units');
  invariant(prize_minor_units > 0, 'prize minor units must be positive');

  const token = assertAddress(token_address, 'token address');
  invariant(token === STAGE_J4_NATIVE_USDC.address, 'J4 production candidate requires exact native Ink USDC address');

  const activation = stageJ4DeadlineSeconds(activation_deadline_ms);
  const organizer = stageJ4DeadlineSeconds(organizer_selection_deadline_ms);
  invariant(activation <= organizer, 'activation deadline must not follow organizer deadline');

  const payload = {
    schema_version: 'inkubator.production-candidate-deployment-plan/1.0',
    value_mode: 'PRODUCTION_CANDIDATE_ONLY',
    authority: 'NO_MAINNET_NO_MONEY',
    source_commit,
    network: STAGE_J4_NETWORK,
    asset: STAGE_J4_NATIVE_USDC,
    challenge_digest: assertDigest(challenge_digest, 'challenge digest'),
    terms_digest: assertDigest(terms_digest, 'terms digest'),
    binding_digest: assertDigest(binding_digest, 'binding digest'),
    prize_minor_units,
    activation_deadline_seconds: activation,
    organizer_selection_deadline_seconds: organizer,
    resolution_deadline_seconds: organizer + 72 * 60 * 60,
    terminal_long_stop_seconds: organizer + 30 * 24 * 60 * 60,
    refund_recipient: assertAddress(refund_recipient, 'refund recipient'),
    outcome_authority: assertAddress(outcome_authority, 'outcome authority'),
    organizer_selection_authority: assertAddress(organizer_selection_authority, 'organizer selection authority'),
    resolver_authority: assertAddress(resolver_authority, 'resolver authority'),
    resolver_signer_set_digest: assertDigest(resolver_signer_set_digest, 'resolver signer-set digest'),
    resolver_quorum: 2,
    prebuild_refund_manifest_digest: assertDigest(prebuild_refund_manifest_digest, 'prebuild refund manifest digest'),
    terminal_refund_manifest_digest: assertDigest(terminal_refund_manifest_digest, 'terminal refund manifest digest'),
  };

  invariant(
    new Set([
      payload.outcome_authority,
      payload.organizer_selection_authority,
      payload.resolver_authority,
    ]).size === 3,
    'J4 authorities must be pairwise independent',
  );

  return deepFreeze({...payload, plan_digest: digestRecord(payload)});
}

function normalizeObservation(observation, index) {
  invariant(observation && typeof observation === 'object' && !Array.isArray(observation), `observation[${index}] must be an object`);
  invariant(typeof observation.provider_id === 'string' && observation.provider_id.length > 0, `observation[${index}].provider_id required`);
  invariant(STAGE_J4_FINALITY_PROVIDERS.includes(observation.provider_id), `observation[${index}].provider_id is not an approved J4 provider`);
  const chainId = assertSafeNonNegative(observation.chain_id, `observation[${index}].chain_id`);
  invariant(chainId === STAGE_J4_NETWORK.chain_id, `observation[${index}] wrong chain id`);
  const txHash = assertDigest(observation.tx_hash, `observation[${index}].tx_hash`);
  const blockHash = assertDigest(observation.block_hash, `observation[${index}].block_hash`);
  const canonicalBlockHash = assertDigest(observation.canonical_block_hash, `observation[${index}].canonical_block_hash`);
  const blockNumber = assertSafeNonNegative(observation.block_number, `observation[${index}].block_number`);
  const finalizedHeadNumber = assertSafeNonNegative(observation.finalized_head_number, `observation[${index}].finalized_head_number`);
  invariant(observation.tx_success === true, `observation[${index}] transaction must be successful`);
  return {
    provider_id: observation.provider_id,
    chain_id: chainId,
    tx_hash: txHash,
    tx_success: true,
    block_number: blockNumber,
    block_hash: blockHash,
    canonical_block_hash: canonicalBlockHash,
    finalized_head_number: finalizedHeadNumber,
  };
}

export function evaluateStageJ4Finality(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return deepFreeze({state: 'RECONCILING', reason: 'FINALITY_REQUEST_REQUIRED'});
  }

  let expectedTxHash;
  try {
    expectedTxHash = assertDigest(input.expected_tx_hash, 'expected tx hash');
  } catch (error) {
    return deepFreeze({state: 'RECONCILING', reason: error.message});
  }

  const observations = input.observations;
  if (!Array.isArray(observations) || observations.length !== 2) {
    return deepFreeze({state: 'RECONCILING', reason: 'TWO_PROVIDER_EVIDENCE_REQUIRED'});
  }

  let normalized;
  try {
    normalized = observations.map(normalizeObservation);
  } catch (error) {
    return deepFreeze({state: 'RECONCILING', reason: error.message});
  }

  const actualProviders = normalized.map((item) => item.provider_id).sort();
  const expectedProviders = [...STAGE_J4_FINALITY_PROVIDERS].sort();
  if (actualProviders.join('|') !== expectedProviders.join('|')) {
    return deepFreeze({state: 'RECONCILING', reason: 'APPROVED_PROVIDER_SET_REQUIRED'});
  }

  if (normalized.some((item) => item.tx_hash !== expectedTxHash)) {
    return deepFreeze({state: 'RECONCILING', reason: 'UNEXPECTED_SETTLEMENT_TRANSACTION'});
  }

  for (const key of ['tx_hash', 'block_number', 'block_hash']) {
    if (normalized[0][key] !== normalized[1][key]) {
      return deepFreeze({state: 'RECONCILING', reason: `PROVIDER_${key.toUpperCase()}_DISAGREEMENT`});
    }
  }

  if (normalized.some((item) => item.canonical_block_hash !== item.block_hash)) {
    return deepFreeze({state: 'RECONCILING', reason: 'RECEIPT_BLOCK_NOT_CANONICAL'});
  }

  if (normalized.some((item) => item.finalized_head_number < item.block_number)) {
    return deepFreeze({state: 'RECONCILING', reason: 'RECEIPT_NOT_FINALIZED_BY_BOTH_PROVIDERS'});
  }

  return deepFreeze({
    state: 'FINALIZED',
    chain_id: STAGE_J4_NETWORK.chain_id,
    tx_hash: expectedTxHash,
    block_number: normalized[0].block_number,
    block_hash: normalized[0].block_hash,
    providers: actualProviders,
  });
}

export function buildStageJ4SigningRequest(input) {
  invariant(input && typeof input === 'object' && !Array.isArray(input), 'signing request required');
  invariant(typeof input.request_id === 'string' && /^[a-z0-9._:-]{1,96}$/.test(input.request_id), 'request id must be stable lowercase text');
  invariant(input.authority_role === 'OUTCOME' || input.authority_role === 'RESOLVER', 'authority role must be OUTCOME or RESOLVER');
  invariant(
    ['PAYOUT_SET', 'QUALIFIER_SET', 'SETTLEMENT'].includes(input.action),
    'unsupported signing action',
  );
  invariant(input.display_fields && typeof input.display_fields === 'object' && !Array.isArray(input.display_fields), 'display fields required');

  const payload = {
    schema_version: 'inkubator.j4-signing-request/1.0',
    request_id: input.request_id,
    authority_role: input.authority_role,
    action: input.action,
    chain_id: STAGE_J4_NETWORK.chain_id,
    vault_address: assertAddress(input.vault_address, 'vault address'),
    typed_data_digest: assertDigest(input.typed_data_digest, 'typed data digest'),
    display_fields: input.display_fields,
    display_fields_digest: digestRecord(input.display_fields),
  };

  return deepFreeze({...payload, request_digest: digestRecord(payload)});
}

export function registerStageJ4SigningRequest(history, request) {
  invariant(Array.isArray(history), 'signing request history must be an array');
  const normalized = buildStageJ4SigningRequest(request);
  const existing = history.find((item) => item?.request_id === normalized.request_id);
  if (existing) {
    invariant(canonicalize(existing) === canonicalize(normalized), 'signing request id conflict');
    return deepFreeze([...history]);
  }
  return deepFreeze([...history, normalized]);
}

export function appendStageJ4ReconciliationReceipt(history, input) {
  invariant(Array.isArray(history), 'reconciliation history must be an array');
  invariant(input && typeof input === 'object' && !Array.isArray(input), 'reconciliation receipt required');
  invariant(typeof input.record_id === 'string' && /^[a-z0-9._:-]{1,96}$/.test(input.record_id), 'record id must be stable lowercase text');
  invariant(input.kind === 'FINALIZED' || input.kind === 'CORRECTION', 'reconciliation kind must be FINALIZED or CORRECTION');

  const payload = {
    schema_version: 'inkubator.j4-reconciliation-receipt/1.0',
    record_id: input.record_id,
    kind: input.kind,
    expected_tx_hash: assertDigest(input.expected_tx_hash, 'expected tx hash'),
    evidence_digest: assertDigest(input.evidence_digest, 'evidence digest'),
    recorded_at_ms: assertSafeNonNegative(input.recorded_at_ms, 'recorded at ms'),
    supersedes_record_id: input.supersedes_record_id ?? null,
  };

  invariant(
    payload.supersedes_record_id === null
      || (typeof payload.supersedes_record_id === 'string' && /^[a-z0-9._:-]{1,96}$/.test(payload.supersedes_record_id)),
    'supersedes record id must be null or stable lowercase text',
  );

  const next = deepFreeze({...payload, record_digest: digestRecord(payload)});
  const existing = history.find((item) => item?.record_id === next.record_id);
  if (existing) {
    invariant(canonicalize(existing) === canonicalize(next), 'record id conflict');
    return deepFreeze([...history]);
  }

  if (next.kind === 'FINALIZED') {
    invariant(next.supersedes_record_id === null, 'initial finalized receipt cannot supersede another record');
  } else {
    invariant(history.length > 0, 'correction requires existing receipt');
    const previous = history[history.length - 1];
    invariant(next.supersedes_record_id === previous.record_id, 'correction must supersede latest receipt');
    invariant(
      assertDigest(previous.expected_tx_hash, 'previous expected tx hash') === next.expected_tx_hash,
      'correction cannot change settlement transaction identity',
    );
  }

  return deepFreeze([...history, next]);
}

export function buildStageJ4ReleaseCandidateReceipt({
  source_commit,
  foundry_toml_digest,
  artifact_digest,
  constructor_abi_digest,
  vault_creation_bytecode_hash,
  vault_runtime_bytecode_hash,
  resolver_creation_bytecode_hash,
  resolver_runtime_bytecode_hash,
  resolver_signer_set_digest,
}) {
  invariant(typeof source_commit === 'string' && /^[0-9a-f]{40}$/.test(source_commit), 'source commit must be a 40-char lowercase git SHA');

  const payload = {
    schema_version: 'inkubator.production-candidate-release/1.0',
    release_authority: 'CANDIDATE_ONLY_NO_MAINNET_NO_MONEY',
    source_commit,
    toolchain: STAGE_J4_TOOLCHAIN,
    foundry_toml_digest: assertDigest(foundry_toml_digest, 'foundry.toml digest'),
    artifact_digest: assertDigest(artifact_digest, 'artifact digest'),
    constructor_abi_digest: assertDigest(constructor_abi_digest, 'constructor ABI digest'),
    vault_creation_bytecode_hash: assertDigest(vault_creation_bytecode_hash, 'vault creation bytecode hash'),
    vault_runtime_bytecode_hash: assertDigest(vault_runtime_bytecode_hash, 'vault runtime bytecode hash'),
    resolver_creation_bytecode_hash: assertDigest(resolver_creation_bytecode_hash, 'resolver creation bytecode hash'),
    resolver_runtime_bytecode_hash: assertDigest(resolver_runtime_bytecode_hash, 'resolver runtime bytecode hash'),
    resolver_signer_set_digest: assertDigest(resolver_signer_set_digest, 'resolver signer-set digest'),
    resolver_quorum: 2,
    chain_id: STAGE_J4_NETWORK.chain_id,
    token_address: STAGE_J4_NATIVE_USDC.address,
    external_audit: 'NOT_STARTED',
    production_money: 'NOT_AUTHORIZED',
  };

  return deepFreeze({...payload, release_digest: digestRecord(payload)});
}
