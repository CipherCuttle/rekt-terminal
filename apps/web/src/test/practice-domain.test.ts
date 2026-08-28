/**
 * Domain-adapter tests.
 *
 * These prove the economic claims of MVP_TERMINAL_LOOP_V0 without a DOM: the
 * simulator is the only thing that moves money, the market gate fails closed,
 * and Career only advances on recorded simulator facts.
 */
import { describe, expect, it } from 'vitest';
import {
  INITIAL_BANKROLL_WEI,
  replayEvents,
  stableReplayDigest,
  type SimEvent,
} from '@rekt-ink/sim';
import { evaluatePracticeEligibility } from '../practice/eligibility';
import { chartCycleId, deriveTradeEconomics, fillStampsForCycle, fillStampsFromEvents } from '../practice/derive';
import { PracticeSessionStore, type PracticeIntent } from '../practice/store';
import {
  createDexiePracticeStorage,
  createMemoryPracticeStorage,
  createPracticeSave,
  decodeSimEvents,
  encodeSimEvents,
  restorePracticeSave,
} from '../practice/persistence';
import type { PracticeQuote } from '../practice/quote';

const START = 1_800_000_000_000;
const ETH_USD = 3284.15;

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
  setQuote(quote: PracticeQuote | null): void;
  now(): number;
  /** Re-quote at the current clock so each action gets a fresh observation. */
  refresh(priceEth?: number): void;
}

