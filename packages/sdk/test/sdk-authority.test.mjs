import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {createInkubatorClient, InkubatorApiError} from '../dist/index.js';
import {createInkubatorServerClient} from '../dist/server.js';

test('SDK-H03/H06/H09 browser entry is credential-free, internals unexported, and 429 is not retried', async () => {
  const entry = fs.readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8');
  const serverEntry = fs.readFileSync(new URL('../dist/server.js', import.meta.url), 'utf8');
  assert.doesNotMatch(entry, /node:|process\.env|REKT_DEVKIT_TOKEN|accessToken|authorization|Bearer/);
  assert.match(serverEntry, /accessToken/);

  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(packageJson.exports).sort(), ['.', './server']);
  assert.equal(Object.keys(packageJson.exports).some((key) => key.includes('generated')), false);

  let browserCalls = 0;
  const browser = createInkubatorClient({
    baseUrl:'https://api.example.test',
    fetchImpl:async(_input, init)=>{
      browserCalls += 1;
      const headers = new Headers(init?.headers);
      assert.equal(headers.has('authorization'), false);
      assert.equal(init?.credentials, 'include');
      return new Response(JSON.stringify({mission:{mission_id:'m1',next_move:'ship'},project:{project_id:'p1'}}),{status:200,headers:{'content-type':'application/json'}});
    },
  });
  await browser.mission.current();
  assert.equal(browserCalls, 1);

  let calls = 0;
  const server = createInkubatorServerClient({baseUrl:'https://api.example.test',accessToken:'rekt_dk_test',fetchImpl:async()=>{calls += 1;return new Response(JSON.stringify({error:'devkit_rate_limited'}),{status:429,headers:{'content-type':'application/json','retry-after':'60'}});}});
  await assert.rejects(server.mission.current(), (error) => error instanceof InkubatorApiError && error.status === 429);
  assert.equal(calls, 1);
  const publicShape = JSON.stringify(Object.keys(server)) + JSON.stringify(Object.keys(server.mission)) + JSON.stringify(Object.keys(server.ship));
  assert.doesNotMatch(publicShape, /prove|proven|grant|achievement|approve|moderate/i);
});
