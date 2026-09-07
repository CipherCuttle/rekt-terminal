from pathlib import Path
import json

ROOT = Path('.')

def read(path): return (ROOT / path).read_text()
def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
def replace_once(path, old, new):
    text = read(path)
    if text.count(old) != 1:
        raise SystemExit(f'{path}: expected exactly one marker, got {text.count(old)}: {old[:80]!r}')
    write(path, text.replace(old, new, 1))

# Root scripts: make the hostile verifier part of canonical build/typecheck/test.
pkg = json.loads(read('package.json'))
for key, cmd in {
    'build:core': 'npm run build -w @rekt-ink/inkubator-verifier',
    'typecheck': 'npm run typecheck -w @rekt-ink/inkubator-verifier',
    'test': 'npm run test -w @rekt-ink/inkubator-verifier',
}.items():
    if cmd not in pkg['scripts'][key]:
        pkg['scripts'][key] += ' && ' + cmd
write('package.json', json.dumps(pkg, indent=2) + '\n')

write('apps/inkubator-verifier/package.json', '''{
  "name": "@rekt-ink/inkubator-verifier",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "start": "node dist/server.js",
    "test": "node --test test/*.test.mjs",
    "pretest": "npm run build"
  },
  "devDependencies": {
    "@types/node": "22.0.0",
    "typescript": "5.8.3"
  },
  "engines": {
    "node": "24.20.x",
    "npm": "11.19.x"
  }
}
''')
write('apps/inkubator-verifier/tsconfig.json', '''{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"],
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
''')
write('apps/inkubator-verifier/src/policy.ts', r'''import {lookup} from 'node:dns/promises';
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
  ['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['100::', 64], ['2001:db8::', 32],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) block.addSubnet(network, prefix, 'ipv6');

function publicAddress(address: ResolvedAddress): boolean {
  const actual = isIP(address.address);
  if (actual !== address.family) return false;
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

export async function resolveSafeTarget(raw: string | URL, resolver: Resolver = systemResolver): Promise<SafeTarget> {
  const url = typeof raw === 'string' ? normalizePublicHttpsUrl(raw) : normalizePublicHttpsUrl(raw.href);
  let addresses: ResolvedAddress[];
  try { addresses = await resolver(url.hostname); } catch { throw new Error('DNS_FAILURE'); }
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
  try { current = await resolveSafeTarget(rawUrl, resolver); }
  catch (error) {
    const code = error instanceof Error ? error.message : 'URL_INVALID';
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
      try { current = await resolveSafeTarget(next, resolver); }
      catch (error) {
        const code = error instanceof Error ? error.message : 'URL_INVALID';
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
''')
write('apps/inkubator-verifier/src/server.ts', r'''import http from 'node:http';
import {assertSafeVerifierEnvironment, verifyPublicUrl} from './policy.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOST = '127.0.0.1';
const portRaw = process.env.INKUBATOR_VERIFIER_PORT?.trim() ?? '4180';
const port = Number(portRaw);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('INKUBATOR_VERIFIER_PORT invalid');
assertSafeVerifierEnvironment(process.env);

const server = http.createServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  if (request.method === 'GET' && request.url === '/health') {
    response.statusCode = 200;
    response.end(JSON.stringify({status: 'ok', service: 'inkubator-verifier', trust_zone: 'NO_PLATFORM_SECRETS'}));
    return;
  }
  if (request.method !== 'POST' || request.url !== '/v1/verify-url') {
    response.statusCode = 404; response.end(JSON.stringify({error: 'not_found'})); return;
  }
  let size = 0;
  const chunks: Buffer[] = [];
  request.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > 16 * 1024) request.destroy();
    else chunks.push(chunk);
  });
  request.on('end', async () => {
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { response.statusCode = 400; response.end(JSON.stringify({error: 'request_invalid'})); return; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) { response.statusCode = 400; response.end(JSON.stringify({error: 'request_invalid'})); return; }
    const value = body as Record<string, unknown>;
    if (value.schema_version !== 'ship-verifier.request.v1' || typeof value.submission_id !== 'string' || !UUID.test(value.submission_id) || typeof value.url !== 'string') {
      response.statusCode = 400; response.end(JSON.stringify({error: 'request_invalid'})); return;
    }
    const observation = await verifyPublicUrl(value.submission_id, value.url);
    response.statusCode = 200;
    response.end(JSON.stringify(observation));
  });
});
server.listen(port, HOST, () => console.log(`inkubator verifier listening on http://${HOST}:${port}`));
''')
write('apps/inkubator-verifier/test/policy.test.mjs', r'''import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSafeVerifierEnvironment, normalizePublicHttpsUrl, resolveSafeTarget, verifyPublicUrl} from '../dist/policy.js';

const pub = async () => [{address: '8.8.8.8', family: 4}, {address: '2606:4700:4700::1111', family: 6}];

test('URL policy rejects schemes, credentials, ports, literals and local names', () => {
  for (const value of ['http://example.com', 'file:///etc/passwd', 'https://u:p@example.com', 'https://example.com:444/', 'https://127.0.0.1/', 'https://localhost/', 'https://foo.local/']) {
    assert.throws(() => normalizePublicHttpsUrl(value), /URL_INVALID/);
  }
  assert.equal(normalizePublicHttpsUrl('https://Example.COM/a#frag').href, 'https://example.com/a');
});

test('DNS policy rejects any private or mixed answer set', async () => {
  await assert.rejects(resolveSafeTarget('https://ship.example', async () => [{address: '127.0.0.1', family: 4}]), /TARGET_NOT_PUBLIC/);
  await assert.rejects(resolveSafeTarget('https://ship.example', async () => [{address: '8.8.8.8', family: 4}, {address: '10.0.0.1', family: 4}]), /TARGET_NOT_PUBLIC/);
  assert.equal((await resolveSafeTarget('https://ship.example', pub)).addresses.length, 2);
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
''')

