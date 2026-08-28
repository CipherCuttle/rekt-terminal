import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './lib/api';
import { connectMarketFeed } from './lib/market-feed';
import { TapeBuffer } from './lib/tape-buffer';
import { formatEth } from './practice/format';
import { MarketFeedStore } from './practice/feed-store';
import { PracticeSessionStore, type PracticeIntent } from './practice/store';
import { createDexiePracticeStorage, type PracticeStorage } from './practice/persistence';
import { PracticeProvider, useFeedSnapshot, usePracticeRuntime, usePracticeSnapshot, type PracticeRuntime } from './practice/react';
import { quoteFromRadarAsset } from './practice/quote';
import { RadarScreen } from './screens/RadarScreen';
import { CareerScreen } from './screens/CareerScreen';
import { DevScreen, WalletDrawer } from './screens/DevScreen';
import { TerminalScreen, type ChartSink } from './terminal/TerminalScreen';
import { TradeReviewCard } from './terminal/TradeReviewCard';
import type { RadarAsset, WalletTrace } from './types/api';

type Screen = 'radar' | 'terminal' | 'career' | 'dev';
type DataMode = 'fixture' | 'live';

const PRIMARY_NAV: readonly { id: Screen; label: string }[] = [
  { id: 'radar', label: 'RADAR' },
  { id: 'terminal', label: 'TERMINAL' },
  { id: 'career', label: 'CAREER' },
];

/** Cadence for re-marking an open position and re-checking market freshness. */
const HEARTBEAT_MS = 1000;

function devEnabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('dev') === '1';
  } catch {
    return false;
  }
}

/**
 * Build the production runtime: an IndexedDB-backed practice session plus the
 * market-data store it reads quotes from. Exported so tests can construct the
 * same wiring with in-memory storage.
 */
export function createRuntime(storage: PracticeStorage = createDexiePracticeStorage()): PracticeRuntime {
  const feed = new MarketFeedStore();
  const session = new PracticeSessionStore({ storage, getQuote: feed.currentQuote });
  return { session, feed };
}

export default function App({ runtime: injected }: { runtime?: PracticeRuntime } = {}) {
  const runtime = useMemo(() => injected ?? createRuntime(), [injected]);

  useEffect(() => {
    void runtime.session.hydrate();
    return () => {
      runtime.session.dispose();
      runtime.feed.dispose();
    };
  }, [runtime]);

  return (
    <PracticeProvider runtime={runtime}>
      <Shell />
    </PracticeProvider>
  );
}

