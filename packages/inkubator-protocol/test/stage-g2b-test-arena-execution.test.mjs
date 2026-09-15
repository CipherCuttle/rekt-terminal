import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILD_CONTRACT_SCHEMA_VERSION,
  IP_TERMS_VERSION,
  MECHANISM_VERSION,
  SETTLEMENT_POLICY_VERSION,
  freezeBuildContract,
} from '../src/challenge.mjs';
import {
  ACCEPTANCE_MANIFEST_REFERENCE_KIND,
  ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
  digestAcceptanceManifest,
} from '../src/acceptance-manifest.mjs';
import {
  TEST_ARENA_EXECUTION_PROFILE_VERSION,
  buildTestArenaQualification,
  digestTestArenaExecution,
  qualificationVersionForTestArena,
} from '../src/test-arena-execution.mjs';

const t0 = 1_800_000_000_000;
const manifestReferenceId = 'REF-ACCEPTANCE-V1';
const fixtureReferenceId = 'REF-FIXTURE-V1';
const fixtureDigest = 'f'.repeat(64);
const moduleDigest = 'a'.repeat(64);
const artifactDigest = 'b'.repeat(64);
const entryId = 'ENTRY-1';

function acceptanceManifest(overrides = {}) {
  return {
    schema_version: ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
    challenge_id: 'CH-G2B',
    contract_version: '1',
    bindings: [
      {
        criterion_id: 'AUTO-1',
        mode: 'AUTOMATED',
        module_id: 'http-smoke',
        module_version: '1.0.0',
        module_digest: moduleDigest,
        fixture_reference_ids: [fixtureReferenceId],
        config: {expected_status: 200},
      },
      {
        criterion_id: 'HUMAN-1',
        mode: 'HUMAN_OBSERVATION',
        instructions: 'Confirm the frozen interaction behavior.',
      },
    ],
    ...overrides,
  };
}

function contractFor(manifest, overrides = {}) {
  return freezeBuildContract({
    schema_version: BUILD_CONTRACT_SCHEMA_VERSION,
    challenge_id: 'CH-G2B',
    contract_version: '1',
    mechanism_version: MECHANISM_VERSION,
    settlement_policy_version: SETTLEMENT_POLICY_VERSION,
    ip_terms_version: IP_TERMS_VERSION,
    title: 'G2B objective execution',
    brief: 'Execute only frozen qualification law.',
    outcome_contract: {criteria: [
      {id: 'AUTO-1', description: 'Returns the frozen expected response.', mandatory: true},
    ]},
    production_envelope: {criteria: []},
    delivery_contract: {criteria: [
      {id: 'HUMAN-1', description: 'Frozen interaction is inspectably correct.', mandatory: true},
    ]},
    preferences: {},
    reference_architecture: {},
    normative_constraints: [],
    normative_references: [
      {id: fixtureReferenceId, kind: 'FIXTURE', content_digest: fixtureDigest},
      {id: manifestReferenceId, kind: ACCEPTANCE_MANIFEST_REFERENCE_KIND, content_digest: digestAcceptanceManifest(manifest)},
    ],
    informational_references: [],
    knowledge: [{kind: 'KNOWN', key: 'g2b', material: true, value: 'frozen'}],
    slot_limit: 3,
    activation_minimum: 2,
    entry_deadline: t0 + 100,
    build_start: t0 + 100,
    submission_deadline: t0 + 1000,
    appeal_window_ms: 200,
    review_deadline: t0 + 1800,
    prize_minor_units: 100,
    prize_display: '100 TEST',
    settlement_asset: 'TEST',
    ...overrides,
  });
}

function submissionFor(contract, overrides = {}) {
  return {
    schema_version: 'inkubator.submission-manifest/1.0',
    challenge_id: contract.challenge_id,
    entry_id: entryId,
    terms_digest: contract.terms_digest,
    submission_version: 1,
    immutable_source_reference: {kind: 'GIT_COMMIT', value: 'deadbeef'},
    artifact_digest: artifactDigest,
    evidence_references: ['EVIDENCE-SUBMISSION'],
    optional_live_url: 'https://example.invalid/',
    accepted_at: contract.submission_deadline - 1,
    ...overrides,
  };
}

