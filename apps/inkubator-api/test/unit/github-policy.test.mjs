import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGitHubInstallationPolicy} from '../../dist/github.js';

test('GitHub App installation policy is minimum-read and push-only', () => {
  assert.doesNotThrow(() => validateGitHubInstallationPolicy({contents: 'read', metadata: 'read'}, ['push']));
  assert.throws(() => validateGitHubInstallationPolicy({contents: 'write', metadata: 'read'}, ['push']), /github_contents_read_permission_required|github_write_permission_forbidden/);
  assert.throws(() => validateGitHubInstallationPolicy({contents: 'read', issues: 'read', metadata: 'read'}, ['push']), /github_read_permission_excessive:issues/);
  assert.throws(() => validateGitHubInstallationPolicy({contents: 'read', metadata: 'read'}, []), /github_push_event_required/);
  assert.throws(() => validateGitHubInstallationPolicy({contents: 'read', metadata: 'read'}, ['push', 'pull_request']), /github_event_subscription_excessive:pull_request/);
});
