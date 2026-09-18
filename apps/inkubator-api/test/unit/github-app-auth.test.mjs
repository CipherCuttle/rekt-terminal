import {generateKeyPairSync, verify} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGitHubAppJwt} from '../../dist/github-app-auth.js';

function decodeJson(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

test('GitHub App JWT is short-lived, app-bound and RS256 signed', () => {
  const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
  const privatePem = privateKey.export({type: 'pkcs8', format: 'pem'}).toString();
  const nowMs = Date.parse('2026-09-12T00:00:00Z');
  const jwt = createGitHubAppJwt({appId: '4910184', privateKey: privatePem}, nowMs);
  const [headerSegment, payloadSegment, signatureSegment] = jwt.split('.');
  assert.ok(headerSegment && payloadSegment && signatureSegment);
  assert.deepEqual(decodeJson(headerSegment), {alg: 'RS256', typ: 'JWT'});
  const payload = decodeJson(payloadSegment);
  assert.equal(payload.iss, '4910184');
  assert.equal(payload.iat, Math.floor(nowMs / 1000) - 60);
  assert.equal(payload.exp, Math.floor(nowMs / 1000) + (9 * 60));
  assert.equal(payload.exp - payload.iat, 600);
  assert.equal(
    verify(
      'RSA-SHA256',
      Buffer.from(`${headerSegment}.${payloadSegment}`),
      publicKey,
      Buffer.from(signatureSegment, 'base64url'),
    ),
    true,
  );
});
