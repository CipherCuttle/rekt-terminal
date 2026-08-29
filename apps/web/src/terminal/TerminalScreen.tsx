import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { formatFixed, priceX18, type SimState } from '@rekt-ink/sim';
import type { CareerState } from '@rekt-ink/career';
import { MarketChart } from '../lib/chart';
import { api } from '../lib/api';
import { money, secondsAgo, short } from '../lib/format-display';
import type { TapeBuffer } from '../lib/tape-buffer';
import type { ChartTick } from '../lib/market-feed';
import { TruthChip } from '../components/TruthChip';
import { formatEth, formatPriceEth } from '../practice/format';
import { chartFillStampsForSim } from '../practice/chart-stamps';
import { PRACTICE_UNAVAILABLE_LABEL } from '../practice/eligibility';
import { priceX18FromNumber } from '../practice/quote';
import type { FeedSnapshot } from '../practice/feed-store';
import type { PracticeIntent, PracticeRejection } from '../practice/store';
import { resolveChartSeries, type ChartSeriesResolution } from '../lib/chart-currency';
import type { MarketEnvironment, RadarAsset } from '../types/api';
import { PositionTruth } from './PositionTruth';
import { TradeTicket } from './TradeTicket';
import { CareerStrip } from './CareerStrip';

export interface ChartSink {
  tick(tick: ChartTick): void;
}

export interface TerminalScreenProps {
  asset: RadarAsset;
  environment: MarketEnvironment;
  sim: SimState;
  career: CareerState;
  feed: FeedSnapshot;
  tape: TapeBuffer;
  rejection: PracticeRejection | null;
  chartSink: { current: ChartSink | null };
  onSubmit: (intent: PracticeIntent) => void;
  onDismissRejection: () => void;
  showWalletTools: boolean;
  onWallet: (address: string) => void;
}

/**
 * The simulator's overlays — fill stamps, average entry, the stop line — are
 * ETH-denominated because the account unit is wei. The bar series must
 * therefore be in the pool's quote token too. `resolveChartSeries` decides;
 * there is no conversion step, because the previous one (dividing 200 historical
 * USD bars by one current ETH/USD rate) was numerically false for every bar but
 * the last.
 */
const OVERLAY_CURRENCY = 'QUOTE_TOKEN' as const;

