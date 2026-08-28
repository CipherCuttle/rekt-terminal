/**
 * Interface tests for the MVP loop.
 *
 * The chart and the feed transport are mocked so the test can drive market
 * evidence deterministically; the simulator, Career and the practice store are
 * the real thing.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SimEvent } from '@rekt-ink/sim';
import type { ChartFillStamp } from '../lib/chart';
import type { MarketFeedHandlers } from '../lib/market-feed';
import { localAssets } from '../lib/local-fixtures';
import { createMemoryPracticeStorage } from '../practice/persistence';

/* ------------------------------------------------------------------ mocks */

const chartInstances: FakeChart[] = [];

class FakeChart {
  stamps: readonly ChartFillStamp[] = [];
  entryPrice: number | null = null;
  loaded = 0;
  ticks: unknown[] = [];

  constructor() {
    chartInstances.push(this);
  }
  load() {
    this.loaded += 1;
  }
  update(...args: unknown[]) {
    this.ticks.push(args);
  }
  setFillStamps(stamps: readonly ChartFillStamp[]) {
    this.stamps = stamps;
  }
  setEntryLine(price: number | null) {
    this.entryPrice = price;
  }
  destroy() {}
}

vi.mock('../lib/chart', () => ({ MarketChart: FakeChart }));

let feedHandlers: MarketFeedHandlers | null = null;
vi.mock('../lib/market-feed', () => ({
  connectMarketFeed: (options: { handlers: MarketFeedHandlers }) => {
    feedHandlers = options.handlers;
    return () => {
      feedHandlers = null;
    };
  },
}));

vi.mock('../lib/api', () => ({
  api: {
    radar: async () => ({ mode: 'fixture', items: localAssets }),
    status: async () => ({ ok: true, blockNumber: 4213 }),
    bars: async () => [],
    trades: async () => ({ trades: [] }),
    wallet: async () => {
      throw new Error('not used');
    },
    nft: async () => {
      throw new Error('not used');
    },
    search: async () => ({ items: [] }),
  },
  streamUrl: () => 'ws://test',
}));

/* --------------------------------------------------------------- harness */

async function mountApp() {
  const { default: App, createRuntime } = await import('../App');
  const runtime = createRuntime(createMemoryPracticeStorage());
  const view = render(<App runtime={runtime} />);
  await screen.findByRole('table');
  return { view, runtime };
}

/**
 * Open an instrument from Radar by symbol, scoped to the table: tab names and
 * asset symbols overlap (there is both a REKT tab and a REKT pair).
 */
async function openFromRadar(symbol: string) {
  const table = await screen.findByRole('table');
  const cell = await within(table).findByText(symbol, { selector: 'b' });
  fireEvent.click(cell.closest('tr')!);
  await screen.findByRole('heading', { level: 1 });
}

function ticket() {
  return screen.getByRole('region', { name: 'Trade ticket' });
}

async function buy() {
  fireEvent.click(within(ticket()).getByRole('button', { name: /BUY/ }));
  await screen.findByRole('region', { name: 'Open position' });
}

async function sellAll() {
  fireEvent.click(within(ticket()).getByRole('button', { name: /SELL ALL/ }));
  await screen.findByRole('dialog');
}

