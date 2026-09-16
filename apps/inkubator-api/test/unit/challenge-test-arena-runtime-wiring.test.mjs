import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const registration = /registerStageG2BTestArenaRoutes\(app, options\.db\);/;
const productionBuilder = /buildFundedChallengeProductionApp/;

async function source(name) {
  return readFile(new URL(`../../src/${name}`, import.meta.url), 'utf8');
}

test('G2B Test Arena routes stay registered through the canonical production builder used by both entrypoints', async () => {
  const [productionApp, server, renderServer] = await Promise.all([
    source('production-app.ts'),
    source('server.ts'),
    source('render-server.ts'),
  ]);

  assert.match(productionApp, registration);
  for (const entrypoint of [server, renderServer]) {
    assert.match(entrypoint, productionBuilder);
    assert.doesNotMatch(entrypoint, /registerStageG2BTestArenaRoutes/);
  }
});
