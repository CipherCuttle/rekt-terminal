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
import type { MarketEnvironment, PoolTrade, RadarAsset, StreamEnvelope } from '../types/api';
import type { FeedConnection, FeedTick } from '../practice/feed-store';

/**
 * One tape row.
 *
 * `kind` is the visual grammar selector and it is not cosmetic. A `SWAP` is one
 * confirmed on-chain trade with transaction identity. A `MARK` is a polled
 * aggregate snapshot — a derived summary of the pool, not a trade that
 * happened. They previously rendered identically, which implied a Dexscreener
 * poll was a single confirmed execution.
 */
export type TapeKind = 'SWAP' | 'MARK' | 'DEMO';

export interface TapeRow {
  id: string;
  label: string;
  kind: TapeKind;
  provenance: string;
  message: string;
  wallet: string | null;
  /** Transaction identity, preserved when the source supplied it. */
  txHash?: string | null;
  blockNumber?: number | null;
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
  environment: MarketEnvironment;
  scenario: string;
  handlers: MarketFeedHandlers;
  now?: () => number;
}

const MAX_QUEUE = 4000;
const DEMO_RATES: Record<string, number> = { NORMAL: 5, ACTIVE: 50, MANIA: 250, PATHOLOGICAL: 100 };

const ethPrice = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const compact = (value: number | null): string =>
  value == null ? '—' : value >= 1e6 ? `$${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `$${(value / 1e3).toFixed(1)}K` : `$${value.toFixed(2)}`;

/**
 * Observation time for a tick.
 *
 * LIVE envelopes carry a real server clock, clamped so a fast server clock
 * cannot manufacture a future-dated observation. DEMO streams replay from a
 * frozen epoch, so their observation time is the moment the deterministic
 * replay reached the client — their SYNTHETIC provenance is what keeps them
 * out of real evidence, never a timestamp trick.
 */
function observedAt(environment: MarketEnvironment, serverTimeMs: number, nowMs: number): number {
  if (environment === 'DEMO') return nowMs;
  return Number.isFinite(serverTimeMs) ? Math.min(serverTimeMs, nowMs) : nowMs;
}

export function connectMarketFeed(options: MarketFeedOptions): () => void {
  const { asset, environment, scenario, handlers } = options;
  const now = options.now ?? (() => Date.now());
  const usdPerEth = asset.priceUsd && asset.priceEth ? asset.priceUsd / asset.priceEth : null;

  let disposed = false;
  let rafHandle = 0;
  let dropped = 0;
  let localTimer = 0;
  let localSeq = 0;
  let localStarted = false;
  const isDemo = environment === 'DEMO';
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
      // DEMO tape events. These only ever arrive on a DEMO stream, and they are
      // fabricated, so they are SYNTHETIC. They previously claimed DERIVED,
      // which made seeded noise acceptable simulator input.
      if (envelope.type === 'BUY' || envelope.type === 'SELL' || envelope.type === 'SWEEP') {
        const payload = envelope.payload;
        const price = ethPrice(payload.priceEth);
        const side = Number(payload.side);
        const quantity = Number(payload.qty || 1);
        const at = observedAt(environment, envelope.serverTime, nowMs);
        if (price !== null) {
          chartTick = { price, side, volume: quantity, timeSeconds: Math.floor(at / 1000) };
          quoteTick = {
            priceEth: price,
            priceUsd: usdPerEth === null ? null : price * usdPerEth,
            observedAtMs: at,
            sourceId: String(payload.provenance?.source ?? 'FIXTURE_STREAM'),
            provenance: 'SYNTHETIC',
          };
        }
        if (envelope.type === 'SWEEP') sweepSide = side;
        tape.push({
          id: `${envelope.seq}`,
          label: envelope.type,
          kind: 'DEMO',
          provenance: 'SYNTHETIC',
          message: `${payload.symbol} ${payload.qty} @ ${price === null ? '—' : price.toPrecision(6)} ETH`,
          wallet: payload.wallet || null,
        });
        continue;
      }

      // A polled provider snapshot. This is an aggregate summary of the pool,
      // not a trade. It is DERIVED and it renders as a MARK.
      if (envelope.type === 'MARKET_UPDATE') {
        const payload = envelope.payload;
        const priceEth = ethPrice(payload.priceNative);
        const priceUsd = ethPrice(payload.priceUsd);
        const at = observedAt(environment, envelope.serverTime, nowMs);
        // The chart axis is the pool's quote token so simulator fill stamps
        // land on the right scale; a USD-only update is never plotted as ETH.
        if (priceEth !== null) {
          chartTick = { price: priceEth, side: 1, volume: 1, timeSeconds: Math.floor(at / 1000) };
        }
        quoteTick = {
          priceEth,
          priceUsd,
          observedAtMs: at,
          // DEXSCREENER aggregates rather than confirming a swap on chain.
          sourceId: String(payload.provenance?.source ?? 'DEXSCREENER'),
          provenance: 'DERIVED',
        };
        tape.push({
          id: `${envelope.seq}`,
          label: 'MARK',
          kind: 'MARK',
          provenance: 'DERIVED',
          message: `${asset.symbol} ${compact(priceUsd)} · pool snapshot`,
          wallet: null,
        });
        continue;
      }

      // Confirmed swaps. Each carries its own transaction identity, which is
      // preserved verbatim. No wallet-behaviour claim is made from them here.
      if (envelope.type === 'SWAPS') {
        const trades = (envelope.payload?.trades ?? []) as PoolTrade[];
        for (const trade of trades) {
          const confirmed = trade.provenance?.state === 'CONFIRMED';
          const price = trade.priceQuoteToken;
          tape.push({
            id: `swap:${trade.id}`,
            label: trade.side === 'BUY' || trade.side === 'SELL' ? trade.side : 'SWAP',
            kind: confirmed ? 'SWAP' : 'MARK',
            provenance: confirmed ? 'CONFIRMED' : 'DERIVED',
            message: `${asset.symbol} ${price === null || price === undefined ? compact(trade.volumeUsd) : `${price.toPrecision(6)} ETH`}`,
            wallet: trade.wallet,
            txHash: trade.txHash,
            blockNumber: trade.blockNumber,
          });
        }
        continue;
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

  /**
   * Browser DEMO fallback. Reachable only when the environment is already DEMO;
   * a LIVE stream that fails stays failed and reports a degraded state.
   */
  const startLocalDemo = () => {
    if (localStarted || disposed || !isDemo) return;
    localStarted = true;
    handlers.onConnection('LOCAL_DEMO');
    const rate = DEMO_RATES[scenario] ?? 5;
    const emit = () => enqueue(localEvent(++localSeq, asset.symbol) as unknown as StreamEnvelope);
    if (scenario === 'PATHOLOGICAL') for (let i = 0; i < 1000; i += 1) emit();
    localTimer = window.setInterval(emit, Math.max(4, Math.floor(1000 / rate)));
  };

  handlers.onConnection('CONNECTING');
  try {
    socket = new WebSocket(streamUrl(environment, asset, scenario));
    const fallback = window.setTimeout(() => {
      if (socket?.readyState !== WebSocket.OPEN) startLocalDemo();
    }, 900);
    socket.onopen = () => {
      clearTimeout(fallback);
      handlers.onConnection(environment === 'DEMO' ? 'SERVER_DEMO' : 'LIVE');
    };
    socket.onclose = () => {
      clearTimeout(fallback);
      // LIVE never falls back to DEMO. A dead LIVE socket is a visible
      // disconnection, not a quiet substitution of fabricated data.
      if (isDemo) startLocalDemo();
      else handlers.onConnection('DISCONNECTED');
    };
    socket.onerror = () => {
      if (!isDemo) handlers.onConnection('DEGRADED');
    };
    socket.onmessage = (event) => {
      try {
        enqueue(JSON.parse(event.data));
      } catch {
        /* a malformed frame is dropped, never partially applied */
      }
    };
  } catch {
    // Only DEMO has a local fallback; startLocalDemo is a no-op under LIVE.
    startLocalDemo();
    if (!isDemo) handlers.onConnection('DISCONNECTED');
  }

  return () => {
    disposed = true;
    if (rafHandle) cancelAnimationFrame(rafHandle);
    clearInterval(localTimer);
    socket?.close();
  };
}
