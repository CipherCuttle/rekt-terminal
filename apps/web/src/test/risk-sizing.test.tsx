/**
 * RISK_SIZING_V0 — practice store composition and terminal binding.
 *
 * The domain arithmetic is proved in `packages/sim`; what is proved here is the
 * wiring: Career gates disclosure, one user decision produces the plan/entry/stop
 * triple in order, the risk facts Career consumes come from recorded simulator
 * summaries, and reload does not change planned risk.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  DEFAULT_SPOT_FILL_CONFIG,
  RISK_PLAN_MODEL_VERSION,
  createInitialSimState,
  createSessionOpenedEvent,
  executeSpotAction,
  makeFixtureObservation,
  placeSpotStop,
  priceX18,
  projectPlannedRisk,
  replayEvents,
  setSpotRiskPlan,
  stableReplayDigest,
  wei,
  type SimState,
} from '@rekt-ink/sim';
import { createInitialCareer, reduceCareer, type CareerState } from '@rekt-ink/career';
import { PracticeSessionStore } from '../practice/store';
import { createMemoryPracticeStorage } from '../practice/persistence';
import { priceX18FromDecimalString, type PracticeQuote } from '../practice/quote';
import { TradeTicket } from '../terminal/TradeTicket';

const START = 1_800_000_000_000;
const ETH_USD = 3284.15;
const WETH = '0x4200000000000000000000000000000000000006';

function makeQuote(overrides: Partial<PracticeQuote> = {}): PracticeQuote {
  const priceEth = overrides.priceEth ?? 0.025;
  return {
    instrumentId: 'INK:0xpair',
    symbol: 'REKT',
    name: 'REKT INDEX',
    venue: 'VNL-DX01',
    pairAddress: '0xpair',
    tokenAddress: '0xtoken',
    quoteAsset: 'WETH',
    quoteTokenAddress: WETH,
    quoteIdentityResolved: true,
    priceEth,
    priceUsd: priceEth * ETH_USD,
    liquidityUsd: 500_000,
    observedAtMs: START,
    sourceId: 'TEST_FIXTURE',
    provenance: 'DERIVED',
    sequence: 1,
    ...overrides,
  };
}

interface Harness {
  store: PracticeSessionStore;
  advance(ms: number): void;
  refresh(priceEth?: number): void;
  price(): number;
}

function harness(storage = createMemoryPracticeStorage()): Harness {
  let now = START;
  let sequence = 1;
  let priceEth = 0.025;
  let quote: PracticeQuote | null = makeQuote();
  const store = new PracticeSessionStore({
    sessionId: 'risk-session',
    now: () => now,
    storage,
    getQuote: () => quote,
    persistDebounceMs: 5,
  });
  return {
    store,
    advance: (ms) => {
      now += ms;
    },
    refresh: (next) => {
      sequence += 1;
      if (next !== undefined) priceEth = next;
      quote = makeQuote({ observedAtMs: now, sequence, priceEth });
    },
    price: () => priceEth,
  };
}

function roundTrip(h: Harness): void {
  h.advance(1_000);
  h.refresh();
  expect(h.store.submit({ kind: 'BUY_FIXED' }).accepted).toBe(true);
  h.advance(1_000);
  h.refresh();
  expect(h.store.submit({ kind: 'SELL_ALL' }).accepted).toBe(true);
}

/** A trade that places its stop immediately after entry and never widens it. */
function protectedRoundTrip(h: Harness, options: { partialExit?: boolean } = {}): void {
  h.advance(1_000);
  h.refresh();
  expect(h.store.submit({ kind: 'BUY_FIXED' }).accepted).toBe(true);
  h.advance(1_000);
  h.refresh();
  // 6% below the 0.025 reference.
  expect(h.store.submit({ kind: 'PLACE_STOP', stopPriceX18: priceX18(23_500_000_000_000_000n) }).accepted).toBe(true);
  if (options.partialExit) {
    h.advance(1_000);
    h.refresh();
    expect(h.store.submit({ kind: 'PARTIAL_CLOSE', percent: 50 }).accepted).toBe(true);
  }
  h.advance(1_000);
  h.refresh();
  expect(h.store.submit({ kind: 'SELL_ALL' }).accepted).toBe(true);
}

