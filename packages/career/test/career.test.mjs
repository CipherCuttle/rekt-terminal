import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAREER_SAVE_VERSION,
  createCareerSave,
  createInitialCareer,
  getNextObjective,
  migrateCareerSave,
  reduceCareer,
} from '../dist/index.js';

function closed(id, lossBps = 0n, equity = 500_000_000_000_000_000n) {
  return {
    type: 'TRADE_CLOSED',
    eventId: `${id}:closed`,
    sourceReceiptId: `${id}:sim-receipt`,
    summary: {
      tradeId: id,
      sessionId: 'career-test-session',
      mode: 'SPOT',
      realizedPnlWei: lossBps > 0n ? -1n : 1n,
      accountEquityAtCloseWei: equity,
      lossBpsOfThenCurrentEquity: lossBps,
      partialExitUsed: false,
      liquidated: false,
      accountEquityAtOpenWei: 500_000_000_000_000_000n,
      exitReason: lossBps > 0n ? 'MANUAL' : 'MANUAL',
      stopUsed: false,
    },
  };
}

test('STOP_LOSS requires SCALE_CONTROL, five trades, equity floor, and controlled loss evidence', () => {
  let state = createInitialCareer('stop-gate', 1_700_000_000_000);
  for (let i = 1; i <= 5; i += 1) state = reduceCareer(state, closed(`stop-${i}`, i === 5 ? 499n : 0n));
  assert.equal(state.unlockedSkills.includes('SCALE_CONTROL'), true);
  assert.equal(state.unlockedSkills.includes('STOP_LOSS'), true);
  assert.equal(state.unlockedCapabilities.includes('STOP_MARKET'), true);
  assert.equal(state.qualification.stopLoss.qualified, true);
  const before = state.stats.closedSpotTrades;
  for (let i = 0; i < 20; i += 1) state = reduceCareer(state, { type: 'NON_ECONOMIC_ACTION', eventId: `stop-spam-${i}`, action: 'click' });
  assert.equal(state.stats.closedSpotTrades, before);
});

test('PROTECT_CAPITAL is an alternate simulator-fact qualification path', () => {
  let state = createInitialCareer('stop-challenge', 1_700_000_000_000);
  for (let i = 1; i <= 5; i += 1) {
    const event = closed(`challenge-${i}`, i === 5 ? 499n : 0n);
    event.summary.exitReason = i === 5 ? 'PROTECT_CAPITAL' : 'MANUAL';
    state = reduceCareer(state, event);
  }
  assert.equal(state.stats.protectCapitalChallenges, 1);
  assert.equal(state.unlockedSkills.includes('STOP_LOSS'), true);
});

test('exact 5% loss and equity below 70% cannot authorize STOP_LOSS', () => {
  let state = createInitialCareer('stop-boundary', 1_700_000_000_000);
  for (let i = 1; i <= 5; i += 1) state = reduceCareer(state, closed(`boundary-${i}`, i === 5 ? 500n : 0n));
  assert.equal(state.stats.manualLossCuts, 0);
  assert.equal(state.unlockedSkills.includes('STOP_LOSS'), false);
  state = createInitialCareer('stop-equity', 1_700_000_000_000);
  for (let i = 1; i <= 5; i += 1) state = reduceCareer(state, closed(`equity-floor-${i}`, i === 5 ? 499n : 0n, 349_000_000_000_000_000n));
  assert.equal(state.qualification.stopLoss.accountEquityAtLeast70Percent, false);
  assert.equal(state.unlockedSkills.includes('STOP_LOSS'), false);
});

test('SPOT_BASIC starts unlocked with only the fixed buy and sell-all capabilities', () => {
  const state = createInitialCareer('career-start', 1_700_000_000_000);
  assert.deepEqual(state.unlockedSkills, ['SPOT_BASIC']);
  assert.deepEqual(state.unlockedCapabilities, ['SPOT_MARKET_BUY_FIXED', 'SPOT_SELL_ALL']);
  assert.equal(state.stats.closedSpotTrades, 0);
  assert.equal(state.objective.text, 'NEXT // Complete 3 controlled spot trades.');
});

