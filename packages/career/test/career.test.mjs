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
    },
  };
}

test('SPOT_BASIC starts unlocked with only the fixed buy and sell-all capabilities', () => {
  const state = createInitialCareer('career-start', 1_700_000_000_000);
  assert.deepEqual(state.unlockedSkills, ['SPOT_BASIC']);
  assert.deepEqual(state.unlockedCapabilities, ['SPOT_MARKET_BUY_FIXED', 'SPOT_SELL_ALL']);
  assert.equal(state.stats.closedSpotTrades, 0);
  assert.equal(state.objective.text, 'NEXT // Close 3 more spot positions.');
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

test('a trade over the loss gate or a non-positive close blocks the unlock', () => {
  let lossState = createInitialCareer('career-loss', 1_700_000_000_000);
  lossState = reduceCareer(lossState, closed('loss-1', 1_001n));
  lossState = reduceCareer(lossState, closed('loss-2'));
  lossState = reduceCareer(lossState, closed('loss-3'));
  assert.equal(lossState.qualification.scaleControl.qualified, false);
  assert.equal(lossState.stats.maxClosedLossBps, 1_001);
  let equityState = createInitialCareer('career-equity', 1_700_000_000_000);
  equityState = reduceCareer(equityState, closed('equity-1'));
  equityState = reduceCareer(equityState, closed('equity-2'));
  equityState = reduceCareer(equityState, closed('equity-3', 0n, 0n));
  assert.equal(equityState.qualification.scaleControl.qualified, false);
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