function observations(overrides = {}) {
  const automated = {
    criterion_id: 'AUTO-1',
    mode: 'AUTOMATED',
    module_id: 'http-smoke',
    module_version: '1.0.0',
    module_digest: moduleDigest,
    result: 'PASS',
    evidence_refs: ['EVIDENCE-AUTO'],
  };
  const human = {
    criterion_id: 'HUMAN-1',
    mode: 'HUMAN_OBSERVATION',
    result: 'PASS',
    evidence_refs: ['EVIDENCE-HUMAN'],
  };
  return [
    {...automated, ...(overrides.automated ?? {})},
    {...human, ...(overrides.human ?? {})},
  ];
}

function executionInput({manifest = acceptanceManifest(), contract = null, submissionManifests = null, observed = null} = {}) {
  const frozen = contract ?? contractFor(manifest);
  return {
    contract: frozen,
    acceptanceManifest: manifest,
    acceptanceManifestReferenceId: manifestReferenceId,
    entryId,
    submissionManifests: submissionManifests ?? [submissionFor(frozen)],
    observations: observed ?? observations(),
  };
}

test('G2B builds qualification only from exact frozen execution bindings', () => {
  const result = buildTestArenaQualification(executionInput());
  assert.equal(result.overall, 'QUALIFIED');
  assert.equal(result.execution.execution_profile_version, TEST_ARENA_EXECUTION_PROFILE_VERSION);
  assert.equal(result.execution.observations[0].criterion_id, 'AUTO-1');
  assert.equal(result.execution.observations[1].criterion_id, 'HUMAN-1');
  assert.deepEqual(result.criterion_results.map((criterion) => criterion.criterion_id), ['AUTO-1', 'HUMAN-1']);
  assert.match(result.execution.submission.manifest_digest, /^[0-9a-f]{64}$/);
  assert.match(result.execution_digest, /^[0-9a-f]{64}$/);
  assert.equal(Object.isFrozen(result.execution), true);
});

test('G2B preserves existing qualification law for fail and disputed outcomes', () => {
  const failed = buildTestArenaQualification(executionInput({observed: observations({automated: {result: 'FAIL'}})}));
  assert.equal(failed.overall, 'NOT_QUALIFIED');

  const disputed = buildTestArenaQualification(executionInput({observed: observations({human: {result: 'DISPUTED'}})}));
  assert.equal(disputed.overall, 'DISPUTED');
});

test('G2B rejects automated result provenance that differs from the frozen module authority', () => {
  for (const patch of [
    {module_id: 'different-module'},
    {module_version: '9.9.9'},
    {module_digest: 'c'.repeat(64)},
  ]) {
    assert.throws(
      () => buildTestArenaQualification(executionInput({observed: observations({automated: patch})})),
      /does not match frozen binding/,
    );
  }
});

test('G2B rejects mode substitution and executor fields on human observations', () => {
  assert.throws(
    () => buildTestArenaQualification(executionInput({
      observed: observations({human: {mode: 'AUTOMATED'}}),
    })),
    /mode does not match frozen binding/,
  );

  const polluted = observations();
  polluted[1] = {...polluted[1], module_id: 'secret-judge'};
  assert.throws(
    () => buildTestArenaQualification(executionInput({observed: polluted})),
    /invalid keys/,
  );
});

test('G2B rejects missing, duplicate, or undeclared observations', () => {
  const base = observations();
  assert.throws(
    () => buildTestArenaQualification(executionInput({observed: [base[0]]})),
    /exactly match frozen bindings/,
  );
  assert.throws(
    () => buildTestArenaQualification(executionInput({observed: [base[0], {...base[0]}]})),
    /criterion ids must be unique|exactly match frozen bindings/,
  );
  assert.throws(
    () => buildTestArenaQualification(executionInput({observed: [base[0], {...base[1], criterion_id: 'POST-HOC'}]})),
    /missing for HUMAN-1|undeclared criteria/,
  );
});

test('G2B requires durable evidence references for every qualification observation', () => {
  assert.throws(
    () => buildTestArenaQualification(executionInput({observed: observations({automated: {evidence_refs: []}})})),
    /evidence_refs must not be empty/,
  );
  assert.throws(
    () => buildTestArenaQualification(executionInput({observed: observations({human: {evidence_refs: []}})})),
    /evidence_refs must not be empty/,
  );
});