function harness(storage = createMemoryPracticeStorage()): Harness {
  let now = START;
  let sequence = 1;
  let quote: PracticeQuote | null = makeQuote();
  const store = new PracticeSessionStore({
    sessionId: 'test-session',
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
    setQuote: (next) => {
      quote = next;
    },
    now: () => now,
    refresh: (priceEth) => {
      sequence += 1;
      quote = makeQuote({ observedAtMs: now, sequence, ...(priceEth === undefined ? {} : { priceEth }) });
    },
  };
}

/** One complete round trip at a stable price. */
function roundTrip(h: Harness, priceEth = 0.025): void {
  h.advance(1_000);
  h.refresh(priceEth);
  expect(h.store.submit({ kind: 'BUY_FIXED' }).accepted).toBe(true);
  h.advance(1_000);
  h.refresh(priceEth);
  expect(h.store.submit({ kind: 'SELL_ALL' }).accepted).toBe(true);
}

/* ========================================================================== */
/* 8 + 9 — the market gate fails closed                                       */
/* ========================================================================== */

describe('market gate', () => {
  it('8. an unsupported quote asset disables practice', () => {
    const gate = evaluatePracticeEligibility(makeQuote({ quoteAsset: 'USDC' }), START);
    expect(gate.status).toBe('BLOCKED');
    if (gate.status === 'BLOCKED') expect(gate.code).toBe('UNSUPPORTED_QUOTE');

    const h = harness();
    h.setQuote(makeQuote({ quoteAsset: 'USDC' }));
    const result = h.store.submit({ kind: 'BUY_FIXED' });
    expect(result.accepted).toBe(false);
    expect(result.rejection?.code).toBe('UNSUPPORTED_QUOTE');
    // The refusal never reaches the simulator, so no economic event is written.
    expect(h.store.getSnapshot().sim.events.filter((e) => e.type !== 'SESSION_OPENED')).toHaveLength(0);
    expect(h.store.getSnapshot().sim.account.freeEthWei).toBe(INITIAL_BANKROLL_WEI);
  });

  it('9. stale market input is rejected and marks nothing', () => {
    const gate = evaluatePracticeEligibility(makeQuote({ observedAtMs: START - 31_000 }), START);
    expect(gate.status).toBe('BLOCKED');
    if (gate.status === 'BLOCKED') {
      expect(gate.code).toBe('STALE_MARKET');
      expect(gate.truthLabel).toBe('STALE');
    }

    const h = harness();
    h.advance(1_000);
    h.refresh();
    expect(h.store.submit({ kind: 'BUY_FIXED' }).accepted).toBe(true);
    const eventsWhileFresh = h.store.getSnapshot().sim.events.length;

    // Feed goes quiet: the observation ages past the freshness window.
    h.advance(60_000);
    expect(h.store.markToMarket()).toBe(false);
    expect(h.store.submit({ kind: 'SELL_ALL' }).accepted).toBe(false);
    expect(h.store.getSnapshot().lastRejection?.code).toBe('STALE_MARKET');
    expect(h.store.getSnapshot().sim.events.length).toBe(eventsWhileFresh);
  });

  it('rejects evidence the simulator will not accept as economic input', () => {
    for (const provenance of ['SYNTHETIC', 'STALE', 'UNAVAILABLE'] as const) {
      const gate = evaluatePracticeEligibility(makeQuote({ provenance }), START);
      expect(gate.status).toBe('BLOCKED');
    }
    const noDepth = evaluatePracticeEligibility(makeQuote({ liquidityUsd: null }), START);
    expect(noDepth.status).toBe('BLOCKED');
    if (noDepth.status === 'BLOCKED') expect(noDepth.code).toBe('MISSING_LIQUIDITY');
  });
});

/* ========================================================================== */
/* 2 + 3 + 4 + 6 — the trade loop runs through the simulator                   */
/* ========================================================================== */

describe('trade loop', () => {
  it('2. a new practice account holds exactly 0.5 ETH', () => {
    const { store } = harness();
    expect(store.getSnapshot().sim.account.freeEthWei).toBe(500_000_000_000_000_000n);
    expect(store.getSnapshot().sim.account.equityWei).toBe(500_000_000_000_000_000n);
  });

  it('3. BUY 0.05 ETH goes through a simulator intent, not a balance mutation', () => {
    const h = harness();
    h.advance(1_000);
    h.refresh();
    expect(h.store.submit({ kind: 'BUY_FIXED' }).accepted).toBe(true);

    const { sim } = h.store.getSnapshot();
    const accepted = sim.events.find((e) => e.type === 'ORDER_INTENT_ACCEPTED');
    expect(accepted).toMatchObject({ type: 'ORDER_INTENT_ACCEPTED', action: 'BUY' });

    const fillEvent = sim.events.find((e) => e.type === 'FILL_APPLIED');
    expect(fillEvent?.type).toBe('FILL_APPLIED');
    const fill = (fillEvent as Extract<SimEvent, { type: 'FILL_APPLIED' }>).fill;
    expect(fill.requestedQuoteWei).toBe(50_000_000_000_000_000n);

    // The balance is exactly what the ledger derived from the fill.
    expect(sim.account.freeEthWei).toBe(INITIAL_BANKROLL_WEI - fill.executedQuoteWei - fill.feeQuoteWei);

    // And it is reproducible purely from the recorded log — no UI-side state
    // contributes to the account.
    const replayed = replayEvents(sim.events);
    expect(replayed.account).toEqual(sim.account);
    expect(stableReplayDigest(replayed)).toBe(stableReplayDigest(sim));
  });

  it('4. an accepted fill produces a visible position snapshot', () => {
    const h = harness();
    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'BUY_FIXED' });

    const position = h.store.getSnapshot().sim.position;
    expect(position).not.toBeNull();
    expect(position!.status).toBe('OPEN');
    expect(position!.openQuantityAtoms).toBeGreaterThan(0n);
    expect(position!.averageEntryPriceX18).toBeGreaterThan(0n);
    expect(position!.medianEntryPriceX18).toBeGreaterThan(0n);
    expect(position!.instrumentId).toBe('INK:0xpair');
  });

  it('5. chart fill stamps carry the simulator fill price and time', () => {
    const h = harness();
    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'BUY_FIXED' });
    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'SELL_ALL' });

    const { sim } = h.store.getSnapshot();
    const fills = sim.events.filter((e) => e.type === 'FILL_APPLIED').map((e) => (e as Extract<SimEvent, { type: 'FILL_APPLIED' }>).fill);
    const stamps = fillStampsFromEvents(sim.events);

    expect(stamps).toHaveLength(fills.length);
    expect(stamps.map((s) => s.side)).toEqual(['BUY', 'SELL']);
    for (const [index, stamp] of stamps.entries()) {
      expect(stamp.fillPriceX18).toBe(fills[index].fillPriceX18);
      expect(stamp.executedAtMs).toBe(fills[index].executedAtMs);
      expect(stamp.quantityAtoms).toBe(fills[index].quantityAtoms);
      // The bar anchor is a bucket of the recorded time, never a render time.
      expect(stamp.barTimeSeconds).toBe(Math.floor(fills[index].executedAtMs / 1000) - (Math.floor(fills[index].executedAtMs / 1000) % 60));
    }
  });

  it('5b. chart stamps are scoped to the trade cycle in view', () => {
    const h = harness();
    roundTrip(h);
    const afterFirst = h.store.getSnapshot().sim;
    // Flat: the chart shows the trade that just closed.
    expect(chartCycleId(afterFirst)).toBe('trade-1');
    expect(fillStampsForCycle(afterFirst.events, chartCycleId(afterFirst))).toHaveLength(2);

    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'BUY_FIXED' });
    const open = h.store.getSnapshot().sim;
    // Open: the chart shows only the cycle being built, not the whole session.
    expect(chartCycleId(open)).toBe('trade-2');
    const scoped = fillStampsForCycle(open.events, chartCycleId(open));
    expect(scoped).toHaveLength(1);
    expect(fillStampsFromEvents(open.events)).toHaveLength(3);
  });

  it('6. SELL ALL closes the actual simulator position', () => {
    const h = harness();
    roundTrip(h);
    const { sim } = h.store.getSnapshot();
    expect(sim.position).toBeNull();
    expect(sim.closedCycleCount).toBe(1);
    expect(sim.tradeSummaries).toHaveLength(1);
    expect(sim.account.unrealizedPnlWei).toBe(0n);
    // Round-tripping at a flat price costs fees and slippage; equity must fall.
    expect(sim.account.equityWei).toBeLessThan(INITIAL_BANKROLL_WEI);
  });
});

