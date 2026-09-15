import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import test from 'node:test';
import {loadGitHubR2ArchiveOptions} from '../../dist/challenge-archive-github-r2.js';

function privatePem() {
  return generateKeyPairSync('rsa', {modulusLength: 2048}).privateKey.export({type: 'pkcs8', format: 'pem'}).toString();
}

test('F3B archive provider configuration is optional but partial configuration fails closed', () => {
  assert.equal(loadGitHubR2ArchiveOptions({}), null);
  assert.throws(
    () => loadGitHubR2ArchiveOptions({INKUBATOR_ARCHIVE_R2_ACCOUNT_ID: 'a'.repeat(32)}),
    /R2 archive configuration must be all-or-none/,
  );
});

test('F3B archive provider configuration is bounded and keeps GitHub App authority explicit', () => {
  const options = loadGitHubR2ArchiveOptions({
    GITHUB_APP_ID: '4910184',
    GITHUB_APP_PRIVATE_KEY: privatePem(),
    INKUBATOR_ARCHIVE_R2_ACCOUNT_ID: 'a'.repeat(32),
    INKUBATOR_ARCHIVE_R2_BUCKET: 'rekt-inkubator-private-evidence',
    INKUBATOR_ARCHIVE_R2_API_TOKEN: 'token_'.padEnd(40, 'x'),
    INKUBATOR_ARCHIVE_MAX_BYTES: String(8 * 1024 * 1024),
  });
  assert.ok(options);
  assert.equal(options.maxArchiveBytes, 8 * 1024 * 1024);
  assert.equal(options.r2Bucket, 'rekt-inkubator-private-evidence');

  assert.throws(
    () => loadGitHubR2ArchiveOptions({
      GITHUB_APP_ID: '4910184',
      GITHUB_APP_PRIVATE_KEY: privatePem(),
      INKUBATOR_ARCHIVE_R2_ACCOUNT_ID: 'a'.repeat(32),
      INKUBATOR_ARCHIVE_R2_BUCKET: 'rekt-inkubator-private-evidence',
      INKUBATOR_ARCHIVE_R2_API_TOKEN: 'token_'.padEnd(40, 'x'),
      INKUBATOR_ARCHIVE_MAX_BYTES: '100',
    }),
    /INKUBATOR_ARCHIVE_MAX_BYTES must be between/,
  );
});