function Shell() {
  const { session, feed } = usePracticeRuntime();
  const practice = usePracticeSnapshot();
  const feedSnapshot = useFeedSnapshot();

  const [mode, setMode] = useState<DataMode>('fixture');
  const [scenario, setScenario] = useState('NORMAL');
  const [items, setItems] = useState<RadarAsset[]>([]);
  const [selected, setSelected] = useState<RadarAsset | null>(null);
  const [screen, setScreen] = useState<Screen>('radar');
  const [wallet, setWallet] = useState<WalletTrace | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<any>(null);
  const showDev = useMemo(devEnabled, []);

  const tape = useMemo(() => new TapeBuffer(), []);
  const chartSink = useRef<ChartSink | null>(null);

  useEffect(() => () => tape.dispose(), [tape]);

  /* -------------------------------------------------------------- discovery */

  useEffect(() => {
    let cancelled = false;
    api
      .radar(mode)
      .then((response) => {
        if (cancelled) return;
        setItems(response.items);
        setSelected((current) => current ?? response.items[0] ?? null);
        if (mode === 'live' && response.items.length === 0) setSelected(null);
      })
      .catch(() => {
        if (cancelled || mode !== 'live') return;
        setItems([]);
        setSelected(null);
      });
    api.status().then(setStatus).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    const timer = setInterval(() => api.status().then(setStatus).catch(() => {}), 10_000);
    return () => clearInterval(timer);
  }, []);

  /* ------------------------------------------------------------------ feed */

  // The feed stays bound to the selected instrument regardless of which screen
  // is showing, so an open position keeps being marked from real evidence.
  useEffect(() => {
    if (!selected) {
      feed.setInstrument(null);
      return undefined;
    }
    const nowMs = Date.now();
    // Fixture rows carry a frozen replay timestamp; the terminal treats the
    // deterministic replay as observed now, and the source id keeps saying
    // FIXTURE so nothing is relabelled as live.
    feed.setInstrument(quoteFromRadarAsset(selected, nowMs, 0, mode === 'fixture' ? nowMs : undefined));
    tape.clear();

    return connectMarketFeed({
      asset: selected,
      mode,
      scenario,
      handlers: {
        onChartTick: (tick) => chartSink.current?.tick(tick),
        onSweep: () => {},
        onTape: (rows) => tape.push(rows),
        onQuote: (tick) => feed.pushTick(tick),
        onConnection: (state) => feed.setConnection(state),
        onHead: (head) => feed.setHeadBlock(head),
        onDropped: (count) => feed.setDroppedTicks(count),
      },
    });
  }, [selected, mode, scenario, feed, tape]);

  // Heartbeat: refresh the freshness verdict, then let the simulator re-mark an
  // open position. Never the other way round — a stale feed marks nothing.
  useEffect(() => {
    const timer = setInterval(() => {
      feed.refreshFreshness();
      session.markToMarket();
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [feed, session]);

  /* --------------------------------------------------------------- actions */

  const openTerminal = useCallback((asset: RadarAsset) => {
    setSelected(asset);
    setScreen('terminal');
  }, []);

  const submit = useCallback((intent: PracticeIntent) => session.submit(intent), [session]);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    const local = items.find((asset) => asset.symbol.toLowerCase() === q.toLowerCase() || asset.tokenAddress.toLowerCase() === q.toLowerCase());
    if (local) {
      openTerminal(local);
      return;
    }
    try {
      const result = await api.search(q);
      const pair = result.items?.[0];
      if (!pair) return;
      const asset: RadarAsset = {
        id: pair.pairAddress,
        symbol: pair.baseToken?.symbol || 'TOKEN',
        name: pair.baseToken?.name || 'Unknown',
        chainId: 57073,
        quote: pair.quoteToken?.symbol || 'WETH',
        venue: pair.dexId || 'INK DEX',
        pairAddress: pair.pairAddress,
        tokenAddress: pair.baseToken?.address || '',
        verified: false,
        priceEth: Number(pair.priceNative || 0) || null,
        priceUsd: Number(pair.priceUsd || 0) || null,
        change5m: Number(pair.priceChange?.m5 || 0) || 0,
        change1h: Number(pair.priceChange?.h1 || 0) || 0,
        change6h: Number(pair.priceChange?.h6 || 0) || 0,
        buys: Number(pair.txns?.h24?.buys || 0) || 0,
        sells: Number(pair.txns?.h24?.sells || 0) || 0,
        buyers: null,
        volume24hUsd: Number(pair.volume?.h24 || 0) || 0,
        liquidityUsd: Number(pair.liquidity?.usd || 0) || 0,
        fdvUsd: Number(pair.fdv || 0) || null,
        ageMinutes: pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 60000 : null,
        heat: null,
        freshness: 'DERIVED',
        imageUrl: pair.info?.imageUrl,
        provenance: { state: 'DERIVED', source: 'DEXSCREENER', asOf: new Date().toISOString(), method: 'search result' },
      };
      setMode('live');
      setItems((current) => [asset, ...current.filter((entry) => entry.pairAddress !== asset.pairAddress)]);
      openTerminal(asset);
    } catch {
      /* search failure leaves the current selection untouched */
    }
  }, [items, openTerminal, query]);

  const loadWallet = useCallback(
    async (address: string) => {
      try {
        setWallet(await api.wallet(address, mode));
      } catch {
        setWallet(null);
      }
    },
    [mode],
  );

  /* ----------------------------------------------------------------- render */

  const { sim, career, tradeReview, lastRejection, restoreStatus } = practice;
  const reviewOpen = Boolean(tradeReview && selected);

  return (
    <>
      {/* The review is a sibling of the shell, and the shell goes inert while it
          is open, so focus cannot wander behind the modal. */}
      <div id="app" inert={reviewOpen}>
      <header id="topbar">
        <div className="brand-block">
          <span className="brand">
            REKT<span className="brand-slash">//</span>INK
          </span>
          <span className="brand-sub">SPOT PRACTICE TERMINAL</span>
        </div>

        <nav className="nav nav-primary" aria-label="Primary">
          {PRIMARY_NAV.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={screen === entry.id ? 'active' : ''}
              aria-current={screen === entry.id ? 'page' : undefined}
              onClick={() => setScreen(entry.id)}
            >
              {entry.label}
            </button>
          ))}
          {showDev && (
            <button type="button" className={screen === 'dev' ? 'active' : ''} onClick={() => setScreen('dev')}>
              DEV
            </button>
          )}
        </nav>

        <input
          className="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && search()}
          placeholder="SEARCH / PASTE 0x CONTRACT"
          aria-label="Search pairs"
        />

        <div className="grow" />

        <div className="account-readout" role="group" aria-label="Practice equity">
          <span className="account-label">PRACTICE</span>
          <span className="account-value num">{formatEth(sim.account.equityWei)}</span>
          <span className="account-unit">ETH</span>
        </div>

        {mode === 'fixture' && (
          <select className="scenario-select" value={scenario} onChange={(event) => setScenario(event.target.value)} aria-label="Replay load">
            <option>NORMAL</option>
            <option>ACTIVE</option>
            <option>MANIA</option>
            <option>PATHOLOGICAL</option>
          </select>
        )}
        <select className="mode-select" value={mode} onChange={(event) => setMode(event.target.value as DataMode)} aria-label="Data source">
          <option value="fixture">DATA · FIXTURE</option>
          <option value="live">DATA · LIVE</option>
        </select>
      </header>

      {restoreStatus === 'RESET_SAVE_UNUSABLE' && (
        <p className="save-notice" role="status">
          A stored practice session could not be replayed and was discarded. Starting from {formatEth(sim.account.freeEthWei)} ETH.
        </p>
      )}

      <main>
        {screen === 'radar' && <RadarScreen items={items} onOpen={openTerminal} />}

        {screen === 'terminal' &&
          (selected ? (
            <TerminalScreen
              asset={selected}
              mode={mode}
              sim={sim}
              career={career}
              feed={feedSnapshot}
              tape={tape}
              rejection={lastRejection}
              chartSink={chartSink}
              onSubmit={submit}
              onDismissRejection={() => session.clearRejection()}
              showWalletTools={showDev}
              onWallet={loadWallet}
            />
          ) : (
            <section className="screen">
              <div className="panel empty">
                NO INSTRUMENT SELECTED
                <br />
                <small>OPEN A SUPPORTED PAIR FROM RADAR.</small>
              </div>
            </section>
          ))}

        {screen === 'career' && <CareerScreen career={career} />}
        {screen === 'dev' && showDev && <DevScreen mode={mode} onWallet={loadWallet} />}
      </main>

      <nav className="bottom-nav" aria-label="Primary mobile">
        {PRIMARY_NAV.map((entry) => (
          <button key={entry.id} type="button" className={screen === entry.id ? 'active' : ''} aria-current={screen === entry.id ? 'page' : undefined} onClick={() => setScreen(entry.id)}>
            {entry.label}
          </button>
        ))}
      </nav>

      <footer id="statusbar">
        <span className={`chip ${status?.ok ? 'ok' : 'warn'}`}>INK {status?.blockNumber ? `HEAD ${status.blockNumber}` : 'HEAD —'}</span>
        <span className="chip">SOURCE {mode.toUpperCase()}</span>
        {mode === 'fixture' && <span className="chip">LOAD {scenario}</span>}
        <span className="chip">SIM {sim.modelVersion}</span>
        <div className="grow" />
        <span className="chip">PRACTICE ONLY · NO REAL EXECUTION</span>
      </footer>

      </div>
      {tradeReview && selected && (
        <TradeReviewCard review={tradeReview} symbol={selected.symbol} onDismiss={() => session.dismissTradeReview()} />
      )}
      {wallet && <WalletDrawer data={wallet} onClose={() => setWallet(null)} />}
    </>
  );
}