test('G2B selects the protocol-final eligible submission from the candidate set', () => {
  const manifest = acceptanceManifest();
  const contract = contractFor(manifest);
  const older = submissionFor(contract, {
    submission_version: 1,
    accepted_at: contract.submission_deadline - 100,
    artifact_digest: '1'.repeat(64),
    immutable_source_reference: {kind: 'GIT_COMMIT', value: 'older'},
  });
  const newer = submissionFor(contract, {
    submission_version: 2,
    accepted_at: contract.submission_deadline - 10,
    artifact_digest: '2'.repeat(64),
    immutable_source_reference: {kind: 'GIT_COMMIT', value: 'newer'},
  });
  const result = buildTestArenaQualification(executionInput({
    manifest,
    contract,
    submissionManifests: [newer, older],
  }));
  assert.equal(result.execution.submission.submission_version, 2);
  assert.equal(result.execution.submission.artifact_digest, '2'.repeat(64));
  assert.equal(result.execution.submission.immutable_source_reference.value, 'newer');
});

test('G2B execution identity binds the complete protocol-selected submission manifest', () => {
  const manifest = acceptanceManifest();
  const contract = contractFor(manifest);
  const base = submissionFor(contract, {
    accepted_at: contract.submission_deadline - 20,
    evidence_references: ['EVIDENCE-A'],
    optional_live_url: 'https://example.invalid/a',
  });
  const baseline = buildTestArenaQualification(executionInput({manifest, contract, submissionManifests: [base]}));

  for (const candidate of [
    {...base, accepted_at: contract.submission_deadline - 19},
    {...base, evidence_references: ['EVIDENCE-B']},
    {...base, optional_live_url: 'https://example.invalid/b'},
  ]) {
    const changed = buildTestArenaQualification(executionInput({manifest, contract, submissionManifests: [candidate]}));
    assert.notEqual(changed.execution.submission.manifest_digest, baseline.execution.submission.manifest_digest);
    assert.notEqual(changed.execution_digest, baseline.execution_digest);
  }
});

test('G2B fails closed when the candidate set has no protocol-eligible final submission', () => {
  const input = executionInput();
  const submission = input.submissionManifests[0];
  assert.throws(
    () => buildTestArenaQualification({...input, submissionManifests: [{...submission, terms_digest: 'd'.repeat(64)}]}),
    /final submission missing/,
  );
  assert.throws(
    () => buildTestArenaQualification({...input, submissionManifests: [{...submission, accepted_at: input.contract.submission_deadline + 1}]}),
    /final submission missing/,
  );
  assert.throws(
    () => buildTestArenaQualification({...input, submissionManifests: [{...submission, entry_id: 'OTHER-ENTRY'}]}),
    /final submission missing/,
  );
});

test('G2B rejects duplicate eligible submission versions through existing finality law', () => {
  const input = executionInput();
  const first = input.submissionManifests[0];
  assert.throws(
    () => buildTestArenaQualification({
      ...input,
      submissionManifests: [first, {...first, artifact_digest: '3'.repeat(64)}],
    }),
    /eligible submission versions must be unique/,
  );
});

test('G2B execution digest is stable across observation and evidence ordering only', () => {
  const input = executionInput();
  const a = digestTestArenaExecution({
    ...input,
    observations: [
      {...input.observations[0], evidence_refs: ['EVIDENCE-Z', 'EVIDENCE-A']},
      input.observations[1],
    ],
  });
  const b = digestTestArenaExecution({
    ...input,
    observations: [
      input.observations[1],
      {...input.observations[0], evidence_refs: ['EVIDENCE-A', 'EVIDENCE-Z']},
    ],
  });
  assert.equal(a, b);
});

test('G2B qualification version is bound to the frozen contract and acceptance manifest authority', () => {
  const manifestA = acceptanceManifest();
  const contractA = contractFor(manifestA);
  const versionA = qualificationVersionForTestArena(contractA, manifestA, manifestReferenceId);

  const manifestB = acceptanceManifest({
    bindings: acceptanceManifest().bindings.map((binding) => binding.mode === 'AUTOMATED'
      ? {...binding, config: {expected_status: 201}}
      : binding),
  });
  const contractB = contractFor(manifestB);
  const versionB = qualificationVersionForTestArena(contractB, manifestB, manifestReferenceId);

  assert.notEqual(versionA, versionB);
  assert.match(versionA, /^objective-test-arena\/1\.0:[0-9a-f]{64}$/);

  assert.throws(
    () => qualificationVersionForTestArena(contractA, manifestB, manifestReferenceId),
    /normative reference digest mismatch/,
  );
});
