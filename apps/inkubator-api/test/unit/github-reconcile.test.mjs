import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverGitHubAppInstallations} from '../../dist/github-reconcile.js';

const runtime = {
  appSlug: 'rekt-inkubator',
  clientId: 'Iv-test',
  clientSecret: 'client-secret-test',
  webhookSecret: 'webhook-secret-test-123456',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
}

test('GitHub reconciliation discovers only this App and its currently authorized repositories', async () => {
  const calls = [];
  const fetchImpl = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/user/installations?')) {
      return json({installations: [
        {
          id: 111,
          app_slug: 'other-app',
          account: {id: 1001, type: 'User'},
          repository_selection: 'all',
          permissions: {contents: 'read', metadata: 'read'},
          events: ['push'],
        },
        {
          id: 222,
          app_slug: 'rekt-inkubator',
          account: {id: 1002, type: 'User'},
          repository_selection: 'all',
          permissions: {contents: 'read', metadata: 'read'},
          events: ['push'],
        },
      ]});
    }
    if (url.includes('/user/installations/222/repositories?')) {
      return json({repositories: [
        {id: 9001, full_name: 'CipherCuttle/rekt-terminal', private: false},
        {id: 9002, full_name: 'CipherCuttle/private-build', private: true},
      ]});
    }
    throw new Error(`unexpected_fetch:${url}`);
  };

  const installations = await discoverGitHubAppInstallations(runtime, 'ghu_test', '97258089', fetchImpl);
  assert.equal(installations.length, 1);
  assert.deepEqual(installations[0], {
    githubUserId: '97258089',
    installationId: '222',
    accountId: '1002',
    accountType: 'User',
    repositorySelection: 'all',
    repositories: [
      {repositoryId: '9001', fullName: 'CipherCuttle/rekt-terminal', private: false},
      {repositoryId: '9002', fullName: 'CipherCuttle/private-build', private: true},
    ],
  });
  assert.equal(calls.some((url) => url.includes('/user/installations/111/repositories')), false);
});

test('GitHub reconciliation fails closed on excessive App permissions', async () => {
  const fetchImpl = async (input) => {
    const url = String(input);
    if (url.includes('/user/installations?')) {
      return json({installations: [{
        id: 333,
        app_slug: 'rekt-inkubator',
        account: {id: 1003, type: 'User'},
        repository_selection: 'selected',
        permissions: {contents: 'write', metadata: 'read'},
        events: ['push'],
      }]});
    }
    throw new Error(`unexpected_fetch:${url}`);
  };

  await assert.rejects(
    () => discoverGitHubAppInstallations(runtime, 'ghu_test', '97258089', fetchImpl),
    /github_contents_read_permission_required/,
  );
});