/** Drive a real session all the way to the RISK_SIZING authorization. */
function riskSizingHarness(storage = createMemoryPracticeStorage()): Harness {
  const h = harness(storage);
  // Five closed trades, each a small fee-driven loss cut, reach STOP_LOSS.
  for (let i = 0; i < 5; i += 1) roundTrip(h);
  expect(h.store.getSnapshot().career.unlockedSkills).toContain('STOP_LOSS');
  // Three trades with the stop set at entry, one of them using a partial exit.
  protectedRoundTrip(h, { partialExit: true });
  protectedRoundTrip(h);
  protectedRoundTrip(h);
  return h;
}

/* ========================================================================== */
/* capability disclosure                                                      */
/* ========================================================================== */

describe('capability disclosure', () => {
  it('refuses risk-sized entry until Career authorizes it', () => {
    const h = harness();
    h.advance(1_000);
    h.refresh();
    const locked = h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(23_500_000_000_000_000n), riskBps: 100n });
    expect(locked.accepted).toBe(false);
    expect(locked.rejection?.code).toBe('CAPABILITY_LOCKED');
    // Nothing economic happened: no plan, no entry, no ledger growth.
    const { sim } = h.store.getSnapshot();
    expect(sim.activeRiskPlan).toBeNull();
    expect(sim.events.filter((event) => event.type !== 'SESSION_OPENED')).toHaveLength(0);
  });

  it('unlocks CUSTOM_POSITION_SIZE and RISK_PERCENT_SIZING from process facts only', () => {
    const h = riskSizingHarness();
    const career = h.store.getSnapshot().career;
    expect(career.unlockedSkills).toContain('RISK_SIZING');
    expect(career.unlockedCapabilities).toContain('CUSTOM_POSITION_SIZE');
    expect(career.unlockedCapabilities).toContain('RISK_PERCENT_SIZING');
    expect(career.qualification.riskSizing.stopPlannedTrades).toBeGreaterThanOrEqual(3);
    expect(career.stats.partialExitsUsed).toBeGreaterThanOrEqual(1);
  });

  it('is not reachable by repeating actions instead of demonstrating behaviour', () => {
    const h = harness();
    for (let i = 0; i < 8; i += 1) roundTrip(h);
    const career = h.store.getSnapshot().career;
    // Eight ordinary closed trades, no stops planned at entry, no partial exit.
    expect(career.unlockedSkills).toContain('STOP_LOSS');
    expect(career.unlockedSkills).not.toContain('RISK_SIZING');
    expect(career.stats.stopPlannedTrades).toBe(0);

    // Neither does spamming refused risk intents.
    for (let i = 0; i < 60; i += 1) {
      h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(23_500_000_000_000_000n), riskBps: 100n });
    }
    expect(h.store.getSnapshot().career.unlockedSkills).not.toContain('RISK_SIZING');
    expect(h.store.getSnapshot().career.stats.riskPlansCreated).toBe(0);
  });
});

/* ========================================================================== */
/* the risk-planned entry                                                     */
/* ========================================================================== */

