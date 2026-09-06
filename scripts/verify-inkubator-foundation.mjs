import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function fail(message) {
  console.error(`Inkubator foundation invariant failed: ${message}`);
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (packageJson.engines?.node !== '>=24 <25') {
  fail(`package.json engines.node must be ">=24 <25"; got ${JSON.stringify(packageJson.engines?.node)}`);
}

if (!fs.existsSync('.nvmrc') || fs.readFileSync('.nvmrc', 'utf8').trim() !== '24') {
  fail('.nvmrc must pin Node 24');
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
  if (!/node-version:\s*24/.test(workflow)) fail(`${workflowPath} must run Node 24`);
}

const inkubatorWorkflow = fs.readFileSync('.github/workflows/inkubator.yml', 'utf8');
const forbiddenWorkflowPatterns = [
  ['write repository permission', /contents:\s*write/],
  ['floating shadcn execution', /shadcn@latest/],
  ['floating Lighthouse execution', /lighthouse@latest/],
  ['React Bits license secret', /REACTBITS_LICENSE_KEY/],
  ['source-branch mutation', /\bgit\s+push\b/],
  ['dependency graph mutation', /\bnpm\s+install\b/],
];
for (const [label, pattern] of forbiddenWorkflowPatterns) {
  if (pattern.test(inkubatorWorkflow)) fail(`Inkubator verification contains ${label}`);
}

console.log('Inkubator foundation invariants: PASS');
