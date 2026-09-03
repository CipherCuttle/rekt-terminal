import assert from 'node:assert/strict';
import { MISSION_DEFINITIONS, MISSION_IDS, evaluateMissionAttempt, missionUsesPnlForPass } from '../packages/learning/dist/index.js';

assert.deepEqual(MISSION_IDS, ['MD-01', 'EX-01', 'LQ-01', 'ST-01', 'RS-01']);
assert.equal(Object.keys(MISSION_DEFINITIONS).length, 5);
for (const id of MISSION_IDS) {
  assert.equal(MISSION_DEFINITIONS[id].version, 1);
  assert.equal(Object.isFrozen(MISSION_DEFINITIONS[id]), true);
}
assert.equal(missionUsesPnlForPass('EX-01'), false);
const first = evaluateMissionAttempt({ missionId: 'MD-01', missionVersion: 1, learnerInput: { kind: 'MD-01', classifications: { 'aggregator-mark': 'DERIVED', 'simulator-fill': 'DERIVED', 'demo-observation': 'SYNTHETIC', 'aged-observation': 'STALE' }, freshnessAnswer: 'STALE' }, completedAtSimMs: 1_800_000_000_000 }).receipt;
assert.equal(first.verdict, 'PASS');
assert.equal(first.scenario.provenance, 'SYNTHETIC');
console.log('VERIFY_LEARNING=PASS');