# Database types.
replace_once('apps/inkubator-api/src/database.ts', 'export interface GitHubSetupStateTable {', '''export type ShipSubmissionState = 'SUBMITTED' | 'OBSERVED' | 'ATTENTION';
export interface ShipSubmissionTable {
  submission_id: string;
  mission_id: string;
  project_id: string;
  owner_player_id: string;
  creation_request_id: string;
  artifact_title: string;
  artifact_url: string;
  demo_url: string | null;
  source_url: string | null;
  state: ShipSubmissionState;
  submitted_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type ShipVerifierOutcome = 'PASS' | 'FAILED' | 'UNAVAILABLE';
export interface ShipVerifierObservationTable {
  observation_id: string;
  submission_id: string;
  outcome: ShipVerifierOutcome;
  reason_code: string;
  final_url: string | null;
  http_status: number | null;
  duration_ms: number;
  redirects: number;
  observed_at: Generated<Date>;
}

export interface GitHubSetupStateTable {''')
replace_once('apps/inkubator-api/src/database.ts', '  github_setup_states: GitHubSetupStateTable;', '''  ship_submissions: ShipSubmissionTable;
  ship_verifier_observations: ShipVerifierObservationTable;
  github_setup_states: GitHubSetupStateTable;''')

write('apps/inkubator-api/src/migrations/013-phase6-ship-verifier-control.ts', r'''import {sql, type Kysely} from 'kysely';
import type {DatabaseSchema} from '../database.js';

export const phase6ShipVerifierControlMigration = {
  async up(db: Kysely<DatabaseSchema>) {
    await db.schema.createTable('ship_submissions')
      .addColumn('submission_id', 'uuid', (c) => c.primaryKey())
      .addColumn('mission_id', 'uuid', (c) => c.notNull().references('missions.mission_id').onDelete('cascade'))
      .addColumn('project_id', 'uuid', (c) => c.notNull().references('projects.project_id').onDelete('cascade'))
      .addColumn('owner_player_id', 'uuid', (c) => c.notNull().references('players.player_id').onDelete('cascade'))
      .addColumn('creation_request_id', 'uuid', (c) => c.notNull().unique())
      .addColumn('artifact_title', 'text', (c) => c.notNull())
      .addColumn('artifact_url', 'text', (c) => c.notNull())
      .addColumn('demo_url', 'text')
      .addColumn('source_url', 'text')
      .addColumn('state', 'text', (c) => c.notNull().defaultTo('SUBMITTED'))
      .addColumn('submitted_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('ship_submissions_state', sql`state in ('SUBMITTED','OBSERVED','ATTENTION')`)
      .addCheckConstraint('ship_submissions_title', sql`char_length(artifact_title) between 1 and 120`)
      .execute();
    await sql`create unique index ship_submissions_active_mission_idx on ship_submissions (mission_id) where state in ('SUBMITTED','OBSERVED','ATTENTION')`.execute(db);

    await db.schema.createTable('ship_verifier_observations')
      .addColumn('observation_id', 'uuid', (c) => c.primaryKey())
      .addColumn('submission_id', 'uuid', (c) => c.notNull().unique().references('ship_submissions.submission_id').onDelete('cascade'))
      .addColumn('outcome', 'text', (c) => c.notNull())
      .addColumn('reason_code', 'text', (c) => c.notNull())
      .addColumn('final_url', 'text')
      .addColumn('http_status', 'integer')
      .addColumn('duration_ms', 'integer', (c) => c.notNull())
      .addColumn('redirects', 'integer', (c) => c.notNull())
      .addColumn('observed_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`clock_timestamp()`))
      .addCheckConstraint('ship_verifier_observations_outcome', sql`outcome in ('PASS','FAILED','UNAVAILABLE')`)
      .addCheckConstraint('ship_verifier_observations_duration', sql`duration_ms >= 0 and duration_ms <= 60000`)
      .addCheckConstraint('ship_verifier_observations_redirects', sql`redirects between 0 and 3`)
      .execute();
  },
  async down(db: Kysely<DatabaseSchema>) {
    await db.schema.dropTable('ship_verifier_observations').execute();
    await db.schema.dropTable('ship_submissions').execute();
  },
};
''')
replace_once('apps/inkubator-api/src/migrations.ts', "import {phase5TesterModerationMigration} from './migrations/012-phase5-tester-moderation.js';", "import {phase5TesterModerationMigration} from './migrations/012-phase5-tester-moderation.js';\nimport {phase6ShipVerifierControlMigration} from './migrations/013-phase6-ship-verifier-control.js';")
replace_once('apps/inkubator-api/src/migrations.ts', "      '012_phase5_tester_moderation': phase5TesterModerationMigration,", "      '012_phase5_tester_moderation': phase5TesterModerationMigration,\n      '013_phase6_ship_verifier_control': phase6ShipVerifierControlMigration,")

