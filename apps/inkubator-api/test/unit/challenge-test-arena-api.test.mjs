import assert from 'node:assert/strict';
import test from 'node:test';
import {freezeBuildContract} from '@rekt-ink/protocol/challenge';
import {
  ACCEPTANCE_MANIFEST_REFERENCE_KIND,
  ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
  digestAcceptanceManifest,
} from '@rekt-ink/protocol/acceptance-manifest';
import {canonicalizeJson} from '../../dist/canonical-json.js';
import {buildStageG2BQualificationFromSnapshot} from '../../dist/challenge-test-arena-api.js';
import {trustedTestModuleCatalog} from '../../dist/challenge-test-runners.js';

const organizer = '20000000-0000-4000-8000-000000000001';
const builder = '20000000-0000-4000-8000-000000000002';
const challengeId = '20000000-0000-4000-8000-000000000003';
const entryId = '20000000-0000-4000-8000-000000000004';
const submissionId = '20000000-0000-4000-8000-000000000005';
const t0 = 1_800_000_000_000;
const acceptanceReferenceId = 'REF-G2B2-ACCEPTANCE';

function archiveModule() {
  return trustedTestModuleCatalog().find((module) => module.module_id === 'archive-capture-integrity');
}

function acceptanceManifest(module = archiveModule()) {
  assert.ok(module);
  return {
    schema_version: ACCEPTANCE_MANIFEST_SCHEMA_VERSION,
    challenge_id: challengeId,
    contract_version: 'g2b2-v1',
    bindings: [
      {
        criterion_id: 'AUTO-ARCHIVE',
        mode: 'AUTOMATED',
        module_id: module.module_id,
        module_version: module.module_version,
        module_digest: module.module_digest,
        fixture_reference_ids: [],
        config: {},
      },
      {
        criterion_id: 'HUMAN-UX',
        mode: 'HUMAN_OBSERVATION',
        instructions: 'Confirm the frozen user interaction requirement.',
      },
    ],
  };
}

function frozenContract(manifest = acceptanceManifest()) {
  return freezeBuildContract({
    schema_version: 'inkubator.build-contract/1.0',
    challenge_id: challengeId,
    contract_version: 'g2b2-v1',
    mechanism_version: 'funded-challenge/1.1',
    settlement_policy_version: 'funded-challenge-settlement/1.0',
    ip_terms_version: 'bespoke-winner-transfer/1.0',
    title: 'G2B2 qualification contract',
    brief: 'Use only frozen Test Arena authority.',
    outcome_contract: {criteria: [
      {id: 'AUTO-ARCHIVE', description: 'Final work must have the frozen archive outcome.', mandatory: true},
    ]},
    production_envelope: {criteria: []},
    delivery_contract: {criteria: [
      {id: 'HUMAN-UX', description: 'Frozen interaction is observed.', mandatory: true},
    ]},
    preferences: {},
    reference_architecture: {},
    normative_constraints: [],
    normative_references: [
      {id: acceptanceReferenceId, kind: ACCEPTANCE_MANIFEST_REFERENCE_KIND, content_digest: digestAcceptanceManifest(manifest)},
    ],
    informational_references: [],
    knowledge: [],
    slot_limit: 3,
    activation_minimum: 1,
    entry_deadline: t0 + 100,
    build_start: t0 + 100,
    submission_deadline: t0 + 1000,
    appeal_window_ms: 1000,
    review_deadline: t0 + 5000,
    prize_minor_units: 100,
    settlement_asset: 'TEST',
  });
}

function submissionManifest(contract, overrides = {}) {
  return {
    schema_version: 'inkubator.submission-manifest/1.0',
    challenge_id: challengeId,
    entry_id: entryId,
    terms_digest: contract.terms_digest,
    submission_version: 1,
    immutable_source_reference: {kind: 'GIT_COMMIT', value: 'abc123'},
    artifact_digest: 'a'.repeat(64),
    evidence_references: ['EVIDENCE-SUBMISSION'],
    optional_live_url: 'https://example.invalid/',
    accepted_at: contract.submission_deadline - 10,
    ...overrides,
  };
}

function fixture({manifest = acceptanceManifest(), contract = null, isFinal = true, archiveStatus = 'CAPTURED', archivePatch = {}} = {}) {
  const frozen = contract ?? frozenContract(manifest);
  const submission = submissionManifest(frozen);
  const manifestDigest = canonicalizeJson(submission).sha256;
  const snapshot = {
    challenge: {
      challenge_id: challengeId,
      organizer_player_id: organizer,
      status: 'QUALIFICATION',
      current_contract_version: frozen.contract_version,
      current_terms_digest: frozen.terms_digest,
    },
    contract: {
      challenge_id: challengeId,
      contract_version: frozen.contract_version,
      terms_digest: frozen.terms_digest,
      contract_json: frozen,
    },
    entries: [{entry_id: entryId, challenge_id: challengeId, builder_player_id: builder}],
    submissions: [{
      submission_id: submissionId,
      challenge_id: challengeId,
      entry_id: entryId,
      submission_version: String(submission.submission_version),
      terms_digest: frozen.terms_digest,
      manifest_json: submission,
      manifest_digest: manifestDigest,
      accepted_at: new Date(submission.accepted_at),
      is_final: isFinal,
    }],
    qualifications: [],
    decisions: [],
    receipts: [],
  };
  const archive = {
    submission_id: submissionId,
    challenge_id: challengeId,
    entry_id: entryId,
    terms_digest: frozen.terms_digest,
    manifest_digest: manifestDigest,
    status: archiveStatus,
    archive_digest: archiveStatus === 'CAPTURED' ? 'b'.repeat(64) : null,
    reason_code: archiveStatus === 'CAPTURED' ? null : 'TEST_REASON',
    ...archivePatch,
  };
  return {manifest, frozen, snapshot, archive};
}

