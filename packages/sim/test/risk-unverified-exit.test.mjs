import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialSimState,
  createSessionOpenedEvent,
  executeSpotAction,
  makeFixtureObservation,
  placeSpotStop,
  priceX18,
  projectPlannedRisk,
  replayEvents,
  setSpotRiskPlan,
  wei,
} from '../dist/index.js';

const START = 1_700_000_000_000;
const ENTRY = 25_000_000_000_000_000n;
const STOP = 24_750_000_000_000_000n; // 1% below entry
const PLAN_LIQUIDITY = 20_000_000_000_000_000n; // 0.02 ETH
const SCALE_LIQUIDITY = 100_000_000_000_000_000n; // 0.10 ETH

function observation(id, liquidity, at = START) {
  return makeFixtureObservation({
    observationId: id,
    referencePriceX18: priceX18(ENTRY),
    usableQuoteLiquidityWei: wei(liquidity),
    observedAtMs: at,
  });
}

test('non-executable exit with a within-budget lower bound is unverified, never affirmative compliance', () => {
  const initial = createInitialSimState({ sessionId: 'risk-unverified-lower-bound', startedAtMs: START });
  let state = replayEvents([createSessionOpenedEvent(initial, START)], initial);

  const entryObs = observation('entry', PLAN_LIQUIDITY);
  const planned = setSpotRiskPlan(state, {
    planId: 'plan-unverified-lower-bound',
    observation: entryObs,
    stopPriceX18: STOP,
    riskBps: 1_000n,
    eventTimeMs: START,
  });
  assert.equal(planned.accepted, true);
  state = planned.state;

  const entry = executeSpotAction(state, {
    type: 'BUY',
    intentId: 'entry-intent',
    fillId: 'entry-fill',
    eventTimeMs: START,
    observation: entryObs,
    quoteNotionalWei: state.activeRiskPlan.plannedNotionalWei,
  });
  assert.equal(entry.accepted, true);
  state = entry.state;

  const stopped = placeSpotStop(state, {
    stopId: 'protective-stop',
    stopPriceX18: priceX18(STOP),
    observation: entryObs,
    eventTimeMs: START,
  });
  assert.equal(stopped.accepted, true);
  state = stopped.state;

  // The scale-in itself is exactly at the fill model's 50% participation
  // ceiling, so it is executable. The combined position, however, is now too
  // large to fully unwind against the same 0.10 ETH of depth.
  const scaleObs = observation('scale', SCALE_LIQUIDITY, START + 1_000);
  const scaled = executeSpotAction(state, {
    type: 'SCALE_IN',
    intentId: 'scale-intent',
    fillId: 'scale-fill',
    eventTimeMs: START + 1_000,
    observation: scaleObs,
    quoteNotionalWei: wei(50_000_000_000_000_000n),
  });
  assert.equal(scaled.accepted, true);

  const projection = projectPlannedRisk(scaled.state, scaleObs, START + 1_000);
  assert.equal(projection.exitExecutable, false);
  assert.equal(projection.status, 'WITHIN_BUDGET');
  assert.equal(projection.projectedLossWei <= projection.toleranceLimitWei, true);
  assert.equal(scaled.state.riskBudgetBreached, false);

  // A max-impact lower bound below budget cannot prove compliance because the
  // full exit is not executable. The cycle must become epistemically
  // unverified, which prevents RISK_BUDGET_RESPECTED downstream.
  assert.equal(scaled.state.riskBudgetVerified, false);
  assert.equal(
    scaled.events.filter((event) => event.type === 'RISK_EXPOSURE_UNVERIFIED').length,
    1,
  );

  // Closing later against ample depth must preserve the historical fact that
  // the cycle entered an unverified state rather than laundering it back into
  // affirmative compliance.
  const closeObs = observation('close', 1_000_000_000_000_000_000n, START + 2_000);
  const closed = executeSpotAction(scaled.state, {
    type: 'FULL_CLOSE',
    intentId: 'close-intent',
    fillId: 'close-fill',
    eventTimeMs: START + 2_000,
    observation: closeObs,
  });
  assert.equal(closed.accepted, true);
  const summary = closed.state.tradeSummaries.at(-1);
  assert.equal(summary.riskBudgetViolated, false);
  assert.equal(summary.riskBudgetVerified, false);
});