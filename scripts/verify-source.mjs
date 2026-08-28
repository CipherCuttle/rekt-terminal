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

/* -------------------------------------------------------------------------- */
/* market-data honesty (Phase 0)                                              */
/* -------------------------------------------------------------------------- */

const server = read('apps/api/src/server.ts');
const live = read('apps/api/src/live.ts');
const clientApi = read('apps/web/src/lib/api.ts');
const chart = read('apps/web/src/lib/chart.ts');

if (server.includes("mode:'fixture-fallback'") || server.includes('mode: \'fixture-fallback\'')) {
  fail('LIVE radar may fall back to fixtures');
}
if (!live.includes("wss://ws-gel.inkonchain.com")) fail('official Ink WSS default missing');
if (/update\([^)]*Date\.now/.test(chart) || chart.includes('time=Math.floor(Date.now')) {
  fail('chart update contains implicit wall-clock default');
}
if (!clientApi.includes("mode === 'fixture'")) fail('client fixture fallback boundary missing');
if (!clientApi.includes('LIVE is fail-closed')) fail('client LIVE fail-closed invariant comment missing');
if (!server.includes("new Date(serverTime).toISOString()")) fail('fixture stream provenance is not tied to deterministic serverTime');
if (!server.includes("mode === 'fixture' ? FIXTURE_STREAM_EPOCH : Date.now()")) fail('fixture HELLO time is not deterministic');

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

if (!process.exitCode) console.log('VERIFY_SOURCE=PASS');
