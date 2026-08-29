/**
 * RISK_SIZING_V0 Career qualification.
 *
 * The gate is process, not outcome: three trades whose stop was decided at
 * entry and never widened, plus one partial exit. Profit is irrelevant, and no
 * amount of clicking, planning, or notional substitutes for it.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAREER_SAVE_VERSION,
  RISK_SIZING_TRADE_TARGET,
  STOP_PLAN_WINDOW_MS,
  createCareerSave,
  createInitialCareer,
  isStopPlannedTrade,
  migrateCareerSave,
  reduceCareer,
} from '../dist/index.js';

const START = 1_700_000_000_000;

function closed(id, overrides = {}) {
  return {
    type: 'TRADE_CLOSED',
    eventId: `${id}:closed`,
    sourceReceiptId: `${id}:sim-receipt`,
    summary: {
      tradeId: id,
      sessionId: 'risk-session',
      mode: 'SPOT',
      realizedPnlWei: 1n,
      accountEquityAtCloseWei: 500_000_000_000_000_000n,
      lossBpsOfThenCurrentEquity: 0n,
      accountEquityAtOpenWei: 500_000_000_000_000_000n,
      exitReason: 'MANUAL',
      stopUsed: false,
      partialExitUsed: false,
      liquidated: false,
      openedAtMs: START,
      firstStopPlacedAtMs: null,
      stopWidened: false,
      riskPlanned: false,
      riskBudgetViolated: false,
      riskBudgetVerified: true,
      evidenceProvenance: 'DERIVED',
      ...overrides,
    },
  };
}

/** A trade whose stop was placed promptly after entry and never widened. */
function planned(id, overrides = {}) {
  return closed(id, { firstStopPlacedAtMs: START + 1_000, ...overrides });
}

/** Reach STOP_LOSS the ordinary way: five trades, one controlled loss cut. */
function stopLossUnlocked(careerId) {
  let state = createInitialCareer(careerId, START);
  for (let i = 1; i <= 5; i += 1) {
    state = reduceCareer(state, closed(`${careerId}-pre-${i}`, i === 5 ? { lossBpsOfThenCurrentEquity: 499n, realizedPnlWei: -1n } : {}));
  }
  assert.equal(state.unlockedSkills.includes('STOP_LOSS'), true);
  return state;
}

function partialExit(id) {
  return { type: 'PARTIAL_EXIT_USED', eventId: `${id}:partial`, sourceReceiptId: `${id}:receipt`, evidenceProvenance: 'DERIVED' };
}

test('RISK_SIZING requires STOP_LOSS, three planned-stop trades, and a partial exit', () => {
  let state = stopLossUnlocked('risk-gate');
  assert.equal(state.unlockedSkills.includes('RISK_SIZING'), false);

  for (let i = 1; i <= RISK_SIZING_TRADE_TARGET; i += 1) state = reduceCareer(state, planned(`risk-gate-${i}`));
  assert.equal(state.stats.stopPlannedTrades, 3);
  // Three planned trades alone are not enough: the partial exit is still owed.
  assert.equal(state.unlockedSkills.includes('RISK_SIZING'), false);
  assert.equal(state.objective.text, 'NEXT // Use a partial exit.');

  state = reduceCareer(state, partialExit('risk-gate'));
  assert.equal(state.unlockedSkills.includes('RISK_SIZING'), true);
  assert.deepEqual(
    state.unlockedCapabilities.filter((capability) => capability.startsWith('CUSTOM') || capability.startsWith('RISK')),
    ['CUSTOM_POSITION_SIZE', 'RISK_PERCENT_SIZING'],
  );
  assert.equal(state.qualification.riskSizing.qualified, true);
  assert.equal(state.receipts.RISK_SIZING_AUTHORIZED, 1);
  assert.equal(state.objective.kind, 'RISK_SIZING_UNLOCKED');
});

test('the partial exit may come first; the gate spans both kinds of fact', () => {
  let state = stopLossUnlocked('risk-order');
  state = reduceCareer(state, partialExit('risk-order'));
  assert.equal(state.unlockedSkills.includes('RISK_SIZING'), false);
  for (let i = 1; i <= 3; i += 1) state = reduceCareer(state, planned(`risk-order-${i}`));
  assert.equal(state.unlockedSkills.includes('RISK_SIZING'), true);
});

test('a widened stop disqualifies the trade no matter how promptly it was placed', () => {
  let state = stopLossUnlocked('risk-widen');
  state = reduceCareer(state, partialExit('risk-widen'));
  for (let i = 1; i <= 5; i += 1) state = reduceCareer(state, planned(`risk-widen-${i}`, { stopWidened: true }));
  assert.equal(state.stats.stopPlannedTrades, 0);
  assert.equal(state.unlockedSkills.includes('RISK_SIZING'), false);
});