function human(result = 'PASS') {
  return [{criterion_id: 'HUMAN-UX', result, evidence_refs: ['EVIDENCE-HUMAN']}];
}

function prepare(options = {}) {
  const {manifest, snapshot, archive} = fixture(options);
  return buildStageG2BQualificationFromSnapshot(snapshot, [archive], {
    entryId,
    acceptanceManifestReferenceId: acceptanceReferenceId,
    acceptanceManifest: manifest,
    humanObservations: options.humanObservations ?? human(),
  });
}

test('G2B2 exposes only content-addressed trusted server modules', () => {
  const catalog = trustedTestModuleCatalog();
  assert.deepEqual(catalog.map((module) => module.module_id), [
    'submission-lineage-integrity',
    'archive-capture-integrity',
  ]);
  for (const module of catalog) assert.match(module.module_digest, /^[0-9a-f]{64}$/);
  assert.deepEqual(trustedTestModuleCatalog(), catalog);
});

test('G2B2 produces QUALIFIED from trusted CAPTURED archive evidence plus exact human observation', () => {
  const result = prepare();
  assert.equal(result.submission_id, submissionId);
  assert.equal(result.qualification.overall, 'QUALIFIED');
  assert.equal(result.qualification.execution.observations[0].mode, 'AUTOMATED');
  assert.equal(result.qualification.execution.observations[0].module_id, 'archive-capture-integrity');
  assert.equal(result.qualification.execution.observations[0].result, 'PASS');
  assert.equal(result.qualification.execution.observations[1].mode, 'HUMAN_OBSERVATION');
});

test('G2B2 does not crystallize pending archive intent into an immutable qualification', () => {
  assert.throws(() => prepare({archiveStatus: 'PENDING'}), /challenge_test_archive_pending/);
});

test('G2B2 maps terminal platform-owned archive uncertainty to DISPUTED rather than builder failure', () => {
  assert.equal(prepare({archiveStatus: 'PLATFORM_UNAVAILABLE'}).qualification.overall, 'DISPUTED');
});

test('G2B2 maps builder-caused or unsupported archive outcomes to existing NOT_QUALIFIED law', () => {
  assert.equal(prepare({archiveStatus: 'BUILDER_CAUSED_UNAVAILABLE'}).qualification.overall, 'NOT_QUALIFIED');
  assert.equal(prepare({archiveStatus: 'UNSUPPORTED_SOURCE'}).qualification.overall, 'NOT_QUALIFIED');
});

test('G2B2 refuses untrusted module substitution even when id/version look plausible', () => {
  const trusted = archiveModule();
  const manifest = acceptanceManifest({...trusted, module_digest: 'f'.repeat(64)});
  const contract = frozenContract(manifest);
  assert.throws(() => prepare({manifest, contract}), /challenge_test_runner_unsupported/);
});

test('G2B2 refuses caller-supplied config or fixtures for a module whose frozen runner does not support them', () => {
  const base = acceptanceManifest();
  const withConfig = {...base, bindings: base.bindings.map((binding) => binding.mode === 'AUTOMATED' ? {...binding, config: {surprise: true}} : binding)};
  assert.throws(() => prepare({manifest: withConfig, contract: frozenContract(withConfig)}), /challenge_test_runner_config_unsupported/);
});

test('G2B2 requires human observations to match only the frozen human bindings exactly', () => {
  assert.throws(() => prepare({humanObservations: []}), /challenge_test_human_observations_mismatch/);
  assert.throws(() => prepare({humanObservations: [
    ...human(),
    {criterion_id: 'AUTO-ARCHIVE', result: 'PASS', evidence_refs: ['FAKE-AUTO']},
  ]}), /challenge_test_human_observations_mismatch/);
});

test('G2B2 fails closed when durable is_final disagrees with Stage-B protocol finality', () => {
  assert.throws(() => prepare({isFinal: false}), /challenge_test_durable_finality_mismatch/);
});

test('G2B2 fails closed on archive lineage mismatch or missing captured digest', () => {
  assert.throws(() => prepare({archivePatch: {manifest_digest: 'c'.repeat(64)}}), /challenge_test_archive_lineage_mismatch/);
  assert.throws(() => prepare({archiveStatus: 'CAPTURED', archivePatch: {archive_digest: null}}), /challenge_test_archive_digest_missing/);
});

test('G2B2 preserves existing human FAIL/DISPUTED qualification semantics', () => {
  assert.equal(prepare({humanObservations: human('FAIL')}).qualification.overall, 'NOT_QUALIFIED');
  assert.equal(prepare({humanObservations: human('DISPUTED')}).qualification.overall, 'DISPUTED');
});
