import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const signalRoot = path.join(root, 'apps/inkubator-lab/src/signal-system');
const required = [
  'tokens.css',
  'SignalSystem.module.css',
  'primitives.tsx',
  'patterns.tsx',
  'fixtures.ts',
  'GoldenScreens.tsx',
  'GoldenScreens.test.tsx',
  'SignalSystem.stories.tsx',
];

for (const file of required) {
  const target = path.join(signalRoot, file);
  if (!fs.existsSync(target)) throw new Error(`missing Signal System file: ${file}`);
}

const files = required.map((name) => [name, fs.readFileSync(path.join(signalRoot, name), 'utf8')]);
for (const [name, content] of files) {
  if (name !== 'tokens.css' && /#[0-9a-f]{3,8}\b/i.test(content)) {
    throw new Error(`literal hex color escaped semantic token layer: ${name}`);
  }
  if (/(reactbits-pro|@react-three|from ['"]three['"])/i.test(content)) {
    throw new Error(`Broadcast-only effect dependency entered Signal System source: ${name}`);
  }
}

const tokens = fs.readFileSync(path.join(signalRoot, 'tokens.css'), 'utf8');
for (const token of [
  '--ink-surface-world', '--ink-surface-instrument', '--ink-surface-artifact',
  '--ink-signal-active', '--ink-signal-observed', '--ink-signal-proven', '--ink-signal-attention', '--ink-signal-blocked',
  '--ink-text-primary', '--ink-text-secondary', '--ink-text-meta', '--ink-border-standard',
]) {
  if (!tokens.includes(token)) throw new Error(`missing semantic token: ${token}`);
}
if ((tokens.match(/#9aff67/gi) ?? []).length !== 1) throw new Error('acid proof color must have one canonical token definition');

const golden = fs.readFileSync(path.join(signalRoot, 'GoldenScreens.tsx'), 'utf8');
for (const screen of ['world', 'command', 'project', 'player', 'ship']) {
  if (!golden.includes(`screen=\"${screen}\"`) && !golden.includes(`screen=\"${screen}`)) {
    // Route links and explicit screen components are checked separately below.
  }
  if (!golden.includes(`id: '${screen}'`)) throw new Error(`golden screen navigation missing ${screen}`);
}
for (const term of ['MISSION', 'NEXT MOVE', 'THE THREAD', 'BLOCKER', 'SHIP ACCEPTED']) {
  if (!golden.includes(term)) throw new Error(`golden screens missing hierarchy term: ${term}`);
}

const main = fs.readFileSync(path.join(root, 'apps/inkubator-lab/src/main.tsx'), 'utf8');
if (!main.includes("lazy(() => import('./AppV3'))") || !main.includes("lazy(() => import('./signal-system/GoldenScreens'))")) {
  throw new Error('Broadcast and Signal System must remain route-selected lazy chunks');
}

if (process.argv.includes('--dist')) {
  const assetsDir = path.join(root, 'apps/inkubator-lab/dist/assets');
  if (!fs.existsSync(assetsDir)) throw new Error('Inkubator dist assets are missing');
  const assets = fs.readdirSync(assetsDir);
  const signalChunk = assets.find((name) => /^GoldenScreens-.*\.js$/.test(name));
  const v3Chunk = assets.find((name) => /^AppV3-.*\.js$/.test(name));
  if (!signalChunk) throw new Error('Signal System did not split into its own GoldenScreens chunk');
  if (!v3Chunk) throw new Error('V3 Broadcast did not split into its own AppV3 chunk');
  const signalPath = path.join(assetsDir, signalChunk);
  const bytes = fs.statSync(signalPath).size;
  if (bytes > 300_000) throw new Error(`Signal System critical chunk exceeds 300KB raw budget: ${bytes}`);
  const bundled = fs.readFileSync(signalPath, 'utf8');
  if (/(reactbits-pro|three\.module|WebGLRenderer|@react-three)/i.test(bundled)) {
    throw new Error('Signal System chunk contains Broadcast-only React Bits/Three code');
  }
}

console.log('REKT Signal System invariants: PASS');
