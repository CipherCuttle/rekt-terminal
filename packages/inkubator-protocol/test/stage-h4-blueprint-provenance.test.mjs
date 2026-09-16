import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const provenance = JSON.parse(fs.readFileSync(
  path.resolve(packageRoot, 'compiler/provenance/blueprints.v1.json'),
  'utf8',
));

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const output = {};
    for (const key of Object.keys(value).sort()) output[key] = canonical(value[key]);
    return output;
  }
  return value;
}

function canonicalSha256(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)), 'utf8')
    .digest('hex');
}

function gitBlobSha1(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`))
    .update(bytes)
    .digest('hex');
}

test('H4 promoted blueprint registry has exact source and semantic provenance', () => {
  assert.equal(provenance.schema_version, 'inkubator.compiler-blueprint-provenance/1.0');
  assert.equal(provenance.promotion.authority, 'STAGE_H_T2');
  assert.match(provenance.promotion.promotion_parent_commit, /^[0-9a-f]{40}$/);
  assert.equal(provenance.blueprints.length, 5);

  const identities = [];
  for (const record of provenance.blueprints) {
    const source = path.resolve(packageRoot, record.source_path);
    const bytes = fs.readFileSync(source);
    const blueprint = JSON.parse(bytes.toString('utf8'));
    const identity = `${blueprint.id}@${blueprint.version}`;

    assert.equal(blueprint.id, record.id);
    assert.equal(blueprint.version, record.version);
    assert.equal(gitBlobSha1(bytes), record.source_git_blob_sha1, `${identity} source blob drifted without provenance update`);
    assert.equal(canonicalSha256(blueprint), record.content_sha256, `${identity} semantic digest drifted without version/provenance update`);
    identities.push(identity);
  }

  assert.deepEqual(identities.sort(), [
    'WEB3_READ_APP@1.0.0',
    'WEB3_TRANSACTION_APP@1.0.0',
    'WEB_CRUD@1.0.0',
    'WEB_REALTIME@1.0.0',
    'WEB_STATIC@1.0.0',
  ]);
});

test('same-id/version blueprint substitution changes the promoted content identity', () => {
  const record = provenance.blueprints.find((item) => item.id === 'WEB_STATIC');
  assert.ok(record);
  const source = path.resolve(packageRoot, record.source_path);
  const blueprint = JSON.parse(fs.readFileSync(source, 'utf8'));
  const substituted = structuredClone(blueprint);
  substituted.reference_architecture = {
    shape: 'SUBSTITUTED_WITHOUT_VERSION_BUMP',
    components: ['untrusted-runtime'],
  };

  assert.equal(substituted.id, record.id);
  assert.equal(substituted.version, record.version);
  assert.notEqual(canonicalSha256(substituted), record.content_sha256);
});