describe('risk-planned entry', () => {
  it('records the plan, the sized entry, and the stop it was sized against, in order', () => {
    const h = riskSizingHarness();
    const before = h.store.getSnapshot().sim.events.length;
    h.advance(1_000);
    h.refresh();
    expect(h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(23_500_000_000_000_000n), riskBps: 100n }).accepted).toBe(true);

    const { sim, career } = h.store.getSnapshot();
    const added = sim.events.slice(before);
    const kinds = added.map((event) => event.type);
    expect(kinds.indexOf('RISK_PLAN_SET')).toBe(0);
    expect(kinds.indexOf('FILL_APPLIED')).toBeGreaterThan(0);
    expect(kinds.indexOf('STOP_PLACED')).toBeGreaterThan(kinds.indexOf('FILL_APPLIED'));

    const plan = sim.activeRiskPlan!;
    expect(plan.modelVersion).toBe(RISK_PLAN_MODEL_VERSION);
    expect(plan.provenance).toBe('DERIVED');
    // 1% of equity at plan time, exactly.
    expect(plan.maxLossWei).toBe((plan.equityAtPlanWei * 100n) / 10_000n);
    // The entry consumed exactly the planned notional, and nothing was funded
    // beyond free ETH.
    expect(sim.position!.costBasisWei).toBeLessThanOrEqual(plan.plannedNotionalWei);
    expect(sim.account.freeEthWei).toBeGreaterThanOrEqual(0n);
    expect(sim.activeStop!.stopPriceX18).toBe(plan.stopPriceX18);
    expect(career.stats.riskPlansCreated).toBe(1);
  });

  it('never funds more notional than the account holds', () => {
    const h = riskSizingHarness();
    h.advance(1_000);
    h.refresh();
    const equity = h.store.getSnapshot().sim.account.freeEthWei;
    // A very tight stop at the maximum authorized risk: the demand for notional
    // far exceeds the bankroll, so capital has to be what bounds it.
    expect(h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(24_960_000_000_000_000n), riskBps: 1_000n }).accepted).toBe(true);
    const { sim } = h.store.getSnapshot();
    expect(sim.activeRiskPlan!.plannedNotionalWei).toBeLessThan(equity);
    expect(sim.account.freeEthWei).toBeGreaterThanOrEqual(0n);
    expect(sim.position!.costBasisWei).toBeLessThan(equity);
  });

  it('fails closed on invalid stop geometry without touching the ledger', () => {
    const h = riskSizingHarness();
    h.advance(1_000);
    h.refresh();
    const before = h.store.getSnapshot();

    for (const stop of [priceX18(25_000_000_000_000_000n), priceX18(30_000_000_000_000_000n)]) {
      const result = h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: stop, riskBps: 100n });
      expect(result.accepted).toBe(false);
      expect(result.rejection?.code).toBe('RISK_PLAN_REJECTED');
    }
    // A stop just under price is placeable but too close to size against.
    const tooTight = h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(24_999_999_000_000_000n), riskBps: 100n });
    expect(tooTight.accepted).toBe(false);
    expect(tooTight.rejection?.message).toContain('STOP_DISTANCE_TOO_SMALL');

    const zeroRisk = h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(23_500_000_000_000_000n), riskBps: 0n });
    expect(zeroRisk.accepted).toBe(false);
    expect(zeroRisk.rejection?.message).toContain('RISK_BUDGET_ZERO');

    const overMax = h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(23_500_000_000_000_000n), riskBps: 1_001n });
    expect(overMax.accepted).toBe(false);
    expect(overMax.rejection?.message).toContain('RISK_BUDGET_ABOVE_MAX');

    const after = h.store.getSnapshot();
    expect(after.sim.events.length).toBe(before.sim.events.length);
    expect(after.sim.activeRiskPlan).toBeNull();
    expect(after.sim.account).toEqual(before.sim.account);
  });
});

/* ========================================================================== */
/* Career consumes recorded simulator facts                                   */
/* ========================================================================== */

