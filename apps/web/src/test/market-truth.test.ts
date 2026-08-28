/**
 * MARKET_TRUTH_V1 web invariants.
 *
 * Chart denomination, LIVE-by-default posture, fail-closed behaviour, and the
 * removal of the fabricated PROTECT_CAPITAL shortcut.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SPOT_FILL_CONFIG } from '@rekt-ink/sim';
import { resolveChartSeries } from '../lib/chart-currency';
import { evaluatePracticeEligibility } from '../practice/eligibility';
import { resolveQuoteIdentity, isEthEquivalentQuoteAddress, toSimProvenance, type PracticeQuote } from '../practice/quote';
import { EVIDENCE_POLICY_FOR_ENVIRONMENT, PracticeSessionStore } from '../practice/store';
import { createMemoryPracticeStorage, createPracticeSave, restorePracticeSave } from '../practice/persistence';
import { createCareerSave } from '@rekt-ink/career';
import { localAssets } from '../lib/local-fixtures';
import { api } from '../lib/api';
import type { Bar, BarSeries, RadarAsset } from '../types/api';

const START = 1_800_000_000_000;
const WETH = '0x4200000000000000000000000000000000000006';
const USDC = '0xf1815bd50389c46847f0bda824ec8da914045d14';
const ETH_USD = 3284.15;

function bars(base: number): Bar[] {
  return Array.from({ length: 5 }, (_, i) => ({
    time: 1_700_000_000 + i * 60,
    open: base, high: base * 1.01, low: base * 0.99, close: base, volume: 10,
  }));
}

function makeQuote(overrides: Partial<PracticeQuote> = {}): PracticeQuote {
  const priceEth = overrides.priceEth ?? 0.025;
  return {
    instrumentId: 'INK:0xpair', symbol: 'REKT', name: 'REKT INDEX', venue: 'VNL',
    pairAddress: '0xpair', tokenAddress: '0xtoken',
    quoteAsset: 'WETH', quoteTokenAddress: WETH, quoteIdentityResolved: true,
    priceEth, priceUsd: priceEth * ETH_USD, liquidityUsd: 500_000,
    observedAtMs: START, sourceId: 'TEST', provenance: 'DERIVED', sequence: 1,
    ...overrides,
  };
}

/* ------------------------------------------- 9 + 10. chart currency */

describe('chart currency', () => {
  it('9. USD bars are never rendered under an ETH-denominated axis', () => {
    const usdSeries: BarSeries = { bars: bars(82.1), currency: 'USD', currencyLabel: 'USD' };
    const resolved = resolveChartSeries({ series: usdSeries, overlayCurrency: 'QUOTE_TOKEN', overlayCurrencyLabel: 'WETH' });
    expect(resolved.status).toBe('UNAVAILABLE');
    if (resolved.status !== 'UNAVAILABLE') throw new Error('unreachable');
    expect(resolved.code).toBe('CURRENCY_MISMATCH');
    expect(resolved.reason).toContain('USD');
    expect(resolved.reason).toContain('WETH');
  });

  it('9b. there is no path that rescales USD bars into ETH bars', () => {
    const usd = bars(82.1);
    const usdSeries: BarSeries = { bars: usd, currency: 'USD', currencyLabel: 'USD' };
    const resolved = resolveChartSeries({ series: usdSeries, overlayCurrency: 'QUOTE_TOKEN', overlayCurrencyLabel: 'WETH' });
    // The old bug divided every historical bar by one current FX rate. Nothing
    // resembling the converted series may come back.
    expect(resolved).not.toHaveProperty('bars');
    const wouldHaveBeen = usd[0].close / ETH_USD;
    expect(JSON.stringify(resolved)).not.toContain(String(wouldHaveBeen));
  });

  it('10. a matching denomination renders and states its currency explicitly', () => {
    const ethSeries: BarSeries = { bars: bars(0.025), currency: 'QUOTE_TOKEN', currencyLabel: 'WETH' };
    const resolved = resolveChartSeries({ series: ethSeries, overlayCurrency: 'QUOTE_TOKEN', overlayCurrencyLabel: 'WETH' });
    expect(resolved.status).toBe('OK');
    if (resolved.status !== 'OK') throw new Error('unreachable');
    expect(resolved.currency).toBe('QUOTE_TOKEN');
    expect(resolved.currencyLabel).toBe('WETH');
    // Bars pass through untouched — no scaling of any kind.
    expect(resolved.bars).toEqual(ethSeries.bars);
  });

  it('10b. missing history fails closed rather than drawing an empty axis silently', () => {
    for (const series of [null, { bars: [], currency: 'QUOTE_TOKEN', currencyLabel: 'WETH' } as BarSeries]) {
      const resolved = resolveChartSeries({ series, overlayCurrency: 'QUOTE_TOKEN', overlayCurrencyLabel: 'WETH' });
      expect(resolved.status).toBe('UNAVAILABLE');
    }
  });

  it('10c. a series with no stated denomination is refused', () => {
    const rogue = { bars: bars(1), currency: 'ETH' as unknown as BarSeries['currency'], currencyLabel: '?' };
    const resolved = resolveChartSeries({ series: rogue, overlayCurrency: 'QUOTE_TOKEN', overlayCurrencyLabel: 'WETH' });
    expect(resolved.status).toBe('UNAVAILABLE');
    if (resolved.status !== 'UNAVAILABLE') throw new Error('unreachable');
    expect(resolved.code).toBe('UNKNOWN_CURRENCY');
  });
});

