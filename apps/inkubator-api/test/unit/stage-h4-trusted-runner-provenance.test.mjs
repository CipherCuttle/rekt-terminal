import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {trustedTestModuleCatalog} from '../../dist/challenge-test-runners.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '../..');
const provenance = JSON.parse(fs.readFileSync(
  path.resolve(appRoot, 'provenance/trusted-test-modules.v1.json'),
  'utf8',
));

function gitBlobSha1(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`))
    .update(bytes)
    .digest('hex');
}

test('H4 trusted runner source is bound to explicit promotion provenance', () => {
  assert.equal(provenance.schema_version, 'inkubator.trusted-test-module-provenance/1.0');
  assert.equal(provenance.promotion.authority, 'STAGE_H_T2');
  assert.match(provenance.promotion.promotion_parent_commit, /^[0-9a-f]{40}$/);
  assert.equal(provenance.runner_engine.version, 'trusted-fact-runner/1.0');

  const source = path.resolve(appRoot, provenance.runner_engine.source_path);
  const bytes = fs.readFileSync(source);
  assert.equal(
    gitBlobSha1(bytes),
    provenance.runner_engine.source_git_blob_sha1,
    'trusted runner implementation drifted without engine/provenance promotion',
  );
});

test('H4 promoted trusted modules exactly match the runtime content-addressed catalog', () => {
  const catalog = trustedTestModuleCatalog()
    .map((item) => ({
      module_id: item.module_id,
      module_version: item.module_version,
      module_digest: item.module_digest,
      runner_engine_version: item.runner_engine_version,
    }))
    .sort((a, b) => a.module_id.localeCompare(b.module_id));

  const promoted = provenance.modules
    .map((item) => ({
      ...item,
      runner_engine_version: provenance.runner_engine.version,
    }))
    .sort((a, b) => a.module_id.localeCompare(b.module_id));

  assert.deepEqual(catalog, promoted);
  assert.deepEqual(catalog.map((item) => `${item.module_id}@${item.module_version}`), [
    'archive-capture-integrity@1.0.0',
    'submission-lineage-integrity@1.0.0',
  ]);
});