test('a stop placed after the frozen window does not count, and the window is event time', () => {
  let state = stopLossUnlocked('risk-window');
  state = reduceCareer(state, partialExit('risk-window'));
  // Exactly at the boundary counts; one millisecond past it does not.
  state = reduceCareer(state, planned('risk-window-1', { firstStopPlacedAtMs: START + STOP_PLAN_WINDOW_MS }));
  state = reduceCareer(state, planned('risk-window-2', { firstStopPlacedAtMs: START + STOP_PLAN_WINDOW_MS + 1 }));
  state = reduceCareer(state, planned('risk-window-3', { firstStopPlacedAtMs: null }));
  assert.equal(state.stats.stopPlannedTrades, 1);
  assert.equal(state.unlockedSkills.includes('RISK_SIZING'), false);

  // The window is measured from the cycle's own opening fill, not from a clock.
  assert.equal(isStopPlannedTrade({ openedAtMs: 9_000_000, firstStopPlacedAtMs: 9_000_500, stopWidened: false }), true);
  assert.equal(isStopPlannedTrade({ openedAtMs: 0, firstStopPlacedAtMs: STOP_PLAN_WINDOW_MS + 1, stopWidened: false }), false);
});

test('a losing but disciplined trade qualifies exactly as readily as a winning one', () => {
  let state = stopLossUnlocked('risk-losing');
  state = reduceCareer(state, partialExit('risk-losing'));
  for (let i = 1; i <= 3; i += 1) {
    state = reduceCareer(state, planned(`risk-losing-${i}`, { realizedPnlWei: -400_000_000_000_000n, lossBpsOfThenCurrentEquity: 80n, exitReason: 'STOP', stopUsed: true }));
  }
  assert.equal(state.unlockedSkills.includes('RISK_SIZING'), true);
});

test('synthetic evidence advances no risk statistic and no unlock', () => {
  let state = stopLossUnlocked('risk-synthetic');
  state = reduceCareer(state, { type: 'PARTIAL_EXIT_USED', eventId: 'synthetic:partial', sourceReceiptId: 'r', evidenceProvenance: 'SYNTHETIC' });
  for (let i = 1; i <= 5; i += 1) state = reduceCareer(state, planned(`risk-synthetic-${i}`, { evidenceProvenance: 'SYNTHETIC' }));
  assert.equal(state.stats.stopPlannedTrades, 0);
  assert.equal(state.stats.partialExitsUsed, 0);
  assert.equal(state.unlockedSkills.includes('RISK_SIZING'), false);

  state = reduceCareer(state, { type: 'RISK_PLAN_CREATED', eventId: 'synthetic:plan', sourceReceiptId: 'r', planId: 'p', evidenceProvenance: 'SYNTHETIC' });
  assert.equal(state.stats.riskPlansCreated, 0);
});

test('risk-plan and budget events are recorded as facts and grant no progression', () => {
  let state = stopLossUnlocked('risk-facts');
  const before = state.unlockedSkills.slice();

  for (let i = 0; i < 200; i += 1) {
    state = reduceCareer(state, { type: 'RISK_PLAN_CREATED', eventId: `spam-plan-${i}`, sourceReceiptId: `r-${i}`, planId: `p-${i}`, evidenceProvenance: 'DERIVED' });
    state = reduceCareer(state, { type: 'RISK_BUDGET_RESPECTED', eventId: `spam-ok-${i}`, sourceReceiptId: `r-${i}`, tradeId: `t-${i}`, evidenceProvenance: 'DERIVED' });
  }
  assert.equal(state.stats.riskPlansCreated, 200);
  assert.equal(state.stats.riskBudgetsRespected, 200);
  // Two hundred plans and two hundred compliant budgets unlock nothing: the
  // gate is closed trades with honoured stops, plus a partial exit.
  assert.deepEqual(state.unlockedSkills, before);
  assert.equal(state.stats.stopPlannedTrades, 0);

  state = reduceCareer(state, { type: 'RISK_BUDGET_VIOLATED', eventId: 'violation-1', sourceReceiptId: 'r', tradeId: 't', evidenceProvenance: 'DERIVED' });
  assert.equal(state.stats.riskBudgetViolations, 1);
});

