/**
 * RISK_PLAN_V0 — deterministic account-risk sizing.
 *
 * The claims under test are economic, not cosmetic: the budget derives from
 * equity, the stop distance drives the size, the size never exceeds what the
 * account can fund, invalid geometry fails closed, and the projected maximum
 * loss is the loss the ledger actually records.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SPOT_FILL_CONFIG,
  INITIAL_BANKROLL_WEI,
  RISK_BUDGET_TOLERANCE_BPS,
  RISK_PLAN_MAX_RISK_BPS,
  RISK_PLAN_MIN_STOP_DISTANCE_BPS,
  RISK_PLAN_MODEL_VERSION,
  bps,
  createInitialSimState,
  createSessionOpenedEvent,
  executeSpotAction,
  makeFixtureObservation,
  markSpot,
  placeSpotStop,
  planRiskSizedEntry,
  priceX18,
  projectActiveStopExit,
  projectPlannedRisk,
  quantityAtoms,
  replayEvents,
  setSpotRiskPlan,
  stableReplayDigest,
  wei,
} from '../dist/index.js';

const START = 1_700_000_000_000;
const ENTRY = 25_000_000_000_000_000n; // 0.025 ETH
const STOP = 23_500_000_000_000_000n; // 0.0235 ETH, 600 bps below entry
const LIQUIDITY = 10_000_000_000_000_000_000n; // 10 ETH

function observation(id, price = ENTRY, at = START, liquidity = LIQUIDITY) {
  return makeFixtureObservation({
    observationId: id,
    referencePriceX18: priceX18(price),
    usableQuoteLiquidityWei: wei(liquidity),
    observedAtMs: at,
  });
}

function opened(sessionId) {
  const initial = createInitialSimState({ sessionId, startedAtMs: START });
  return replayEvents([createSessionOpenedEvent(initial, START)], initial);
}

function plan(overrides = {}) {
  return planRiskSizedEntry({
    planId: 'plan-1',
    instrumentId: 'INK-ETH-SPOT',
    quoteAsset: 'WETH',
    equityAtPlanWei: INITIAL_BANKROLL_WEI,
    availableCapitalWei: INITIAL_BANKROLL_WEI,
    intendedEntryPriceX18: priceX18(ENTRY),
    stopPriceX18: priceX18(STOP),
    riskBps: bps(100n),
    usableQuoteLiquidityWei: wei(LIQUIDITY),
    createdAtMs: START,
    observationId: 'obs-1',
    sourceId: 'TEST_FIXTURE',
    ...overrides,
  });
}

/* ========================================================================== */
/* 1. the normal plan                                                         */
/* ========================================================================== */

test('1. a valid long plan derives its budget from equity and its size from the stop distance', () => {
  const result = plan();
  assert.equal(result.ok, true);
  // 1% of 0.5 ETH, exactly, in wei.
  assert.equal(result.plan.maxLossWei, 5_000_000_000_000_000n);
  assert.equal(result.plan.maxLossBpsOfEquity, 100n);
  assert.equal(result.plan.stopDistanceBps, 600n);
  assert.equal(result.plan.modelVersion, RISK_PLAN_MODEL_VERSION);
  assert.equal(result.plan.provenance, 'DERIVED');
  assert.equal(result.plan.plannedNotionalWei > 0n, true);
  assert.equal(result.plan.plannedQuantityAtoms > 0n, true);
  // The projection never exceeds the frozen budget.
  assert.equal(result.plan.projectedLossWei <= result.plan.maxLossWei, true);
  // And it uses the whole budget rather than leaving it on the table.
  assert.equal(result.plan.projectedLossWei, 5_000_000_000_000_000n);
});

