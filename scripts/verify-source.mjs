import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fail = (msg) => { console.error(`VERIFY_SOURCE=FAIL ${msg}`); process.exitCode = 1; };

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

if (!process.exitCode) console.log('VERIFY_SOURCE=PASS');