/* ========================================================================== */
/* 7 — trade review is built from domain facts                                */
/* ========================================================================== */

describe('trade review', () => {
  it('7. consumes the recorded TradeSummary and the cycle’s real fills', () => {
    const h = harness();
    roundTrip(h);

    const snapshot = h.store.getSnapshot();
    const review = snapshot.tradeReview;
    expect(review).not.toBeNull();

    const summary = snapshot.sim.tradeSummaries[0];
    expect(review!.summary).toEqual(summary);
    expect(review!.summary.realizedPnlWei).toBe(summary.realizedPnlWei);
    expect(review!.economics.totalFeesWei).toBe(summary.entryFeesWei + summary.exitFeesWei);

    // The exit price is the quantity-weighted average of the cycle's SELL fills.
    const sellFill = snapshot.sim.events
      .filter((e) => e.type === 'FILL_APPLIED')
      .map((e) => (e as Extract<SimEvent, { type: 'FILL_APPLIED' }>).fill)
      .find((fill) => fill.side === 'SELL')!;
    expect(review!.economics.exitQuantityAtoms).toBe(sellFill.quantityAtoms);
    expect(review!.economics.exitProceedsWei).toBe(sellFill.executedQuoteWei);

    const recomputed = deriveTradeEconomics(snapshot.sim.events, summary);
    expect(recomputed).toEqual(review!.economics);
  });

  it('separates outcome from qualification', () => {
    const h = harness();
    roundTrip(h);
    const review = h.store.getSnapshot().tradeReview!;
    // A small fee-driven loss still counts toward qualification: outcome and
    // process are independent verdicts.
    expect(review.summary.realizedPnlWei).toBeLessThan(0n);
    expect(review.countedTowardQualification).toBe(true);
  });
});