test('a tighter stop buys more size and a wider stop buys less, at the same budget', () => {
  const tight = plan({ stopPriceX18: priceX18((ENTRY * 9_800n) / 10_000n) });
  const normal = plan();
  const wide = plan({ stopPriceX18: priceX18(ENTRY / 2n) });
  assert.equal(tight.ok && normal.ok && wide.ok, true);
  assert.equal(tight.plan.plannedNotionalWei > normal.plan.plannedNotionalWei, true);
  assert.equal(normal.plan.plannedNotionalWei > wide.plan.plannedNotionalWei, true);
  // Every one of them still risks the same budget, never more.
  for (const result of [tight, normal, wide]) {
    assert.equal(result.plan.projectedLossWei <= result.plan.maxLossWei, true);
  }
});

test('doubling account risk roughly doubles size and exactly doubles the budget', () => {
  const one = plan({ riskBps: bps(100n) });
  const two = plan({ riskBps: bps(200n) });
  assert.equal(one.ok && two.ok, true);
  assert.equal(two.plan.maxLossWei, one.plan.maxLossWei * 2n);
  assert.equal(two.plan.plannedNotionalWei > one.plan.plannedNotionalWei, true);
});

/* ========================================================================== */
/* 2 - 7. invalid geometry and pathological budgets fail closed               */
/* ========================================================================== */

test('2. a stop equal to the entry is rejected and never divides by zero', () => {
  const result = plan({ stopPriceX18: priceX18(ENTRY) });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'STOP_NOT_BELOW_ENTRY');
});

test('3. a stop above the long entry is invalid protective geometry', () => {
  const above = plan({ stopPriceX18: priceX18(ENTRY + 1n) });
  assert.equal(above.ok, false);
  assert.equal(above.code, 'STOP_NOT_BELOW_ENTRY');
  const zero = plan({ stopPriceX18: priceX18(0n) });
  assert.equal(zero.ok, false);
  assert.equal(zero.code, 'INVALID_PRICE');
});

test('4. an extremely tight stop is clamped by capital and never creates leverage', () => {
  // 15 bps of stop distance at the maximum authorized 10% account risk would
  // demand roughly 3 ETH of notional against a 0.5 ETH account.
  const result = plan({
    stopPriceX18: priceX18((ENTRY * 9_985n) / 10_000n),
    riskBps: RISK_PLAN_MAX_RISK_BPS,
    usableQuoteLiquidityWei: wei(1_000_000_000_000_000_000_000n),
  });
  assert.equal(result.ok, true);
  const funded = result.sizing.entryCostWei + result.sizing.entryFeeWei;
  assert.equal(funded <= INITIAL_BANKROLL_WEI, true);
  assert.equal(result.plan.plannedNotionalWei < INITIAL_BANKROLL_WEI, true);
  // Capital, not the budget, is what bound this plan: the realized risk is far
  // below the requested budget precisely because no leverage is available.
  assert.equal(result.plan.projectedLossWei < result.plan.maxLossWei, true);

  // Below the frozen minimum distance the calculator refuses outright.
  const tooTight = plan({ stopPriceX18: priceX18(ENTRY - ENTRY / 100_000n) });
  assert.equal(tooTight.ok, false);
  assert.equal(tooTight.code, 'STOP_DISTANCE_TOO_SMALL');
  assert.equal(RISK_PLAN_MIN_STOP_DISTANCE_BPS, 10n);
});

test('5. an extremely wide stop produces a correspondingly small position', () => {
  const result = plan({ stopPriceX18: priceX18(ENTRY / 10n) });
  assert.equal(result.ok, true);
  assert.equal(result.plan.plannedNotionalWei < 10_000_000_000_000_000n, true);
  assert.equal(result.plan.projectedLossWei <= result.plan.maxLossWei, true);
});

test('6. zero account risk authorizes no position', () => {
  const zero = plan({ riskBps: bps(0n) });
  assert.equal(zero.ok, false);
  assert.equal(zero.code, 'RISK_BUDGET_ZERO');
  // A budget that rounds to zero against a dust account is the same refusal.
  const dust = plan({ equityAtPlanWei: wei(1n), availableCapitalWei: wei(1n) });
  assert.equal(dust.ok, false);
  assert.equal(dust.code, 'RISK_BUDGET_ZERO');
});

