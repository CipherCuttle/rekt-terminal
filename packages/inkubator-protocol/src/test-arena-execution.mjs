import {digestRecord} from './index.mjs';
import {
  QUALIFICATION_RESULTS,
  assertFrozenBuildContract,
  computeQualification,
  selectFinalSubmission,
} from './challenge-hardened.mjs';
import {
  bindAcceptanceManifestToContract,
  digestAcceptanceManifest,
} from './acceptance-manifest.mjs';

export const TEST_ARENA_EXECUTION_SCHEMA_VERSION = 'inkubator.test-arena-execution/1.0';
export const TEST_ARENA_EXECUTION_PROFILE_VERSION = 'objective-test-arena/1.0';

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

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(
    actual.length === wanted.length && actual.every((key, index) => key === wanted[index]),
    `${label} has invalid keys`,
  );
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
  invariant(values.length > 0, `${label} must not be empty`);
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

function normalizeObservation(observation, binding, index) {
  const label = `test arena observations[${index}]`;
  assertObject(observation, label);
  assertString(observation.criterion_id, `${label}.criterion_id`);
  invariant(observation.criterion_id === binding.criterion_id, `${label}.criterion_id does not match frozen binding`);
  invariant(observation.mode === binding.mode, `${label}.mode does not match frozen binding`);
  invariant(QUALIFICATION_RESULTS.includes(observation.result), `${label}.result invalid`);
  const evidenceRefs = uniqueSortedStrings(observation.evidence_refs, `${label}.evidence_refs`);

  if (binding.mode === 'AUTOMATED') {
    assertExactKeys(
      observation,
      ['criterion_id', 'mode', 'module_id', 'module_version', 'module_digest', 'result', 'evidence_refs'],
      label,
    );
    invariant(observation.module_id === binding.module_id, `${label}.module_id does not match frozen binding`);
    invariant(observation.module_version === binding.module_version, `${label}.module_version does not match frozen binding`);
    invariant(observation.module_digest === binding.module_digest, `${label}.module_digest does not match frozen binding`);
    return {
      criterion_id: binding.criterion_id,
      mode: 'AUTOMATED',
      module_id: binding.module_id,
      module_version: binding.module_version,
      module_digest: binding.module_digest,
      result: observation.result,
      evidence_refs: evidenceRefs,
    };
  }

  assertExactKeys(observation, ['criterion_id', 'mode', 'result', 'evidence_refs'], label);
  return {
    criterion_id: binding.criterion_id,
    mode: 'HUMAN_OBSERVATION',
    result: observation.result,
    evidence_refs: evidenceRefs,
  };
}

function criterionResultsFromObservations(observations) {
  return observations.map((observation) => ({
    criterion_id: observation.criterion_id,
    result: observation.result,
    evidence_refs: [...observation.evidence_refs],
  }));
}

export function qualificationVersionForTestArena(contract, acceptanceManifest, acceptanceManifestReferenceId) {
  const frozenContract = assertFrozenBuildContract(contract);
  const boundManifest = bindAcceptanceManifestToContract(
    frozenContract,
    acceptanceManifest,
    acceptanceManifestReferenceId,
  );
  const acceptanceManifestDigest = digestAcceptanceManifest(boundManifest);
  const authorityDigest = digestRecord({
    execution_profile_version: TEST_ARENA_EXECUTION_PROFILE_VERSION,
    terms_digest: frozenContract.terms_digest,
    acceptance_manifest_digest: acceptanceManifestDigest,
  });
  return `${TEST_ARENA_EXECUTION_PROFILE_VERSION}:${authorityDigest}`;
}

export function canonicalTestArenaExecution({
  contract,
  acceptanceManifest,
  acceptanceManifestReferenceId,
  entryId,
  submissionManifests,
  observations,
}) {
  const frozenContract = assertFrozenBuildContract(contract);
  const boundManifest = bindAcceptanceManifestToContract(
    frozenContract,
    acceptanceManifest,
    acceptanceManifestReferenceId,
  );
  assertString(entryId, 'test arena entryId');
  invariant(Array.isArray(submissionManifests), 'test arena submissionManifests must be an array');
  const submission = selectFinalSubmission(submissionManifests, frozenContract, entryId);
  invariant(submission, 'test arena final submission missing');
  const submissionManifestDigest = digestRecord(submission);
  invariant(Array.isArray(observations), 'test arena observations must be an array');
  invariant(observations.length === boundManifest.bindings.length, 'test arena observations must exactly match frozen bindings');

  const observationsByCriterion = new Map();
  for (const observation of observations) {
    assertObject(observation, 'test arena observation');
    assertString(observation.criterion_id, 'test arena observation.criterion_id');
    invariant(!observationsByCriterion.has(observation.criterion_id), 'test arena observation criterion ids must be unique');
    observationsByCriterion.set(observation.criterion_id, observation);
  }

  const normalizedObservations = boundManifest.bindings.map((binding, index) => {
    const observation = observationsByCriterion.get(binding.criterion_id);
    invariant(observation, `test arena observation missing for ${binding.criterion_id}`);
    return normalizeObservation(observation, binding, index);
  });
  invariant(observationsByCriterion.size === normalizedObservations.length, 'test arena observations contain undeclared criteria');

  const criterionResults = criterionResultsFromObservations(normalizedObservations);
  const qualification = computeQualification(frozenContract, criterionResults);
  const acceptanceManifestDigest = digestAcceptanceManifest(boundManifest);
  const qualificationVersion = qualificationVersionForTestArena(
    frozenContract,
    boundManifest,
    acceptanceManifestReferenceId,
  );

  return deepFreeze({
    schema_version: TEST_ARENA_EXECUTION_SCHEMA_VERSION,
    execution_profile_version: TEST_ARENA_EXECUTION_PROFILE_VERSION,
    challenge_id: frozenContract.challenge_id,
    contract_version: frozenContract.contract_version,
    terms_digest: frozenContract.terms_digest,
    acceptance_manifest_digest: acceptanceManifestDigest,
    qualification_version: qualificationVersion,
    submission: {
      entry_id: submission.entry_id,
      submission_version: submission.submission_version,
      manifest_digest: submissionManifestDigest,
      artifact_digest: submission.artifact_digest,
      immutable_source_reference: {...submission.immutable_source_reference},
    },
    observations: normalizedObservations,
    qualification,
  });
}

export function digestTestArenaExecution(input) {
  return digestRecord(canonicalTestArenaExecution(input));
}

export function buildTestArenaQualification(input) {
  const execution = canonicalTestArenaExecution(input);
  return deepFreeze({
    qualification_version: execution.qualification_version,
    criterion_results: execution.qualification.criteria.map((criterion) => ({
      criterion_id: criterion.criterion_id,
      result: criterion.result,
      evidence_refs: [...(criterion.evidence_refs ?? [])],
    })),
    overall: execution.qualification.overall,
    execution_digest: digestRecord(execution),
    execution,
  });
}