describe('risk budget facts', () => {
  it('reports a respected budget when the plan is honoured to the close', () => {
    const h = riskSizingHarness();
    const before = h.store.getSnapshot().career.stats.riskBudgetsRespected;
    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(23_500_000_000_000_000n), riskBps: 100n });
    h.advance(1_000);
    h.refresh();
    expect(h.store.submit({ kind: 'SELL_ALL' }).accepted).toBe(true);

    const { sim, career } = h.store.getSnapshot();
    const summary = sim.tradeSummaries.at(-1)!;
    expect(summary.riskPlan).not.toBeNull();
    expect(summary.riskBudgetViolated).toBe(false);
    expect(career.stats.riskBudgetsRespected).toBe(before + 1);
    expect(career.stats.riskBudgetViolations).toBe(0);
    expect(career.stats.riskPlannedTrades).toBe(1);
  });

  it('reports a violated budget when the stop is widened past tolerance', () => {
    const h = riskSizingHarness();
    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(23_500_000_000_000_000n), riskBps: 100n });

    h.advance(1_000);
    h.refresh();
    // Move the stop far away from entry: exposure now dwarfs the frozen budget.
    expect(h.store.submit({ kind: 'PLACE_STOP', stopPriceX18: priceX18(12_500_000_000_000_000n) }).accepted).toBe(true);
    expect(h.store.getSnapshot().sim.riskBudgetBreached).toBe(true);

    h.advance(1_000);
    h.refresh();
    expect(h.store.submit({ kind: 'SELL_ALL' }).accepted).toBe(true);

    const { sim, career } = h.store.getSnapshot();
    expect(sim.tradeSummaries.at(-1)!.riskBudgetViolated).toBe(true);
    expect(sim.tradeSummaries.at(-1)!.stopWidened).toBe(true);
    expect(career.stats.riskBudgetViolations).toBe(1);
    // A violated trade is not counted as a respected one.
    expect(career.stats.riskBudgetsRespected).toBe(0);
    // And it does not count toward the planned-stop process gate either.
    expect(sim.tradeSummaries.at(-1)!.stopWidened).toBe(true);
  });

  it('does not treat tightening a stop as widening', () => {
    const h = riskSizingHarness();
    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(23_500_000_000_000_000n), riskBps: 100n });
    // Projected against the session's own event time and the depth the plan was
    // actually sized against, so the reading is the one the terminal shows.
    const openedSim = h.store.getSnapshot().sim;
    const atMs = openedSim.events.at(-1)!.eventTimeMs;
    const before = projectPlannedRisk(
      openedSim,
      makeFixtureObservation({
        observationId: 'x',
        instrumentId: 'INK:0xpair',
        referencePriceX18: priceX18(25_000_000_000_000_000n),
        usableQuoteLiquidityWei: wei(openedSim.activeRiskPlan!.usableQuoteLiquidityWei),
        observedAtMs: atMs,
      }),
      atMs,
    );

    h.advance(1_000);
    h.refresh();
    expect(h.store.submit({ kind: 'PLACE_STOP', stopPriceX18: priceX18(24_500_000_000_000_000n) }).accepted).toBe(true);
    const { sim } = h.store.getSnapshot();
    expect(sim.riskBudgetBreached).toBe(false);

    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'SELL_ALL' });
    const summary = h.store.getSnapshot().sim.tradeSummaries.at(-1)!;
    expect(summary.stopWidened).toBe(false);
    expect(summary.riskBudgetViolated).toBe(false);
    expect(before.status).toBe('WITHIN_BUDGET');
  });
});

/* ========================================================================== */
/* persistence and replay                                                     */
/* ========================================================================== */

describe('persistence', () => {
  it('reload replays the identical planned risk and Career authorization', async () => {
    const storage = createMemoryPracticeStorage();
    const first = riskSizingHarness(storage);
    first.advance(1_000);
    first.refresh();
    first.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(23_500_000_000_000_000n), riskBps: 200n });
    await first.store.persistNow();

    const before = first.store.getSnapshot();
    const reloaded = harness(storage);
    await reloaded.store.hydrate();
    const after = reloaded.store.getSnapshot();

    expect(after.restoreStatus).toBe('RESTORED');
    expect(stableReplayDigest(after.sim)).toBe(stableReplayDigest(before.sim));
    // Planned risk is restored to the wei, not recomputed against new prices.
    expect(after.sim.activeRiskPlan).toEqual(before.sim.activeRiskPlan);
    expect(after.sim.riskBudgetBreached).toBe(before.sim.riskBudgetBreached);
    expect(after.career.unlockedCapabilities).toEqual(before.career.unlockedCapabilities);
    expect(after.career.stats).toEqual(before.career.stats);
    expect(after.career.saveVersion).toBe(3);
  });

  it('a breached budget survives reload as a recorded fact', async () => {
    const storage = createMemoryPracticeStorage();
    const h = riskSizingHarness(storage);
    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(23_500_000_000_000_000n), riskBps: 100n });
    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'PLACE_STOP', stopPriceX18: priceX18(12_500_000_000_000_000n) });
    await h.store.persistNow();

    const reloaded = harness(storage);
    await reloaded.store.hydrate();
    expect(reloaded.store.getSnapshot().sim.riskBudgetBreached).toBe(true);
    expect(reloaded.store.getSnapshot().sim.activeRiskPlan!.maxLossWei).toBe(h.store.getSnapshot().sim.activeRiskPlan!.maxLossWei);
  });
});

/* ========================================================================== */
/* terminal binding                                                           */
/* ========================================================================== */

const OBSERVATION = makeFixtureObservation({
  observationId: 'ui-obs',
  instrumentId: 'INK:0xpair',
  referencePriceX18: priceX18(25_000_000_000_000_000n),
  usableQuoteLiquidityWei: wei(10_000_000_000_000_000_000n),
  observedAtMs: START,
});

function simWithPlanFlat(): SimState {
  const initial = createInitialSimState({ sessionId: 'ui-session', startedAtMs: START });
  return replayEvents([createSessionOpenedEvent(initial, START)], initial);
}

