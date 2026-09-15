import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILD_CONTRACT_SCHEMA_VERSION,
  MECHANISM_VERSION,
  SETTLEMENT_POLICY_VERSION,
  IP_TERMS_VERSION,
  freezeBuildContract,
} from '../src/challenge.mjs';
import {
  ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
  ACCEPTANCE_MANIFEST_REFERENCE_KIND,
  bindAcceptanceManifestToContract,
  canonicalAcceptanceManifest,
  digestAcceptanceManifest,
} from '../src/acceptance-manifest.mjs';

const t0 = 1_800_000_000_000;
const fixtureDigest = 'f'.repeat(64);
const moduleDigest = 'a'.repeat(64);
const manifestReferenceId = 'REF-ACCEPTANCE-V1';
const fixtureReferenceId = 'REF-FIXTURE-V1';

function acceptanceManifest(overrides = {}) {
  return {
    schema_version: ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
    challenge_id: 'CH-G2',
    contract_version: '1',
    bindings: [
      {
        criterion_id: 'AUTO-1',
        mode: 'AUTOMATED',
        module_id: 'http-response',
        module_version: '1.0.0',
        module_digest: moduleDigest,
        fixture_reference_ids: [fixtureReferenceId],
        config: {expected_status: 200},
      },
      {
        criterion_id: 'HUMAN-1',
        mode: 'HUMAN_OBSERVATION',
        instructions: 'Confirm the delivered interaction matches the frozen observable behavior.',
      },
    ],
    ...overrides,
  };
}

function withAutomatedBinding(manifest, patch) {
  return acceptanceManifest({
    ...manifest,
    bindings: manifest.bindings.map((binding) => binding.mode === 'AUTOMATED' ? {...binding, ...patch} : binding),
  });
}

