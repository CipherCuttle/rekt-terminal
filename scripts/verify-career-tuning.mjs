#!/usr/bin/env node
/**
 * verify:career-tuning — dedicated verification for CAREER_TUNING_HARNESS_V0.
 *
 * 1. rebuild the domain packages the harness depends on (no stale dist);
 * 2. run the focused harness tests;
 * 3. re-run the full seed x agent matrix and prove its deterministic digest
 *    still matches the committed docs/CAREER_TUNING_HARNESS_V0_RECEIPT.json.
 *
 * Deterministic and offline. No Math.random, no Date.now, no network.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

function run(command, args) {
  process.stdout.write(`\n$ ${command} ${args.join(' ')}\n`);
  execFileSync(command, args, { cwd: ROOT, stdio: 'inherit' });
}

try {
  run('npm', ['run', 'build', '-w', '@rekt-ink/sim']);
  run('npm', ['run', 'build', '-w', '@rekt-ink/career']);
  run(process.execPath, ['--test', 'scripts/career-tuning/test/harness.test.mjs']);
  run(process.execPath, ['scripts/sim-career-agents.mjs', '--check']);
  console.log('\nVERIFY_CAREER_TUNING=PASS');
} catch (error) {
  console.error(`\nVERIFY_CAREER_TUNING=FAIL ${error.message}`);
  process.exitCode = 1;
}
