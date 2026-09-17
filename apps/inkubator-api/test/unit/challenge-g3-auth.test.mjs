import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import {registerStageG3Routes} from '../../dist/challenge-g3-api.js';

async function appWithoutDatabaseAccess() {
  const app = Fastify();
  registerStageG3Routes(app, {});
  return app;
}

test('G3 organizer comparison requires authentication before database access', async () => {
  const app = await appWithoutDatabaseAccess();
  try {
    const response = await app.inject({method: 'GET', url: '/v1/challenges/00000000-0000-4000-8000-000000000001/qualifier-comparison'});
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {error: 'authentication_required'});
  } finally {
    await app.close();
  }
});

test('G3 organizer selection requires authentication before database access', async () => {
  const app = await appWithoutDatabaseAccess();
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/challenges/00000000-0000-4000-8000-000000000001/selection',
      payload: {},
    });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), {error: 'authentication_required'});
  } finally {
    await app.close();
  }
});