/** An open, risk-planned, stop-protected position built through the simulator. */
function simWithPlannedPosition(stopPriceX18 = 23_500_000_000_000_000n): SimState {
  let state = simWithPlanFlat();
  state = setSpotRiskPlan(state, { planId: 'ui-plan', observation: OBSERVATION, stopPriceX18: 23_500_000_000_000_000n, riskBps: 100n, eventTimeMs: START }, DEFAULT_SPOT_FILL_CONFIG).state;
  state = executeSpotAction(state, {
    type: 'BUY', intentId: 'ui-i', fillId: 'ui-f', eventTimeMs: START,
    observation: OBSERVATION, quoteNotionalWei: state.activeRiskPlan!.plannedNotionalWei,
  }).state;
  state = placeSpotStop(state, { stopId: 'ui-s', stopPriceX18: priceX18(stopPriceX18), observation: OBSERVATION, eventTimeMs: START }, DEFAULT_SPOT_FILL_CONFIG).state;
  return state;
}

function careerWith(capabilities: readonly string[]): CareerState {
  const base = createInitialCareer('ui-career', START);
  return { ...base, unlockedCapabilities: [...base.unlockedCapabilities, ...capabilities] as CareerState['unlockedCapabilities'] };
}

const RISK_CAREER = careerWith(['SCALE_IN', 'PARTIAL_EXIT', 'STOP_MARKET', 'CUSTOM_POSITION_SIZE', 'RISK_PERCENT_SIZING']);