async function dismissReview() {
  fireEvent.click(screen.getByRole('button', { name: /DISMISS/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

beforeEach(() => {
  chartInstances.length = 0;
  feedHandlers = null;
});

/* ---------------------------------------------------------------- tests */

describe('MVP terminal loop', () => {
  it('1. selecting a supported asset on Radar opens the Terminal with that instrument', async () => {
    const { runtime } = await mountApp();
    await openFromRadar('NOIR');

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('NOIR');
    expect(heading).toHaveTextContent('/WETH');

    const asset = localAssets.find((entry) => entry.symbol === 'NOIR')!;
    expect(runtime.feed.currentQuote()?.instrumentId).toBe(`INK:${asset.pairAddress.toLowerCase()}`);
    expect(runtime.feed.getSnapshot().eligibility?.status).toBe('SUPPORTED');
  });

  it('2. the initial practice account displays 0.5000 ETH', async () => {
    await mountApp();
    await openFromRadar('REKT');
    const account = screen.getByRole('region', { name: 'Account' });
    // Flat account: free ETH and equity are both the untouched bankroll.
    expect(within(account).getAllByText('0.5000')).toHaveLength(2);
    expect(within(account).getByText('FREE ETH')).toBeInTheDocument();
    expect(within(account).getByText('EQUITY')).toBeInTheDocument();
    expect(within(account).getByText('NO OPEN POSITION')).toBeInTheDocument();
    // And on the persistent header readout.
    const readout = screen.getByRole('group', { name: 'Practice equity' });
    expect(within(readout).getByText('0.5000')).toBeInTheDocument();
  });

  it('4. an accepted BUY renders a position snapshot from simulator state', async () => {
    const { runtime } = await mountApp();
    await openFromRadar('REKT');
    await buy();

    const position = screen.getByRole('region', { name: 'Open position' });
    expect(within(position).getByText('QUANTITY')).toBeInTheDocument();
    expect(within(position).getByText('AVG ENTRY')).toBeInTheDocument();
    expect(within(position).getByText('MEDIAN ENTRY FILL')).toBeInTheDocument();
    expect(within(position).getByText('UNREALIZED PNL')).toBeInTheDocument();
    expect(runtime.session.getSnapshot().sim.position).not.toBeNull();
  });

  it('5. the chart receives a fill stamp built from the simulator fill', async () => {
    const { runtime } = await mountApp();
    await openFromRadar('REKT');
    await buy();

    const chart = chartInstances.at(-1)!;
    await waitFor(() => expect(chart.stamps.length).toBe(1));

    const fill = runtime.session
      .getSnapshot()
      .sim.events.filter((event): event is Extract<SimEvent, { type: 'FILL_APPLIED' }> => event.type === 'FILL_APPLIED')
      .at(-1)!.fill;

    const stamp = chart.stamps[0];
    expect(stamp.id).toBe(fill.fillId);
    expect(stamp.side).toBe('BUY');
    const expectedSeconds = Math.floor(fill.executedAtMs / 1000);
    expect(stamp.timeSeconds).toBe(expectedSeconds - (expectedSeconds % 60));
    expect(stamp.price).toBeCloseTo(Number(fill.fillPriceX18) / 1e18, 18);
    // The entry reference tracks the simulator's weighted average entry.
    expect(chart.entryPrice).toBeCloseTo(Number(runtime.session.getSnapshot().sim.position!.averageEntryPriceX18) / 1e18, 18);
  });

  it('6 + 7. SELL ALL closes the position and opens a review built from the TradeSummary', async () => {
    const { runtime } = await mountApp();
    await openFromRadar('REKT');
    await buy();
    await sellAll();

    expect(runtime.session.getSnapshot().sim.position).toBeNull();

    const review = screen.getByRole('dialog');
    expect(within(review).getByText('OUTCOME')).toBeInTheDocument();
    expect(within(review).getByText('PROCESS / QUALIFICATION')).toBeInTheDocument();
    expect(within(review).getByText('AVG EXIT')).toBeInTheDocument();
    expect(within(review).getByText('FEES PAID')).toBeInTheDocument();
    expect(within(review).getByText(/COUNTED TOWARD SCALE_CONTROL/)).toBeInTheDocument();
    expect(within(review).getByText(/CLOSED SPOT TRADES/)).toBeInTheDocument();
    expect(within(review).getByText(/profitable trade is not by itself evidence of skill/)).toBeInTheDocument();

    const summary = runtime.session.getSnapshot().sim.tradeSummaries[0];
    expect(runtime.session.getSnapshot().tradeReview?.summary).toEqual(summary);
  });

  it('8. an unsupported quote shows PRACTICE_UNAVAILABLE_V0 and disables trading', async () => {
    await mountApp();
    await openFromRadar('STBL');

    expect(screen.getByText('PRACTICE_UNAVAILABLE_V0')).toBeInTheDocument();
    expect(screen.getByText('UNSUPPORTED_QUOTE')).toBeInTheDocument();
    expect(within(ticket()).getByRole('button', { name: /BUY/ })).toBeDisabled();
  });

  it('9. a feed that goes stale disables trading in the interface', async () => {
    const { runtime } = await mountApp();
    await openFromRadar('REKT');
    expect(within(ticket()).getByRole('button', { name: /BUY/ })).toBeEnabled();

    // Push an observation older than the freshness window, then let the
    // heartbeat re-evaluate.
    feedHandlers!.onQuote({
      priceEth: 0.18,
      priceUsd: 600,
      observedAtMs: Date.now() - 120_000,
      sourceId: 'TEST',
      provenance: 'DERIVED',
    });
    runtime.feed.refreshFreshness();

    await waitFor(() => expect(screen.getByText('STALE_MARKET')).toBeInTheDocument());
    expect(screen.getByText('PRACTICE_UNAVAILABLE_V0')).toBeInTheDocument();
    expect(within(ticket()).getByRole('button', { name: /BUY/ })).toBeDisabled();
  });

  it('11 + 12. three qualifying trades unlock SCALE_CONTROL and reveal working controls', async () => {
    const { runtime } = await mountApp();
    await openFromRadar('REKT');

    // Before the unlock there is no MANAGE affordance at all — no dead buttons.
    await buy();
    expect(within(ticket()).queryByRole('button', { name: /MANAGE/ })).toBeNull();
    await sellAll();
    await dismissReview();

    await buy();
    await sellAll();
    await dismissReview();

    await buy();
    await sellAll();
    const review = screen.getByRole('dialog');
    expect(within(review).getByText('CAPABILITY UNLOCKED')).toBeInTheDocument();
    expect(within(review).getByText('SCALE_CONTROL')).toBeInTheDocument();
    await dismissReview();

    expect(runtime.session.getSnapshot().career.unlockedSkills).toContain('SCALE_CONTROL');

    await buy();
    const manage = within(ticket()).getByRole('button', { name: /MANAGE/ });
    // Collapsed until asked for: the controls must not be in the document
    // merely because the capability exists.
    expect(within(ticket()).queryByText('MANAGE POSITION')).toBeNull();
    expect(manage).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(manage);
    expect(within(ticket()).getByText('MANAGE POSITION')).toBeInTheDocument();
    expect(manage).toHaveAttribute('aria-expanded', 'true');

    const before = runtime.session.getSnapshot().sim.position!.openQuantityAtoms;
    fireEvent.click(within(ticket()).getByRole('button', { name: /SELL 50%/ }));

    const after = runtime.session.getSnapshot().sim.position!;
    expect(after.openQuantityAtoms).toBe(before - before / 2n);
    expect(after.partialExitUsed).toBe(true);
    expect(runtime.session.getSnapshot().career.stats.partialExitsUsed).toBe(1);

    // Scale-in is real too.
    fireEvent.click(within(ticket()).getByRole('button', { name: /SCALE IN/ }));
    expect(runtime.session.getSnapshot().sim.position!.entryCount).toBe(2);
  });

  it('13. clicking a blocked control repeatedly changes nothing', async () => {
    const { runtime } = await mountApp();
    await openFromRadar('STBL');
    const before = runtime.session.getSnapshot();

    const button = within(ticket()).getByRole('button', { name: /BUY/ });
    for (let i = 0; i < 40; i += 1) fireEvent.click(button);

    const after = runtime.session.getSnapshot();
    expect(after.sim.events).toEqual(before.sim.events);
    expect(after.career.stats).toEqual(before.career.stats);
  });

  it('never labels a position with an instrument it is not held on', async () => {
    const { runtime } = await mountApp();
    await openFromRadar('REKT');
    await buy();
    const rektPair = localAssets.find((entry) => entry.symbol === 'REKT')!.pairAddress.toLowerCase();
    expect(runtime.session.getSnapshot().sim.position!.instrumentId).toBe(`INK:${rektPair}`);

    // Navigate to a different instrument while the REKT position is open.
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    fireEvent.click(within(nav).getByRole('button', { name: 'RADAR' }));
    await openFromRadar('NOIR');

    expect(screen.getByText('POSITION OPEN ELSEWHERE')).toBeInTheDocument();
    const position = screen.getByRole('region', { name: 'Open position' });
    // The panel must not claim the position is a NOIR position.
    expect(within(position).queryByText(/LONG NOIR/)).toBeNull();
    expect(within(position).getByText(/LONG /)).toBeInTheDocument();
    // And trading the other instrument is refused, not silently allowed.
    expect(within(ticket()).getByRole('button', { name: /SELL ALL/ })).toBeDisabled();
  });

  it('keeps NFT and wallet forensics out of primary navigation', async () => {
    await mountApp();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getAllByRole('button').map((button) => button.textContent)).toEqual(['RADAR', 'TERMINAL', 'CAREER']);
    expect(screen.queryByText(/REKT\/\/NFT/)).toBeNull();
  });
});
