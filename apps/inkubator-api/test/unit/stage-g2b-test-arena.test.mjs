import assert from 'node:assert/strict';
import test from 'node:test';
import {
  executeTrustedAutomatedBinding,
  TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_DIGEST,
  TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_ID,
  TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_VERSION,
} from '../../dist/challenge-test-arena.js';

const artifactDigest = 'a'.repeat(64);
const baseSubmission = {
  schema_version: 'inkubator.submission-manifest/1.0',
  challenge_id: '00000000-0000-4000-8000-000000000001',
  entry_id: '00000000-0000-4000-8000-000000000002',
  terms_digest: 'b'.repeat(64),
  submission_version: 1,
  immutable_source_reference: {kind: 'GIT_COMMIT', value: 'c'.repeat(40)},
  artifact_digest: artifactDigest,
  evidence_references: [],
  accepted_at: 1,
};

function binding(overrides = {}) {
  return {
    criterion_id: 'AUTO-1',
    mode: 'AUTOMATED',
    module_id: TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_ID,
    module_version: TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_VERSION,
    module_digest: TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_DIGEST,
    fixture_reference_ids: [],
    config: {expected_artifact_digest: artifactDigest},
    ...overrides,
  };
}

const context = {
  challengeId: baseSubmission.challenge_id,
  entryId: baseSubmission.entry_id,
  submissionId: '00000000-0000-4000-8000-000000000003',
  termsDigest: baseSubmission.terms_digest,
  acceptanceManifestDigest: 'd'.repeat(64),
};

test('G2B trusted artifact module emits a content-bound PASS evidence reference', () => {
  const result = executeTrustedAutomatedBinding(binding(), baseSubmission, context);
  assert.equal(result.result, 'PASS');
  assert.equal(result.module_id, TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_ID);
  assert.equal(result.module_version, TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_VERSION);
  assert.equal(result.module_digest, TEST_ARENA_ARTIFACT_DIGEST_MATCH_MODULE_DIGEST);
  assert.match(result.evidence_digest, /^[0-9a-f]{64}$/);
  assert.deepEqual(result.evidence_refs, [`challenge-evidence:${result.evidence_digest}`]);
});

test('G2B trusted artifact module returns FAIL without allowing a caller-selected result', () => {
  const result = executeTrustedAutomatedBinding(binding({config: {expected_artifact_digest: 'e'.repeat(64)}}), baseSubmission, context);
  assert.equal(result.result, 'FAIL');
});

test('G2B rejects unknown or digest-mismatched executor identities', () => {
  assert.throws(() => executeTrustedAutomatedBinding(binding({module_id: 'caller-chosen'}), baseSubmission, context), /executor_unsupported/);
  assert.throws(() => executeTrustedAutomatedBinding(binding({module_digest: 'f'.repeat(64)}), baseSubmission, context), /executor_digest_mismatch/);
  assert.throws(() => executeTrustedAutomatedBinding(binding({fixture_reference_ids: ['fixture-ref']}), baseSubmission, context), /executor_fixtures_unsupported/);
});

test('G2B rejects executor configs outside the frozen module contract', () => {
  assert.throws(() => executeTrustedAutomatedBinding(binding({config: {expected_artifact_digest: artifactDigest, hidden: true}}), baseSubmission, context), /config has invalid keys/);
});