function contractFor(manifest, overrides = {}) {
  return freezeBuildContract({
    schema_version: BUILD_CONTRACT_SCHEMA_VERSION,
    challenge_id: 'CH-G2',
    contract_version: '1',
    mechanism_version: MECHANISM_VERSION,
    settlement_policy_version: SETTLEMENT_POLICY_VERSION,
    ip_terms_version: IP_TERMS_VERSION,
    title: 'G2 acceptance binding',
    brief: 'Prove frozen evaluation meaning before execution.',
    outcome_contract: {criteria: [
      {id: 'AUTO-1', description: 'Returns the frozen expected response.', mandatory: true},
      {id: 'OPTIONAL-1', description: 'Nice-to-have polish.', mandatory: false},
    ]},
    production_envelope: {criteria: []},
    delivery_contract: {criteria: [
      {id: 'HUMAN-1', description: 'Interaction is inspectably correct.', mandatory: true},
    ]},
    preferences: {taste: 'organizer-only'},
    reference_architecture: {},
    normative_constraints: [],
    normative_references: [
      {id: fixtureReferenceId, kind: 'FIXTURE', content_digest: fixtureDigest},
      {id: manifestReferenceId, kind: ACCEPTANCE_MANIFEST_REFERENCE_KIND, content_digest: digestAcceptanceManifest(manifest)},
    ],
    informational_references: [],
    knowledge: [{kind: 'KNOWN', key: 'evaluation_mode', material: true, value: 'frozen'}],
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

test('G2A binds exactly one frozen evaluation path per mandatory criterion', () => {
  const manifest = acceptanceManifest();
  const contract = contractFor(manifest);
  const bound = bindAcceptanceManifestToContract(contract, manifest, manifestReferenceId);
  assert.deepEqual(bound.bindings.map((binding) => binding.criterion_id), ['AUTO-1', 'HUMAN-1']);
  assert.equal(bound.bindings[0].mode, 'AUTOMATED');
  assert.equal(bound.bindings[1].mode, 'HUMAN_OBSERVATION');
});

test('G2A rejects missing mandatory criterion bindings', () => {
  const manifest = acceptanceManifest({bindings: [acceptanceManifest().bindings[0]]});
  const contract = contractFor(manifest);
  assert.throws(
    () => bindAcceptanceManifestToContract(contract, manifest, manifestReferenceId),
    /exactly match frozen mandatory criteria/,
  );
});

test('G2A rejects optional or post-hoc criteria as qualification bindings', () => {
  const original = acceptanceManifest();
  const manifest = acceptanceManifest({
    bindings: [
      ...original.bindings,
      {criterion_id: 'OPTIONAL-1', mode: 'HUMAN_OBSERVATION', instructions: 'Do not promote this optional criterion.'},
    ],
  });
  const contract = contractFor(manifest);
  assert.throws(
    () => bindAcceptanceManifestToContract(contract, manifest, manifestReferenceId),
    /exactly match frozen mandatory criteria/,
  );
});

test('G2A content digest binds module/config semantics and fails closed on tampering', () => {
  const manifest = acceptanceManifest();
  const contract = contractFor(manifest);
  const tampered = withAutomatedBinding(manifest, {config: {expected_status: 201}});
  assert.notEqual(digestAcceptanceManifest(manifest), digestAcceptanceManifest(tampered));
  assert.throws(
    () => bindAcceptanceManifestToContract(contract, tampered, manifestReferenceId),
    /normative reference digest mismatch/,
  );
});

test('G2A rejects non-canonical JSON executor configs before hashing', () => {
  for (const config of [
    {at: new Date(0)},
    {mapping: new Map([['expected_status', 200]])},
    {unsafe_number: 1.5},
  ]) {
    const manifest = withAutomatedBinding(acceptanceManifest(), {config});
    assert.throws(
      () => digestAcceptanceManifest(manifest),
      /must contain only canonical JSON values/,
    );
  }
});

test('G2A automated fixtures must already exist as frozen normative references', () => {
  const manifest = withAutomatedBinding(acceptanceManifest(), {fixture_reference_ids: ['REF-MISSING']});
  const contract = contractFor(manifest);
  assert.throws(
    () => bindAcceptanceManifestToContract(contract, manifest, manifestReferenceId),
    /acceptance fixture reference missing/,
  );
});

test('G2A acceptance manifest cannot reference itself as an automated fixture', () => {
  const manifest = withAutomatedBinding(acceptanceManifest(), {fixture_reference_ids: [manifestReferenceId]});
  const contract = contractFor(manifest);
  assert.throws(
    () => bindAcceptanceManifestToContract(contract, manifest, manifestReferenceId),
    /cannot use itself as an automated fixture/,
  );
});

test('G2A rejects content-addressed self-aliases with a different fixture id', () => {
  const aliasReferenceId = 'REF-MANIFEST-ALIAS';
  const manifest = withAutomatedBinding(acceptanceManifest(), {fixture_reference_ids: [aliasReferenceId]});
  const manifestDigest = digestAcceptanceManifest(manifest);
  const contract = contractFor(manifest, {
    normative_references: [
      {id: aliasReferenceId, kind: 'FIXTURE', content_digest: manifestDigest},
      {id: manifestReferenceId, kind: ACCEPTANCE_MANIFEST_REFERENCE_KIND, content_digest: manifestDigest},
    ],
  });
  assert.throws(
    () => bindAcceptanceManifestToContract(contract, manifest, manifestReferenceId),
    /content-addressed self-alias/,
  );
});

test('G2A contract cannot freeze multiple competing acceptance authorities', () => {
  const manifest = acceptanceManifest();
  const digest = digestAcceptanceManifest(manifest);
  const contract = contractFor(manifest, {
    normative_references: [
      {id: fixtureReferenceId, kind: 'FIXTURE', content_digest: fixtureDigest},
      {id: manifestReferenceId, kind: ACCEPTANCE_MANIFEST_REFERENCE_KIND, content_digest: digest},
      {id: 'REF-ACCEPTANCE-V2', kind: ACCEPTANCE_MANIFEST_REFERENCE_KIND, content_digest: digest},
    ],
  });
  assert.throws(
    () => bindAcceptanceManifestToContract(contract, manifest, manifestReferenceId),
    /reference authority must be unique/,
  );
});

test('G2A supports the existing protocol edge case with zero mandatory criteria', () => {
  const manifest = acceptanceManifest({bindings: []});
  const contract = contractFor(manifest, {
    outcome_contract: {criteria: [{id: 'OPTIONAL-1', description: 'Optional only.', mandatory: false}]},
    production_envelope: {criteria: []},
    delivery_contract: {criteria: []},
    normative_constraints: [],
  });
  const bound = bindAcceptanceManifestToContract(contract, manifest, manifestReferenceId);
  assert.deepEqual(bound.bindings, []);
});

test('G2A digest is stable across non-semantic binding and fixture ordering', () => {
  const a = acceptanceManifest();
  const automated = {...a.bindings[0], fixture_reference_ids: ['REF-Z', fixtureReferenceId]};
  const human = a.bindings[1];
  const b = acceptanceManifest({bindings: [human, {...automated, fixture_reference_ids: [fixtureReferenceId, 'REF-Z']}]});
  const c = acceptanceManifest({bindings: [automated, human]});
  assert.deepEqual(canonicalAcceptanceManifest(b), canonicalAcceptanceManifest(c));
  assert.equal(digestAcceptanceManifest(b), digestAcceptanceManifest(c));
});

test('G2A human observation cannot smuggle an executor or hidden config', () => {
  const manifest = acceptanceManifest({
    bindings: acceptanceManifest().bindings.map((binding) => binding.mode === 'HUMAN_OBSERVATION'
      ? {...binding, module_id: 'secret-judge'}
      : binding),
  });
  assert.throws(() => digestAcceptanceManifest(manifest), /invalid keys/);
});