write('apps/inkubator-api/src/ship.ts', r'''import {randomUUID} from 'node:crypto';
import {sql, type Kysely, type Selectable} from 'kysely';
import type {DatabaseSchema, ShipSubmissionTable, ShipVerifierObservationTable} from './database.js';
import {appendHistoryEvent} from './events.js';
import {enqueueOutboxJob, SHIP_VERIFICATION_JOB_TYPE} from './jobs.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(value: string, name: string) { if (typeof value !== 'string' || !UUID.test(value)) throw new Error(`invalid_${name}`); return value.toLowerCase(); }
function title(value: string) { if (typeof value !== 'string') throw new Error('invalid_artifact_title'); const v=value.trim().replace(/\s+/g,' '); if(v.length<1||v.length>120)throw new Error('invalid_artifact_title'); return v; }
function publicHttps(value: string | undefined, name: string): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 2048) throw new Error(`invalid_${name}`);
  let url: URL; try { url = new URL(value); } catch { throw new Error(`invalid_${name}`); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`invalid_${name}`);
  url.hash=''; return url.href;
}
function submissionView(row: Selectable<ShipSubmissionTable>) {
  return {schema_version:'ship.submission.private.v1' as const, submission_id:row.submission_id, mission_id:row.mission_id, project_id:row.project_id,
    artifact:{title:row.artifact_title,url:row.artifact_url,...(row.demo_url?{demo_url:row.demo_url}:{}),...(row.source_url?{source_url:row.source_url}:{})}, state:row.state, submitted_at:row.submitted_at.toISOString()};
}
function observationView(row: Selectable<ShipVerifierObservationTable>) {
  return {schema_version:'ship.verifier_observation.public.v1' as const, outcome:row.outcome, reason_code:row.reason_code,
    ...(row.final_url?{final_url:row.final_url}:{}), ...(row.http_status!==null?{http_status:row.http_status}:{}), duration_ms:row.duration_ms, redirects:row.redirects, observed_at:row.observed_at.toISOString()};
}
function sameSubmission(row: Selectable<ShipSubmissionTable>, missionId:string, actorId:string, artifactTitle:string, artifactUrl:string, demoUrl:string|null, sourceUrl:string|null) {
  return row.mission_id===missionId && row.owner_player_id===actorId && row.artifact_title===artifactTitle && row.artifact_url===artifactUrl && row.demo_url===demoUrl && row.source_url===sourceUrl;
}

export async function submitShip(db: Kysely<DatabaseSchema>, actorIdInput:string, missionIdInput:string, input:{requestId:string;title:string;url:string;demoUrl?:string;sourceUrl?:string}) {
  const actorId=uuid(actorIdInput,'player_id'), missionId=uuid(missionIdInput,'mission_id'), requestId=uuid(input.requestId,'request_id');
  const artifactTitle=title(input.title), artifactUrl=publicHttps(input.url,'artifact_url')!, demoUrl=publicHttps(input.demoUrl,'demo_url'), sourceUrl=publicHttps(input.sourceUrl,'source_url');
  return db.transaction().execute(async tx=>{
    const replay=await tx.selectFrom('ship_submissions').selectAll().where('creation_request_id','=',requestId).executeTakeFirst();
    if(replay){if(!sameSubmission(replay,missionId,actorId,artifactTitle,artifactUrl,demoUrl,sourceUrl))throw new Error('ship_submission_idempotency_conflict');return submissionView(replay);}
    const mission=await tx.selectFrom('missions').select(['mission_id','project_id','owner_player_id','state']).where('mission_id','=',missionId).forUpdate().executeTakeFirst();
    if(!mission)throw new Error('mission_not_found');
    const lockedReplay=await tx.selectFrom('ship_submissions').selectAll().where('creation_request_id','=',requestId).executeTakeFirst();
    if(lockedReplay){if(!sameSubmission(lockedReplay,missionId,actorId,artifactTitle,artifactUrl,demoUrl,sourceUrl))throw new Error('ship_submission_idempotency_conflict');return submissionView(lockedReplay);}
    if(mission.owner_player_id!==actorId)throw new Error('authorization_denied');
    if(mission.state!=='SHIP_READY')throw new Error('mission_not_ship_ready');
    const active=await tx.selectFrom('ship_submissions').select('submission_id').where('mission_id','=',missionId).where('state','in',['SUBMITTED','OBSERVED','ATTENTION']).executeTakeFirst();
    if(active)throw new Error('ship_submission_active');
    const row=await tx.insertInto('ship_submissions').values({submission_id:randomUUID(),mission_id:missionId,project_id:mission.project_id,owner_player_id:actorId,creation_request_id:requestId,
      artifact_title:artifactTitle,artifact_url:artifactUrl,demo_url:demoUrl,source_url:sourceUrl,state:'SUBMITTED'}).returningAll().executeTakeFirstOrThrow();
    await tx.updateTable('missions').set({state:'SUBMITTED',updated_at:sql`clock_timestamp()`}).where('mission_id','=',missionId).execute();
    await appendHistoryEvent(tx,{eventFamily:'activity',eventType:'project.ship.submitted',dedupeKey:`activity:project.ship.submitted:${row.submission_id}`,actorPlayerId:actorId,subjectType:'project',subjectId:mission.project_id,
      payload:{schema_version:'project.ship.submitted.v1',submission_id:row.submission_id,mission_id:missionId,project_id:mission.project_id,artifact_title:artifactTitle,artifact_url:artifactUrl,truth_state:'CLAIMED'}});
    await enqueueOutboxJob(tx,{jobType:SHIP_VERIFICATION_JOB_TYPE,idempotencyKey:`ship.verify:${row.submission_id}`,payload:{schema_version:'ship.verification.job.v1',submission_id:row.submission_id,artifact_url:artifactUrl},maxAttempts:5});
    return submissionView(row);
  });
}

export async function getProjectShipState(db:Kysely<DatabaseSchema>,projectIdInput:string){
  const projectId=uuid(projectIdInput,'project_id');
  const project=await db.selectFrom('projects').select('project_id').where('project_id','=',projectId).executeTakeFirst(); if(!project)throw new Error('project_not_found');
  const submission=await db.selectFrom('ship_submissions').selectAll().where('project_id','=',projectId).orderBy('submitted_at','desc').executeTakeFirst();
  if(!submission)return{schema_version:'project.ship.public.v1' as const,project_id:projectId};
  const observation=await db.selectFrom('ship_verifier_observations').selectAll().where('submission_id','=',submission.submission_id).executeTakeFirst();
  return{schema_version:'project.ship.public.v1' as const,project_id:projectId,latest_submission:{schema_version:'ship.submission.public.v1' as const,submission_id:submission.submission_id,mission_id:submission.mission_id,
    artifact:{title:submission.artifact_title,url:submission.artifact_url,...(submission.demo_url?{demo_url:submission.demo_url}:{}),...(submission.source_url?{source_url:submission.source_url}:{})},state:submission.state,submitted_at:submission.submitted_at.toISOString(),...(observation?{verifier_observation:observationView(observation)}:{})}};
}
''')

