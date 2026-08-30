import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAREER_SAVE_VERSION,
  createInitialCareer,
  migrateCareerSave,
  reduceCareer,
} from '../dist/index.js';

function marginUnlocked(id = 'short-career') {
  let state = createInitialCareer(id, 0);
  for (const skillId of ['SCALE_CONTROL', 'STOP_LOSS', 'RISK_SIZING', 'MARGIN_2X']) {
    state = reduceCareer(state, { type: 'SKILL_UNLOCKED', eventId: `${id}:${skillId}`, skillId });
  }
  return state;
}

function completion(episodeId, overrides = {}) {
  return {
    completionId: `completion:${episodeId}:${overrides.completionSuffix ?? 'a'}`,
    sessionId: `session:${episodeId}`,
    episodeId,
    tradeId: `trade:${episodeId}`,
    side: 'LONG',
    leverage: 2,
    closeReason: 'MANUAL',
    liquidated: false,
    protectiveStopUsed: true,
    plannedMaxAccountRiskBps: 500n,
    marketProvenance: 'DERIVED',
    simulationProvenance: 'SYNTHETIC',
    modelVersion: 'SIM_MARGIN_V0',
    ...overrides,
  };
}

function reduceCompletion(state, summary, suffix = '') {
  return reduceCareer(state, {
    type: 'MARGIN_EPISODE_COMPLETED',
    eventId: `${summary.completionId}:career${suffix}`,
    sourceReceiptId: summary.completionId,
    summary,
  });
}

test('one qualifying long episode does not unlock SHORT; two distinct qualifying episodes do', () => {
  let state = marginUnlocked();
  state = reduceCompletion(state, completion('EP_A'));
  assert.equal(state.unlockedSkills.includes('SHORT'), false);
  assert.deepEqual(state.stats.qualifyingLongMarginEpisodeIds, ['EP_A']);
  assert.equal(state.objective.progress, 1);
  assert.equal(state.objective.target, 2);

  state = reduceCompletion(state, completion('EP_B'));
  assert.equal(state.unlockedSkills.includes('SHORT'), true);
  assert.equal(state.unlockedCapabilities.includes('PERP_SHORT_2X'), true);
  assert.deepEqual(state.stats.qualifyingLongMarginEpisodeIds, ['EP_A', 'EP_B']);
});

test('repeating the same historical episode cannot grind SHORT qualification', () => {
  let state = marginUnlocked('repeat');
  state = reduceCompletion(state, completion('EP_A', { completionId: 'a-1' }));
  state = reduceCompletion(state, completion('EP_A', { completionId: 'a-2', tradeId: 'trade-a-2', sessionId: 'session-a-2' }));
  assert.deepEqual(state.stats.qualifyingLongMarginEpisodeIds, ['EP_A']);
  assert.equal(state.unlockedSkills.includes('SHORT'), false);
});

test('liquidation, missing stop, unknown risk, >5% risk, SHORT-side completion, and unavailable evidence do not qualify', () => {
  const bad = [
    completion('LIQ', { liquidated: true, closeReason: 'LIQUIDATION' }),
    completion('NO_STOP', { protectiveStopUsed: false }),
    completion('UNKNOWN_RISK', { plannedMaxAccountRiskBps: null }),
    completion('TOO_RISKY', { plannedMaxAccountRiskBps: 501n }),
    completion('SHORT_SIDE', { side: 'SHORT' }),
    completion('UNAVAILABLE', { marketProvenance: 'UNAVAILABLE' }),
  ];
  let state = marginUnlocked('bad');
  for (const summary of bad) state = reduceCompletion(state, summary);
  assert.deepEqual(state.stats.qualifyingLongMarginEpisodeIds, []);
  assert.equal(state.unlockedSkills.includes('SHORT'), false);
});

test('exactly 500 bps qualifies and SHORT grants only PERP_SHORT_2X as its new capability', () => {
  let state = marginUnlocked('boundary');
  const before = new Set(state.unlockedCapabilities);
  state = reduceCompletion(state, completion('EP_A', { plannedMaxAccountRiskBps: 500n }));
  state = reduceCompletion(state, completion('EP_B', { plannedMaxAccountRiskBps: 500n }));
  const newlyGranted = state.unlockedCapabilities.filter((capability) => !before.has(capability));
  assert.deepEqual(newlyGranted, ['PERP_SHORT_2X']);
  assert.equal(state.receipts.SHORT_AUTHORIZED, 1);
});

test('MARGIN_2X is a prerequisite even when two valid completion receipts exist', () => {
  let state = createInitialCareer('no-margin', 0);
  state = reduceCompletion(state, completion('EP_A'));
  state = reduceCompletion(state, completion('EP_B'));
  assert.deepEqual(state.stats.qualifyingLongMarginEpisodeIds, ['EP_A', 'EP_B']);
  assert.equal(state.unlockedSkills.includes('SHORT'), false);
});

test('v4 migration creates no invented historical margin completion credit', () => {
  const current = createInitialCareer('legacy-v4', 0);
  const legacyState = structuredClone(current);
  legacyState.saveVersion = 4;
  delete legacyState.stats.qualifyingLongMarginEpisodeIds;
  delete legacyState.qualification.short;
  const migrated = migrateCareerSave({ kind: 'REKT_INK_CAREER_SAVE', saveVersion: 4, state: legacyState });
  assert.ok(migrated);
  assert.equal(migrated.saveVersion, CAREER_SAVE_VERSION);
  assert.deepEqual(migrated.state.stats.qualifyingLongMarginEpisodeIds, []);
  assert.deepEqual(migrated.state.qualification.short.qualifyingLongEpisodeIds, []);
  assert.equal(migrated.state.unlockedCapabilities.includes('PERP_SHORT_2X'), false);
});
