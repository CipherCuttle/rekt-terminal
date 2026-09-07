import {createHmac} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGitHubInstallUrl,
  toPrivateGitHubRepositoryProjection,
  toPublicGitHubRepositoryProjection,
  validateDeliveryId,
  verifyGitHubWebhookSignature,
} from '../../dist/github.js';

const secret = 'f1d-test-webhook-secret-123456';

function signature(body) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

test('GitHub webhook HMAC is exact-byte and fail-closed', () => {
  const raw = Buffer.from(JSON.stringify({message: 'rå rekt 🐙', ref: 'refs/heads/main'}), 'utf8');
  const signed = signature(raw);
  assert.equal(verifyGitHubWebhookSignature(secret, raw, signed), true);
  assert.equal(verifyGitHubWebhookSignature(secret, Buffer.concat([raw, Buffer.from(' ')]), signed), false);
  assert.equal(verifyGitHubWebhookSignature(secret, raw, undefined), false);
  assert.equal(verifyGitHubWebhookSignature(secret, raw, 'sha256=wat'), false);
});

test('GitHub delivery IDs and installation URL state are bounded', () => {
  const delivery = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(validateDeliveryId(delivery), delivery);
  assert.throws(() => validateDeliveryId('not-a-guid'), /github_delivery_id_invalid/);
  const url = new URL(buildGitHubInstallUrl('rekt-inkubator-test', 'opaque-state'));
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.pathname, '/apps/rekt-inkubator-test/installations/new');
  assert.equal(url.searchParams.get('state'), 'opaque-state');
});

test('public GitHub repository projection cannot leak provider identity or private metadata', () => {
  const row = {
    repository_id: '12345',
    installation_id: '67890',
    full_name: 'secret-org/top-secret-repo',
    private: true,
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const publicView = toPublicGitHubRepositoryProjection(row);
  const privateView = toPrivateGitHubRepositoryProjection(row);
  assert.deepEqual(publicView, {
    schema_version: 'github.repository.public.v1',
    connected: true,
    observation_capability: 'OBSERVED',
  });
  const serializedPublic = JSON.stringify(publicView);
  assert.equal(serializedPublic.includes('12345'), false);
  assert.equal(serializedPublic.includes('secret-org'), false);
  assert.equal(privateView.repository_id, '12345');
  assert.equal(privateView.full_name, 'secret-org/top-secret-repo');
});
