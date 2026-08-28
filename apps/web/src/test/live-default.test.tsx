/**
 * LIVE_DEFAULT_FAIL_CLOSED.
 *
 * The application must attempt LIVE evidence first, and a LIVE failure must
 * produce a visible degraded state rather than a quiet substitution of
 * synthetic data. DEMO stays available, but only as a deliberate choice.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MarketFeedHandlers } from '../lib/market-feed';
import { localAssets } from '../lib/local-fixtures';
import { createMemoryPracticeStorage } from '../practice/persistence';
import type { RadarAsset } from '../types/api';

class FakeChart {
  load() {}
  update() {}
  setFillStamps() {}
  setEntryLine() {}
  setStopLine() {}
  destroy() {}
}
vi.mock('../lib/chart', () => ({ MarketChart: FakeChart }));

let connectedEnvironments: string[] = [];
vi.mock('../lib/market-feed', () => ({
  connectMarketFeed: (options: { environment: string; handlers: MarketFeedHandlers }) => {
    connectedEnvironments.push(options.environment);
    return () => {};
  },
}));

const WETH = '0x4200000000000000000000000000000000000006';
const liveAssets: RadarAsset[] = localAssets.slice(0, 3).map((asset) => ({
  ...asset,
  quoteTokenAddress: asset.quote === 'WETH' ? WETH : asset.quoteTokenAddress ?? null,
  quoteIdentityResolved: true,
  freshness: 'DERIVED' as const,
  provenance: { state: 'DERIVED' as const, source: 'GECKOTERMINAL', asOf: new Date().toISOString(), method: 'live provider double' },
}));

/** Records every environment the client asked for, in order. */
const radarCalls: string[] = [];
let radarBehaviour: (environment: string) => Promise<{ environment: string; items: RadarAsset[] }> = async (environment) => ({
  environment,
  items: liveAssets,
});

vi.mock('../lib/api', () => ({
  api: {
    radar: (environment: string) => {
      radarCalls.push(environment);
      return radarBehaviour(environment);
    },
    status: async () => ({ ok: true, blockNumber: 4213 }),
    bars: async () => ({ bars: [], currency: 'QUOTE_TOKEN', currencyLabel: 'WETH' }),
    trades: async () => ({ trades: [] }),
    wallet: async () => { throw new Error('not used'); },
    nft: async () => { throw new Error('not used'); },
    search: async () => ({ items: [] }),
  },
  streamUrl: () => 'ws://test',
}));

async function mountApp() {
  const { default: App, createRuntime } = await import('../App');
  const runtime = createRuntime(createMemoryPracticeStorage());
  const view = render(<App runtime={runtime} />);
  return { view, runtime };
}

beforeEach(() => {
  radarCalls.length = 0;
  connectedEnvironments = [];
  radarBehaviour = async (environment) => ({ environment, items: liveAssets });
});

describe('LIVE by default, fail closed', () => {
  it('5. LIVE is attempted first, without any DEMO request', async () => {
    await mountApp();
    await waitFor(() => expect(radarCalls.length).toBeGreaterThan(0));
    expect(radarCalls[0]).toBe('LIVE');
    expect(radarCalls).not.toContain('DEMO');
    // The environment badge names LIVE explicitly (the select option shares the
    // word, so this is scoped to the badge itself).
    const badge = document.querySelector('.env-badge');
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent('LIVE');
  });

  it('5b. the practice session boots with the LIVE_ONLY evidence policy', async () => {
    const { runtime } = await mountApp();
    await waitFor(() => expect(radarCalls.length).toBeGreaterThan(0));
    expect(runtime.session.getSnapshot().environment).toBe('LIVE');
    expect(runtime.session.getSnapshot().sim.evidencePolicy).toBe('LIVE_ONLY');
  });

  it('4. a LIVE provider failure shows a degraded state and does not load DEMO rows', async () => {
    radarBehaviour = async () => { throw new Error('provider 503'); };
    const { runtime } = await mountApp();

    await screen.findByText('LIVE EVIDENCE UNAVAILABLE');
    expect(screen.getByText(/provider 503/)).toBeInTheDocument();
    // Never silently switched.
    expect(radarCalls).toEqual(['LIVE']);
    expect(runtime.session.getSnapshot().environment).toBe('LIVE');
    expect(runtime.session.getSnapshot().sim.evidencePolicy).toBe('LIVE_ONLY');
    // No synthetic rows leaked into the table.
    expect(screen.queryByText('SQUID')).toBeNull();
    expect(connectedEnvironments).not.toContain('DEMO');
  });

  it('4b. an empty LIVE result is reported as unavailable, not filled in', async () => {
    radarBehaviour = async (environment) => ({ environment, items: [] });
    await mountApp();
    await screen.findByText('LIVE EVIDENCE UNAVAILABLE');
    expect(radarCalls).toEqual(['LIVE']);
  });

  it('4c. DEMO is reachable only by explicit choice, and announces itself', async () => {
    radarBehaviour = async () => { throw new Error('provider 503'); };
    const { runtime } = await mountApp();
    await screen.findByText('LIVE EVIDENCE UNAVAILABLE');

    fireEvent.click(screen.getByRole('button', { name: /SWITCH TO DEMO/ }));

    await waitFor(() => expect(radarCalls).toContain('DEMO'));
    // The user is told, in words, that everything on screen is synthetic.
    await screen.findByText(/Every price, trade and wallet on screen is synthetic development data/);
    expect(screen.getByText('DEMO · SYNTHETIC DATA')).toBeInTheDocument();
    expect(runtime.session.getSnapshot().environment).toBe('DEMO');
    expect(runtime.session.getSnapshot().sim.evidencePolicy).toBe('DEMO_ALLOW_SYNTHETIC');
  });

  it('4d. selecting DEMO from the environment control is equally explicit', async () => {
    await mountApp();
    await waitFor(() => expect(radarCalls[0]).toBe('LIVE'));
    fireEvent.change(screen.getByLabelText('Data environment'), { target: { value: 'DEMO' } });
    await waitFor(() => expect(radarCalls).toContain('DEMO'));
    await screen.findByText('DEMO · SYNTHETIC DATA');
  });
});
