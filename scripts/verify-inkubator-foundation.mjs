import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

function fail(message) {
  console.error(`Inkubator foundation invariant failed: ${message}`);
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

if (packageJson.packageManager !== 'npm@11.19.0') fail(`package.json packageManager must be "npm@11.19.0"; got ${JSON.stringify(packageJson.packageManager)}`);
if (packageJson.engines?.node !== '24.20.x') fail(`package.json engines.node must be "24.20.x"; got ${JSON.stringify(packageJson.engines?.node)}`);
if (packageJson.engines?.npm !== '11.19.x') fail(`package.json engines.npm must be "11.19.x"; got ${JSON.stringify(packageJson.engines?.npm)}`);
if (packageJson.devEngines?.runtime?.name !== 'node' || packageJson.devEngines?.runtime?.version !== '24.20.0' || packageJson.devEngines?.runtime?.onFail !== 'error') fail('package.json devEngines.runtime must fail closed on Node 24.20.0');
if (packageJson.devEngines?.packageManager?.name !== 'npm' || packageJson.devEngines?.packageManager?.version !== '11.19.0' || packageJson.devEngines?.packageManager?.onFail !== 'error') fail('package.json devEngines.packageManager must fail closed on npm 11.19.0');
if (!fs.existsSync('.nvmrc') || fs.readFileSync('.nvmrc', 'utf8').trim() !== '24.20.0') fail('.nvmrc must pin Node 24.20.0 exactly');

const npmrc = fs.readFileSync('.npmrc', 'utf8');
for (const required of ['engine-strict=true', 'save-exact=true', 'audit=false', 'fund=false']) if (!npmrc.split(/\r?\n/).includes(required)) fail(`.npmrc must contain ${required}`);

const expectedBuildScripts = {
  build: 'npm run build:canonical',
  'build:core': 'npm run build -w @rekt-ink/episodes && npm run build -w @rekt-ink/sim && npm run build -w @rekt-ink/career && npm run build -w @rekt-ink/learning && npm run build -w @rekt-ink/api && npm run build -w @rekt-ink/web && npm run build -w @rekt-ink/inkubator-api && npm run build -w @rekt-ink/inkubator-verifier',
  'build:inkubator': 'npm run build -w @rekt-ink/inkubator-lab',
  'build:canonical': 'npm run build:core && npm run build:inkubator && npm run build:devkit',
};
for (const [name, expected] of Object.entries(expectedBuildScripts)) if (packageJson.scripts?.[name] !== expected) fail(`${name} must be the canonical repository build contract; got ${JSON.stringify(packageJson.scripts?.[name])}`);

const forbiddenBuildInputPattern = /\bnpx\b|\bnpm\s+(?:install|exec)\b|\bcurl\b|\bwget\b|\bgit\s+(?:clone|pull|fetch)\b/;
function loadWorkspacePackages(rootPackageJson) {
  const records = new Map();
  records.set('.', {path: '.', json: rootPackageJson});
  for (const workspacePattern of rootPackageJson.workspaces ?? []) {
    if (!workspacePattern.endsWith('/*')) fail(`unsupported workspace pattern in canonical build verifier: ${workspacePattern}`);
    const baseDir = workspacePattern.slice(0, -2);
    if (!fs.existsSync(baseDir)) continue;
    for (const entry of fs.readdirSync(baseDir, {withFileTypes: true})) {
      if (!entry.isDirectory()) continue;
      const packageDir = path.posix.join(baseDir, entry.name);
      const manifestPath = path.join(packageDir, 'package.json');
      if (fs.existsSync(manifestPath)) records.set(packageDir, {path: packageDir, json: JSON.parse(fs.readFileSync(manifestPath, 'utf8'))});
    }
  }
  return records;
}
function unquote(token) { return token.replace(/^['"]|['"]$/g, ''); }
function splitShellSegments(script) { return script.split(/\s*(?:&&|\|\||[;|])\s*/).filter(Boolean); }
const packageRecords = loadWorkspacePackages(packageJson);
const packagesByName = new Map();
for (const record of packageRecords.values()) if (record.json.name) packagesByName.set(record.json.name, record);
function parseNpmRunDelegation(segment, currentRecord) {
  const tokens = segment.trim().split(/\s+/).map(unquote);
  const npmIndex = tokens.indexOf('npm');
  if (npmIndex === -1) return null;
  let cursor = npmIndex + 1;
  let workspaceName = null;
  const readWorkspaceFlag = () => {
    const token = tokens[cursor];
    if (token === '-w' || token === '--workspace') {
      workspaceName = tokens[cursor + 1];
      if (!workspaceName) fail(`missing workspace name in canonical build segment: ${segment}`);
      cursor += 2;
      return true;
    }
    if (token?.startsWith('--workspace=')) {
      workspaceName = token.slice('--workspace='.length);
      cursor += 1;
      return true;
    }
    return false;
  };
  readWorkspaceFlag();
  if (tokens[cursor] !== 'run' && tokens[cursor] !== 'run-script') return null;
  cursor += 1;
  const scriptName = tokens[cursor];
  if (!scriptName || scriptName.startsWith('-')) fail(`unable to resolve delegated npm script in canonical build segment: ${segment}`);
  cursor += 1;
  while (cursor < tokens.length) { if (readWorkspaceFlag()) continue; cursor += 1; }
  const targetRecord = workspaceName ? packagesByName.get(workspaceName) : currentRecord;
  if (!targetRecord) fail(`canonical build delegates to unknown workspace ${JSON.stringify(workspaceName)} in segment: ${segment}`);
  return {targetRecord, scriptName};
}
const visitedBuildScripts = new Set();
function inspectReachableBuildScript(record, scriptName, chain = []) {
  const key = `${record.path}#${scriptName}`;
  if (visitedBuildScripts.has(key)) return;
  visitedBuildScripts.add(key);
  for (const lifecycleName of [`pre${scriptName}`, scriptName, `post${scriptName}`]) {
    const script = record.json.scripts?.[lifecycleName];
    if (!script) continue;
    const label = `${record.path}/package.json#scripts.${lifecycleName}`;
    const nextChain = [...chain, label];
    if (forbiddenBuildInputPattern.test(script)) fail(`canonical build path must not fetch or mutate upstream inputs: ${nextChain.join(' -> ')}`);
    for (const segment of splitShellSegments(script)) {
      if (!/\bnpm\b/.test(segment)) continue;
      const delegation = parseNpmRunDelegation(segment, record);
      if (delegation) inspectReachableBuildScript(delegation.targetRecord, delegation.scriptName, nextChain);
    }
  }
}
inspectReachableBuildScript(packageRecords.get('.'), 'build');

const tracked = execFileSync('git', ['ls-files', '-z'], {encoding: 'utf8'}).split('\0').filter(Boolean);
for (const prefix of ['apps/inkubator-lab/src/components/react-bits/', 'inkubator/']) {
  const match = tracked.find((file) => file.startsWith(prefix));
  if (match) fail(`licensed/generated public source must not be tracked: ${match}`);
}
for (const forbiddenPath of ['.github/workflows/inkubator-reactbits-pro.yml', 'scripts/install-inkubator-reactbits-pro.mjs', '.github/workflows/f1-lockfile-admission.yml']) if (tracked.includes(forbiddenPath)) fail(`legacy/temporary mutable build path must not be tracked: ${forbiddenPath}`);

const adapter = fs.readFileSync('apps/inkubator-lab/src/reactbits-pro.tsx', 'utf8');
if (/components\/react-bits|@reactbits-(?:starter|pro)/.test(adapter)) fail('public effect adapter must not import licensed React Bits source');

const workflows = ['.github/workflows/ci.yml', '.github/workflows/inkubator.yml', '.github/workflows/inkubator-auth.yml'];
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
    const ref = action.includes('@') ? action.slice(action.lastIndexOf('@') + 1) : '';
    if (!/^[0-9a-f]{40}$/i.test(ref)) fail(`${workflowPath} action must be pinned to a full commit SHA: ${action}`);
  }
}

const authWorkflow = fs.readFileSync('.github/workflows/inkubator-auth.yml', 'utf8');
if (!/image:\s*postgres@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2/.test(authWorkflow)) {
  fail('Inkubator auth integration Postgres image must be pinned to the reviewed 18.6 image digest');
}

console.log('Inkubator foundation invariants: PASS');
