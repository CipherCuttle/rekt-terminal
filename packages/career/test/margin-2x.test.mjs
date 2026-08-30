import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialCareer, reduceCareer } from '../dist/index.js';

const START = 1_700_000_000_000;

function unlockPrerequisites(state) {
  for (const [index, skillId] of ['SCALE_CONTROL', 'STOP_LOSS', 'RISK_SIZING'].entries()) {
    state = reduceCareer(state, { type: 'SKILL_UNLOCKED', eventId: `skill-${index}`, skillId });
  }
  return state;
}

function summary(id, overrides = {}) {
  return {
    tradeId: id,
    sessionId: 'margin-career',
    mode: 'SPOT',
    realizedPnlWei: 1n,
    accountEquityAtCloseWei: 500_000_000_000_000_000n,
    lossBpsOfThenCurrentEquity: 0n,
    accountEquityAtOpenWei: 500_000_000_000_000_000n,
    maxDrawdownBpsAtClose: 500n,
    exitReason: 'MANUAL',
    stopUsed: true,
    partialExitUsed: false,
    liquidated: false,
    openedAtMs: START,
    firstStopPlacedAtMs: START,
    stopWidened: false,
    riskPlanned: false,
    riskBudgetViolated: false,
    riskBudgetVerified: true,
    evidenceProvenance: 'DERIVED',
    ...overrides,
  };
}

function close(state, id, overrides = {}) {
  return reduceCareer(state, { type: 'TRADE_CLOSED', eventId: `close-${id}`, summary: summary(id, overrides) });
}

function partial(state, id) {
  return reduceCareer(state, { type: 'PARTIAL_EXIT_USED', eventId: `partial-${id}`, sourceReceiptId: `fill-${id}`, evidenceProvenance: 'DERIVED' });
}

function eightTradesWithLastThree(state, outcomes = ['RESPECTED', 'RESPECTED', 'RESPECTED'], drawdownBps = 500n) {
  for (let i = 1; i <= 5; i += 1) state = close(state, `plain-${i}`, { maxDrawdownBpsAtClose: drawdownBps });
  for (let i = 0; i < 3; i += 1) {
    const outcome = outcomes[i];
    state = close(state, `risk-${i + 1}`, {
      riskPlanned: true,
      riskBudgetViolated: outcome === 'VIOLATED',
      riskBudgetVerified: outcome !== 'UNVERIFIED',
      maxDrawdownBpsAtClose: drawdownBps,
    });
  }
  return state;
}

test('MARGIN_2X requires the full process gate and grants only PERP_LONG_2X', () => {
  let state = unlockPrerequisites(createInitialCareer('margin-career', START));
  state = partial(state, '1');
  state = partial(state, '2');
  state = eightTradesWithLastThree(state);

  assert.equal(state.qualification.margin2x.qualified, true);
  assert.equal(state.unlockedSkills.includes('MARGIN_2X'), true);
  assert.equal(state.unlockedCapabilities.includes('PERP_LONG_2X'), true);
  assert.equal(state.unlockedCapabilities.includes('PERP_SHORT_2X'), false);
  assert.equal(state.qualification.margin2x.closedSpotTrades, 8);
  assert.equal(state.qualification.margin2x.riskPlannedTrades, 3);
  assert.equal(state.qualification.margin2x.partialExitsUsed, 2);
  assert.deepEqual(state.qualification.margin2x.recentRiskPlannedOutcomes.map((entry) => entry.outcome), ['RESPECTED', 'RESPECTED', 'RESPECTED']);
  assert.equal(state.qualification.margin2x.maxAccountDrawdownBps, 500);
  assert.equal(state.qualification.margin2x.accountResetsUsed, 0);
});

test('a violation in the most recent three risk-planned trades blocks leverage', () => {
  let state = unlockPrerequisites(createInitialCareer('recent-violation', START));
  state = partial(partial(state, '1'), '2');
  state = eightTradesWithLastThree(state, ['RESPECTED', 'VIOLATED', 'RESPECTED']);
  assert.equal(state.unlockedSkills.includes('MARGIN_2X'), false);
  assert.equal(state.qualification.margin2x.qualified, false);
});

test('an old violation may age out only after three newer verified disciplined risk plans', () => {
  let state = unlockPrerequisites(createInitialCareer('aged-violation', START));
  state = partial(partial(state, '1'), '2');
  for (let i = 1; i <= 4; i += 1) state = close(state, `plain-${i}`);
  state = close(state, 'risk-old-bad', { riskPlanned: true, riskBudgetViolated: true, riskBudgetVerified: true });
  for (let i = 1; i <= 3; i += 1) state = close(state, `risk-clean-${i}`, { riskPlanned: true, riskBudgetVerified: true });

  assert.deepEqual(state.stats.recentRiskPlannedOutcomes.map((entry) => entry.outcome), ['RESPECTED', 'RESPECTED', 'RESPECTED']);
  assert.equal(state.unlockedSkills.includes('MARGIN_2X'), true);
});

test('UNVERIFIED is not compliance and blocks MARGIN_2X', () => {
  let state = unlockPrerequisites(createInitialCareer('unverified', START));
  state = partial(partial(state, '1'), '2');
  state = eightTradesWithLastThree(state, ['RESPECTED', 'UNVERIFIED', 'RESPECTED']);
  assert.equal(state.stats.recentRiskPlannedOutcomes[1].outcome, 'UNVERIFIED');
  assert.equal(state.unlockedSkills.includes('MARGIN_2X'), false);
});

test('Career max account drawdown above 20% blocks leverage even when recent risk discipline is clean', () => {
  let state = unlockPrerequisites(createInitialCareer('drawdown', START));
  state = partial(partial(state, '1'), '2');
  state = eightTradesWithLastThree(state, ['RESPECTED', 'RESPECTED', 'RESPECTED'], 2_001n);
  assert.equal(state.qualification.margin2x.maxAccountDrawdownBps, 2_001);
  assert.equal(state.unlockedSkills.includes('MARGIN_2X'), false);
});

test('a bankroll reset permanently blocks the MARGIN_2X authorization gate for that Career', () => {
  let state = unlockPrerequisites(createInitialCareer('reset', START));
  state = reduceCareer(state, { type: 'ACCOUNT_RESET_USED', eventId: 'reset-1' });
  state = partial(partial(state, '1'), '2');
  state = eightTradesWithLastThree(state);
  assert.equal(state.stats.accountResetsUsed, 1);
  assert.equal(state.unlockedSkills.includes('MARGIN_2X'), false);
});

test('legacy unknown reset history is fail-closed, never treated as zero', () => {
  let state = unlockPrerequisites(createInitialCareer('legacy-reset', START));
  state = { ...state, stats: { ...state.stats, accountResetsUsed: null }, qualification: { ...state.qualification, margin2x: { ...state.qualification.margin2x, accountResetsUsed: null } } };
  state = partial(partial(state, '1'), '2');
  state = eightTradesWithLastThree(state);
  assert.equal(state.qualification.margin2x.accountResetsUsed, null);
  assert.equal(state.unlockedSkills.includes('MARGIN_2X'), false);
});