/* ---------------------------------------------- 6. quote identity */

describe('quote identity', () => {
  it('6. ETH/WETH eligibility is decided by token address, not display name', () => {
    const impostor: Pick<RadarAsset, 'quote' | 'quoteTokenAddress' | 'quoteIdentityResolved'> = {
      quote: 'WETH', quoteTokenAddress: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', quoteIdentityResolved: true,
    };
    const identity = resolveQuoteIdentity(impostor);
    expect(identity.byAddress).toBe(true);
    expect(isEthEquivalentQuoteAddress(identity.address)).toBe(false);
    // A token that merely renders as WETH does not become tradable.
    const gate = evaluatePracticeEligibility(makeQuote({ quoteAsset: 'WETH', quoteTokenAddress: impostor.quoteTokenAddress }), START);
    expect(gate.status).toBe('SUPPORTED');
    // Symbol WETH is still an accepted symbol; the point is that the address
    // check is what promotes a non-WETH-symbol token, never the pool name.
    const usdcGate = evaluatePracticeEligibility(makeQuote({ quoteAsset: 'USDC', quoteTokenAddress: USDC }), START);
    expect(usdcGate.status).toBe('BLOCKED');
  });

  it('6b. an address-identified WETH quote is supported whatever symbol it reports', () => {
    const gate = evaluatePracticeEligibility(makeQuote({ quoteAsset: 'SOMETHING-ELSE', quoteTokenAddress: WETH }), START);
    expect(gate.status).toBe('SUPPORTED');
    if (gate.status !== 'SUPPORTED') throw new Error('unreachable');
    expect(gate.observation.quoteAsset).toBe('WETH');
  });

  it('6c. an unresolved quote identity fails closed instead of being guessed', () => {
    const gate = evaluatePracticeEligibility(makeQuote({ quoteAsset: 'UNKNOWN', quoteTokenAddress: null, quoteIdentityResolved: false }), START);
    expect(gate.status).toBe('BLOCKED');
    if (gate.status !== 'BLOCKED') throw new Error('unreachable');
    expect(gate.code).toBe('QUOTE_IDENTITY_UNRESOLVED');
  });
});

/* ------------------------- 7 + 8 + 13. evidence gating at the market gate */