/* ========================================================================== */
/* 10 – 13 — Career advances only on domain facts                             */
/* ========================================================================== */

describe('career', () => {
  it('10. progress advances only from qualifying domain events', () => {
    const h = harness();
    expect(h.store.getSnapshot().career.stats.closedSpotTrades).toBe(0);

    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'BUY_FIXED' });
    // An open position is not progress.
    expect(h.store.getSnapshot().career.stats.closedSpotTrades).toBe(0);

    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'SELL_ALL' });
    expect(h.store.getSnapshot().career.stats.closedSpotTrades).toBe(1);
    expect(h.store.getSnapshot().career.stats.qualifyingScaleTrades).toBe(1);
  });

  it('11. three qualifying closed trades unlock SCALE_CONTROL', () => {
    const h = harness();
    expect(h.store.getSnapshot().career.unlockedSkills).toEqual(['SPOT_BASIC']);
    expect(h.store.hasCapability('SCALE_IN')).toBe(false);
    expect(h.store.hasCapability('PARTIAL_EXIT')).toBe(false);

    roundTrip(h);
    roundTrip(h);
    expect(h.store.getSnapshot().career.unlockedSkills).toEqual(['SPOT_BASIC']);

    roundTrip(h);
    const career = h.store.getSnapshot().career;
    expect(career.unlockedSkills).toEqual(['SPOT_BASIC', 'SCALE_CONTROL']);
    expect(career.unlockedCapabilities).toEqual(['SPOT_MARKET_BUY_FIXED', 'SPOT_SELL_ALL', 'SCALE_IN', 'PARTIAL_EXIT']);
    expect(career.qualification.scaleControl.qualified).toBe(true);
    expect(h.store.getSnapshot().tradeReview?.unlockedSkills).toEqual(['SCALE_CONTROL']);
  });

  it('12. SCALE_CONTROL exposes partial close and scale-in that really execute', () => {
    const h = harness();
    // Locked before the unlock: the intent is refused at the capability gate.
    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'BUY_FIXED' });
    const locked = h.store.submit({ kind: 'PARTIAL_CLOSE', percent: 50 });
    expect(locked.accepted).toBe(false);
    expect(locked.rejection?.code).toBe('CAPABILITY_LOCKED');
    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'SELL_ALL' });

    roundTrip(h);
    roundTrip(h);
    expect(h.store.hasCapability('PARTIAL_EXIT')).toBe(true);

    h.advance(1_000);
    h.refresh();
    h.store.submit({ kind: 'BUY_FIXED' });
    const opened = h.store.getSnapshot().sim.position!.openQuantityAtoms;

    h.advance(1_000);
    h.refresh();
    expect(h.store.submit({ kind: 'SCALE_IN' }).accepted).toBe(true);
    const scaled = h.store.getSnapshot().sim.position!;
    expect(scaled.openQuantityAtoms).toBeGreaterThan(opened);
    expect(scaled.entryCount).toBe(2);
    expect(h.store.getSnapshot().career.stats.scaleInsUsed).toBe(1);

    h.advance(1_000);
    h.refresh();
    expect(h.store.submit({ kind: 'PARTIAL_CLOSE', percent: 50 }).accepted).toBe(true);
    const reduced = h.store.getSnapshot().sim.position!;
    expect(reduced.openQuantityAtoms).toBe(scaled.openQuantityAtoms - scaled.openQuantityAtoms / 2n);
    expect(reduced.partialExitUsed).toBe(true);
    expect(h.store.getSnapshot().career.stats.partialExitsUsed).toBe(1);
  });

  it('13. refused intents cannot advance Career no matter how many times they fire', () => {
    const h = harness();
    const before = h.store.getSnapshot().career;

    // Spam while flat: SELL ALL has nothing to close.
    for (let i = 0; i < 60; i += 1) h.store.submit({ kind: 'SELL_ALL' });
    // Spam locked capabilities.
    for (let i = 0; i < 60; i += 1) h.store.submit({ kind: 'SCALE_IN' } as PracticeIntent);
    // Spam against an unusable market.
    h.setQuote(makeQuote({ quoteAsset: 'USDC' }));
    for (let i = 0; i < 60; i += 1) h.store.submit({ kind: 'BUY_FIXED' });

    const after = h.store.getSnapshot().career;
    expect(after.stats).toEqual(before.stats);
    expect(after.unlockedSkills).toEqual(before.unlockedSkills);
    expect(after.qualification).toEqual(before.qualification);
    expect(h.store.getSnapshot().sim.position).toBeNull();
    expect(h.store.getSnapshot().sim.account.freeEthWei).toBe(INITIAL_BANKROLL_WEI);
  });
});