test('7. account risk beyond the authorized V0 ceiling fails closed rather than clamping', () => {
  const atLimit = plan({ riskBps: RISK_PLAN_MAX_RISK_BPS });
  assert.equal(atLimit.ok, true);
  const overLimit = plan({ riskBps: bps(RISK_PLAN_MAX_RISK_BPS + 1n) });
  assert.equal(overLimit.ok, false);
  assert.equal(overLimit.code, 'RISK_BUDGET_ABOVE_MAX');
});

test('8. insufficient bankroll and missing depth both refuse to size a trade', () => {
  const noCapital = plan({ availableCapitalWei: wei(0n) });
  assert.equal(noCapital.ok, false);
  assert.equal(noCapital.code, 'INSUFFICIENT_CAPITAL');

  const noDepth = plan({ usableQuoteLiquidityWei: wei(0n) });
  assert.equal(noDepth.ok, false);
  assert.equal(noDepth.code, 'MISSING_LIQUIDITY');

  // Capital so small that no executable notional survives the minimum.
  const dustCapital = plan({ availableCapitalWei: wei(1_000n) });
  assert.equal(dustCapital.ok, false);
  assert.equal(dustCapital.code, 'SIZE_BELOW_MINIMUM');

  const noEquity = plan({ equityAtPlanWei: wei(0n) });
  assert.equal(noEquity.ok, false);
  assert.equal(noEquity.code, 'INVALID_EQUITY');
});

test('thin depth bounds the plan at the model participation ceiling', () => {
  const result = plan({ usableQuoteLiquidityWei: wei(1_000_000_000_000_000n) });
  assert.equal(result.ok, true);
  // 50% of 0.001 ETH of usable depth.
  assert.equal(result.plan.plannedNotionalWei <= 500_000_000_000_000n, true);
  assert.equal(result.plan.projectedLossWei < result.plan.maxLossWei, true);
});

/* ========================================================================== */
/* the projection is the ledger's own arithmetic                              */
/* ========================================================================== */

test('projected maximum loss equals the realized loss when the stop fills at its trigger', () => {
  const sized = plan();
  assert.equal(sized.ok, true);

  let state = opened('risk-exact');
  const entryObs = observation('risk-entry');
  const set = setSpotRiskPlan(state, { planId: 'plan-1', observation: entryObs, stopPriceX18: STOP, riskBps: 100n, eventTimeMs: START });
  assert.equal(set.accepted, true);
  state = set.state;
  assert.equal(state.activeRiskPlan.plannedNotionalWei, sized.plan.plannedNotionalWei);

  const entry = executeSpotAction(state, {
    type: 'BUY', intentId: 'risk-i1', fillId: 'risk-f1', eventTimeMs: START,
    observation: entryObs, quoteNotionalWei: state.activeRiskPlan.plannedNotionalWei,
  });
  assert.equal(entry.accepted, true);
  state = entry.state;

  const stop = placeSpotStop(state, { stopId: 'risk-s1', stopPriceX18: priceX18(STOP), observation: entryObs, eventTimeMs: START });
  assert.equal(stop.accepted, true);
  state = stop.state;

  // The live projection agrees with the frozen plan before anything moves.
  const projection = projectPlannedRisk(state, entryObs, START);
  assert.equal(projection.status, 'WITHIN_BUDGET');
  assert.equal(projection.projectedLossWei, sized.plan.projectedLossWei);

  // And the ledger records exactly that when the stop fills at its trigger.
  const triggered = markSpot(state, observation('risk-trigger', STOP, START + 1_000), START + 1_000);
  assert.equal(triggered.accepted, true);
  const summary = triggered.state.tradeSummaries.at(-1);
  assert.equal(summary.realizedPnlWei, -sized.plan.projectedLossWei);
  assert.equal(summary.riskPlan.planId, 'plan-1');
  assert.equal(summary.riskBudgetViolated, false);
  assert.equal(summary.firstStopPlacedAtMs, START);
});

