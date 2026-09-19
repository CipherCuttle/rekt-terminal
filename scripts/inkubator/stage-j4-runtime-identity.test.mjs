import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalImmutableLayout,
  immutableLayoutDigest,
  normalizeImmutableRuntime,
  runtimeIdentityInputFromArtifact,
} from './stage-j4-runtime-identity.mjs';

test('immutable layout is canonical and runtime normalization zeroes only declared spans', () => {
  const refs = {
    '9': [{start: 5, length: 2}],
    '2': [{start: 1, length: 2}],
  };
  const runtime = '0x0011223344556677';

  assert.deepEqual(canonicalImmutableLayout(refs, 8), [
    {start: 1, length: 2},
    {start: 5, length: 2},
  ]);
  assert.equal(normalizeImmutableRuntime(runtime, refs), '0x0000003344000077');
  assert.match(immutableLayoutDigest(refs, runtime), /^0x[0-9a-f]{64}$/);
});

test('artifact runtime identity is stable across immutable values when layout and code template match', () => {
  const refs = {'1': [{start: 2, length: 2}]};
  const artifactA = {
    deployedBytecode: {
      object: '0x600111226002',
      immutableReferences: refs,
    },
  };
  const artifactB = {
    deployedBytecode: {
      object: '0x6001aabb6002',
      immutableReferences: refs,
    },
  };

  const a = runtimeIdentityInputFromArtifact(artifactA);
  const b = runtimeIdentityInputFromArtifact(artifactB);

  assert.equal(a.runtime_template_bytecode, '0x600100006002');
  assert.equal(a.runtime_template_bytecode, b.runtime_template_bytecode);
  assert.equal(a.immutable_layout_digest, b.immutable_layout_digest);
  assert.equal(a.immutable_reference_count, 1);
});

test('runtime normalization fails closed on missing, overlapping or out-of-range immutable references', () => {
  assert.throws(() => normalizeImmutableRuntime('0x6001', {}), /requires compiler-declared immutable references/);
  assert.throws(() => normalizeImmutableRuntime('0x60016002', {
    '1': [{start: 1, length: 2}],
    '2': [{start: 2, length: 1}],
  }), /must not overlap/);
  assert.throws(() => normalizeImmutableRuntime('0x6001', {
    '1': [{start: 1, length: 2}],
  }), /exceeds runtime bytecode/);
});