write('apps/inkubator-api/src/ship-verifier-client.ts', r'''export interface ShipVerifierClientRequest {submissionId:string; url:string}
export interface ShipVerifierClient {verify(input:ShipVerifierClientRequest):Promise<unknown>}
export function createShipVerifierClient(endpointRaw:string):ShipVerifierClient{
  const endpoint=new URL(endpointRaw);
  if(endpoint.protocol!=='http:'||endpoint.hostname!=='127.0.0.1'||!endpoint.port||endpoint.username||endpoint.password)throw new Error('INKUBATOR_VERIFIER_URL must be loopback http://127.0.0.1:<port>');
  endpoint.pathname='/v1/verify-url';endpoint.search='';endpoint.hash='';
  return{async verify(input){
    const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schema_version:'ship-verifier.request.v1',submission_id:input.submissionId,url:input.url}),signal:AbortSignal.timeout(10_000)});
    if(!response.ok)throw new Error(`ship_verifier_service_status:${response.status}`);
    return await response.json();
  }};
}
''')

# Jobs: narrow verifier client injection + observation persistence.
replace_once('apps/inkubator-api/src/jobs.ts', "export const PROJECT_GITHUB_OBSERVATION_JOB_TYPE = 'project.github_observation';", "export const PROJECT_GITHUB_OBSERVATION_JOB_TYPE = 'project.github_observation';\nexport const SHIP_VERIFICATION_JOB_TYPE = 'ship.verification';")
replace_once('apps/inkubator-api/src/jobs.ts', '''export interface RunOneJobOptions {
  leaseMs?: number;
  retryBaseMs?: number;
}''', '''export interface ShipVerifierClient {
  verify(input: {submissionId: string; url: string}): Promise<unknown>;
}

export interface RunOneJobOptions {
  leaseMs?: number;
  retryBaseMs?: number;
  shipVerifierClient?: ShipVerifierClient;
}''')
marker='async function handleJob(db: Kysely<DatabaseSchema>, job: OutboxJobRow, databaseNow: Date): Promise<void> {'
insert=r'''type ShipVerificationPayload = {submissionId:string; artifactUrl:string};
function shipVerificationPayload(payload:unknown):ShipVerificationPayload{
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('ship_verification_payload_invalid');
  const value=payload as Record<string,unknown>;
  if(value.schema_version!=='ship.verification.job.v1'||typeof value.submission_id!=='string'||!UUID_PATTERN.test(value.submission_id)||typeof value.artifact_url!=='string')throw new Error('ship_verification_payload_invalid');
  let url:URL;try{url=new URL(value.artifact_url);}catch{throw new Error('ship_verification_payload_invalid');}
  if(url.protocol!=='https:'||url.username||url.password)throw new Error('ship_verification_payload_invalid');
  return{submissionId:value.submission_id.toLowerCase(),artifactUrl:url.href};
}
const SHIP_REASON_CODES=new Set(['PUBLIC_HTTPS_OK','URL_INVALID','TARGET_NOT_PUBLIC','DNS_FAILURE','NETWORK_ERROR','TIMEOUT','RESPONSE_TOO_LARGE','HTTP_STATUS','REDIRECT_LIMIT','REDIRECT_INVALID']);
function verifierResult(raw:unknown,submissionId:string){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('ship_verifier_result_invalid');const v=raw as Record<string,unknown>;
  if(v.schema_version!=='ship-verifier.observation.v1'||v.submission_id!==submissionId||!['PASS','FAILED','UNAVAILABLE'].includes(String(v.outcome))||!SHIP_REASON_CODES.has(String(v.reason_code)))throw new Error('ship_verifier_result_invalid');
  if(!Number.isInteger(v.duration_ms)||Number(v.duration_ms)<0||Number(v.duration_ms)>60000||!Number.isInteger(v.redirects)||Number(v.redirects)<0||Number(v.redirects)>3)throw new Error('ship_verifier_result_invalid');
  const finalUrl=typeof v.final_url==='string'?v.final_url:null;if(finalUrl){let u:URL;try{u=new URL(finalUrl);}catch{throw new Error('ship_verifier_result_invalid');}if(u.protocol!=='https:'||u.username||u.password)throw new Error('ship_verifier_result_invalid');}
  const httpStatus=v.http_status===undefined?null:Number(v.http_status);if(httpStatus!==null&&(!Number.isInteger(httpStatus)||httpStatus<100||httpStatus>599))throw new Error('ship_verifier_result_invalid');
  return{outcome:v.outcome as 'PASS'|'FAILED'|'UNAVAILABLE',reasonCode:String(v.reason_code),finalUrl,httpStatus,durationMs:Number(v.duration_ms),redirects:Number(v.redirects)};
}
async function handleShipVerification(db:Kysely<DatabaseSchema>,job:OutboxJobRow,client:ShipVerifierClient|undefined):Promise<void>{
  const input=shipVerificationPayload(job.payload);
  const existing=await db.selectFrom('ship_verifier_observations').select('observation_id').where('submission_id','=',input.submissionId).executeTakeFirst();if(existing)return;
  if(!client)throw new Error('ship_verifier_unavailable');
  const result=verifierResult(await client.verify({submissionId:input.submissionId,url:input.artifactUrl}),input.submissionId);
  await db.transaction().execute(async tx=>{
    const submission=await tx.selectFrom('ship_submissions').selectAll().where('submission_id','=',input.submissionId).forUpdate().executeTakeFirst();
    if(!submission||submission.artifact_url!==input.artifactUrl)throw new Error('ship_verification_submission_invalid');
    const replay=await tx.selectFrom('ship_verifier_observations').select('observation_id').where('submission_id','=',input.submissionId).executeTakeFirst();if(replay)return;
    const now=await readDatabaseNow(tx);
    await tx.insertInto('ship_verifier_observations').values({observation_id:randomUUID(),submission_id:input.submissionId,outcome:result.outcome,reason_code:result.reasonCode,final_url:result.finalUrl,http_status:result.httpStatus,duration_ms:result.durationMs,redirects:result.redirects,observed_at:now}).execute();
    await tx.updateTable('ship_submissions').set({state:result.outcome==='PASS'?'OBSERVED':'ATTENTION',updated_at:now}).where('submission_id','=',input.submissionId).execute();
    await appendHistoryEvent(tx,{eventFamily:'evidence',eventType:'project.ship_verifier.observed',dedupeKey:`evidence:project.ship_verifier.observed:${input.submissionId}`,actorPlayerId:null,subjectType:'project',subjectId:submission.project_id,occurredAt:now,
      payload:{schema_version:'project.ship_verifier.observed.v1',submission_id:input.submissionId,outcome:result.outcome,reason_code:result.reasonCode,...(result.finalUrl?{final_url:result.finalUrl}:{}),...(result.httpStatus!==null?{http_status:result.httpStatus}:{}),duration_ms:result.durationMs,redirects:result.redirects,truth_state:result.outcome==='UNAVAILABLE'?'UNKNOWN':'OBSERVED'}});
  });
}

'''
replace_once('apps/inkubator-api/src/jobs.ts', marker, insert + 'async function handleJob(db: Kysely<DatabaseSchema>, job: OutboxJobRow, databaseNow: Date, options: RunOneJobOptions): Promise<void> {')
replace_once('apps/inkubator-api/src/jobs.ts', '''    case PROJECT_GITHUB_OBSERVATION_JOB_TYPE:
      await handleProjectGitHubObservation(db, job);
      return;
    default:''', '''    case PROJECT_GITHUB_OBSERVATION_JOB_TYPE:
      await handleProjectGitHubObservation(db, job);
      return;
    case SHIP_VERIFICATION_JOB_TYPE:
      await handleShipVerification(db, job, options.shipVerifierClient);
      return;
    default:''')
