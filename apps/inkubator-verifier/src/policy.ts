import {lookup} from 'node:dns/promises';
import https from 'node:https';
import {BlockList, isIP} from 'node:net';
import {performance} from 'node:perf_hooks';

export type AddressFamily = 4 | 6;
export interface ResolvedAddress {address: string; family: AddressFamily}
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;
export type VerifierOutcome = 'PASS' | 'FAILED' | 'UNAVAILABLE';
export type VerifierReasonCode =
  | 'PUBLIC_HTTPS_OK'
  | 'URL_INVALID'
  | 'TARGET_NOT_PUBLIC'
  | 'DNS_FAILURE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'RESPONSE_TOO_LARGE'
  | 'HTTP_STATUS'
  | 'REDIRECT_LIMIT'
  | 'REDIRECT_INVALID';

export interface VerifierObservation {
  schema_version: 'ship-verifier.observation.v1';
  submission_id: string;
  outcome: VerifierOutcome;
  reason_code: VerifierReasonCode;
  final_url?: string;
  http_status?: number;
  duration_ms: number;
  redirects: number;
}

interface SafeTarget {url: URL; addresses: ResolvedAddress[]}
export type HopResult =
  | {kind: 'response'; status: number; bytes: number; location?: string}
  | {kind: 'timeout'}
  | {kind: 'network_error'};
export type HopRequester = (target: SafeTarget, timeoutMs: number, maxBytes: number) => Promise<HopResult>;

export const VERIFIER_POLICY_VERSION = 'ship-verifier-policy.v1';
export const MAX_REDIRECTS = 3;
export const MAX_RESPONSE_BYTES = 256 * 1024;
export const PER_HOP_TIMEOUT_MS = 3_000;
export const TOTAL_TIMEOUT_MS = 8_000;

const block = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) block.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['::', 128], ['::1', 128], ['100::', 64], ['2001:db8::', 32],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) block.addSubnet(network, prefix, 'ipv6');

function publicAddress(address: ResolvedAddress): boolean {
  const actual = isIP(address.address);
  if (actual !== address.family) return false;
  if (address.family === 6 && address.address.toLowerCase().startsWith('::ffff:')) return false;
  return !block.check(address.address, address.family === 4 ? 'ipv4' : 'ipv6');
}

export function normalizePublicHttpsUrl(raw: string): URL {
  if (typeof raw !== 'string' || raw.length < 1 || raw.length > 2048) throw new Error('URL_INVALID');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('URL_INVALID'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('URL_INVALID');
  if (isIP(url.hostname) !== 0) throw new Error('URL_INVALID');
  const host = url.hostname.toLowerCase();
  if (host.length > 253 || !host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('URL_INVALID');
  }
  const labels = host.split('.');
  if (labels.some((label) => label.length < 1 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) throw new Error('URL_INVALID');
  url.hash = '';
  return url;
}

export const systemResolver: Resolver = async (hostname) => {
  const result = await lookup(hostname, {all: true, order: 'verbatim'});
  return result.map((entry) => ({address: entry.address, family: entry.family as AddressFamily}));
};

async function resolveWithTimeout(hostname: string, resolver: Resolver, timeoutMs: number | undefined): Promise<ResolvedAddress[]> {
  if (timeoutMs === undefined) return resolver(hostname);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('TIMEOUT');
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      resolver(hostname),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('TIMEOUT')), Math.max(1, Math.ceil(timeoutMs)));
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function resolveSafeTarget(raw: string | URL, resolver: Resolver = systemResolver, timeoutMs?: number): Promise<SafeTarget> {
  const url = typeof raw === 'string' ? normalizePublicHttpsUrl(raw) : normalizePublicHttpsUrl(raw.href);
  let addresses: ResolvedAddress[];
  try {
    addresses = await resolveWithTimeout(url.hostname, resolver, timeoutMs);
  } catch (error) {
    if (error instanceof Error && error.message === 'TIMEOUT') throw error;
    throw new Error('DNS_FAILURE');
  }
  if (!Array.isArray(addresses) || addresses.length < 1 || addresses.length > 16) throw new Error('DNS_FAILURE');
  if (addresses.some((address) => !publicAddress(address))) throw new Error('TARGET_NOT_PUBLIC');
  const unique = [...new Map(addresses.map((entry) => [`${entry.family}:${entry.address}`, entry])).values()]
    .sort((a, b) => a.family - b.family || a.address.localeCompare(b.address));
  if (unique.length < 1) throw new Error('DNS_FAILURE');
  return {url, addresses: unique};
}

export const pinnedHttpsRequest: HopRequester = (target, timeoutMs, maxBytes) => new Promise((resolve) => {
  const pinned = target.addresses[0];
  if (!pinned) return resolve({kind: 'network_error'});
  let settled = false;
  const finish = (result: HopResult) => { if (!settled) { settled = true; resolve(result); } };
  const req = https.request({
    protocol: 'https:',
    hostname: pinned.address,
    family: pinned.family,
    port: 443,
    servername: target.url.hostname,
    method: 'GET',
    path: `${target.url.pathname}${target.url.search}`,
    headers: {
      host: target.url.host,
      accept: 'text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.2',
      'user-agent': 'REKT-Inkubator-Verifier/0.1',
      connection: 'close',
    },
    rejectUnauthorized: true,
  }, (response) => {
    let bytes = 0;
    const contentLength = Number(response.headers['content-length'] ?? 0);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      response.destroy();
      return finish({kind: 'response', status: response.statusCode ?? 0, bytes: contentLength});
    }
    response.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) response.destroy();
    });
    response.on('end', () => finish({
      kind: 'response', status: response.statusCode ?? 0, bytes,
      ...(typeof response.headers.location === 'string' ? {location: response.headers.location} : {}),
    }));
    response.on('error', () => finish(bytes > maxBytes
      ? {kind: 'response', status: response.statusCode ?? 0, bytes}
      : {kind: 'network_error'}));
  });
  req.setTimeout(timeoutMs, () => { req.destroy(); finish({kind: 'timeout'}); });
  req.on('error', () => finish({kind: 'network_error'}));
  req.end();
});

