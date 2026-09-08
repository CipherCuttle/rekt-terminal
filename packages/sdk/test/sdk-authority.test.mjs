import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {createInkubatorClient, InkubatorApiError} from '../dist/index.js';

test('SDK-H03/H06/H09 browser entry is bounded, internals unexported, and 429 is not retried', async () => {
  const entry = fs.readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8');
  assert.doesNotMatch(entry, /node:|process\.env|REKT_DEVKIT_TOKEN/);
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(packageJson.exports).sort(), ['.', './server']);
  assert.equal(Object.keys(packageJson.exports).some((key) => key.includes('generated')), false);

  let calls = 0;
  const client = createInkubatorClient({baseUrl:'https://api.example.test',accessToken:'rekt_dk_test',fetchImpl:async()=>{calls += 1;return new Response(JSON.stringify({error:'devkit_rate_limited'}),{status:429,headers:{'content-type':'application/json','retry-after':'60'}});}});
  await assert.rejects(client.mission.current(), (error) => error instanceof InkubatorApiError && error.status === 429);
  assert.equal(calls, 1);
  const publicShape = JSON.stringify(Object.keys(client)) + JSON.stringify(Object.keys(client.mission)) + JSON.stringify(Object.keys(client.ship));
  assert.doesNotMatch(publicShape, /prove|proven|grant|achievement|approve|moderate/i);
});