test('duplicate risk events are idempotent', () => {
  let state = stopLossUnlocked('risk-dupes');
  const event = { type: 'RISK_PLAN_CREATED', eventId: 'once', sourceReceiptId: 'r', planId: 'p', evidenceProvenance: 'DERIVED' };
  state = reduceCareer(state, event);
  state = reduceCareer(state, event);
  assert.equal(state.stats.riskPlansCreated, 1);

  const trade = planned('dupe-trade');
  state = reduceCareer(state, trade);
  state = reduceCareer(state, trade);
  assert.equal(state.stats.stopPlannedTrades, 1);
});

test('RISK_SIZING stays unlocked after later undisciplined trades', () => {
  let state = stopLossUnlocked('risk-sticky');
  state = reduceCareer(state, partialExit('risk-sticky'));
  for (let i = 1; i <= 3; i += 1) state = reduceCareer(state, planned(`risk-sticky-${i}`));
  assert.equal(state.unlockedSkills.includes('RISK_SIZING'), true);
  state = reduceCareer(state, closed('risk-sticky-bad', { stopWidened: true, riskPlanned: true, riskBudgetViolated: true }));
  assert.equal(state.unlockedSkills.includes('RISK_SIZING'), true);
  assert.equal(state.qualification.riskSizing.qualified, true);
});

test('a v2 save migrates to v3 without back-crediting behaviour it never recorded', () => {
  let state = stopLossUnlocked('risk-migrate');
  state = reduceCareer(state, partialExit('risk-migrate'));
  for (let i = 1; i <= 3; i += 1) state = reduceCareer(state, planned(`risk-migrate-${i}`));
  assert.equal(state.unlockedSkills.includes('RISK_SIZING'), true);

  // Reconstruct what a pre-RISK_SIZING v2 save looked like.
  const v2State = structuredClone(state);
  v2State.saveVersion = 2;
  delete v2State.stats.stopPlannedTrades;
  delete v2State.stats.riskPlannedTrades;
  delete v2State.stats.riskPlansCreated;
  delete v2State.stats.riskBudgetsRespected;
  delete v2State.stats.riskBudgetViolations;
  delete v2State.qualification.riskSizing;

  const migrated = migrateCareerSave({ kind: 'REKT_INK_CAREER_SAVE', saveVersion: 2, state: v2State });
  assert.notEqual(migrated, null);
  assert.equal(migrated.saveVersion, CAREER_SAVE_VERSION);
  assert.equal(migrated.state.stats.stopPlannedTrades, 0);
  assert.equal(migrated.state.stats.riskPlansCreated, 0);
  assert.equal(migrated.state.qualification.riskSizing.qualified, false);
  // The partial exit is a fact the old save did record, so it carries forward.
  assert.equal(migrated.state.qualification.riskSizing.partialExitsUsed, 1);
  // Skills already earned are never revoked by a migration.
  assert.equal(migrated.state.unlockedSkills.includes('RISK_SIZING'), true);

  // v1 saves migrate all the way through the chain.
  const v1 = migrateCareerSave({ kind: 'REKT_INK_CAREER_SAVE', saveVersion: 1, state: v2State });
  assert.equal(v1.saveVersion, CAREER_SAVE_VERSION);
  assert.equal(v1.state.stats.stopPlannedTrades, 0);
  assert.equal(v1.state.qualification.stopLoss.qualified, false);
});

test('a v3 save round-trips unchanged', () => {
  let state = stopLossUnlocked('risk-roundtrip');
  state = reduceCareer(state, partialExit('risk-roundtrip'));
  for (let i = 1; i <= 3; i += 1) state = reduceCareer(state, planned(`risk-roundtrip-${i}`));
  const save = createCareerSave(state);
  assert.equal(save.saveVersion, 3);
  const restored = migrateCareerSave(save);
  assert.deepEqual(restored.state, state);
  assert.equal(migrateCareerSave({ ...save, saveVersion: 99 }), null);
});

test('a migrated save recomputes its objective instead of showing the saved line', () => {
  let state = stopLossUnlocked('risk-objective');
  const stale = createCareerSave(state);
  stale.state.objective = { id: 'stale', kind: 'CLOSE_SPOT', text: 'NEXT // stale copy from an older save.', progress: 0, target: 1 };
  const migrated = migrateCareerSave({ ...stale, saveVersion: 2 });
  assert.notEqual(migrated.state.objective.text, 'NEXT // stale copy from an older save.');
  assert.equal(migrated.state.objective.kind, 'RISK_SIZING_UNLOCKED');

  // A same-version save is passed through untouched, objective included.
  const current = createCareerSave(state);
  assert.deepEqual(migrateCareerSave(current).state.objective, current.state.objective);
});
