import {digestRecord} from './index.mjs';
import {assertFrozenBuildContract} from './challenge-hardened.mjs';

export const ACCEPTANCE_MANIFEST_SCHEMA_VERSION = 'inkubator.acceptance-manifest/1.0';
export const ACCEPTANCE_BINDING_MODES = Object.freeze(['AUTOMATED', 'HUMAN_OBSERVATION']);
export const ACCEPTANCE_MANIFEST_REFERENCE_KIND = 'ACCEPTANCE_MANIFEST';

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

function assertDigest(value, label) {
  invariant(typeof value === 'string' && /^[0-9a-f]{64}$/.test(value), `${label} must be a lowercase sha256 hex digest`);
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(actual.length === wanted.length && actual.every((key, index) => key === wanted[index]), `${label} has invalid keys`);
}

function byteCompare(left, right) {
  const encoder = new TextEncoder();
  const a = encoder.encode(String(left));
  const b = encoder.encode(String(right));
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return a.length - b.length;
}

function uniqueSortedStrings(values, label) {
  invariant(Array.isArray(values), `${label} must be an array`);
  values.forEach((value, index) => assertString(value, `${label}[${index}]`));
  invariant(new Set(values).size === values.length, `${label} must be unique`);
  return [...values].sort(byteCompare);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function normalizeBinding(binding, index) {
  const label = `acceptance manifest.bindings[${index}]`;
  assertObject(binding, label);
  assertString(binding.criterion_id, `${label}.criterion_id`);
  invariant(ACCEPTANCE_BINDING_MODES.includes(binding.mode), `${label}.mode invalid`);

  if (binding.mode === 'AUTOMATED') {
    assertExactKeys(binding, ['criterion_id', 'mode', 'module_id', 'module_version', 'module_digest', 'fixture_reference_ids', 'config'], label);
    assertString(binding.module_id, `${label}.module_id`);
    assertString(binding.module_version, `${label}.module_version`);
    assertDigest(binding.module_digest, `${label}.module_digest`);
    assertObject(binding.config, `${label}.config`);
    digestRecord(binding.config);
    return {
      criterion_id: binding.criterion_id,
      mode: binding.mode,
      module_id: binding.module_id,
      module_version: binding.module_version,
      module_digest: binding.module_digest,
      fixture_reference_ids: uniqueSortedStrings(binding.fixture_reference_ids, `${label}.fixture_reference_ids`),
      config: clone(binding.config),
    };
  }

  assertExactKeys(binding, ['criterion_id', 'mode', 'instructions'], label);
  assertString(binding.instructions, `${label}.instructions`);
  return {
    criterion_id: binding.criterion_id,
    mode: binding.mode,
    instructions: binding.instructions,
  };
}

export function canonicalAcceptanceManifest(manifest) {
  assertObject(manifest, 'acceptance manifest');
  assertExactKeys(manifest, ['schema_version', 'challenge_id', 'contract_version', 'bindings'], 'acceptance manifest');
  invariant(manifest.schema_version === ACCEPTANCE_MANIFEST_SCHEMA_VERSION, `unsupported acceptance manifest schema ${manifest.schema_version}`);
  assertString(manifest.challenge_id, 'acceptance manifest.challenge_id');
  assertString(manifest.contract_version, 'acceptance manifest.contract_version');
  invariant(Array.isArray(manifest.bindings), 'acceptance manifest.bindings must be an array');
  const bindings = manifest.bindings.map(normalizeBinding).sort((left, right) => byteCompare(left.criterion_id, right.criterion_id));
  invariant(new Set(bindings.map((binding) => binding.criterion_id)).size === bindings.length, 'acceptance manifest criterion bindings must be unique');
  return {
    schema_version: ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
    challenge_id: manifest.challenge_id,
    contract_version: manifest.contract_version,
    bindings,
  };
}

export function assertAcceptanceManifest(manifest) {
  return canonicalAcceptanceManifest(manifest);
}

export function digestAcceptanceManifest(manifest) {
  return digestRecord(canonicalAcceptanceManifest(manifest));
}

function mandatoryCriterionIds(contract) {
  return [
    ...(contract.outcome_contract?.criteria ?? []),
    ...(contract.production_envelope?.criteria ?? []),
    ...(contract.delivery_contract?.criteria ?? []),
    ...(contract.normative_constraints ?? []),
  ]
    .filter((criterion) => criterion.mandatory === true)
    .map((criterion) => criterion.id)
    .sort(byteCompare);
}

export function bindAcceptanceManifestToContract(contract, manifest, referenceId) {
  const frozenContract = assertFrozenBuildContract(contract);
  const canonicalManifest = canonicalAcceptanceManifest(manifest);
  assertString(referenceId, 'acceptance manifest reference id');
  invariant(canonicalManifest.challenge_id === frozenContract.challenge_id, 'acceptance manifest Challenge mismatch');
  invariant(canonicalManifest.contract_version === frozenContract.contract_version, 'acceptance manifest contract version mismatch');

  const mandatoryIds = mandatoryCriterionIds(frozenContract);
  const bindingIds = canonicalManifest.bindings.map((binding) => binding.criterion_id);
  invariant(
    mandatoryIds.length === bindingIds.length && mandatoryIds.every((criterionId, index) => criterionId === bindingIds[index]),
    'acceptance manifest bindings must exactly match frozen mandatory criteria',
  );

  const manifestReferences = frozenContract.normative_references.filter((candidate) => candidate.kind === ACCEPTANCE_MANIFEST_REFERENCE_KIND);
  invariant(manifestReferences.length === 1, 'acceptance manifest reference authority must be unique');
  const reference = manifestReferences[0];
  invariant(reference.id === referenceId, 'acceptance manifest normative reference id mismatch');
  invariant(reference.content_digest === digestAcceptanceManifest(canonicalManifest), 'acceptance manifest normative reference digest mismatch');

  const normativeReferenceIds = new Set(frozenContract.normative_references.map((candidate) => candidate.id));
  for (const binding of canonicalManifest.bindings) {
    if (binding.mode !== 'AUTOMATED') continue;
    for (const fixtureReferenceId of binding.fixture_reference_ids) {
      invariant(fixtureReferenceId !== referenceId, 'acceptance manifest cannot use itself as an automated fixture');
      invariant(normativeReferenceIds.has(fixtureReferenceId), `acceptance fixture reference missing: ${fixtureReferenceId}`);
    }
  }

  return deepFreeze(canonicalManifest);
}