test('the active-stop projection prices the exit at the stop, not at the current mark', () => {
  let state = opened('risk-projection-price');
  const entryObs = observation('proj-entry');
  state = executeSpotAction(state, { type: 'BUY', intentId: 'p-i', fillId: 'p-f', eventTimeMs: START, observation: entryObs, quoteNotionalWei: wei(50_000_000_000_000_000n) }).state;
  state = placeSpotStop(state, { stopId: 'p-s', stopPriceX18: priceX18(STOP), observation: entryObs, eventTimeMs: START }).state;

  // Marking far above the stop must not improve the "if stop fills" answer.
  const high = observation('proj-high', ENTRY * 2n, START + 1_000);
  const atEntry = projectActiveStopExit(state, entryObs, START);
  const atHigh = projectActiveStopExit(state, high, START + 1_000);
  assert.notEqual(atEntry, null);
  assert.equal(atHigh.stopPriceX18, STOP);
  assert.equal(atHigh.realizedWei, atEntry.realizedWei);
  assert.equal(atHigh.realizedWei < 0n, true);
});

/* ========================================================================== */
/* 9 - 12. composition with STOP_LOSS and with position changes                */
/* ========================================================================== */

function plannedPosition(sessionId, riskBps = 100n) {
  let state = opened(sessionId);
  const entryObs = observation(`${sessionId}-entry`);
  state = setSpotRiskPlan(state, { planId: `${sessionId}-plan`, observation: entryObs, stopPriceX18: STOP, riskBps, eventTimeMs: START }).state;
  state = executeSpotAction(state, {
    type: 'BUY', intentId: `${sessionId}-i`, fillId: `${sessionId}-f`, eventTimeMs: START,
    observation: entryObs, quoteNotionalWei: state.activeRiskPlan.plannedNotionalWei,
  }).state;
  state = placeSpotStop(state, { stopId: `${sessionId}-s`, stopPriceX18: priceX18(STOP), observation: entryObs, eventTimeMs: START }).state;
  return { state, entryObs };
}

test('9. tightening a long stop lowers projected loss and is never counted as widening', () => {
  const { state, entryObs } = plannedPosition('tighten');
  const before = projectPlannedRisk(state, entryObs, START).projectedLossWei;

  const tighter = placeSpotStop(state, { stopId: 'tighten-s2', stopPriceX18: priceX18((ENTRY * 9_900n) / 10_000n), observation: observation('tighten-obs', ENTRY, START + 1_000), eventTimeMs: START + 1_000 });
  assert.equal(tighter.accepted, true);
  assert.equal(tighter.events[0].type, 'STOP_REPLACED');
  assert.equal(tighter.events[0].widened, false);

  const after = projectPlannedRisk(tighter.state, observation('tighten-obs', ENTRY, START + 1_000), START + 1_000).projectedLossWei;
  assert.equal(after < before, true);
  assert.equal(tighter.state.riskBudgetBreached, false);
});