function failure(submissionId: string, start: number, redirects: number, outcome: VerifierOutcome, reason: VerifierReasonCode, extra: Partial<VerifierObservation> = {}): VerifierObservation {
  return {
    schema_version: 'ship-verifier.observation.v1', submission_id: submissionId, outcome, reason_code: reason,
    duration_ms: Math.max(0, Math.round(performance.now() - start)), redirects, ...extra,
  };
}

export async function verifyPublicUrl(
  submissionId: string,
  rawUrl: string,
  deps: {resolver?: Resolver; request?: HopRequester} = {},
): Promise<VerifierObservation> {
  const start = performance.now();
  const resolver = deps.resolver ?? systemResolver;
  const request = deps.request ?? pinnedHttpsRequest;
  let current: SafeTarget;
  try {
    current = await resolveSafeTarget(rawUrl, resolver, TOTAL_TIMEOUT_MS);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'URL_INVALID';
    if (code === 'TIMEOUT') return failure(submissionId, start, 0, 'UNAVAILABLE', 'TIMEOUT');
    if (code === 'DNS_FAILURE') return failure(submissionId, start, 0, 'UNAVAILABLE', 'DNS_FAILURE');
    if (code === 'TARGET_NOT_PUBLIC') return failure(submissionId, start, 0, 'FAILED', 'TARGET_NOT_PUBLIC');
    return failure(submissionId, start, 0, 'FAILED', 'URL_INVALID');
  }

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const elapsed = performance.now() - start;
    if (elapsed >= TOTAL_TIMEOUT_MS) return failure(submissionId, start, redirects, 'UNAVAILABLE', 'TIMEOUT');
    const hop = await request(current, Math.min(PER_HOP_TIMEOUT_MS, TOTAL_TIMEOUT_MS - elapsed), MAX_RESPONSE_BYTES);
    if (hop.kind === 'timeout') return failure(submissionId, start, redirects, 'UNAVAILABLE', 'TIMEOUT');
    if (hop.kind === 'network_error') return failure(submissionId, start, redirects, 'UNAVAILABLE', 'NETWORK_ERROR');
    if (hop.bytes > MAX_RESPONSE_BYTES) return failure(submissionId, start, redirects, 'FAILED', 'RESPONSE_TOO_LARGE', {final_url: current.url.href, http_status: hop.status});
    if ([301, 302, 303, 307, 308].includes(hop.status)) {
      if (!hop.location) return failure(submissionId, start, redirects, 'FAILED', 'REDIRECT_INVALID', {final_url: current.url.href, http_status: hop.status});
      if (redirects >= MAX_REDIRECTS) return failure(submissionId, start, redirects, 'FAILED', 'REDIRECT_LIMIT', {final_url: current.url.href, http_status: hop.status});
      let next: URL;
      try { next = new URL(hop.location, current.url); } catch { return failure(submissionId, start, redirects, 'FAILED', 'REDIRECT_INVALID'); }
      const remainingForDns = TOTAL_TIMEOUT_MS - (performance.now() - start);
      if (remainingForDns <= 0) return failure(submissionId, start, redirects + 1, 'UNAVAILABLE', 'TIMEOUT');
      try {
        current = await resolveSafeTarget(next, resolver, remainingForDns);
      } catch (error) {
        const code = error instanceof Error ? error.message : 'URL_INVALID';
        if (code === 'TIMEOUT') return failure(submissionId, start, redirects + 1, 'UNAVAILABLE', 'TIMEOUT');
        if (code === 'DNS_FAILURE') return failure(submissionId, start, redirects + 1, 'UNAVAILABLE', 'DNS_FAILURE');
        if (code === 'TARGET_NOT_PUBLIC') return failure(submissionId, start, redirects + 1, 'FAILED', 'TARGET_NOT_PUBLIC');
        return failure(submissionId, start, redirects + 1, 'FAILED', 'REDIRECT_INVALID');
      }
      continue;
    }
    if (hop.status >= 200 && hop.status < 300) {
      return failure(submissionId, start, redirects, 'PASS', 'PUBLIC_HTTPS_OK', {final_url: current.url.href, http_status: hop.status});
    }
    return failure(submissionId, start, redirects, 'FAILED', 'HTTP_STATUS', {final_url: current.url.href, http_status: hop.status});
  }
  return failure(submissionId, start, MAX_REDIRECTS, 'FAILED', 'REDIRECT_LIMIT');
}

export function assertSafeVerifierEnvironment(env: NodeJS.ProcessEnv): void {
  const forbidden = ['DATABASE_URL', 'GITHUB_TOKEN', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_CLIENT_SECRET', 'INKUBATOR_SESSION_SECRET', 'REACT_BITS_PRO_KEY'];
  const present = forbidden.filter((name) => typeof env[name] === 'string' && env[name]!.length > 0);
  if (present.length) throw new Error(`verifier_forbidden_environment:${present.join(',')}`);
}
