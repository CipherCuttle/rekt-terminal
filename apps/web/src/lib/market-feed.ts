/**
 * Market feed transport.
 *
 * Owns the WebSocket, the deterministic local-fixture fallback, and the
 * requestAnimationFrame batching that keeps a 250 msg/s tape from turning into
 * 250 renders/s. Chart updates are dispatched imperatively; React only sees the
 * coalesced quote via `MarketFeedStore`.
 */
import { streamUrl } from './api';
import { localEvent } from './local-fixtures';
import type { RadarAsset, StreamEnvelope } from '../types/api';
import type { FeedConnection, FeedTick } from '../practice/feed-store';

export interface TapeRow {
  id: string;
  label: string;
  message: string;
  wallet: string | null;
}

export interface ChartTick {
  price: number;
  side: number;
  volume: number;
  timeSeconds: number;
}

export interface MarketFeedHandlers {
  onChartTick(tick: ChartTick): void;
  onSweep(side: number): void;
  onTape(rows: readonly TapeRow[]): void;
  onQuote(tick: FeedTick): void;
  onConnection(state: FeedConnection): void;
  onHead(head: number | null): void;
  onDropped(count: number): void;
}

export interface MarketFeedOptions {
  asset: RadarAsset;
  mode: 'fixture' | 'live';
  scenario: string;
  handlers: MarketFeedHandlers;
  now?: () => number;
}

const MAX_QUEUE = 4000;
const FIXTURE_RATES: Record<string, number> = { NORMAL: 5, ACTIVE: 50, MANIA: 250, PATHOLOGICAL: 100 };

