import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalizeJson} from '../../dist/canonical-json.js';

test('canonical JSON preserves own __proto__ data in payload identity', () => {
  const withProto = JSON.parse('{"__proto__":{"polluted":true},"alpha":1}');
  const withoutProto = {alpha: 1};

  const canonical = canonicalizeJson(withProto);
  const baseline = canonicalizeJson(withoutProto);

  assert.equal(Object.hasOwn(canonical.value, '__proto__'), true);
  assert.equal(canonical.serialized, '{"__proto__":{"polluted":true},"alpha":1}');
  assert.notEqual(canonical.sha256, baseline.sha256);
  assert.equal({}.polluted, undefined);
});
