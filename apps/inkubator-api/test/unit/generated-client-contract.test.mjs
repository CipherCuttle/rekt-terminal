import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('generated enum-array unions are parenthesized before []', () => {
  const target = new URL('../../../inkubator-lab/src/generated/inkubator-api-client.ts', import.meta.url);
  const source = fs.readFileSync(target, 'utf8');
  const stackLines = source.split('\n').filter((line) => line.includes('observed_stacks:'));
  assert.ok(stackLines.length > 0);
  for (const line of stackLines) assert.match(line, /observed_stacks: \(.+\)\[\];/);
});