const ethPrice = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const compact = (value: number | null): string =>
  value == null ? '—' : value >= 1e6 ? `$${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `$${(value / 1e3).toFixed(1)}K` : `$${value.toFixed(2)}`;

/**
 * Observation time for a tick.
 *
 * Live envelopes carry a real server clock, clamped so a fast server clock
 * cannot manufacture a future-dated observation. Fixture streams replay from a
 * frozen epoch, so their observation time is the moment the deterministic
 * replay reached the client — the provenance source id keeps them labelled as
 * fixtures, they are never presented as live evidence.
 */
function observedAt(mode: 'fixture' | 'live', serverTimeMs: number, nowMs: number): number {
  if (mode === 'fixture') return nowMs;
  return Number.isFinite(serverTimeMs) ? Math.min(serverTimeMs, nowMs) : nowMs;
}

export function connectMarketFeed(options: MarketFeedOptions): () => void {
  const { asset, mode, scenario, handlers } = options;
  const now = options.now ?? (() => Date.now());
  const usdPerEth = asset.priceUsd && asset.priceEth ? asset.priceUsd / asset.priceEth : null;

  let disposed = false;
  let rafHandle = 0;
  let dropped = 0;
  let localTimer = 0;
  let localSeq = 0;
  let localStarted = false;
  let socket: WebSocket | null = null;
  const queue: StreamEnvelope[] = [];

  const flush = () => {
    rafHandle = 0;
    if (disposed || queue.length === 0) return;
    const batch = queue.splice(0, queue.length);
    const nowMs = now();

    let head: number | null = null;
    let connection: FeedConnection | null = null;
    let chartTick: ChartTick | null = null;
    let quoteTick: FeedTick | null = null;
    let sweepSide: number | null = null;
    const tape: TapeRow[] = [];

    for (const envelope of batch) {
      if (envelope.type === 'HEAD') {
        head = Number(envelope.payload.number);
        continue;
      }
      if (envelope.type === 'SOURCE_STATUS') {
        connection = envelope.payload.state === 'DEGRADED' ? 'DEGRADED' : 'LIVE';
        continue;
      }
      if (envelope.type === 'BUY' || envelope.type === 'SELL' || envelope.type === 'SWEEP') {
        const payload = envelope.payload;
        const price = ethPrice(payload.priceEth);
        const side = Number(payload.side);
        const quantity = Number(payload.qty || 1);
        if (price !== null) {
          const timeSeconds = Math.floor(observedAt(mode, envelope.serverTime, nowMs) / 1000);
          chartTick = { price, side, volume: quantity, timeSeconds };
          quoteTick = {
            priceEth: price,
            priceUsd: usdPerEth === null ? null : price * usdPerEth,
            observedAtMs: observedAt(mode, envelope.serverTime, nowMs),
            sourceId: String(payload.provenance?.source ?? (mode === 'fixture' ? 'FIXTURE_STREAM' : 'INK_STREAM')),
            provenance: mode === 'fixture' ? 'DERIVED' : 'CONFIRMED',
          };
        }
        if (envelope.type === 'SWEEP') sweepSide = side;
        tape.push({
          id: `${envelope.seq}`,
          label: envelope.type,
          message: `${payload.symbol} ${payload.qty} @ ${price === null ? '—' : price.toPrecision(6)} ETH`,
          wallet: payload.wallet || null,
        });
        continue;
      }
      if (envelope.type === 'MARKET_UPDATE') {
        const payload = envelope.payload;
        const priceEth = ethPrice(payload.priceNative);
        const priceUsd = ethPrice(payload.priceUsd);
        // The chart axis is ETH so simulator fill stamps land on the right
        // scale; a USD-only update must not be plotted as if it were ETH.
        if (priceEth !== null) {
          chartTick = { price: priceEth, side: 1, volume: 1, timeSeconds: Math.floor(observedAt(mode, envelope.serverTime, nowMs) / 1000) };
        }
        quoteTick = {
          priceEth,
          priceUsd,
          observedAtMs: observedAt(mode, envelope.serverTime, nowMs),
          // DEXSCREENER aggregates rather than confirming a swap on chain.
          sourceId: String(payload.provenance?.source ?? 'DEXSCREENER'),
          provenance: 'DERIVED',
        };
        tape.push({ id: `${envelope.seq}`, label: 'MARK', message: `${asset.symbol} ${compact(priceUsd)}`, wallet: null });
      }
    }

    if (head !== null) handlers.onHead(head);
    if (connection) handlers.onConnection(connection);
    if (chartTick) handlers.onChartTick(chartTick);
    if (sweepSide !== null) handlers.onSweep(sweepSide);
    if (quoteTick) handlers.onQuote(quoteTick);
    if (tape.length) handlers.onTape(tape.reverse());
    if (dropped) handlers.onDropped(dropped);
  };

  const enqueue = (envelope: StreamEnvelope) => {
    if (queue.length >= MAX_QUEUE) {
      queue.shift();
      dropped += 1;
    }
    queue.push(envelope);
    if (!rafHandle) rafHandle = requestAnimationFrame(flush);
  };

  const startLocalFixture = () => {
    if (localStarted || disposed || mode !== 'fixture') return;
    localStarted = true;
    handlers.onConnection('LOCAL_FIXTURE');
    const rate = FIXTURE_RATES[scenario] ?? 5;
    const emit = () => enqueue(localEvent(++localSeq, asset.symbol) as StreamEnvelope);
    if (scenario === 'PATHOLOGICAL') for (let i = 0; i < 1000; i += 1) emit();
    localTimer = window.setInterval(emit, Math.max(4, Math.floor(1000 / rate)));
  };

  handlers.onConnection('CONNECTING');
  try {
    socket = new WebSocket(streamUrl(mode, asset, scenario));
    const fallback = window.setTimeout(() => {
      if (socket?.readyState !== WebSocket.OPEN) startLocalFixture();
    }, 900);
    socket.onopen = () => {
      clearTimeout(fallback);
      handlers.onConnection(mode === 'fixture' ? 'SERVER_FIXTURE' : 'LIVE');
    };
    socket.onclose = () => {
      clearTimeout(fallback);
      if (mode === 'fixture') startLocalFixture();
      else handlers.onConnection('DISCONNECTED');
    };
    socket.onerror = () => {
      if (mode !== 'fixture') handlers.onConnection('DEGRADED');
    };
    socket.onmessage = (event) => {
      try {
        enqueue(JSON.parse(event.data));
      } catch {
        /* a malformed frame is dropped, never partially applied */
      }
    };
  } catch {
    startLocalFixture();
  }

  return () => {
    disposed = true;
    if (rafHandle) cancelAnimationFrame(rafHandle);
    clearInterval(localTimer);
    socket?.close();
  };
}
