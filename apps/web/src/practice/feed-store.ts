/**
 * Market-data store.
 *
 * Deliberately separate from the practice session store. Raw ticks arrive at
 * whatever rate the venue produces; React is notified on a slow, coalesced
 * cadence so a busy tape cannot drive the render loop. The chart is fed
 * imperatively and does not pass through here at all.
 *
 * Freshness is re-evaluated on a heartbeat, so a feed that simply stops
 * produces a visible STALE state instead of a frozen "live" price.
 */
import type { ProvenanceState } from '@rekt-ink/sim';
import { evaluatePracticeEligibility, type PracticeEligibility } from './eligibility';
import { quoteWithTick, type PracticeQuote } from './quote';

export type FeedConnection =
  | 'CONNECTING'
  | 'LIVE'
  | 'SERVER_FIXTURE'
  | 'LOCAL_FIXTURE'
  | 'DEGRADED'
  | 'DISCONNECTED'
  | 'IDLE';

export interface FeedTick {
  priceEth: number | null;
  priceUsd: number | null;
  observedAtMs: number;
  sourceId: string;
  provenance: ProvenanceState;
}

export interface FeedSnapshot {
  quote: PracticeQuote | null;
  eligibility: PracticeEligibility | null;
  connection: FeedConnection;
  headBlock: number | null;
  droppedTicks: number;
  /** Wall-clock the snapshot was built at; drives the age readout. */
  atMs: number;
}

const EMPTY: FeedSnapshot = {
  quote: null,
  eligibility: null,
  connection: 'IDLE',
  headBlock: null,
  droppedTicks: 0,
  atMs: 0,
};

export interface MarketFeedStoreOptions {
  now?: () => number;
  /** Minimum interval between React notifications. */
  throttleMs?: number;
}

export class MarketFeedStore {
  private snapshot: FeedSnapshot = EMPTY;
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly throttleMs: number;

  private quote: PracticeQuote | null = null;
  private connection: FeedConnection = 'IDLE';
  private headBlock: number | null = null;
  private droppedTicks = 0;
  private sequence = 0;
  private lastNotifyMs = 0;
  private pending: ReturnType<typeof setTimeout> | null = null;

  constructor(options: MarketFeedStoreOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.throttleMs = options.throttleMs ?? 250;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): FeedSnapshot => this.snapshot;

  /** Latest quote, read synchronously by the session store at submit time. */
  currentQuote = (): PracticeQuote | null => this.quote;

  /** Bind the feed to an instrument, seeded from its discovery-time snapshot. */
  setInstrument(base: PracticeQuote | null): void {
    this.quote = base;
    this.sequence = base?.sequence ?? 0;
    this.droppedTicks = 0;
    this.headBlock = null;
    this.connection = base ? 'CONNECTING' : 'IDLE';
    this.flush();
  }

  pushTick(tick: FeedTick): void {
    if (!this.quote) return;
    this.sequence += 1;
    this.quote = quoteWithTick(this.quote, tick, this.sequence);
    this.scheduleFlush();
  }

  setConnection(connection: FeedConnection): void {
    if (this.connection === connection) return;
    this.connection = connection;
    this.flush();
  }

  setHeadBlock(headBlock: number | null): void {
    if (this.headBlock === headBlock) return;
    this.headBlock = headBlock;
    this.scheduleFlush();
  }

  setDroppedTicks(dropped: number): void {
    if (this.droppedTicks === dropped) return;
    this.droppedTicks = dropped;
    this.scheduleFlush();
  }

  /**
   * Heartbeat. Publishes immediately when the market gate changes class, so a
   * feed going quiet disables trading without waiting for a tick that will
   * never arrive.
   */
  refreshFreshness(): void {
    const next = this.evaluate();
    if (gateClass(next) !== gateClass(this.snapshot.eligibility)) {
      this.flush();
      return;
    }
    this.scheduleFlush();
  }

  private evaluate(atMs = this.now()): PracticeEligibility | null {
    return this.quote ? evaluatePracticeEligibility(this.quote, atMs) : null;
  }

  private scheduleFlush(): void {
    if (this.pending !== null) return;
    const wait = Math.max(0, this.throttleMs - (this.now() - this.lastNotifyMs));
    this.pending = setTimeout(() => {
      this.pending = null;
      this.flush();
    }, wait);
  }

  private flush(): void {
    if (this.pending !== null) {
      clearTimeout(this.pending);
      this.pending = null;
    }
    const atMs = this.now();
    this.lastNotifyMs = atMs;
    this.snapshot = {
      quote: this.quote,
      eligibility: this.evaluate(atMs),
      connection: this.connection,
      headBlock: this.headBlock,
      droppedTicks: this.droppedTicks,
      atMs,
    };
    for (const listener of this.listeners) listener();
  }

  dispose(): void {
    if (this.pending !== null) clearTimeout(this.pending);
    this.pending = null;
    this.listeners.clear();
  }
}

/** Identity of the gate for change detection: status plus block reason. */
function gateClass(eligibility: PracticeEligibility | null): string {
  if (!eligibility) return 'NONE';
  return eligibility.status === 'SUPPORTED' ? 'SUPPORTED' : `BLOCKED:${eligibility.code}`;
}