/* ========================================================================== */
/* 14 — persistence                                                           */
/* ========================================================================== */

describe('persistence', () => {
  it('round-trips bigint-bearing simulator events without loss', () => {
    const h = harness();
    roundTrip(h);
    const events = h.store.getSnapshot().sim.events;
    const decoded = decodeSimEvents(encodeSimEvents(events));
    expect(decoded).toEqual(events);
    expect(stableReplayDigest(replayEvents(decoded))).toBe(stableReplayDigest(replayEvents(events)));
  });

  it('14. reload restores the practice session by replaying its event log', async () => {
    const storage = createMemoryPracticeStorage();
    const first = harness(storage);
    roundTrip(first);
    first.advance(1_000);
    first.refresh();
    first.store.submit({ kind: 'BUY_FIXED' });
    await first.store.persistNow();

    const before = first.store.getSnapshot();
    const reloaded = harness(storage);
    await reloaded.store.hydrate();
    const after = reloaded.store.getSnapshot();

    expect(after.restoreStatus).toBe('RESTORED');
    expect(stableReplayDigest(after.sim)).toBe(stableReplayDigest(before.sim));
    expect(after.sim.account).toEqual(before.sim.account);
    expect(after.sim.position).toEqual(before.sim.position);
    expect(after.career.stats).toEqual(before.career.stats);
    expect(after.instrumentId).toBe('INK:0xpair');
  });

  it('14b. restores through the real IndexedDB adapter', async () => {
    const storage = createDexiePracticeStorage(`test-db-${Math.random().toString(36).slice(2)}`);
    const first = harness(storage);
    roundTrip(first);
    await first.store.persistNow();

    const reloaded = harness(storage);
    await reloaded.store.hydrate();
    expect(reloaded.store.getSnapshot().restoreStatus).toBe('RESTORED');
    expect(stableReplayDigest(reloaded.store.getSnapshot().sim)).toBe(stableReplayDigest(first.store.getSnapshot().sim));
  });

  it('fails safe when a save cannot be replayed', async () => {
    const h = harness();
    roundTrip(h);
    const good = createPracticeSave({
      sim: h.store.getSnapshot().sim,
      career: { kind: 'REKT_INK_CAREER_SAVE', saveVersion: 1, state: h.store.getSnapshot().career },
      instrumentId: 'INK:0xpair',
      savedAtMs: START,
    });

    expect(() => restorePracticeSave({ ...good, saveVersion: 99 })).toThrow(/unsupported practice save version/);
    expect(() => restorePracticeSave({ ...good, replayDigest: 'FNV1A64-0000000000000000' })).toThrow(/replay digest mismatch/);
    expect(() => restorePracticeSave({ ...good, career: { kind: 'NOPE' } })).toThrow(/career save failed migration/);

    const tampered = createMemoryPracticeStorage({ ...good, replayDigest: 'FNV1A64-0000000000000000' });
    const recovered = harness(tampered);
    await recovered.store.hydrate();
    expect(recovered.store.getSnapshot().restoreStatus).toBe('RESET_SAVE_UNUSABLE');
    expect(recovered.store.getSnapshot().sim.account.freeEthWei).toBe(INITIAL_BANKROLL_WEI);
    expect(await tampered.load()).toBeNull();
  });
});
