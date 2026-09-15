import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const registration = /registerStageGRevealArenaRoutes\(app, db\);/;

async function source(name) {
  return readFile(new URL(`../../src/${name}`, import.meta.url), 'utf8');
}

test('G1 reveal routes stay registered in both Inkubator API entrypoints', async () => {
  const [server, renderServer] = await Promise.all([
    source('server.ts'),
    source('render-server.ts'),
  ]);
  assert.match(server, registration);
  assert.match(renderServer, registration);
});
