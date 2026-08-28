/**
 * Shared server-side market polling — SHARED_MARKET_POLLING_V1.
 *
 * Before this, every websocket connection started its own 2-second Dexscreener
 * poll for the pair it was watching. Ten browser tabs on one pair meant ten
 * times the provider traffic, and a client could multiply our provider budget
 * simply by reconnecting.
 *
 * The shape is the smallest thing that fixes it, single-process and
 * dependency-free:
 *
 *     provider poller -> pair-keyed cache/subscription -> websocket fan-out
 *
 * Guarantees:
 *   - at most one active provider polling stream per pair in this process;
 *   - additional subscribers reuse it and immediately receive the cached snapshot;
 *   - the poller stops after the last subscriber leaves (following a bounded
 *     linger, so a page reload does not thrash the provider);
 *   - the polling interval, linger and backoff ceiling are configurable;
 *   - failures back off with bounded exponential delay and are reported as an
 *     explicit degraded/stale state rather than silence.
 *
 * No Redis, no Kafka, no cross-process fan-out. That is deliberate for V1.
 */
import type { PoolTrade, Provenance } from './types.js';

export interface MarketSnapshot {
  pairAddress: string;
  priceUsd: number | null;
  priceNative: number | null;
  txns: unknown;
  volume: unknown;
  liquidity: unknown;
  observedAtMs: number;
  provenance: Provenance;
}

export type MarketHubEvent =
  | { kind: 'SNAPSHOT'; pairAddress: string; snapshot: MarketSnapshot }
  | { kind: 'SWAPS'; pairAddress: string; trades: readonly PoolTrade[] }
  | { kind: 'STATUS'; pairAddress: string; state: 'LIVE' | 'DEGRADED' | 'STALE'; detail?: string };

export type MarketHubListener = (event: MarketHubEvent) => void;

export interface MarketHubOptions {
  /** Fetch one pair snapshot. Injected so tests never touch the network. */
  fetchPair: (pairAddress: string) => Promise<any>;
  /**
   * Optional recent-trades fetch, polled on the same shared per-pair stream at
   * a lower cadence so confirmed swap evidence does not multiply requests.
   */
  fetchTrades?: (pairAddress: string) => Promise<readonly PoolTrade[]>;
  /** Poll trades once every N snapshot cycles. */
  tradePollEveryNCycles?: number;
  /** Base polling interval per pair. Provider budget knob. */
  pollIntervalMs?: number;
  /** How long a poller lingers with no subscribers before stopping. */
  lingerMs?: number;
  /** Upper bound on retry backoff. */
  maxBackoffMs?: number;
  /** A snapshot older than this is reported STALE. */
  staleAfterMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => any;
  clearTimer?: (handle: any) => void;
}

/** Documented Dexscreener limit for the pairs endpoints is 300 requests/minute. */
export const DEXSCREENER_PAIRS_RATE_LIMIT_PER_MINUTE = 300;
/** One poll every 2s per pair = 30 requests/minute/pair, shared by all clients. */
export const DEFAULT_POLL_INTERVAL_MS = 2_000;
/** Never poll a single pair faster than this, whatever the environment says. */
export const MIN_POLL_INTERVAL_MS = 1_000;

interface PairPoller {
  pairAddress: string;
  listeners: Set<MarketHubListener>;
  timer: any;
  lingerTimer: any;
  running: boolean;
  stopped: boolean;
  failures: number;
  fingerprint: string;
  last: MarketSnapshot | null;
  lastStatus: 'LIVE' | 'DEGRADED' | 'STALE' | null;
  cycle: number;
  seenTradeIds: Set<string>;
  lastTrades: readonly PoolTrade[];
}

export class MarketHub {
  private readonly pollers = new Map<string, PairPoller>();
  private readonly fetchPair: (pairAddress: string) => Promise<any>;
  private readonly fetchTrades: ((pairAddress: string) => Promise<readonly PoolTrade[]>) | null;
  private readonly tradePollEveryNCycles: number;
  private readonly pollIntervalMs: number;
  private readonly lingerMs: number;
  private readonly maxBackoffMs: number;
  private readonly staleAfterMs: number;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => any;
  private readonly clearTimer: (handle: any) => void;
  /** Provider requests actually issued, for budget assertions and tests. */
  providerRequests = 0;