replace_once('apps/inkubator-api/src/jobs.ts', '    await handleJob(db, job, await readDatabaseNow(db));', '    await handleJob(db, job, await readDatabaseNow(db), options);')

replace_once('apps/inkubator-api/src/worker.ts', "import {runOneJob} from './jobs.js';", "import {runOneJob} from './jobs.js';\nimport {createShipVerifierClient} from './ship-verifier-client.js';")
replace_once('apps/inkubator-api/src/worker.ts', 'let stopping = false;', "const shipVerifierUrl = process.env.INKUBATOR_VERIFIER_URL?.trim();\nconst shipVerifierClient = shipVerifierUrl ? createShipVerifierClient(shipVerifierUrl) : undefined;\nlet stopping = false;")
replace_once('apps/inkubator-api/src/worker.ts', 'const result = await runOneJob(db, {leaseMs, retryBaseMs});', 'const result = await runOneJob(db, {leaseMs, retryBaseMs, ...(shipVerifierClient ? {shipVerifierClient} : {})});')

# Contract schemas and routes.
contract_schemas=r'''  ShipSubmissionCreateRequest: {
    type:'object',additionalProperties:false,required:['request_id','title','url'],properties:{request_id:{$ref:'#/components/schemas/RequestId'},title:{type:'string',minLength:1,maxLength:120},url:{type:'string',format:'uri',pattern:'^https://'},demo_url:{type:'string',format:'uri',pattern:'^https://'},source_url:{type:'string',format:'uri',pattern:'^https://'}},
  },
  ShipArtifactView:{type:'object',additionalProperties:false,required:['title','url'],properties:{title:{type:'string'},url:{type:'string',format:'uri'},demo_url:{type:'string',format:'uri'},source_url:{type:'string',format:'uri'}}},
  ShipVerifierObservationView:{type:'object',additionalProperties:false,required:['schema_version','outcome','reason_code','duration_ms','redirects','observed_at'],properties:{schema_version:{type:'string',const:'ship.verifier_observation.public.v1'},outcome:{type:'string',enum:['PASS','FAILED','UNAVAILABLE']},reason_code:{type:'string'},final_url:{type:'string',format:'uri'},http_status:{type:'integer',minimum:100,maximum:599},duration_ms:{type:'integer',minimum:0},redirects:{type:'integer',minimum:0,maximum:3},observed_at:{type:'string',format:'date-time'}}},
  ShipSubmissionView:{type:'object',additionalProperties:false,required:['schema_version','submission_id','mission_id','project_id','artifact','state','submitted_at'],properties:{schema_version:{type:'string',enum:['ship.submission.private.v1','ship.submission.public.v1']},submission_id:{type:'string',format:'uuid'},mission_id:{$ref:'#/components/schemas/MissionId'},project_id:{$ref:'#/components/schemas/ProjectId'},artifact:{$ref:'#/components/schemas/ShipArtifactView'},state:{type:'string',enum:['SUBMITTED','OBSERVED','ATTENTION']},submitted_at:{type:'string',format:'date-time'},verifier_observation:{$ref:'#/components/schemas/ShipVerifierObservationView'}}},
  ProjectShipStateView:{type:'object',additionalProperties:false,required:['schema_version','project_id'],properties:{schema_version:{type:'string',const:'project.ship.public.v1'},project_id:{$ref:'#/components/schemas/ProjectId'},latest_submission:{$ref:'#/components/schemas/ShipSubmissionView'}}},
'''
replace_once('apps/inkubator-api/src/contract.ts', '  RoundView: {', contract_schemas + '  RoundView: {')
contract_paths=r'''    '/v1/missions/{missionId}/ship-submissions': {post:{operationId:'submitShip',security:[{sessionCookie:[]}],parameters:[{name:'missionId',in:'path',required:true,schema:ref('MissionId')}],requestBody:{required:true,content:{'application/json':{schema:ref('ShipSubmissionCreateRequest')}}},responses:{'201':{description:'Claimed Ship submission queued for isolated verification',content:{'application/json':{schema:ref('ShipSubmissionView')}}},'400':errorResponse('Invalid Ship submission'),'401':errorResponse('Authentication required'),'403':errorResponse('Mission owner required'),'404':errorResponse('Mission not found'),'409':errorResponse('Ship submission conflict')}}},
    '/v1/projects/{projectId}/ship': {get:{operationId:'getProjectShipState',parameters:[{name:'projectId',in:'path',required:true,schema:ref('ProjectId')}],responses:{'200':{description:'Public Ship submission and bounded verifier observation state',content:{'application/json':{schema:ref('ProjectShipStateView')}}},'404':errorResponse('Project not found')}}},
'''
replace_once('apps/inkubator-api/src/contract.ts', "    '/v1/rounds': {", contract_paths + "    '/v1/rounds': {")

