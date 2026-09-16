import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {createGitHubR2ChallengeArchiveDeletionClient} from '../../dist/challenge-archive-r2-retention.js';

const options = {
  githubAppId: '123', githubPrivateKey: 'unused', r2AccountId: 'a'.repeat(32), r2Bucket: 'private-archives', r2ApiToken: 'x'.repeat(32), maxArchiveBytes: 1024 * 1024,
};

test('H2 R2 deletion is exact-reference scoped and idempotent on missing objects', async () => {
  const submissionId = randomUUID();
  const key = `challenge-submissions/${submissionId}/source.tar.gz`;
  const reference = `r2://${options.r2Bucket}/${key}`;
  const calls = [];
  const client = createGitHubR2ChallengeArchiveDeletionClient(options, async (url, init) => {
    calls.push({url: String(url), init});
    return new Response('', {status: 404});
  });
  await client.delete({submissionId, archiveReference: reference});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'DELETE');
  assert.equal(calls[0].init.headers.authorization, `Bearer ${options.r2ApiToken}`);
  assert.match(calls[0].url, new RegExp(`/objects/challenge-submissions/${submissionId}/source\\.tar\\.gz$`));
});

test('H2 R2 deletion rejects arbitrary object references before network egress', async () => {
  const submissionId = randomUUID();
  let calls = 0;
  const client = createGitHubR2ChallengeArchiveDeletionClient(options, async () => { calls += 1; return new Response('', {status: 204}); });
  await assert.rejects(() => client.delete({submissionId, archiveReference: 'r2://other-bucket/steal-me'}), /challenge_archive_delete_reference_invalid/);
  assert.equal(calls, 0);
});

test('H2 R2 deletion fails closed on object-store errors', async () => {
  const submissionId = randomUUID();
  const reference = `r2://${options.r2Bucket}/challenge-submissions/${submissionId}/source.tar.gz`;
  const client = createGitHubR2ChallengeArchiveDeletionClient(options, async () => new Response('nope', {status: 503}));
  await assert.rejects(() => client.delete({submissionId, archiveReference: reference}), /challenge_archive_delete_failed/);
});