test('10. widening a long stop past the budget plus tolerance records a breach', () => {
  const { state, entryObs } = plannedPosition('widen');
  assert.equal(state.riskBudgetBreached, false);

  // Far below the planned stop: projected loss must blow through budget.
  const wideObs = observation('widen-obs', ENTRY, START + 1_000);
  const wider = placeSpotStop(state, { stopId: 'widen-s2', stopPriceX18: priceX18(ENTRY / 2n), observation: wideObs, eventTimeMs: START + 1_000 });
  assert.equal(wider.accepted, true);
  assert.equal(wider.events[0].widened, true);
  assert.equal(wider.state.riskBudgetBreached, true);

  const breach = wider.events.find((event) => event.type === 'RISK_BUDGET_BREACHED');
  assert.notEqual(breach, undefined);
  assert.equal(breach.projectedLossWei > breach.toleranceLimitWei, true);

  const projection = projectPlannedRisk(wider.state, wideObs, START + 1_000);
  assert.equal(projection.status, 'OVER_BUDGET');
  assert.equal(projection.overBudgetWei > 0n, true);

  // Tightening back does not erase the recorded behaviour.
  const back = placeSpotStop(wider.state, { stopId: 'widen-s3', stopPriceX18: priceX18(STOP), observation: observation('widen-back', ENTRY, START + 2_000), eventTimeMs: START + 2_000 });
  assert.equal(back.state.riskBudgetBreached, true);

  const closed = markSpot(back.state, observation('widen-close', STOP, START + 3_000), START + 3_000);
  assert.equal(closed.state.tradeSummaries.at(-1).riskBudgetViolated, true);
  assert.equal(closed.state.tradeSummaries.at(-1).stopWidened, true);
});

test('a stop widened only inside the tolerance is not a violation', () => {
  const { state } = plannedPosition('tolerance');
  const budget = state.activeRiskPlan.maxLossWei;
  const obs = observation('tolerance-obs', ENTRY, START + 1_000);
  // Nudge the stop down by 1 bps of price: well inside the 5% budget tolerance.
  const nudged = placeSpotStop(state, { stopId: 'tolerance-s2', stopPriceX18: priceX18((STOP * 9_999n) / 10_000n), observation: obs, eventTimeMs: START + 1_000 });
  assert.equal(nudged.accepted, true);
  assert.equal(nudged.events[0].widened, true);
  const projection = projectPlannedRisk(nudged.state, obs, START + 1_000);
  assert.equal(projection.projectedLossWei > budget, true);
  assert.equal(projection.projectedLossWei <= projection.toleranceLimitWei, true);
  assert.equal(projection.status, 'WITHIN_BUDGET');
  assert.equal(nudged.state.riskBudgetBreached, false);
  assert.equal(RISK_BUDGET_TOLERANCE_BPS, 500n);
});

test('11. scaling in past the plan records a risk-budget violation', () => {
  const { state } = plannedPosition('scale');
  const obs = observation('scale-obs', ENTRY, START + 1_000);
  const scaled = executeSpotAction(state, {
    type: 'SCALE_IN', intentId: 'scale-i2', fillId: 'scale-f2', eventTimeMs: START + 1_000,
    observation: obs, quoteNotionalWei: wei(100_000_000_000_000_000n),
  });
  assert.equal(scaled.accepted, true);
  assert.equal(scaled.state.riskBudgetBreached, true);
  assert.equal(scaled.events.some((event) => event.type === 'RISK_BUDGET_BREACHED'), true);
});

test('12. a partial exit reduces projected risk back under budget', () => {
  const { state } = plannedPosition('reduce');
  const obs = observation('reduce-obs', ENTRY, START + 1_000);
  const scaled = executeSpotAction(state, {
    type: 'SCALE_IN', intentId: 'reduce-i2', fillId: 'reduce-f2', eventTimeMs: START + 1_000,
    observation: obs, quoteNotionalWei: wei(100_000_000_000_000_000n),
  });
  const overBudget = projectPlannedRisk(scaled.state, obs, START + 1_000).projectedLossWei;

  const reduced = executeSpotAction(scaled.state, {
    type: 'PARTIAL_CLOSE', intentId: 'reduce-i3', fillId: 'reduce-f3', eventTimeMs: START + 2_000,
    observation: observation('reduce-obs-2', ENTRY, START + 2_000),
    quantityAtoms: quantityAtoms((scaled.state.position.openQuantityAtoms * 3n) / 4n),
  });
  assert.equal(reduced.accepted, true);
  const after = projectPlannedRisk(reduced.state, observation('reduce-obs-2', ENTRY, START + 2_000), START + 2_000);
  assert.equal(after.projectedLossWei < overBudget, true);
  assert.equal(after.status, 'WITHIN_BUDGET');
  // The breach already happened; reducing exposure does not un-record it.
  assert.equal(after.breached, true);
});