# Generated client operation list.
replace_once('apps/inkubator-api/src/generate-client.ts', "  ['/v1/rounds', 'get'],", "  ['/v1/missions/{missionId}/ship-submissions', 'post'],\n  ['/v1/projects/{projectId}/ship', 'get'],\n  ['/v1/rounds', 'get'],")

# App routes.
replace_once('apps/inkubator-api/src/app.ts', "import {toPrivatePlayer, toPublicPlayer} from './projection.js';", "import {toPrivatePlayer, toPublicPlayer} from './projection.js';\nimport {getProjectShipState, submitShip} from './ship.js';")
replace_once('apps/inkubator-api/src/app.ts', 'function phase3Error(reply: FastifyReply, cause: unknown) {', '''function phase6Error(reply: FastifyReply, cause: unknown) {
  const message = cause instanceof Error ? cause.message : 'phase6_mutation_failed';
  if (message === 'authorization_denied') return error(reply, 403, message);
  if (message === 'mission_not_found' || message === 'project_not_found') return error(reply, 404, message);
  if (message.includes('idempotency_conflict') || message === 'mission_not_ship_ready' || message === 'ship_submission_active') return error(reply, 409, message);
  if (message.startsWith('invalid_')) return error(reply, 400, message);
  throw cause;
}

function phase3Error(reply: FastifyReply, cause: unknown) {''')
routes=r'''  app.post('/v1/missions/:missionId/ship-submissions', {schema:{body:fastifyBodySchema('ShipSubmissionCreateRequest')}}, async (request, reply) => {
    const authenticated=await authenticate(request,options.db);if(!authenticated)return error(reply,401,'authentication_required');
    const {missionId}=request.params as {missionId:string};const body=request.body as {request_id:string;title:string;url:string;demo_url?:string;source_url?:string};
    try {const result=await submitShip(options.db,authenticated.actor.playerId,missionId,{requestId:body.request_id,title:body.title,url:body.url,...(body.demo_url?{demoUrl:body.demo_url}:{}),...(body.source_url?{sourceUrl:body.source_url}:{})});return reply.code(201).send(result);} catch(cause){return phase6Error(reply,cause);}
  });

  app.get('/v1/projects/:projectId/ship', async (request, reply) => {
    const {projectId}=request.params as {projectId:string};
    try{return await getProjectShipState(options.db,projectId);}catch(cause){return phase6Error(reply,cause);}
  });

'''
replace_once('apps/inkubator-api/src/app.ts', "  app.delete('/v1/session', async (request, reply) => {", routes + "  app.delete('/v1/session', async (request, reply) => {")