export function TerminalScreen(props: TerminalScreenProps) {
  const { asset, environment, sim, career, feed, tape, rejection, chartSink, onSubmit, onDismissRejection, showWalletTools, onWallet } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<MarketChart | null>(null);
  // Bars load asynchronously; the chart-creation effect must not paint overlays
  // from the simulator state it happened to close over.
  const simRef = useRef(sim);
  simRef.current = sim;
  const overlayLabel = asset.quote?.toUpperCase() || 'ETH';
  const [chartSeries, setChartSeries] = useState<ChartSeriesResolution | null>(null);
  const [awayFromRealtime, setAwayFromRealtime] = useState(false);

  // Chart lifecycle. The chart is imperative on purpose: ticks never pass
  // through React state.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    setAwayFromRealtime(false);
    const chart = new MarketChart(box, { onRealtimeStateChange: setAwayFromRealtime });
    chartRef.current = chart;
    chartSink.current = { tick: (tick) => chart.update(tick.price, tick.side, tick.volume, tick.timeSeconds) };

    let disposed = false;
    setChartSeries(null);
    api
      .bars(asset, environment)
      .then((series) => {
        if (disposed) return;
        const resolved = resolveChartSeries({ series, overlayCurrency: OVERLAY_CURRENCY, overlayCurrencyLabel: overlayLabel });
        setChartSeries(resolved);
        // Fail closed: bars whose denomination does not match the overlays are
        // not drawn at all, rather than rescaled into a plausible-looking lie.
        if (resolved.status !== 'OK') return;
        chart.load(resolved.bars);
        syncChartOverlays(chart, simRef.current);
      })
      .catch((error) => {
        if (disposed) return;
        setChartSeries({ status: 'UNAVAILABLE', code: 'NO_HISTORY', reason: String(error?.message || 'Historical OHLCV could not be loaded.') });
      });

    return () => {
      disposed = true;
      chartSink.current = null;
      chartRef.current = null;
      chart.destroy();
    };
  }, [asset.id, asset.pairAddress, environment, chartSink, overlayLabel]);

  // Fill stamps and the entry reference redraw whenever the simulator log grows.
  useEffect(() => {
    if (chartRef.current) syncChartOverlays(chartRef.current, sim);
  }, [sim]);

  const gate = feed.eligibility;
  const blocked = gate === null || gate.status === 'BLOCKED';
  const blockedReason = gate === null ? 'Waiting for a usable market observation.' : gate.status === 'BLOCKED' ? gate.detail : null;
  const blockedCode = gate !== null && gate.status === 'BLOCKED' ? gate.code : null;
  const truthLabel = gate?.truthLabel ?? 'UNAVAILABLE';
  const ageMs = feed.quote ? Math.max(0, feed.atMs - feed.quote.observedAtMs) : null;

  const positionElsewhere = sim.position !== null && sim.position.instrumentId !== feed.quote?.instrumentId;
  const markPrice = priceX18FromNumber(feed.quote?.priceEth ?? null);

  return (
    <section className="screen terminal-screen">
      <header className="panel instrument-head">
        <div className="instrument-id">
          <h1>
            {asset.symbol}
            <span className="instrument-quote">/{asset.quote}</span>
          </h1>
          <p className="instrument-meta">
            {asset.venue} · INK 57073 · {short(asset.pairAddress)}
          </p>
        </div>

        <div className="instrument-price">
          <span className="price-value num">{markPrice === null ? '—' : formatPriceEth(markPrice)}</span>
          <span className="price-unit">ETH</span>
          <span className="price-usd num">{money(feed.quote?.priceUsd ?? null)}</span>
        </div>

        <div className="instrument-truth">
          <TruthChip state={truthLabel} title={feed.quote ? `${feed.quote.sourceId} · observed ${new Date(feed.quote.observedAtMs).toISOString()}` : undefined} />
          <span className="truth-age">{ageMs === null ? 'NO DATA' : `AGE ${secondsAgo(ageMs)}`}</span>
          <span className="truth-link">{feed.connection}</span>
        </div>

        <div className="instrument-equity">
          <span className="equity-label">EQUITY</span>
          <span className="equity-value num">{formatEth(sim.account.equityWei)}</span>
          <span className="equity-unit">ETH</span>
        </div>
      </header>

      <div className="terminal-body">
        <div className="panel chart-panel">
          <div ref={boxRef} className="chart-box" />
          {awayFromRealtime && (
            <button type="button" className="chart-realtime" onClick={() => chartRef.current?.scrollToRealtime()}>
              RETURN TO LIVE →
            </button>
          )}
          {chartSeries?.status === 'UNAVAILABLE' && (
            <div className="chart-unavailable" role="status">
              <p className="chart-unavailable-code">HISTORY UNAVAILABLE · {chartSeries.code}</p>
              <p className="chart-unavailable-detail">{chartSeries.reason}</p>
            </div>
          )}
          <p className="chart-foot">
            {/* Denomination is stated, never inferred from the axis. */}
            <span className="chart-currency">{chartSeries?.status === 'OK' ? `${chartSeries.currencyLabel} OHLCV` : `${overlayLabel} AXIS`}</span>
            {environment === 'DEMO' && <span className="chart-demo"> · SYNTHETIC DEMO HISTORY</span>}
            {' · FILL STAMPS FROM SIMULATOR EVENTS'}
            {feed.droppedTicks > 0 && ` · DROPPED ${feed.droppedTicks}`}
          </p>
        </div>

        <aside className="terminal-rail">
          {blocked && (
            <div className="unavailable" role="status">
              <p className="unavailable-code">{PRACTICE_UNAVAILABLE_LABEL}</p>
              {blockedCode && <p className="unavailable-reason-code">{blockedCode}</p>}
              <p className="unavailable-detail">{blockedReason}</p>
            </div>
          )}

          {positionElsewhere && sim.position && (
            <div className="unavailable" role="status">
              <p className="unavailable-code">POSITION OPEN ELSEWHERE</p>
              <p className="unavailable-detail">
                A spot session holds one instrument at a time. Close the open position on {sim.position.instrumentId} before trading {asset.symbol}.
              </p>
            </div>
          )}

          <PositionTruth sim={sim} symbol={positionElsewhere ? positionLabel(sim) : asset.symbol} />

          <TradeTicket
            sim={sim}
            career={career}
            blockedReason={blocked ? blockedReason : positionElsewhere ? 'An open position on another instrument must be closed first.' : null}
            onSubmit={onSubmit}
            observation={gate?.status === 'SUPPORTED' ? gate.observation : null}
            observationTimeMs={feed.atMs}
          />

          {rejection && (
            <div className="rejection" role="alert">
              <div className="rejection-head">
                <span className="rejection-code">{rejection.code}</span>
                <button type="button" onClick={onDismissRejection} aria-label="Dismiss rejection">
                  ×
                </button>
              </div>
              <p>{rejection.message}</p>
            </div>
          )}

          <CareerStrip career={career} />

          <TapePanel tape={tape} showWalletTools={showWalletTools} onWallet={onWallet} />
        </aside>
      </div>
    </section>
  );
}