test('an open position with no active stop reports unbounded risk rather than a number', () => {
  let state = opened('unprotected');
  const obs = observation('unprotected-obs');
  state = setSpotRiskPlan(state, { planId: 'unprotected-plan', observation: obs, stopPriceX18: STOP, riskBps: 100n, eventTimeMs: START }).state;
  assert.equal(projectPlannedRisk(state, obs, START).status, 'PLANNED_FLAT');
  state = executeSpotAction(state, { type: 'BUY', intentId: 'u-i', fillId: 'u-f', eventTimeMs: START, observation: obs, quoteNotionalWei: state.activeRiskPlan.plannedNotionalWei }).state;
  const projection = projectPlannedRisk(state, obs, START);
  assert.equal(projection.status, 'UNPROTECTED');
  assert.equal(projection.projectedLossWei, 0n);
  assert.equal(state.riskBudgetBreached, false);
});

/* ========================================================================== */
/* ledger discipline                                                          */
/* ========================================================================== */

test('a risk plan cannot be retro-fitted onto an already open position', () => {
  let state = opened('retrofit');
  const obs = observation('retrofit-obs');
  state = executeSpotAction(state, { type: 'BUY', intentId: 'r-i', fillId: 'r-f', eventTimeMs: START, observation: obs, quoteNotionalWei: wei(50_000_000_000_000_000n) }).state;
  const refused = setSpotRiskPlan(state, { planId: 'retrofit-plan', observation: obs, stopPriceX18: STOP, riskBps: 100n, eventTimeMs: START });
  assert.equal(refused.accepted, false);
  assert.equal(refused.code, 'RISK_PLAN_POSITION_OPEN');
  assert.equal(refused.state, state);
});

test('an unusable observation refuses to produce a plan', () => {
  const state = opened('evidence');
  for (const provenance of ['SYNTHETIC', 'STALE', 'UNAVAILABLE']) {
    const refused = setSpotRiskPlan(state, {
      planId: `evidence-${provenance}`,
      observation: { ...observation('evidence-obs'), provenance },
      stopPriceX18: STOP,
      riskBps: 100n,
      eventTimeMs: START,
    });
    assert.equal(refused.accepted, false);
  }
  const stale = setSpotRiskPlan(state, { planId: 'evidence-old', observation: observation('evidence-old', ENTRY, START), stopPriceX18: STOP, riskBps: 100n, eventTimeMs: START + 60_000 });
  assert.equal(stale.accepted, false);
  assert.equal(stale.code, 'MODEL_INPUT_UNAVAILABLE');
});

test('the plan clears when the cycle closes and does not leak into the next trade', () => {
  const { state, entryObs } = plannedPosition('clear');
  const closed = executeSpotAction(state, {
    type: 'FULL_CLOSE', intentId: 'clear-i2', fillId: 'clear-f2', eventTimeMs: START + 1_000,
    observation: observation('clear-obs', ENTRY, START + 1_000),
  });
  assert.equal(closed.accepted, true);
  assert.equal(closed.state.activeRiskPlan, null);
  assert.equal(closed.state.riskBudgetBreached, false);
  // But the closed trade keeps its plan, frozen.
  const summary = closed.state.tradeSummaries.at(-1);
  assert.equal(summary.riskPlan.planId, 'clear-plan');
  assert.equal(summary.riskPlan.maxLossWei, 5_000_000_000_000_000n);
  assert.equal(entryObs.observationId, 'clear-entry');
});

/* ========================================================================== */
/* 13 + 15. determinism and replay                                            */
/* ========================================================================== */