write('apps/inkubator-api/test/integration/phase6-ship-verifier-control.test.mjs', r'''import {randomUUID} from 'node:crypto';import test from 'node:test';import assert from 'node:assert/strict';import {buildApp} from '../../dist/app.js';import {createDatabase} from '../../dist/database.js';import {migrateToLatest} from '../../dist/migrations.js';import {runOneJob,SHIP_VERIFICATION_JOB_TYPE} from '../../dist/jobs.js';
const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error('DATABASE_URL required');const appOrigin=process.env.INKUBATOR_APP_ORIGIN??'http://127.0.0.1:4175';
function cookie(r){const v=Array.isArray(r.headers['set-cookie'])?r.headers['set-cookie'][0]:r.headers['set-cookie'];assert.ok(v);return v.split(';')[0];}
async function session(app,name){const r=await app.inject({method:'POST',url:'/v1/dev/session',headers:{origin:appOrigin},payload:{display_name:name}});assert.equal(r.statusCode,201);return{cookie:cookie(r),playerId:r.json().player.player_id};}
async function mission(app,cookieValue){const rounds=await app.inject({method:'GET',url:'/v1/rounds',headers:{cookie:cookieValue}});const round=rounds.json().find(r=>r.code==='ROUND_01');await app.inject({method:'POST',url:`/v1/rounds/${round.round_id}/join`,headers:{origin:appOrigin,cookie:cookieValue}});const create=await app.inject({method:'POST',url:'/v1/missions',headers:{origin:appOrigin,cookie:cookieValue},payload:{request_id:randomUUID(),round_id:round.round_id,project_name:'Ship Control',goal:'Ship safely',ship_condition:'Public URL observed and reviewed',current_focus:'Prepare',next_move:'Submit'}});assert.equal(create.statusCode,201);const id=create.json().mission.mission_id,projectId=create.json().project.project_id;for(const state of ['BUILDING','SHIP_READY']){const r=await app.inject({method:'PATCH',url:`/v1/missions/${id}`,headers:{origin:appOrigin,cookie:cookieValue},payload:{request_id:randomUUID(),state}});assert.equal(r.statusCode,200);}return{id,projectId};}

test('Phase 6A submission is owner-only/idempotent and verifier evidence never mints PROVEN',async()=>{const db=createDatabase(databaseUrl);await migrateToLatest(db);const app=buildApp({db,appOrigin,allowDevAuth:true,sessionTtlSeconds:3600,github:null});try{const alice=await session(app,`Alice S ${randomUUID().slice(0,5)}`),bob=await session(app,`Bob S ${randomUUID().slice(0,5)}`);const m=await mission(app,alice.cookie);const ah={origin:appOrigin,cookie:alice.cookie},bh={origin:appOrigin,cookie:bob.cookie};
const denied=await app.inject({method:'POST',url:`/v1/missions/${m.id}/ship-submissions`,headers:bh,payload:{request_id:randomUUID(),title:'Nope',url:'https://example.com/'}});assert.equal(denied.statusCode,403);
const req=randomUUID();const submit=await app.inject({method:'POST',url:`/v1/missions/${m.id}/ship-submissions`,headers:ah,payload:{request_id:req,title:'Working artifact',url:'https://example.com/demo'}});assert.equal(submit.statusCode,201);const submissionId=submit.json().submission_id;
const replay=await app.inject({method:'POST',url:`/v1/missions/${m.id}/ship-submissions`,headers:ah,payload:{request_id:req,title:'Working artifact',url:'https://example.com/demo'}});assert.equal(replay.statusCode,201);assert.equal(replay.json().submission_id,submissionId);
const conflict=await app.inject({method:'POST',url:`/v1/missions/${m.id}/ship-submissions`,headers:ah,payload:{request_id:req,title:'Working artifact',url:'https://example.org/demo'}});assert.equal(conflict.statusCode,409);
const job=await db.selectFrom('outbox_jobs').selectAll().where('job_type','=',SHIP_VERIFICATION_JOB_TYPE).where('payload','->>','submission_id','=',submissionId).executeTakeFirst();assert.ok(job);assert.equal(job.state,'pending');
const noClient=await runOneJob(db,{retryBaseMs:100});assert.equal(noClient.status,'retry');assert.equal((await db.selectFrom('ship_verifier_observations').selectAll().where('submission_id','=',submissionId).execute()).length,0);
await db.updateTable('outbox_jobs').set({next_attempt_at:new Date(0)}).where('job_id','=',job.job_id).execute();
const fake={verify:async({submissionId:id,url})=>({schema_version:'ship-verifier.observation.v1',submission_id:id,outcome:'PASS',reason_code:'PUBLIC_HTTPS_OK',final_url:url,http_status:200,duration_ms:42,redirects:0})};
const done=await runOneJob(db,{shipVerifierClient:fake});assert.equal(done.status,'succeeded');const obs=await db.selectFrom('ship_verifier_observations').selectAll().where('submission_id','=',submissionId).executeTakeFirstOrThrow();assert.equal(obs.outcome,'PASS');
const missionRow=await db.selectFrom('missions').select('state').where('mission_id','=',m.id).executeTakeFirstOrThrow();assert.equal(missionRow.state,'SUBMITTED');const gates=await db.selectFrom('mission_gates').selectAll().where('mission_id','=',m.id).execute();assert.equal(gates.every(g=>g.signal_state==='UNKNOWN'),true);
const evidence=await db.selectFrom('history_events').selectAll().where('event_type','=','project.ship_verifier.observed').where('subject_id','=',m.projectId).execute();assert.equal(evidence.length,1);assert.equal(evidence[0].payload.truth_state,'OBSERVED');assert.equal(JSON.stringify(evidence).includes('PROVEN'),false);assert.equal(JSON.stringify(evidence).includes('SHIPPED'),false);
const publicState=await app.inject({method:'GET',url:`/v1/projects/${m.projectId}/ship`});assert.equal(publicState.statusCode,200);assert.equal(publicState.json().latest_submission.state,'OBSERVED');assert.equal(publicState.json().latest_submission.verifier_observation.outcome,'PASS');
}finally{await app.close();await db.destroy();}});
''')

print('Phase 6A patch staged')