/** Short label for a position held on an instrument other than the one shown. */
function positionLabel(sim: SimState): string {
  const id = sim.position?.instrumentId ?? '';
  const pair = id.replace(/^INK:/, '');
  return pair.length > 10 ? `${pair.slice(0, 6)}…${pair.slice(-4)}` : pair;
}

function syncChartOverlays(chart: MarketChart, sim: SimState) {
  chart.setFillStamps(chartFillStampsForSim(sim));
  const position = sim.position;
  // Short title: the axis label sits next to the newest bar, where the fill
  // stamps also land, and a long one collides with them on narrow viewports.
  chart.setEntryLine(position ? Number(formatFixed(priceX18(position.averageEntryPriceX18), 18)) : null, position ? 'ENTRY' : '');
  if (typeof chart.setStopLine === 'function') chart.setStopLine(sim.activeStop ? Number(formatFixed(priceX18(sim.activeStop.stopPriceX18), 18)) : null);
}

function TapePanel({ tape, showWalletTools, onWallet }: { tape: TapeBuffer; showWalletTools: boolean; onWallet: (address: string) => void }) {
  const rows = useSyncExternalStore(tape.subscribe, tape.getSnapshot, tape.getSnapshot);
  return (
    <section className="panel tape-panel" aria-label="Market event tape">
      <header className="panel-head">
        <h2>TAPE</h2>
        <span className="panel-note">SWAP = CONFIRMED · MARK = DERIVED · {rows.length} EV</span>
      </header>
      <ol className="tape">
        {rows.map((row) => (
          /* A confirmed swap and a derived pool snapshot get different visual
             grammar. A polled aggregate must never read as one executed trade. */
          <li key={row.id} className={`tape-row tape-kind-${row.kind.toLowerCase()}`}>
            <span className={`tape-tag tape-${row.label.toLowerCase()}`}>{row.label}</span>
            <span className="tape-msg">
              {row.message}
              {showWalletTools && row.wallet && (
                <button type="button" className="addrbtn" onClick={() => onWallet(row.wallet!)}>
                  {short(row.wallet)}
                </button>
              )}
              {row.txHash && (
                <span className="tape-tx" title={`tx ${row.txHash}${row.blockNumber ? ` · block ${row.blockNumber}` : ''}`}>
                  {short(row.txHash)}
                </span>
              )}
            </span>
            <span className={`tape-truth truth-${row.provenance.toLowerCase()}`}>{row.provenance}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