  constructor(options: MarketHubOptions) {
    this.fetchPair = options.fetchPair;
    this.fetchTrades = options.fetchTrades ?? null;
    this.tradePollEveryNCycles = Math.max(1, options.tradePollEveryNCycles ?? 5);
    this.pollIntervalMs = Math.max(MIN_POLL_INTERVAL_MS, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
    this.lingerMs = options.lingerMs ?? 10_000;
    this.maxBackoffMs = options.maxBackoffMs ?? 30_000;
    this.staleAfterMs = options.staleAfterMs ?? 30_000;
    this.now = options.now ?? (() => Date.now());
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
  }

  /** Active provider polling streams. One per actively requested pair. */
  activePollerCount(): number {
    let count = 0;
    for (const poller of this.pollers.values()) if (!poller.stopped) count += 1;
    return count;
  }

  subscriberCount(pairAddress: string): number {
    return this.pollers.get(key(pairAddress))?.listeners.size ?? 0;
  }

  /**
   * Attach to a pair's shared stream. Returns an unsubscribe function.
   *
   * The listener is given the cached snapshot synchronously when one exists, so
   * a new client does not trigger a provider request just to render.
   */
  subscribe(pairAddress: string, listener: MarketHubListener): () => void {
    const id = key(pairAddress);
    if (!id) return () => {};
    let poller = this.pollers.get(id);
    if (!poller) {
      poller = {
        pairAddress,
        listeners: new Set(),
        timer: null,
        lingerTimer: null,
        running: false,
        stopped: false,
        failures: 0,
        fingerprint: '',
        last: null,
        lastStatus: null,
        cycle: 0,
        seenTradeIds: new Set<string>(),
        lastTrades: [],
      };
      this.pollers.set(id, poller);
    }
    if (poller.lingerTimer !== null) {
      this.clearTimer(poller.lingerTimer);
      poller.lingerTimer = null;
    }
    poller.stopped = false;
    poller.listeners.add(listener);

    if (poller.last) listener({ kind: 'SNAPSHOT', pairAddress: poller.pairAddress, snapshot: poller.last });
    if (poller.lastTrades.length > 0) listener({ kind: 'SWAPS', pairAddress: poller.pairAddress, trades: poller.lastTrades });
    // Exactly one poll loop per pair, however many subscribers arrive.
    if (!poller.running) {
      poller.running = true;
      void this.poll(poller);
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      poller.listeners.delete(listener);
      if (poller.listeners.size === 0) this.scheduleStop(poller);
    };
  }

  private scheduleStop(poller: PairPoller): void {
    if (poller.lingerTimer !== null) return;
    poller.lingerTimer = this.setTimer(() => {
      poller.lingerTimer = null;
      if (poller.listeners.size > 0) return;
      this.stopPoller(poller);
    }, this.lingerMs);
  }

  private stopPoller(poller: PairPoller): void {
    poller.stopped = true;
    poller.running = false;
    if (poller.timer !== null) {
      this.clearTimer(poller.timer);
      poller.timer = null;
    }
    this.pollers.delete(key(poller.pairAddress));
  }

  private emit(poller: PairPoller, event: MarketHubEvent): void {
    for (const listener of [...poller.listeners]) {
      try {
        listener(event);
      } catch {
        /* one bad consumer must not stop the shared stream */
      }
    }
  }

  private status(poller: PairPoller, state: 'LIVE' | 'DEGRADED' | 'STALE', detail?: string): void {
    if (poller.lastStatus === state && state !== 'DEGRADED') return;
    poller.lastStatus = state;
    this.emit(poller, { kind: 'STATUS', pairAddress: poller.pairAddress, state, detail });
  }

  private async poll(poller: PairPoller): Promise<void> {
    if (poller.stopped) return;
    try {
      this.providerRequests += 1;
      const pair = await this.fetchPair(poller.pairAddress);
      if (poller.stopped) return;
      if (pair) {
        poller.failures = 0;
        const observedAtMs = this.now();
        const fingerprint = JSON.stringify([pair.priceUsd, pair.priceNative, pair.txns?.m5, pair.volume?.m5, pair.liquidity?.usd]);
        if (fingerprint !== poller.fingerprint) {
          poller.fingerprint = fingerprint;
          const snapshot: MarketSnapshot = {
            pairAddress: poller.pairAddress,
            priceUsd: Number(pair.priceUsd || 0) || null,
            priceNative: Number(pair.priceNative || 0) || null,
            txns: pair.txns || null,
            volume: pair.volume || null,
            liquidity: pair.liquidity || null,
            observedAtMs,
            provenance: {
              state: 'DERIVED',
              source: 'DEXSCREENER',
              asOf: new Date(observedAtMs).toISOString(),
              method: 'shared server-side pair snapshot poll; aggregate figures only, not a confirmed swap',
            },
          };
          poller.last = snapshot;
          this.emit(poller, { kind: 'SNAPSHOT', pairAddress: poller.pairAddress, snapshot });
        }
        this.status(poller, 'LIVE');
        // A snapshot that stops changing is not automatically fresh.
        if (poller.last && observedAtMs - poller.last.observedAtMs > this.staleAfterMs) this.status(poller, 'STALE');
      }
      poller.cycle += 1;
      await this.pollTrades(poller);
      this.schedule(poller, this.pollIntervalMs);
    } catch (error: any) {
      if (poller.stopped) return;
      poller.failures += 1;
      this.status(poller, 'DEGRADED', String(error?.message || error));
      this.schedule(poller, this.backoffMs(poller.failures));
    }
  }

  /**
   * Confirmed swap evidence, on the same shared stream at a lower cadence.
   * Only trades not seen before are fanned out, and their provenance is left
   * exactly as the adapter classified it — CONFIRMED only with a tx hash.
   */
  private async pollTrades(poller: PairPoller): Promise<void> {
    if (!this.fetchTrades || poller.stopped) return;
    if (poller.cycle % this.tradePollEveryNCycles !== 1 % this.tradePollEveryNCycles) return;
    try {
      this.providerRequests += 1;
      const trades = await this.fetchTrades(poller.pairAddress);
      if (poller.stopped) return;
      const fresh = trades.filter((trade) => !poller.seenTradeIds.has(trade.id));
      if (fresh.length === 0) return;
      for (const trade of fresh) poller.seenTradeIds.add(trade.id);
      // Bound the dedupe set so a long-lived poller cannot grow without limit.
      if (poller.seenTradeIds.size > 2_000) {
        poller.seenTradeIds = new Set([...poller.seenTradeIds].slice(-1_000));
      }
      poller.lastTrades = fresh.slice(0, 50);
      this.emit(poller, { kind: 'SWAPS', pairAddress: poller.pairAddress, trades: poller.lastTrades });
    } catch {
      /* swap evidence is supplementary; the snapshot stream reports health */
    }
  }

  /** Bounded exponential backoff; never tighter than the configured interval. */
  backoffMs(failures: number): number {
    const scaled = this.pollIntervalMs * 2 ** Math.min(failures, 10);
    return Math.min(this.maxBackoffMs, Math.max(this.pollIntervalMs, scaled));
  }

  private schedule(poller: PairPoller, delayMs: number): void {
    if (poller.stopped) return;
    poller.timer = this.setTimer(() => {
      poller.timer = null;
      void this.poll(poller);
    }, delayMs);
  }

  dispose(): void {
    for (const poller of [...this.pollers.values()]) {
      poller.listeners.clear();
      if (poller.lingerTimer !== null) this.clearTimer(poller.lingerTimer);
      this.stopPoller(poller);
    }
  }
}

function key(pairAddress: string): string {
  return String(pairAddress || '').toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* shared chain-head fan-out                                                   */
/* -------------------------------------------------------------------------- */

export interface ChainHead {
  number: number;
  hash?: string;
  parentHash?: string;
}

export type HeadHubListener =
  | { kind: 'HEAD'; head: ChainHead }
  | { kind: 'STATUS'; state: string };

/**
 * One Ink `newHeads` subscription for the whole process.
 *
 * Same amplification problem as pair polling, different provider: every
 * websocket connection used to open its own upstream RPC socket, so N browser
 * tabs meant N subscriptions against the public Ink gateway. The head stream is
 * identical for every client, so exactly one is kept and fanned out.
 */
export class ChainHeadHub {
  private readonly listeners = new Set<(event: HeadHubListener) => void>();
  private readonly connect: (onHead: (head: ChainHead) => void, onState: (state: string) => void) => () => void;
  private readonly lingerMs: number;
  private readonly setTimer: (fn: () => void, ms: number) => any;
  private readonly clearTimer: (handle: any) => void;
  private stop: (() => void) | null = null;
  private lingerTimer: any = null;
  private lastHead: ChainHead | null = null;
  private lastState: string | null = null;
  /** Upstream subscriptions actually opened, for budget assertions and tests. */
  upstreamConnections = 0;

  constructor(options: {
    connect: (onHead: (head: ChainHead) => void, onState: (state: string) => void) => () => void;
    lingerMs?: number;
    setTimer?: (fn: () => void, ms: number) => any;
    clearTimer?: (handle: any) => void;
  }) {
    this.connect = options.connect;
    this.lingerMs = options.lingerMs ?? 10_000;
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
  }

  isActive(): boolean {
    return this.stop !== null;
  }

  subscriberCount(): number {
    return this.listeners.size;
  }

  subscribe(listener: (event: HeadHubListener) => void): () => void {
    if (this.lingerTimer !== null) {
      this.clearTimer(this.lingerTimer);
      this.lingerTimer = null;
    }
    this.listeners.add(listener);
    // Newcomers get current state immediately instead of waiting a block.
    if (this.lastState !== null) listener({ kind: 'STATUS', state: this.lastState });
    if (this.lastHead !== null) listener({ kind: 'HEAD', head: this.lastHead });

    if (this.stop === null) {
      this.upstreamConnections += 1;
      this.stop = this.connect(
        (head) => {
          this.lastHead = head;
          this.emit({ kind: 'HEAD', head });
        },
        (state) => {
          this.lastState = state;
          this.emit({ kind: 'STATUS', state });
        },
      );
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.scheduleStop();
    };
  }

  private scheduleStop(): void {
    if (this.lingerTimer !== null) return;
    this.lingerTimer = this.setTimer(() => {
      this.lingerTimer = null;
      if (this.listeners.size > 0) return;
      this.stop?.();
      this.stop = null;
    }, this.lingerMs);
  }

  private emit(event: HeadHubListener): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        /* one bad consumer must not stop the shared stream */
      }
    }
  }

  dispose(): void {
    this.listeners.clear();
    if (this.lingerTimer !== null) this.clearTimer(this.lingerTimer);
    this.lingerTimer = null;
    this.stop?.();
    this.stop = null;
  }
}