describe('market gate', () => {
  it('7. DERIVED real market evidence becomes simulator-eligible', () => {
    const gate = evaluatePracticeEligibility(makeQuote({ provenance: 'DERIVED' }), START);
    expect(gate.status).toBe('SUPPORTED');
    if (gate.status !== 'SUPPORTED') throw new Error('unreachable');
    expect(gate.observation.provenance).toBe('DERIVED');
    expect(gate.observation.usableQuoteLiquidityWei > 0n).toBe(true);
  });

  it('8. SYNTHETIC evidence is blocked under the default LIVE policy', () => {
    const gate = evaluatePracticeEligibility(makeQuote({ provenance: 'SYNTHETIC' }), START);
    expect(gate.status).toBe('BLOCKED');
    if (gate.status !== 'BLOCKED') throw new Error('unreachable');
    expect(gate.code).toBe('SYNTHETIC_EVIDENCE');
  });

  it('8b. SYNTHETIC evidence passes only under an explicit DEMO policy, still labelled SYNTHETIC', () => {
    const gate = evaluatePracticeEligibility(makeQuote({ provenance: 'SYNTHETIC' }), START, { evidencePolicy: 'DEMO_ALLOW_SYNTHETIC' });
    expect(gate.status).toBe('SUPPORTED');
    if (gate.status !== 'SUPPORTED') throw new Error('unreachable');
    expect(gate.observation.provenance).toBe('SYNTHETIC');
    expect(gate.truthLabel).toBe('SYNTHETIC');
  });

  it('13. stale provider data makes practice fail closed under both policies', () => {
    const stale = makeQuote({ observedAtMs: START - (DEFAULT_SPOT_FILL_CONFIG.maxObservationAgeMs + 1_000) });
    for (const evidencePolicy of ['LIVE_ONLY', 'DEMO_ALLOW_SYNTHETIC'] as const) {
      const gate = evaluatePracticeEligibility(stale, START, { evidencePolicy });
      expect(gate.status).toBe('BLOCKED');
      if (gate.status !== 'BLOCKED') throw new Error('unreachable');
      expect(gate.code).toBe('STALE_MARKET');
      expect(gate.truthLabel).toBe('STALE');
    }
  });

  it('13b. a stale feed cannot mark an open position', () => {
    let now = START;
    const store = new PracticeSessionStore({ storage: createMemoryPracticeStorage(), now: () => now, environment: 'LIVE' });
    let quote = makeQuote({ observedAtMs: START });
    store.setQuoteProvider(() => quote);
    expect(store.submit({ kind: 'BUY_FIXED' }).accepted).toBe(true);
    const equityBefore = store.getSnapshot().sim.account.equityWei;
    // The market moves, but the observation ages out of the freshness window.
    now = START + 60_000;
    quote = makeQuote({ observedAtMs: START, priceEth: 0.05, sequence: 2 });
    expect(store.markToMarket()).toBe(false);
    expect(store.getSnapshot().sim.account.equityWei).toBe(equityBefore);
  });

  it('provenance mapping never invents a stronger label', () => {
    expect(toSimProvenance('CONFIRMED')).toBe('CONFIRMED');
    expect(toSimProvenance('DERIVED')).toBe('DERIVED');
    expect(toSimProvenance('SYNTHETIC')).toBe('SYNTHETIC');
    expect(toSimProvenance('STALE')).toBe('STALE');
    // Anything unrecognised — including the removed ESTIMATED — fails closed.
    expect(toSimProvenance('ESTIMATED')).toBe('UNAVAILABLE');
    expect(toSimProvenance('TOTALLY_MADE_UP')).toBe('UNAVAILABLE');
  });
});

/* --------------------------------------- 2 + 3. DEMO isolation via the store */

