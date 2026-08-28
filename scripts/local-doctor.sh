#!/usr/bin/env bash
set -euo pipefail

printf 'REKT//INK local doctor\n'
printf 'node: '; node --version
printf 'npm:  '; npm --version

if [[ ! -f package-lock.json ]]; then
  echo 'lockfile: MISSING (first networked npm install will create it; commit it immediately)'
else
  echo 'lockfile: PRESENT'
fi

node scripts/verify-core.mjs
node scripts/verify-source.mjs

echo 'Static dependency-free checks passed.'
echo 'Next: npm install --no-audit --no-fund && npm run verify'