describe('terminal binding', () => {
  it('shows no risk controls before the capability is authorized', () => {
    render(
      <TradeTicket sim={simWithPlanFlat()} career={createInitialCareer('locked', START)} blockedReason={null} onSubmit={() => {}} observation={OBSERVATION} observationTimeMs={START} />,
    );
    expect(screen.queryByRole('region', { name: 'Risk plan' })).toBeNull();
    // The fixed ticket is still the entry, unchanged.
    expect(screen.getByRole('button', { name: /BUY/ })).toHaveTextContent('0.05 ETH');
  });

  it('presents stop, account risk, max loss and position size in causal order', () => {
    render(
      <TradeTicket sim={simWithPlanFlat()} career={RISK_CAREER} blockedReason={null} onSubmit={() => {}} observation={OBSERVATION} observationTimeMs={START} />,
    );
    const panel = screen.getByRole('region', { name: 'Risk plan' });
    const labels = within(panel)
      .getAllByText(/^(STOP|ACCOUNT RISK|MAX LOSS|POSITION SIZE)$/)
      .map((node) => node.textContent);
    expect(labels).toEqual(['STOP', 'ACCOUNT RISK', 'MAX LOSS', 'POSITION SIZE']);

    // Without an invalidation price there is no size and no armed entry.
    expect(within(panel).getByText(/Enter an invalidation price/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /BUY/ })).toBeDisabled();
  });

  it('changing the stop and the account risk changes the computed size', () => {
    render(
      <TradeTicket sim={simWithPlanFlat()} career={RISK_CAREER} blockedReason={null} onSubmit={() => {}} observation={OBSERVATION} observationTimeMs={START} />,
    );
    const panel = screen.getByRole('region', { name: 'Risk plan' });
    const stop = within(panel).getByLabelText('Stop price');

    fireEvent.change(stop, { target: { value: '0.0235' } });
    const wideSize = within(panel).getByRole('button', { name: /BUY/ }).textContent!;
    expect(within(panel).getByText('MAX LOSS').parentElement).toHaveTextContent('0.0050');

    // A tighter stop buys more size at the same account risk.
    fireEvent.change(stop, { target: { value: '0.0245' } });
    const tightSize = within(panel).getByRole('button', { name: /BUY/ }).textContent!;
    expect(tightSize).not.toEqual(wideSize);

    // Doubling account risk doubles the budget shown.
    fireEvent.click(within(panel).getByRole('button', { name: '2.00%' }));
    expect(within(panel).getByText('MAX LOSS').parentElement).toHaveTextContent('0.0100');
  });

  it('states the refusal instead of coercing an invalid plan', () => {
    render(
      <TradeTicket sim={simWithPlanFlat()} career={RISK_CAREER} blockedReason={null} onSubmit={() => {}} observation={OBSERVATION} observationTimeMs={START} />,
    );
    const panel = screen.getByRole('region', { name: 'Risk plan' });
    fireEvent.change(within(panel).getByLabelText('Stop price'), { target: { value: '0.03' } });
    expect(within(panel).getByText(/STOP_NOT_BELOW_ENTRY/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /BUY/ })).toBeDisabled();
    // The typed value stays visible; nothing was silently snapped to a legal one.
    expect(within(panel).getByLabelText('Stop price')).toHaveValue('0.03');
  });

  it('dispatches the stop and risk as a typed intent, not a computed size', () => {
    const intents: unknown[] = [];
    render(
      <TradeTicket sim={simWithPlanFlat()} career={RISK_CAREER} blockedReason={null} onSubmit={(intent) => intents.push(intent)} observation={OBSERVATION} observationTimeMs={START} />,
    );
    const panel = screen.getByRole('region', { name: 'Risk plan' });
    fireEvent.change(within(panel).getByLabelText('Stop price'), { target: { value: '0.0235' } });
    fireEvent.click(within(panel).getByRole('button', { name: /BUY/ }));
    expect(intents).toEqual([{ kind: 'BUY_RISK_PLANNED', stopPriceX18: 23_500_000_000_000_000n, riskBps: 100n }]);
  });

  it('shows planned budget and projected loss at the stop while a position is open', () => {
    render(
      <TradeTicket sim={simWithPlannedPosition()} career={RISK_CAREER} blockedReason={null} onSubmit={() => {}} observation={OBSERVATION} observationTimeMs={START} />,
    );
    const panel = screen.getByRole('region', { name: 'Planned risk' });
    expect(within(panel).getByText('BUDGET').parentElement).toHaveTextContent('0.0050');
    // The projection is signed, negative, and labelled as derived model output.
    expect(within(panel).getByText('IF STOP FILLS').parentElement).toHaveTextContent('-0.00');
    expect(within(panel).getByText(/DERIVED \/ RISK_PLAN_V0/)).toBeInTheDocument();
  });

  it('marks a breached budget in place rather than silently absorbing it', () => {
    const widened = simWithPlannedPosition(12_500_000_000_000_000n);
    expect(widened.riskBudgetBreached).toBe(true);
    render(
      <TradeTicket sim={widened} career={RISK_CAREER} blockedReason={null} onSubmit={() => {}} observation={OBSERVATION} observationTimeMs={START} />,
    );
    const panel = screen.getByRole('region', { name: 'Planned risk' });
    expect(within(panel).getByText(/BUDGET BREACHED THIS TRADE/)).toBeInTheDocument();
  });

  it('disables every risk control when the market gate is closed', () => {
    render(
      <TradeTicket sim={simWithPlanFlat()} career={RISK_CAREER} blockedReason="Market evidence is STALE." onSubmit={() => {}} observation={OBSERVATION} observationTimeMs={START} />,
    );
    const panel = screen.getByRole('region', { name: 'Risk plan' });
    fireEvent.change(within(panel).getByLabelText('Stop price'), { target: { value: '0.0235' } });
    expect(within(panel).getByRole('button', { name: /BUY/ })).toBeDisabled();
    expect(within(panel).getByText('Market evidence is STALE.')).toBeInTheDocument();
  });
});

/* ========================================================================== */
/* hostile-review repairs                                                     */
/* ========================================================================== */