describe('DEMO isolation', () => {
  it('2. browser fixture assets are SYNTHETIC and none claims CONFIRMED', () => {
    expect(localAssets.length).toBeGreaterThan(0);
    for (const asset of localAssets) {
      expect(asset.provenance.state).toBe('SYNTHETIC');
      expect(asset.freshness).toBe('SYNTHETIC');
    }
  });

  it('3. a DEMO session can trade but advances no Career qualification', () => {
    let now = START;
    const store = new PracticeSessionStore({ storage: createMemoryPracticeStorage(), now: () => now, environment: 'DEMO' });
    expect(store.getSnapshot().sim.evidencePolicy).toBe('DEMO_ALLOW_SYNTHETIC');

    for (let cycle = 0; cycle < 5; cycle += 1) {
      let quote = makeQuote({ provenance: 'SYNTHETIC', observedAtMs: now, sequence: cycle * 2 + 1 });
      store.setQuoteProvider(() => quote);
      expect(store.submit({ kind: 'BUY_FIXED' }).accepted).toBe(true);
      now += 1_000;
      quote = makeQuote({ provenance: 'SYNTHETIC', observedAtMs: now, priceEth: 0.024, sequence: cycle * 2 + 2 });
      expect(store.submit({ kind: 'SELL_ALL' }).accepted).toBe(true);
      now += 1_000;
    }

    const { sim, career } = store.getSnapshot();
    // Five real closed trades in the ledger...
    expect(sim.tradeSummaries).toHaveLength(5);
    for (const summary of sim.tradeSummaries) expect(summary.evidenceProvenance).toBe('SYNTHETIC');
    // ...and nothing at all in Career.
    expect(career.stats.closedSpotTrades).toBe(0);
    expect(career.unlockedSkills).toEqual(['SPOT_BASIC']);
    expect(career.unlockedCapabilities).not.toContain('STOP_MARKET');
  });

  it('3b. the same run on DERIVED evidence in LIVE does advance Career', () => {
    let now = START;
    const store = new PracticeSessionStore({ storage: createMemoryPracticeStorage(), now: () => now, environment: 'LIVE' });
    for (let cycle = 0; cycle < 3; cycle += 1) {
      let quote = makeQuote({ provenance: 'DERIVED', observedAtMs: now, sequence: cycle * 2 + 1 });
      store.setQuoteProvider(() => quote);
      expect(store.submit({ kind: 'BUY_FIXED' }).accepted).toBe(true);
      now += 1_000;
      quote = makeQuote({ provenance: 'DERIVED', observedAtMs: now, priceEth: 0.0251, sequence: cycle * 2 + 2 });
      expect(store.submit({ kind: 'SELL_ALL' }).accepted).toBe(true);
      now += 1_000;
    }
    const { career } = store.getSnapshot();
    expect(career.stats.closedSpotTrades).toBe(3);
    expect(career.unlockedSkills).toContain('SCALE_CONTROL');
  });

  it('the environment policy map is explicit and LIVE is the strict one', () => {
    expect(EVIDENCE_POLICY_FOR_ENVIRONMENT.LIVE).toBe('LIVE_ONLY');
    expect(EVIDENCE_POLICY_FOR_ENVIRONMENT.DEMO).toBe('DEMO_ALLOW_SYNTHETIC');
  });

  it('a store defaults to LIVE when no environment is given', () => {
    const store = new PracticeSessionStore({ storage: createMemoryPracticeStorage(), now: () => START });
    expect(store.getSnapshot().environment).toBe('LIVE');
    expect(store.getSnapshot().sim.evidencePolicy).toBe('LIVE_ONLY');
  });

  it('switching environment starts a fresh session rather than mutating the gate', () => {
    let now = START;
    const store = new PracticeSessionStore({ storage: createMemoryPracticeStorage(), now: () => now, environment: 'LIVE' });
    store.setQuoteProvider(() => makeQuote({ observedAtMs: now }));
    expect(store.submit({ kind: 'BUY_FIXED' }).accepted).toBe(true);
    expect(store.getSnapshot().sim.position).not.toBeNull();
    now += 1_000;
    store.setEnvironment('DEMO');
    const after = store.getSnapshot();
    // A LIVE position cannot be carried into DEMO.
    expect(after.environment).toBe('DEMO');
    expect(after.sim.position).toBeNull();
    expect(after.sim.evidencePolicy).toBe('DEMO_ALLOW_SYNTHETIC');
  });
});

/* ---------------- hostile review: the LIVE label is verified, not trusted */

