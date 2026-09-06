import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function fail(message) {
  console.error(`Inkubator foundation invariant failed: ${message}`);
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

if (packageJson.packageManager !== 'npm@11.19.0') {
  fail(`package.json packageManager must be "npm@11.19.0"; got ${JSON.stringify(packageJson.packageManager)}`);
}
if (packageJson.engines?.node !== '24.20.x') {
  fail(`package.json engines.node must be "24.20.x"; got ${JSON.stringify(packageJson.engines?.node)}`);
}
if (packageJson.engines?.npm !== '11.19.x') {
  fail(`package.json engines.npm must be "11.19.x"; got ${JSON.stringify(packageJson.engines?.npm)}`);
}
if (packageJson.devEngines?.runtime?.name !== 'node' || packageJson.devEngines?.runtime?.version !== '24.20.0' || packageJson.devEngines?.runtime?.onFail !== 'error') {
  fail('package.json devEngines.runtime must fail closed on Node 24.20.0');
}
if (packageJson.devEngines?.packageManager?.name !== 'npm' || packageJson.devEngines?.packageManager?.version !== '11.19.0' || packageJson.devEngines?.packageManager?.onFail !== 'error') {
  fail('package.json devEngines.packageManager must fail closed on npm 11.19.0');
}

if (!fs.existsSync('.nvmrc') || fs.readFileSync('.nvmrc', 'utf8').trim() !== '24.20.0') {
  fail('.nvmrc must pin Node 24.20.0 exactly');
}

const npmrc = fs.readFileSync('.npmrc', 'utf8');
for (const required of ['engine-strict=true', 'save-exact=true', 'audit=false', 'fund=false']) {
  if (!npmrc.split(/\r?\n/).includes(required)) fail(`.npmrc must contain ${required}`);
}

const expectedBuildScripts = {
  build: 'npm run build:canonical',
  'build:inkubator': 'npm run build -w @rekt-ink/inkubator-lab',
  'build:canonical': 'npm run build:core && npm run build:inkubator',
};
for (const [name, expected] of Object.entries(expectedBuildScripts)) {
  if (packageJson.scripts?.[name] !== expected) {
    fail(`${name} must be the canonical repository build contract; got ${JSON.stringify(packageJson.scripts?.[name])}`);
  }
}
for (const name of ['build', 'build:core', 'build:inkubator', 'build:canonical']) {
  const script = packageJson.scripts?.[name] ?? '';
  if (/\bnpx\b|\bnpm\s+install\b|\bcurl\b|\bwget\b|\bgit\s+(?:clone|pull|fetch)\b/.test(script)) {
    fail(`${name} must not fetch or mutate upstream build inputs at build time`);
  }
}

const tracked = execFileSync('git', ['ls-files', '-z'], {encoding: 'utf8'})
  .split('\0')
  .filter(Boolean);

const forbiddenTrackedPrefixes = [
  'apps/inkubator-lab/src/components/react-bits/',
  'inkubator/',
];
for (const prefix of forbiddenTrackedPrefixes) {
  const match = tracked.find((file) => file.startsWith(prefix));
  if (match) fail(`licensed/generated public source must not be tracked: ${match}`);
}

for (const forbiddenPath of [
  '.github/workflows/inkubator-reactbits-pro.yml',
  'scripts/install-inkubator-reactbits-pro.mjs',
]) {
  if (tracked.includes(forbiddenPath)) fail(`legacy mutable build path must not be tracked: ${forbiddenPath}`);
}

const adapter = fs.readFileSync('apps/inkubator-lab/src/reactbits-pro.tsx', 'utf8');
if (/components\/react-bits|@reactbits-(?:starter|pro)/.test(adapter)) {
  fail('public effect adapter must not import licensed React Bits source');
}

const workflows = [
  '.github/workflows/ci.yml',
  '.github/workflows/inkubator.yml',
];
for (const workflowPath of workflows) {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  if (!/contents:\s*read/.test(workflow)) fail(`${workflowPath} must use contents: read`);
  if (!/node-version:\s*24\.20\.0/.test(workflow)) fail(`${workflowPath} must run Node 24.20.0 exactly`);
  if (/@latest\b/.test(workflow)) fail(`${workflowPath} must not execute floating @latest tooling`);
  if (/contents:\s*write/.test(workflow)) fail(`${workflowPath} must not grant repository write permission`);
  if (/\bgit\s+push\b/.test(workflow)) fail(`${workflowPath} must not mutate source branches`);
  if (/\bnpm\s+install\b/.test(workflow)) fail(`${workflowPath} must use the locked npm ci install path`);

  for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
    const action = match[1];
    if (action.startsWith('./')) continue;
    const at = action.lastIndexOf('@');
    const ref = at === -1 ? '' : action.slice(at + 1);
    if (!/^[0-9a-f]{40}$/i.test(ref)) {
      fail(`${workflowPath} action must be pinned to a full commit SHA: ${action}`);
    }
  }
}

console.log('Inkubator foundation invariants: PASS');
