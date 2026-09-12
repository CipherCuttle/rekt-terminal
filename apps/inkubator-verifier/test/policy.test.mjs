import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSafeVerifierEnvironment, normalizePublicHttpsUrl, resolveSafeTarget, verifyPublicUrl} from '../dist/policy.js';

const pub = async () => [{address: '8.8.8.8', family: 4}, {address: '2606:4700:4700::1111', family: 6}];

test('URL policy rejects schemes, credentials, ports, literals and local names', () => {
  for (const value of ['http://example.com', 'file:///etc/passwd', 'https://u:p@example.com', 'https://example.com:444/', 'https://127.0.0.1/', 'https://localhost/', 'https://foo.local/']) {
    assert.throws(() => normalizePublicHttpsUrl(value), /URL_INVALID/);
  }
  assert.equal(normalizePublicHttpsUrl('https://Example.COM/a#frag').href, 'https://example.com/a');
});

test('DNS policy rejects RFC1918, local IPv6, IPv4-mapped IPv6 and mixed answer sets', async () => {
  for (const address of [
    {address: '127.0.0.1', family: 4},
    {address: '10.0.0.1', family: 4},
    {address: '172.16.0.1', family: 4},
    {address: '192.168.0.1', family: 4},
    {address: '::1', family: 6},
    {address: 'fc00::1', family: 6},
    {address: 'fe80::1', family: 6},
    {address: '::ffff:127.0.0.1', family: 6},
    {address: '::ffff:8.8.8.8', family: 6},
  ]) {
    await assert.rejects(resolveSafeTarget('https://ship.example', async () => [address]), /TARGET_NOT_PUBLIC/);
  }
  await assert.rejects(resolveSafeTarget('https://ship.example', async () => [{address: '8.8.8.8', family: 4}, {address: '10.0.0.1', family: 4}]), /TARGET_NOT_PUBLIC/);
  assert.equal((await resolveSafeTarget('https://ship.example', pub)).addresses.length, 2);
});

test('DNS policy fails closed on empty, oversized and malformed answer sets', async () => {
  await assert.rejects(resolveSafeTarget('https://ship.example', async () => []), /DNS_FAILURE/);
  await assert.rejects(resolveSafeTarget('https://ship.example', async () => Array.from({length: 17}, (_, index) => ({address: `8.8.8.${index + 1}`, family: 4}))), /DNS_FAILURE/);
  await assert.rejects(resolveSafeTarget('https://ship.example', async () => [{address: '8.8.8.8', family: 6}]), /TARGET_NOT_PUBLIC/);
});

test('DNS resolution obeys an explicit deadline', async () => {
  const started = Date.now();
  await assert.rejects(
    resolveSafeTarget('https://ship.example', async () => new Promise(() => {}), 25),
    /TIMEOUT/,
  );
  assert.ok(Date.now() - started < 1000);
});

test('redirect target is re-resolved and cannot cross to private address', async () => {
  let requests = 0;
  const result = await verifyPublicUrl('00000000-0000-4000-8000-000000000001', 'https://ship.example', {
    resolver: async (host) => host === 'internal.example' ? [{address: '10.0.0.2', family: 4}] : [{address: '8.8.8.8', family: 4}],
    request: async () => { requests += 1; return {kind: 'response', status: 302, bytes: 0, location: 'https://internal.example/admin'}; },
  });
  assert.equal(result.outcome, 'FAILED');
  assert.equal(result.reason_code, 'TARGET_NOT_PUBLIC');
  assert.equal(requests, 1);
});

test('same-host redirect is re-resolved and blocks DNS rebinding', async () => {
  let resolutions = 0;
  let requests = 0;
  const result = await verifyPublicUrl('00000000-0000-4000-8000-000000000005', 'https://ship.example/start', {
    resolver: async () => {
      resolutions += 1;
      return resolutions === 1 ? [{address: '8.8.8.8', family: 4}] : [{address: '10.0.0.2', family: 4}];
    },
    request: async () => { requests += 1; return {kind: 'response', status: 302, bytes: 0, location: '/next'}; },
  });
  assert.equal(result.outcome, 'FAILED');
  assert.equal(result.reason_code, 'TARGET_NOT_PUBLIC');
  assert.equal(resolutions, 2);
  assert.equal(requests, 1);
});

test('redirect policy rejects unsafe protocol, credentials, port and IP literal', async () => {
  const hostileLocations = [
    'http://public.example/',
    'https://u:p@public.example/',
    'https://public.example:444/',
    'https://127.0.0.1/',
  ];
  for (let index = 0; index < hostileLocations.length; index += 1) {
    const result = await verifyPublicUrl(`00000000-0000-4000-8000-00000000001${index}`, 'https://ship.example', {
      resolver: pub,
      request: async () => ({kind: 'response', status: 302, bytes: 0, location: hostileLocations[index]}),
    });
    assert.equal(result.outcome, 'FAILED');
    assert.equal(result.reason_code, 'REDIRECT_INVALID');
  }
});

test('redirect loop is bounded and fails closed', async () => {
  let requests = 0;
  const result = await verifyPublicUrl('00000000-0000-4000-8000-000000000020', 'https://ship.example/loop', {
    resolver: pub,
    request: async () => {
      requests += 1;
      return {kind: 'response', status: 302, bytes: 0, location: '/loop'};
    },
  });
  assert.equal(result.outcome, 'FAILED');
  assert.equal(result.reason_code, 'REDIRECT_LIMIT');
  assert.equal(result.redirects, 3);
  assert.equal(requests, 4);
});

test('successful bounded public response remains verifier observation only', async () => {
  const result = await verifyPublicUrl('00000000-0000-4000-8000-000000000002', 'https://ship.example/demo', {
    resolver: pub,
    request: async () => ({kind: 'response', status: 200, bytes: 1024}),
  });
  assert.equal(result.outcome, 'PASS');
  assert.equal(result.reason_code, 'PUBLIC_HTTPS_OK');
  assert.equal(result.http_status, 200);
  assert.equal('truth_state' in result, false);
  assert.equal(JSON.stringify(result).includes('PROVEN'), false);
});

test('oversize and timeout fail closed', async () => {
  const large = await verifyPublicUrl('00000000-0000-4000-8000-000000000003', 'https://ship.example', {resolver: pub, request: async () => ({kind: 'response', status: 200, bytes: 999999})});
  assert.equal(large.reason_code, 'RESPONSE_TOO_LARGE');
  const timeout = await verifyPublicUrl('00000000-0000-4000-8000-000000000004', 'https://ship.example', {resolver: pub, request: async () => ({kind: 'timeout'})});
  assert.equal(timeout.outcome, 'UNAVAILABLE');
  assert.equal(timeout.reason_code, 'TIMEOUT');
});

test('verifier refuses platform credential environment', () => {
  assert.throws(() => assertSafeVerifierEnvironment({DATABASE_URL: 'postgres://secret'}), /verifier_forbidden_environment/);
  assert.doesNotThrow(() => assertSafeVerifierEnvironment({INKUBATOR_VERIFIER_PORT: '4180'}));
});
