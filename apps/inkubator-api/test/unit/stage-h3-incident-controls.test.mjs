import assert from 'node:assert/strict';
import test from 'node:test';
import {loadRuntimeConfig} from '../../dist/config.js';

const baseEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://fixture.invalid/inkubator',
  INKUBATOR_APP_ORIGIN: 'https://inkubator.example.test',
};

test('H3 incident controls are strict opt-in flags and default fail-normal', () => {
  const normal = loadRuntimeConfig({...baseEnv});
  assert.equal(normal.incidentWriteFreeze, false);
  assert.equal(normal.incidentDisableGitHub, false);

  const incident = loadRuntimeConfig({
    ...baseEnv,
    INKUBATOR_INCIDENT_WRITE_FREEZE: '1',
    INKUBATOR_INCIDENT_DISABLE_GITHUB: '1',
  });
  assert.equal(incident.incidentWriteFreeze, true);
  assert.equal(incident.incidentDisableGitHub, true);

  for (const [name, value] of [
    ['INKUBATOR_INCIDENT_WRITE_FREEZE', 'true'],
    ['INKUBATOR_INCIDENT_DISABLE_GITHUB', 'yes'],
  ]) {
    assert.throws(() => loadRuntimeConfig({...baseEnv, [name]: value}), /must be 0 or 1/);
  }
});