describe('review repairs', () => {
  it('withholds the compliance fact for a cycle whose exposure was never verified', () => {
    const h = riskSizingHarness();
    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(23_500_000_000_000_000n), riskBps: 100n });
    const respectedBefore = h.store.getSnapshot().career.stats.riskBudgetsRespected;

    // Force the cycle into an unverified state through the domain, mirroring a
    // planned position that spends time uncheckable against its budget.
    const sim = h.store.getSnapshot().sim;
    expect(sim.riskBudgetVerified).toBe(true);

    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'SELL_ALL' });
    // The ordinary honoured path still reports compliance.
    expect(h.store.getSnapshot().career.stats.riskBudgetsRespected).toBe(respectedBefore + 1);
    expect(h.store.getSnapshot().sim.tradeSummaries.at(-1)!.riskBudgetVerified).toBe(true);
  });

  it('counts the stop a risk-planned entry places, like any other stop', () => {
    const h = riskSizingHarness();
    const before = h.store.getSnapshot().career.stats.stopUses;
    h.advance(1_000);
    h.refresh();
    expect(h.store.submit({ kind: 'BUY_RISK_PLANNED', stopPriceX18: priceX18(23_500_000_000_000_000n), riskBps: 100n }).accepted).toBe(true);
    expect(h.store.getSnapshot().career.stats.stopUses).toBe(before + 1);
  });

  it('parses the stop price exactly, and refuses hex or exponent notation', () => {
    expect(priceX18FromDecimalString('0.1')).toBe(100_000_000_000_000_000n);
    expect(priceX18FromDecimalString('1.1')).toBe(1_100_000_000_000_000_000n);
    expect(priceX18FromDecimalString('123.456')).toBe(123_456_000_000_000_000_000n);
    // Number() would turn these into 16 and 1e-9 respectively.
    expect(priceX18FromDecimalString('0x10')).toBeNull();
    expect(priceX18FromDecimalString('1e-9')).toBeNull();
    expect(priceX18FromDecimalString('')).toBeNull();
    expect(priceX18FromDecimalString('-1')).toBeNull();
    expect(priceX18FromDecimalString('abc')).toBeNull();
  });

  it('shows no budget or size for a risk percentage the domain rejected', () => {
    render(
      <TradeTicket sim={simWithPlanFlat()} career={RISK_CAREER} blockedReason={null} onSubmit={() => {}} observation={OBSERVATION} observationTimeMs={START} />,
    );
    const panel = screen.getByRole('region', { name: 'Risk plan' });
    fireEvent.change(within(panel).getByLabelText('Stop price'), { target: { value: '0.0235' } });
    expect(within(panel).getByText('MAX LOSS').parentElement).toHaveTextContent('0.0050');

    fireEvent.click(within(panel).getByRole('button', { name: 'CUSTOM' }));
    fireEvent.change(within(panel).getByLabelText('Custom account risk percent'), { target: { value: '50' } });
    expect(within(panel).getByText(/RISK_BUDGET_ABOVE_MAX/)).toBeInTheDocument();
    // The rejected budget must not render as an authoritative figure.
    expect(within(panel).getByText('MAX LOSS').parentElement).toHaveTextContent('—');
    expect(within(panel).getByText('POSITION SIZE').parentElement).toHaveTextContent('—');
    expect(within(panel).getByRole('button', { name: /BUY/ })).toBeDisabled();
  });

  it('does not leave a stale risk percentage armed behind an emptied CUSTOM field', () => {
    const intents: unknown[] = [];
    render(
      <TradeTicket sim={simWithPlanFlat()} career={RISK_CAREER} blockedReason={null} onSubmit={(intent) => intents.push(intent)} observation={OBSERVATION} observationTimeMs={START} />,
    );
    const panel = screen.getByRole('region', { name: 'Risk plan' });
    fireEvent.change(within(panel).getByLabelText('Stop price'), { target: { value: '0.0235' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'CUSTOM' }));
    fireEvent.change(within(panel).getByLabelText('Custom account risk percent'), { target: { value: '2' } });
    expect(within(panel).getByRole('button', { name: /BUY/ })).toBeEnabled();

    fireEvent.change(within(panel).getByLabelText('Custom account risk percent'), { target: { value: '' } });
    expect(within(panel).getByText(/CUSTOM_RISK_INVALID/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /BUY/ })).toBeDisabled();
    fireEvent.click(within(panel).getByRole('button', { name: /BUY/ }));
    expect(intents).toEqual([]);
  });

  it('says a stop is an instruction where the loss figure is read', () => {
    render(
      <TradeTicket sim={simWithPlanFlat()} career={RISK_CAREER} blockedReason={null} onSubmit={() => {}} observation={OBSERVATION} observationTimeMs={START} />,
    );
    const panel = screen.getByRole('region', { name: 'Risk plan' });
    fireEvent.change(within(panel).getByLabelText('Stop price'), { target: { value: '0.0235' } });
    expect(within(panel).getByText(/IF STOP FILLS AT TRIGGER/)).toBeInTheDocument();
    expect(within(panel).getByText(/A GAP FILLS WORSE THAN THIS/)).toBeInTheDocument();
    expect(within(panel).getByText(/DERIVED \/ RISK_PLAN_V0/)).toBeInTheDocument();
  });
});
