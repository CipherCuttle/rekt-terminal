import assert from 'node:assert/strict';
import test from 'node:test';
import {loadRuntimeConfig} from '../../dist/config.js';

const baseEnv = {
  DATABASE_URL: 'postgres://inkubator:test@localhost:5432/inkubator',
  INKUBATOR_APP_ORIGIN: 'https://inkubator.example.test',
  NODE_ENV: 'production',
};

test('production REKT sessions default to an eight-hour absolute window', () => {
  const config = loadRuntimeConfig(baseEnv);
  assert.equal(config.sessionTtlSeconds, 8 * 60 * 60);
});

test('explicit bounded session TTL still overrides the default', () => {
  const config = loadRuntimeConfig({...baseEnv, INKUBATOR_SESSION_TTL_SECONDS: '3600'});
  assert.equal(config.sessionTtlSeconds, 3600);
});