test('13. identical inputs produce identical plans, in any order, any number of times', () => {
  const first = plan();
  const second = plan();
  assert.deepEqual(first, second);
  // Deterministic across independent evaluation order too.
  const varied = [200n, 50n, 100n, 200n].map((risk) => plan({ riskBps: bps(risk) }));
  assert.deepEqual(varied[0], varied[3]);
});

test('15. replaying a risk-planned session reproduces the plan and the breach exactly', () => {
  const { state } = plannedPosition('replay');
  const wideObs = observation('replay-wide', ENTRY, START + 1_000);
  const widened = placeSpotStop(state, { stopId: 'replay-s2', stopPriceX18: priceX18(ENTRY / 2n), observation: wideObs, eventTimeMs: START + 1_000 });
  const closed = markSpot(widened.state, observation('replay-close', ENTRY / 2n, START + 2_000), START + 2_000);

  const replayed = replayEvents(closed.state.events, createInitialSimState({ sessionId: closed.state.sessionId, startedAtMs: START }));
  assert.equal(stableReplayDigest(replayed), stableReplayDigest(closed.state));
  assert.deepEqual(replayed.tradeSummaries.at(-1), closed.state.tradeSummaries.at(-1));
  assert.equal(replayed.tradeSummaries.at(-1).riskBudgetViolated, true);
  assert.equal(replayed.tradeSummaries.at(-1).riskPlan.maxLossWei, 5_000_000_000_000_000n);
  // Replay never re-derives a plan; it restores the one that was recorded.
  assert.equal(replayed.activeRiskPlan, null);
});

test('a risk-planned session mid-position replays to the same active plan', () => {
  const { state } = plannedPosition('replay-open');
  const replayed = replayEvents(state.events, createInitialSimState({ sessionId: state.sessionId, startedAtMs: START }));
  assert.deepEqual(replayed.activeRiskPlan, state.activeRiskPlan);
  assert.equal(replayed.riskBudgetBreached, state.riskBudgetBreached);
  assert.equal(stableReplayDigest(replayed), stableReplayDigest(state));
});

test('a self-inconsistent risk plan is refused by the ledger', () => {
  const { state } = plannedPosition('tamper');
  const planEvent = state.events.find((event) => event.type === 'RISK_PLAN_SET');
  const fresh = opened('tamper-2');
  const tampered = {
    ...planEvent,
    sessionId: 'tamper-2',
    sequence: fresh.lastSequence + 1,
    // Claim a projected loss beyond the plan's own budget.
    plan: { ...planEvent.plan, projectedLossWei: wei(planEvent.plan.maxLossWei * 2n) },
  };
  assert.throws(() => replayEvents([tampered], fresh), (error) => error.code === 'RISK_PLAN_INVALID');
});

test('16. STOP_LOSS behaviour is unchanged for an unplanned trade', () => {
  let state = opened('no-plan');
  const obs = observation('no-plan-obs');
  state = executeSpotAction(state, { type: 'BUY', intentId: 'np-i', fillId: 'np-f', eventTimeMs: START, observation: obs, quoteNotionalWei: wei(50_000_000_000_000_000n) }).state;
  state = placeSpotStop(state, { stopId: 'np-s', stopPriceX18: priceX18(STOP), observation: obs, eventTimeMs: START }).state;
  assert.equal(state.activeRiskPlan, null);
  const triggered = markSpot(state, observation('np-trigger', STOP - 1n, START + 1_000), START + 1_000);
  const summary = triggered.state.tradeSummaries.at(-1);
  assert.equal(summary.exitReason, 'STOP');
  assert.equal(summary.stopUsed, true);
  assert.equal(summary.riskPlan, null);
  assert.equal(summary.riskBudgetViolated, false);
  // No plan means no breach event can ever be emitted.
  assert.equal(triggered.events.some((event) => event.type === 'RISK_BUDGET_BREACHED'), false);
  assert.equal(DEFAULT_SPOT_FILL_CONFIG.feeBps, 30n);
});
