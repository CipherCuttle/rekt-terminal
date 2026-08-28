import { useEffect, useRef, useSyncExternalStore } from 'react';
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
import type { Bar, RadarAsset } from '../types/api';
import { PositionTruth } from './PositionTruth';
import { TradeTicket } from './TradeTicket';
import { CareerStrip } from './CareerStrip';

export interface ChartSink {
  tick(tick: ChartTick): void;
}

export interface TerminalScreenProps {
  asset: RadarAsset;
  mode: 'fixture' | 'live';
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

/** Chart price axis is always ETH so simulator fill stamps land on the right scale. */
function toEthBars(bars: Bar[], usdPerEth: number | null): Bar[] {
  if (usdPerEth === null || !Number.isFinite(usdPerEth) || usdPerEth <= 0) return bars;
  const scale = 1 / usdPerEth;
  return bars.map((bar) => ({
    ...bar,
    open: bar.open * scale,
    high: bar.high * scale,
    low: bar.low * scale,
    close: bar.close * scale,
  }));
}

export function TerminalScreen(props: TerminalScreenProps) {
  const { asset, mode, sim, career, feed, tape, rejection, chartSink, onSubmit, onDismissRejection, showWalletTools, onWallet } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<MarketChart | null>(null);
  // Bars load asynchronously; the chart-creation effect must not paint overlays
  // from the simulator state it happened to close over.
  const simRef = useRef(sim);
  simRef.current = sim;
  const usdPerEth = asset.priceUsd && asset.priceEth ? asset.priceUsd / asset.priceEth : null;

  // Chart lifecycle. The chart is imperative on purpose: ticks never pass
  // through React state.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const chart = new MarketChart(box);
    chartRef.current = chart;
    chartSink.current = { tick: (tick) => chart.update(tick.price, tick.side, tick.volume, tick.timeSeconds) };

    let disposed = false;
    api
      .bars(asset, mode)
      .then((bars) => {
        if (disposed) return;
        chart.load(mode === 'live' ? toEthBars(bars, usdPerEth) : bars);
        syncChartOverlays(chart, simRef.current);
      })
      .catch(() => {
        /* history is optional; live ticks still build candles */
      });

    return () => {
      disposed = true;
      chartSink.current = null;
      chartRef.current = null;
      chart.destroy();
    };
  }, [asset.id, mode, chartSink, usdPerEth]);

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
          <p className="chart-foot">
            ETH OHLCV{mode === 'live' ? ' · HISTORY DERIVED FROM USD OHLCV' : ' · FIXTURE HISTORY'} · FILL STAMPS FROM SIMULATOR EVENTS
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
        <span className="panel-note">{rows.length} EV</span>
      </header>
      <ol className="tape">
        {rows.map((row) => (
          <li key={row.id} className="tape-row">
            <span className={`tape-tag tape-${row.label.toLowerCase()}`}>{row.label}</span>
            <span className="tape-msg">
              {row.message}
              {showWalletTools && row.wallet && (
                <button type="button" className="addrbtn" onClick={() => onWallet(row.wallet!)}>
                  {short(row.wallet)}
                </button>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