test('three qualifying closed spot trades unlock SCALE_CONTROL and its capabilities', () => {
  let state = createInitialCareer('career-unlock', 1_700_000_000_000);
  for (let i = 1; i <= 3; i += 1) state = reduceCareer(state, closed(`trade-${i}`));
  assert.deepEqual(state.unlockedSkills, ['SPOT_BASIC', 'SCALE_CONTROL']);
  assert.deepEqual(state.unlockedCapabilities, ['SPOT_MARKET_BUY_FIXED', 'SPOT_SELL_ALL', 'SCALE_IN', 'PARTIAL_EXIT']);
  assert.equal(state.qualification.scaleControl.qualified, true);
  assert.equal(state.stats.closedSpotTrades, 3);
  assert.equal(state.receipts.SCALE_CONTROL_AUTHORIZED, 1);
  assert.equal(state.recentEffects.some((effect) => effect.kind === 'SKILL_UNLOCKED'), true);
  assert.equal(getNextObjective(state).kind, 'SCALE_CONTROL_UNLOCKED');
});

test('a >10% loss remains in history but does not poison later qualification', () => {
  let lossState = createInitialCareer('career-loss', 1_700_000_000_000);
  lossState = reduceCareer(lossState, closed('loss-1', 1_001n));
  lossState = reduceCareer(lossState, closed('loss-2'));
  lossState = reduceCareer(lossState, closed('loss-3'));
  assert.equal(lossState.qualification.scaleControl.qualified, false);
  assert.equal(lossState.stats.closedSpotTrades, 3);
  assert.equal(lossState.stats.qualifyingScaleTrades, 2);
  assert.equal(lossState.stats.maxClosedLossBps, 1_001);
  lossState = reduceCareer(lossState, closed('loss-4'));
  assert.equal(lossState.qualification.scaleControl.qualified, true);
  assert.equal(lossState.stats.qualifyingScaleTrades, 3);
  assert.equal(lossState.objective.kind, 'SCALE_CONTROL_UNLOCKED');
});

test('a >10% loss does not count and non-positive equity cannot qualify', () => {
  let state = createInitialCareer('career-equity', 1_700_000_000_000);
  state = reduceCareer(state, closed('bad-loss', 1_001n));
  assert.equal(state.stats.qualifyingScaleTrades, 0);
  assert.equal(state.qualification.scaleControl.closedSpotTrades, 0);

  state = reduceCareer(state, closed('equity-zero', 0n, 0n));
  assert.equal(state.stats.qualifyingScaleTrades, 0);
  assert.equal(state.qualification.scaleControl.positiveAccountEquity, false);

  state = reduceCareer(state, closed('good-1'));
  state = reduceCareer(state, closed('good-2'));
  state = reduceCareer(state, closed('good-3'));
  assert.equal(state.stats.qualifyingScaleTrades, 3);
  let equityState = createInitialCareer('career-equity', 1_700_000_000_000);
  equityState = reduceCareer(equityState, closed('equity-1'));
  equityState = reduceCareer(equityState, closed('equity-2'));
  equityState = reduceCareer(equityState, closed('equity-3'));
  assert.equal(equityState.qualification.scaleControl.qualified, true);
});

test('SCALE_CONTROL stays unlocked after later bad or non-positive facts', () => {
  let state = createInitialCareer('career-sticky-unlock', 1_700_000_000_000);
  for (let i = 1; i <= 3; i += 1) state = reduceCareer(state, closed(`good-${i}`));
  assert.equal(state.qualification.scaleControl.qualified, true);
  state = reduceCareer(state, closed('later-bad', 1_001n, 0n));
  assert.equal(state.unlockedSkills.includes('SCALE_CONTROL'), true);
  assert.equal(state.qualification.scaleControl.qualified, true);
});

test('duplicate receipts and non-economic action spam do not grant Career progress', () => {
  let state = createInitialCareer('career-spam', 1_700_000_000_000);
  const event = closed('only-trade');
  state = reduceCareer(state, event);
  const afterTrade = state;
  state = reduceCareer(state, event);
  for (let i = 0; i < 100; i += 1) state = reduceCareer(state, { type: 'NON_ECONOMIC_ACTION', eventId: `spam-${i}`, action: 'click' });
  assert.equal(state.stats.closedSpotTrades, 1);
  assert.equal(state.stats.scaleInsUsed, 0);
  assert.equal(state.stats.partialExitsUsed, 0);
  assert.equal(state.qualification.scaleControl.closedSpotTrades, afterTrade.qualification.scaleControl.closedSpotTrades);
});

test('Career save migration is versioned and rejects malformed or future saves', () => {
  const state = createInitialCareer('career-save', 1_700_000_000_000);
  const save = createCareerSave(state);
  assert.equal(save.saveVersion, CAREER_SAVE_VERSION);
  assert.equal(migrateCareerSave(save)?.state.careerId, 'career-save');
  assert.equal(migrateCareerSave({ ...save, saveVersion: 99 }), null);
  assert.equal(migrateCareerSave({ kind: save.kind, saveVersion: save.saveVersion, state: { nope: true } }), null);
});
