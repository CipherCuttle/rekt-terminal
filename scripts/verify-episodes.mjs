import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const sourceRoot = path.join(root, 'packages/episodes/src');
const files = fs.readdirSync(sourceRoot).filter((file) => file.endsWith('.ts'));
const source = files.map((file) => fs.readFileSync(path.join(sourceRoot, file), 'utf8')).join('\n');
const forbidden = [
  [/Date\.now\s*\(/, 'wall-clock time'],
  [/Math\.random\s*\(/, 'random entropy'],
  [/\bfetch\s*\(/, 'network fetching'],
  [/\b(?:window|document|localStorage|indexedDB)\b/, 'browser globals'],
  [/from\s+['"]node:/, 'Node-only imports'],
  [/\b(?:signing|broadcast|privateKey|wallet)\b/i, 'real execution surface'],
];
for (const [pattern, label] of forbidden) {
  if (pattern.test(source)) {
    console.error(`VERIFY_EPISODES=FAIL ${label} is present in packages/episodes/src`);
    process.exitCode = 1;
  }
}
if (process.exitCode) process.exit(process.exitCode);
console.log(`VERIFY_EPISODES=PASS files=${files.length} network=none clock=none entropy=none execution=none`);