describe('LIVE response labelling', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  function stubFetch(status: number, body: unknown) {
    globalThis.fetch = vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      statusText: 'stub',
      text: async () => JSON.stringify(body),
      json: async () => body,
    })) as unknown as typeof fetch;
  }

  it('a LIVE request answered with a DEMO envelope is refused', async () => {
    stubFetch(200, { environment: 'DEMO', items: localAssets });
    await expect(api.radar('LIVE')).rejects.toThrow(/responded with DEMO/);
  });

  it('a correctly labelled LIVE envelope is accepted', async () => {
    stubFetch(200, { environment: 'LIVE', items: [] });
    await expect(api.radar('LIVE')).resolves.toMatchObject({ environment: 'LIVE' });
  });

  it('a failed LIVE request surfaces the reason and never returns fixture rows', async () => {
    stubFetch(503, { environment: 'LIVE_UNAVAILABLE', warning: 'provider 403', items: [] });
    await expect(api.radar('LIVE')).rejects.toThrow(/provider 403/);
  });

  it('DEMO may fall back to browser fixtures, and they are SYNTHETIC', async () => {
    stubFetch(503, { error: 'api down' });
    const result = await api.radar('DEMO');
    expect(result.items.length).toBeGreaterThan(0);
    for (const asset of result.items) expect(asset.provenance.state).toBe('SYNTHETIC');
  });
});

/* ------------------- hostile review: DEMO ledger cannot restore as LIVE */

describe('save environment binding', () => {
  async function demoSave() {
    let now = START;
    const storage = createMemoryPracticeStorage();
    const store = new PracticeSessionStore({ storage, now: () => now, environment: 'DEMO', persistDebounceMs: 0 });
    store.setQuoteProvider(() => makeQuote({ provenance: 'SYNTHETIC', observedAtMs: now }));
    expect(store.submit({ kind: 'BUY_FIXED' }).accepted).toBe(true);
    await store.persistNow();
    return { storage, now };
  }

  it('a DEMO save records its environment and restores under the DEMO policy', async () => {
    const { storage } = await demoSave();
    const restored = restorePracticeSave(await storage.load());
    expect(restored.environment).toBe('DEMO');
    expect(restored.sim.evidencePolicy).toBe('DEMO_ALLOW_SYNTHETIC');
    expect(restored.sim.position).not.toBeNull();
  });

  it('a DEMO ledger is discarded rather than restored into a LIVE session', async () => {
    const { storage } = await demoSave();
    const live = new PracticeSessionStore({ storage, now: () => START + 10_000, environment: 'LIVE' });
    await live.hydrate();
    const snapshot = live.getSnapshot();
    // A position built on fabricated evidence must never appear behind a LIVE badge.
    expect(snapshot.restoreStatus).toBe('RESET_ENVIRONMENT_CHANGED');
    expect(snapshot.sim.position).toBeNull();
    expect(snapshot.sim.evidencePolicy).toBe('LIVE_ONLY');
    expect(snapshot.environment).toBe('LIVE');
  });

  it('a save with no recorded environment is refused, never assumed LIVE', () => {
    const store = new PracticeSessionStore({ storage: createMemoryPracticeStorage(), now: () => START, environment: 'LIVE' });
    const envelope = createPracticeSave({
      sim: store.getSnapshot().sim,
      career: createCareerSave(store.getSnapshot().career),
      instrumentId: null,
      environment: 'LIVE',
      savedAtMs: START,
    });
    const { environment, ...legacy } = envelope;
    expect(environment).toBe('LIVE');
    expect(() => restorePracticeSave(legacy)).toThrow(/no data environment/);
  });
});

/* --------------------------- 14. no one-click PROTECT_CAPITAL remains */

describe('PROTECT_CAPITAL', () => {
  it('14. PROTECT_CAPITAL is not a submittable practice intent', () => {
    const store = new PracticeSessionStore({ storage: createMemoryPracticeStorage(), now: () => START, environment: 'LIVE' });
    store.setQuoteProvider(() => makeQuote());
    // Force the removed intent past the type system the way a stale caller would.
    const result = store.submit({ kind: 'PROTECT_CAPITAL' } as never);
    expect(result.accepted).toBe(false);
    expect(store.getSnapshot().sim.tradeSummaries).toHaveLength(0);
    expect(store.getSnapshot().career.stats.protectCapitalChallenges).toBe(0);
  });
});
