import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGitHubLoginUrl,
  claimGitHubLoginAttempt,
  createGitHubLoginAttempt,
  GITHUB_OAUTH_STATE_COOKIE,
  GITHUB_OAUTH_VERIFIER_COOKIE,
  serializeGitHubOauthCookie,
  verifyGitHubLoginIdentity,
} from '../../dist/github-login.js';

const runtime = {
  appSlug: 'rekt-inkubator',
  clientId: 'Iv23.test',
  clientSecret: 'secret-secret',
  webhookSecret: '0'.repeat(16),
};

test('GitHub login URL uses exact callback, state and S256 PKCE without leaking the client secret', () => {
  const attempt = createGitHubLoginAttempt();
  assert.equal(attempt.state.length >= 43, true);
  assert.equal(attempt.verifier.length >= 43, true);
  assert.equal(attempt.challenge.length, 43);

  const url = new URL(buildGitHubLoginUrl(runtime, 'https://ink.example', attempt));
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.pathname, '/login/oauth/authorize');
  assert.equal(url.searchParams.get('client_id'), runtime.clientId);
  assert.equal(url.searchParams.get('redirect_uri'), 'https://ink.example/v1/auth/github/callback');
  assert.equal(url.searchParams.get('state'), attempt.state);
  assert.equal(url.searchParams.get('code_challenge'), attempt.challenge);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.toString().includes(runtime.clientSecret), false);
});

test('OAuth callback claim requires matching HttpOnly state and verifier cookies', () => {
  const attempt = createGitHubLoginAttempt();
  const cookieHeader = [
    serializeGitHubOauthCookie(GITHUB_OAUTH_STATE_COOKIE, attempt.state).split(';')[0],
    serializeGitHubOauthCookie(GITHUB_OAUTH_VERIFIER_COOKIE, attempt.verifier).split(';')[0],
  ].join('; ');

  assert.equal(claimGitHubLoginAttempt(cookieHeader, attempt.state).verifier, attempt.verifier);
  assert.throws(() => claimGitHubLoginAttempt(cookieHeader, 'attacker-state'), /github_oauth_state_invalid/);
});

test('GitHub access token remains server-side and immutable numeric user id is identity authority', async () => {
  const calls = [];
  const fakeFetch = async (url, init = {}) => {
    calls.push({url: String(url), init});
    if (String(url).includes('/login/oauth/access_token')) {
      const body = JSON.parse(init.body);
      assert.equal(body.client_secret, runtime.clientSecret);
      assert.equal(body.redirect_uri, 'https://ink.example/v1/auth/github/callback');
      assert.equal(body.code_verifier, 'v'.repeat(43));
      return new Response(JSON.stringify({access_token: ['g', 'h', 'u', '_', 'ephemeral'].join('')}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      });
    }

    assert.equal(init.headers.authorization, `Bearer ${['g', 'h', 'u', '_', 'ephemeral'].join('')}`);
    return new Response(JSON.stringify({id: 123456, login: 'renamable-handle'}), {
      status: 200,
      headers: {'content-type': 'application/json'},
    });
  };

  const identity = await verifyGitHubLoginIdentity(
    runtime,
    'https://ink.example',
    'code',
    'v'.repeat(43),
    fakeFetch,
  );

  assert.deepEqual(identity, {githubUserId: '123456', login: 'renamable-handle'});
  assert.equal(calls.length, 2);
});
