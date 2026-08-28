import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fail = (msg) => { console.error(`VERIFY_SOURCE=FAIL ${msg}`); process.exitCode = 1; };

function walk(relDir, extensions) {
  const abs = path.join(root, relDir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(relDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      out.push(...walk(rel, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      out.push(rel);
    }
  }
  return out;
}

/**
 * Strip comments so provenance-literal checks only look at executable code.
 * These invariants are documented in prose right next to the code they govern,
 * and that prose necessarily names the labels it is forbidding.
 */
function code(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join('\n');
}

/* -------------------------------------------------------------------------- */
/* market-data honesty (Phase 0)                                              */
/* -------------------------------------------------------------------------- */

const server = read('apps/api/src/server.ts');
const live = read('apps/api/src/live.ts');
const clientApi = read('apps/web/src/lib/api.ts');
const chart = read('apps/web/src/lib/chart.ts');

if (server.includes("fixture-fallback")) {
  fail('LIVE radar may fall back to fixtures');
}
if (!live.includes("wss://ws-gel.inkonchain.com")) fail('official Ink WSS default missing');
if (/update\([^)]*Date\.now/.test(chart) || chart.includes('time=Math.floor(Date.now')) {
  fail('chart update contains implicit wall-clock default');
}
if (!clientApi.includes("environment === 'DEMO'")) fail('client DEMO fallback boundary missing');
if (!clientApi.includes('LIVE is fail-closed')) fail('client LIVE fail-closed invariant comment missing');
if (!server.includes("new Date(serverTime).toISOString()")) fail('DEMO stream provenance is not tied to deterministic serverTime');
if (!server.includes("environment === 'DEMO' ? FIXTURE_STREAM_EPOCH : Date.now()")) fail('DEMO HELLO time is not deterministic');

/* -------------------------------------------------------------------------- */
/* MARKET_TRUTH_V1                                                            */
/* -------------------------------------------------------------------------- */

/**
 * CANONICAL_PROVENANCE_V1.
 *
 * Exactly five states, one vocabulary, no synonyms. `ESTIMATED` was removed:
 * it labelled real aggregate provider data as weaker than it was, and seeded
 * fixtures as stronger than they were.
 */
const CANONICAL_PROVENANCE = ['CONFIRMED', 'DERIVED', 'SYNTHETIC', 'STALE', 'UNAVAILABLE'];
const PROVENANCE_SOURCE_ROOTS = ['apps/api/src', 'apps/web/src', 'packages/sim/src', 'packages/career/src', 'scripts'];

for (const root of PROVENANCE_SOURCE_ROOTS) {
  for (const file of walk(root, ['.ts', '.tsx', '.mjs'])) {
    // The literal may legitimately appear in a test asserting it is refused,
    // so only quoted-literal use in product code is a failure.
    if (/['"`]ESTIMATED['"`]/.test(code(read(file))) && !file.includes('test')) {
      fail(`${file} still uses the removed ESTIMATED provenance state`);
    }
  }
}

for (const state of CANONICAL_PROVENANCE) {
  if (!read('packages/sim/src/types.ts').includes(`'${state}'`)) {
    fail(`packages/sim/src/types.ts does not declare canonical provenance state ${state}`);
  }
}

/**
 * FIXTURE_SYNTHETIC_ONLY.
 *
 * A fixture module fabricates market facts. It may therefore never emit
 * CONFIRMED — that label is reserved for direct evidence with real identity.
 * These are the modules that feed the product's DEMO environment.
 */
const MARKET_FIXTURE_MODULES = [
  'apps/api/src/fixtures.ts',
  'apps/web/src/lib/local-fixtures.ts',
];

for (const file of MARKET_FIXTURE_MODULES) {
  const source = code(read(file));
  if (/['"`]CONFIRMED['"`]/.test(source)) {
    fail(`${file} emits CONFIRMED provenance; fixture modules must be SYNTHETIC only`);
  }
  if (!/['"`]SYNTHETIC['"`]/.test(source)) {
    fail(`${file} does not label its fabricated data SYNTHETIC`);
  }
  // A fixture that emits DERIVED is claiming a deterministic calculation over
  // observed inputs, which a fabricated row is not.
  if (/state:\s*'DERIVED'/.test(source)) {
    fail(`${file} emits DERIVED provenance; fabricated rows are SYNTHETIC`);
  }
}

// The DEMO stream in the server is a fixture source too.
if (!/makeDemoEvent[\s\S]*?state:\s*'SYNTHETIC'/.test(server)) {
  fail('apps/api/src/server.ts DEMO stream events are not labelled SYNTHETIC');
}

/**
 * LIVE_DEFAULT_FAIL_CLOSED.
 *
 * LIVE must be the default posture and a LIVE failure must never resolve to
 * DEMO data.
 */
const appShell = read('apps/web/src/App.tsx');
if (!/DEFAULT_ENVIRONMENT:\s*MarketEnvironment\s*=\s*'LIVE'/.test(appShell)) {
  fail('apps/web/src/App.tsx does not default to the LIVE environment');
}
if (!/environmentFromQuery/.test(server) || !server.includes("=== 'DEMO' ? 'DEMO' : 'LIVE'")) {
  fail('apps/api/src/server.ts does not default the data environment to LIVE');
}

/**
 * LIVE_CHART_CURRENCY_V1.
 *
 * No module may rescale a historical series by a single current FX ratio. The
 * chart is drawn in the currency its numbers are actually in, or not drawn.
 */
const CHART_CONVERSION_PATTERNS = [
  /function\s+toEthBars/,
  /usdPerEth\s*\)/,
  /1\s*\/\s*usdPerEth/,
];
for (const file of walk('apps/web/src', ['.ts', '.tsx'])) {
  if (file.includes('test')) continue;
  const source = code(read(file));
  for (const pattern of CHART_CONVERSION_PATTERNS) {
    if (pattern.test(source)) fail(`${file} rescales a price series by a current FX ratio (${pattern}); historical bars must keep their own denomination`);
  }
}
if (!read('apps/web/src/lib/chart-currency.ts').includes('CURRENCY_MISMATCH')) {
  fail('the chart currency guard does not fail closed on a denomination mismatch');
}

/**
 * PROTECT_CAPITAL_TRUTH_REPAIR.
 *
 * The deterministic synthetic rehearsal must not be reachable from the web app,
 * and must be SYNTHETIC where it does survive for tests/dev.
 */
for (const file of walk('apps/web/src', ['.ts', '.tsx'])) {
  const source = code(read(file));
  if (/executeSyntheticProtectCapitalRehearsal|executeProtectCapitalChallenge/.test(source)) {
    fail(`${file} references the synthetic PROTECT_CAPITAL rehearsal; it must not be wired into product flow`);
  }
  if (/kind:\s*'PROTECT_CAPITAL'/.test(source) && !file.includes('test')) {
    fail(`${file} still submits a PROTECT_CAPITAL practice intent`);
  }
}
const spot = read('packages/sim/src/spot.ts');
if (!/executeSyntheticProtectCapitalRehearsal[\s\S]*?provenance:\s*'SYNTHETIC'/.test(spot)) {
  fail('the PROTECT_CAPITAL rehearsal does not label its fabricated observation SYNTHETIC');
}
if (!/executeSyntheticProtectCapitalRehearsal[\s\S]*?DEMO_ALLOW_SYNTHETIC/.test(spot)) {
  fail('the PROTECT_CAPITAL rehearsal is not gated behind an explicit DEMO session');
}

/**
 * SHARED_MARKET_POLLING_V1.
 *
 * Provider polling belongs to the shared hub. A websocket handler must not
 * start its own interval against a provider.
 */
if (/setInterval\([\s\S]{0,400}?dexPair\(/.test(server)) {
  fail('apps/api/src/server.ts polls a provider per websocket connection; use the shared MarketHub');
}
if (!server.includes('marketHub.subscribe(')) {
  fail('apps/api/src/server.ts does not attach websockets to the shared market hub');
}

/* -------------------------------------------------------------------------- */
/* domain packages stay framework-independent                                 */
/* -------------------------------------------------------------------------- */

for (const pkg of ['packages/sim', 'packages/career']) {
  const manifest = JSON.parse(read(`${pkg}/package.json`));
  for (const field of ['dependencies', 'peerDependencies', 'devDependencies']) {
    const names = Object.keys(manifest[field] ?? {});
    if (names.length > 0) fail(`${pkg} declares ${field}: ${names.join(', ')} — domain packages must stay dependency-free`);
  }

  for (const file of walk(`${pkg}/src`, ['.ts'])) {
    const source = read(file);
    if (/from\s+['"]react(-dom)?['"]|require\(['"]react/.test(source)) fail(`${file} imports React; domain packages must be framework-independent`);
    if (/\bdocument\.|\bwindow\.|localStorage|indexedDB/.test(source)) fail(`${file} touches a browser global; domain packages must be environment-independent`);
  }
}

/* -------------------------------------------------------------------------- */
/* simulator / UI separation                                                  */
/* -------------------------------------------------------------------------- */

// Every economic mutation must go through the practice session store. React
// components may read simulator state but must never advance it.
const MUTATORS = /\b(executeSpotAction|applySimEvent|markSpot|replayEvents|reduceCareer|reduceCareerEvents)\s*\(/;
const MUTATION_ALLOWLIST = new Set([
  'apps/web/src/practice/store.ts',
  'apps/web/src/practice/persistence.ts',
]);

for (const file of walk('apps/web/src', ['.ts', '.tsx'])) {
  if (file.startsWith(path.join('apps', 'web', 'src', 'test'))) continue;
  if (MUTATION_ALLOWLIST.has(file.split(path.sep).join('/'))) continue;
  if (MUTATORS.test(read(file))) fail(`${file} calls a simulator/Career mutator directly; route it through PracticeSessionStore`);
}

/* -------------------------------------------------------------------------- */
/* no real-money execution path                                               */
/* -------------------------------------------------------------------------- */

const EXECUTION_PATTERNS = [
  /eth_sendTransaction/,
  /eth_sendRawTransaction/,
  /eth_signTypedData/,
  /personal_sign/,
  /\bsignTransaction\b/,
  /\bsendTransaction\b/,
  /\bwriteContract\b/,
  /\bprivateKey\b/,
  /wallet_requestPermissions/,
  /window\.ethereum/,
];

for (const file of [...walk('apps/web/src', ['.ts', '.tsx']), ...walk('packages/sim/src', ['.ts']), ...walk('packages/career/src', ['.ts'])]) {
  const source = read(file);
  for (const pattern of EXECUTION_PATTERNS) {
    if (pattern.test(source)) fail(`${file} matches a real-execution pattern (${pattern}); practice must never sign or broadcast`);
  }
}

/**
 * PROVIDER / DATA-RIGHTS REGISTER.
 *
 * Every external source we rely on must be recorded, and the register must not
 * claim redistribution permission that has not actually been verified.
 */
const register = JSON.parse(read('docs/provider-register.json'));
const REQUIRED_SOURCE_FIELDS = ['id', 'provider', 'endpointFamily', 'factsConsumed', 'provenanceClass', 'rateLimit', 'retrievalDate', 'persistencePolicy', 'redistribution', 'termsReference'];
const REQUIRED_SOURCE_IDS = ['GECKOTERMINAL_POOLS', 'GECKOTERMINAL_OHLCV', 'GECKOTERMINAL_TRADES', 'DEXSCREENER_PAIRS', 'INK_RPC', 'INTERNAL_FIXTURES'];

for (const id of REQUIRED_SOURCE_IDS) {
  if (!register.sources.some((entry) => entry.id === id)) fail(`provider register is missing ${id}`);
}
for (const entry of register.sources) {
  for (const field of REQUIRED_SOURCE_FIELDS) {
    if (!(field in entry)) fail(`provider register entry ${entry.id} is missing ${field}`);
  }
  if (!['VERIFIED', 'REQUIRES_REVIEW'].includes(entry.redistribution)) {
    fail(`provider register entry ${entry.id} has an invalid redistribution status`);
  }
  // Only our own fabricated content and public chain state may claim VERIFIED.
  if (entry.redistribution === 'VERIFIED' && !['INTERNAL_FIXTURES', 'INK_RPC'].includes(entry.id)) {
    fail(`provider register entry ${entry.id} claims VERIFIED redistribution for third-party data without review`);
  }
}
if (!register.sources.some((entry) => entry.blocksPhase === 'EPISODES_V0')) {
  fail('provider register does not flag historical-data redistribution for review before EPISODES_V0');
}
if (!read('docs/PROVIDER_REGISTER_V1.md').includes('EPISODES_V0')) {
  fail('the provider register document does not flag EPISODES_V0');
}

if (!process.exitCode) console.log('VERIFY_SOURCE=PASS');
