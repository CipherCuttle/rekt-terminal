/**
 * Practice session store.
 *
 * This is the *only* place in the web app that advances economic state. React
 * components submit typed intents and read immutable snapshots; they never
 * mutate a balance, a position, or Career progress.
 *
 * Ordering inside `submit`:
 *   1. capability gate      (Career authorises the action at all)
 *   2. market gate          (fail-closed eligibility -> MarketObservation)
 *   3. simulator            (`executeSpotAction` is the economic authority)
 *   4. Career               (fed only from recorded simulator facts)
 *   5. persistence          (event log + Career save, debounced)
 *
 * Steps 1 and 2 can only ever *refuse*. They cannot improve a fill.
 */
import {
  DEFAULT_FIRST_TICKET_WEI,
  DEFAULT_SPOT_FILL_CONFIG,
  createInitialSimState,
  createSessionOpenedEvent,
  executeSpotAction,
  executeProtectCapitalChallenge,
  placeSpotStop,
  markSpot,
  mulDiv,
  quantityAtoms,
  replayEvents,
  type SimState,
  type SpotAction,
  type TradeSummary,
} from '@rekt-ink/sim';
import {
  createCareerSave,
  createInitialCareer,
  reduceCareer,
  type CapabilityId,
  type CareerEvent,
  type CareerState,
} from '@rekt-ink/career';
import { evaluatePracticeEligibility, type PracticeBlockCode, type PracticeEligibility } from './eligibility';
import { deriveTradeEconomics, type TradeReviewEconomics } from './derive';
import {
  createMemoryPracticeStorage,
  createPracticeSave,
  restorePracticeSave,
  type PracticeStorage,
} from './persistence';
import type { PracticeQuote } from './quote';

export type PracticeIntent =
  | { kind: 'BUY_FIXED' }
  | { kind: 'SCALE_IN' }
  | { kind: 'SELL_ALL' }
  | { kind: 'PARTIAL_CLOSE'; percent: number }
  | { kind: 'PLACE_STOP'; stopPriceX18: bigint }
  | { kind: 'PROTECT_CAPITAL' };

export type PracticeRejectionCode = PracticeBlockCode | 'CAPABILITY_LOCKED' | 'NO_MARKET_INPUT' | 'INSTRUMENT_LOCKED' | 'NO_OPEN_POSITION' | 'INVALID_QUANTITY' | 'SIMULATOR_REJECTED';

export interface PracticeRejection {
  code: PracticeRejectionCode;
  message: string;
  atMs: number;
}

export interface PracticeIntentResult {
  accepted: boolean;
  rejection?: PracticeRejection;
}

/** OUTCOME facts and PROCESS facts are kept apart on purpose. */
export interface TradeReview {
  summary: TradeSummary;
  economics: TradeReviewEconomics;
  /** True only if this trade incremented Career's qualifying-trade counter. */
  countedTowardQualification: boolean;
  /** Career snapshot taken immediately after the trade was reduced. */
  careerAfter: CareerState;
  /** Skills newly unlocked by this trade. */
  unlockedSkills: readonly string[];
}

export type PracticeRestoreStatus = 'FRESH' | 'RESTORED' | 'RESET_SAVE_UNUSABLE';

export interface PracticeSnapshot {
  sim: SimState;
  career: CareerState;
  /** Instrument the session's economic state is bound to, if any. */
  instrumentId: string | null;
  lastRejection: PracticeRejection | null;
  tradeReview: TradeReview | null;
  restoreStatus: PracticeRestoreStatus;
  hydrated: boolean;
}

const CAPABILITY_FOR_INTENT: Record<PracticeIntent['kind'], CapabilityId> = {
  BUY_FIXED: 'SPOT_MARKET_BUY_FIXED',
  SELL_ALL: 'SPOT_SELL_ALL',
  SCALE_IN: 'SCALE_IN',
  PARTIAL_CLOSE: 'PARTIAL_EXIT',
  PLACE_STOP: 'STOP_MARKET',
  PROTECT_CAPITAL: 'SCALE_IN',
};

export interface PracticeStoreOptions {
  sessionId?: string;
  now?: () => number;
  storage?: PracticeStorage;
  /** Latest usable quote for the instrument currently on screen. */
  getQuote?: () => PracticeQuote | null;
  persistDebounceMs?: number;
}

function openedSession(sessionId: string, startedAtMs: number): SimState {
  const initial = createInitialSimState({ sessionId, startedAtMs });
  return replayEvents([createSessionOpenedEvent(initial, startedAtMs)], initial);
}

export class PracticeSessionStore {
  private snapshot: PracticeSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly storage: PracticeStorage;
  private readonly persistDebounceMs: number;
  private getQuote: () => PracticeQuote | null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private hydration: Promise<void> | null = null;

  constructor(options: PracticeStoreOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.storage = options.storage ?? createMemoryPracticeStorage();
    this.getQuote = options.getQuote ?? (() => null);
    this.persistDebounceMs = options.persistDebounceMs ?? 400;
    const startedAtMs = this.now();
    const sessionId = options.sessionId ?? `practice-${startedAtMs}`;
    this.snapshot = {
      sim: openedSession(sessionId, startedAtMs),
      career: createInitialCareer(`career-${sessionId}`, startedAtMs),
      instrumentId: null,
      lastRejection: null,
      tradeReview: null,
      restoreStatus: 'FRESH',
      hydrated: false,
    };
  }

  /* ---------------------------------------------------------------------- */
  /* subscription                                                            */
  /* ---------------------------------------------------------------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): PracticeSnapshot => this.snapshot;

  setQuoteProvider(getQuote: () => PracticeQuote | null): void {
    this.getQuote = getQuote;
  }

  private commit(next: Partial<PracticeSnapshot>, persist = true): void {
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) listener();
    if (persist) this.schedulePersist();
  }

  /* ---------------------------------------------------------------------- */
  /* hydration                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * Restore a previous practice session by replaying its event log. Any fault
   * — malformed save, failed Career migration, digest mismatch — discards the
   * save and starts clean rather than showing a partially reconstructed ledger.
   */
  hydrate(): Promise<void> {
    // React StrictMode runs mount effects twice; hydration must happen once.
    return (this.hydration ??= this.runHydration());
  }

  private async runHydration(): Promise<void> {
    let loaded: unknown = null;
    try {
      loaded = await this.storage.load();
    } catch {
      loaded = null;
    }
    if (loaded === null || loaded === undefined) {
      this.commit({ hydrated: true, restoreStatus: 'FRESH' }, false);
      return;
    }
    try {
      const restored = restorePracticeSave(loaded);
      this.commit(
        {
          sim: restored.sim,
          career: restored.career.state,
          instrumentId: restored.instrumentId,
          hydrated: true,
          restoreStatus: 'RESTORED',
        },
        false,
      );
    } catch {
      await this.storage.clear();
      this.commit({ hydrated: true, restoreStatus: 'RESET_SAVE_UNUSABLE' }, false);
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer !== null) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persistNow();
    }, this.persistDebounceMs);
  }

  async persistNow(): Promise<void> {
    const { sim, career, instrumentId } = this.snapshot;
    const envelope = createPracticeSave({
      sim,
      career: createCareerSave(career),
      instrumentId,
      savedAtMs: this.now(),
    });
    await this.storage.save(envelope);
  }

  /* ---------------------------------------------------------------------- */
  /* clock                                                                   */
  /* ---------------------------------------------------------------------- */

  /**
   * The simulator refuses events that move backwards in time, so the session
   * clock is monotonic with respect to the recorded log.
   */
  private eventTime(): number {
    const last = this.snapshot.sim.events[this.snapshot.sim.events.length - 1]?.eventTimeMs ?? this.snapshot.sim.startedAtMs;
    return Math.max(this.now(), last);
  }

  /* ---------------------------------------------------------------------- */
  /* gates                                                                   */
  /* ---------------------------------------------------------------------- */

  hasCapability(capability: CapabilityId): boolean {
    return this.snapshot.career.unlockedCapabilities.includes(capability);
  }

  private reject(code: PracticeRejectionCode, message: string): PracticeIntentResult {
    const rejection: PracticeRejection = { code, message, atMs: this.now() };
    this.commit({ lastRejection: rejection }, false);
    return { accepted: false, rejection };
  }

  /* ---------------------------------------------------------------------- */
  /* intents                                                                 */
  /* ---------------------------------------------------------------------- */

  submit(intent: PracticeIntent): PracticeIntentResult {
    const capability = CAPABILITY_FOR_INTENT[intent.kind];
    if (!this.hasCapability(capability)) {
      return this.reject('CAPABILITY_LOCKED', `${capability} is not authorised by your Career yet.`);
    }

    const quote = this.getQuote();
    if (!quote) return this.reject('NO_MARKET_INPUT', 'No market observation is available for this instrument.');

    const eventTimeMs = this.eventTime();
    const gate = evaluatePracticeEligibility(quote, eventTimeMs);
    if (gate.status === 'BLOCKED') return this.reject(gate.code, gate.detail);

    const { sim } = this.snapshot;
    const position = sim.position;

    // A spot session cannot mix instruments; the simulator enforces this and
    // the UI must not offer an action that would trip it.
    if (position && position.instrumentId !== gate.observation.instrumentId) {
      return this.reject('INSTRUMENT_LOCKED', `An open position on ${position.instrumentId} must be closed before trading another instrument.`);
    }

    if (intent.kind === 'PROTECT_CAPITAL') {
      if (!this.snapshot.career.unlockedSkills.includes('SCALE_CONTROL')) return this.reject('CAPABILITY_LOCKED', 'SCALE_CONTROL is required for practice challenges.');
      const result = executeProtectCapitalChallenge(sim, gate.observation, eventTimeMs, DEFAULT_SPOT_FILL_CONFIG);
      if (!result.accepted) return this.reject('SIMULATOR_REJECTED', result.reason ?? 'The simulator refused this challenge.');
      this.applyAccepted(intent, result.state, gate.observation.instrumentId);
      return { accepted: true };
    }
    if (intent.kind === 'PLACE_STOP') {
      const result = placeSpotStop(sim, { stopId: `${sim.sessionId}:stop:${sim.lastSequence + 1}`, stopPriceX18: intent.stopPriceX18, observation: gate.observation, eventTimeMs }, DEFAULT_SPOT_FILL_CONFIG);
      if (!result.accepted) return this.reject('SIMULATOR_REJECTED', result.reason ?? 'The simulator refused this stop.');
      let career = reduceCareer(this.snapshot.career, { type: 'STOP_PLACED', eventId: `${sim.sessionId}:stop:${sim.lastSequence + 1}:career`, sourceReceiptId: result.events[0].eventId });
      this.commit({ sim: result.state, career, instrumentId: gate.observation.instrumentId, lastRejection: null });
      return { accepted: true };
    }

    const action = this.buildAction(intent, gate, eventTimeMs);
    if ('rejection' in action) return action.rejection;

    const result = executeSpotAction(sim, action.action);
    if (!result.accepted) {
      // The rejection is itself a recorded simulator event; keep it.
      const rejection: PracticeRejection = {
        code: 'SIMULATOR_REJECTED',
        message: result.reason ?? 'The simulator refused this intent.',
        atMs: eventTimeMs,
      };
      this.commit({ sim: result.state, lastRejection: rejection });
      return { accepted: false, rejection };
    }

    this.applyAccepted(intent, result.state, gate.observation.instrumentId);
    return { accepted: true };
  }

  private buildAction(
    intent: PracticeIntent,
    gate: Extract<PracticeEligibility, { status: 'SUPPORTED' }>,
    eventTimeMs: number,
  ): { action: SpotAction } | { rejection: PracticeIntentResult } {
    const { sim } = this.snapshot;
    const ordinal = sim.lastSequence + 1;
    const intentId = `${sim.sessionId}:i${ordinal}`;
    const fillId = `${sim.sessionId}:f${ordinal}`;
    const base = { intentId, fillId, eventTimeMs, observation: gate.observation, config: DEFAULT_SPOT_FILL_CONFIG };

    if (intent.kind === 'BUY_FIXED') {
      return { action: { ...base, type: 'BUY', quoteNotionalWei: DEFAULT_FIRST_TICKET_WEI } };
    }
    if (intent.kind === 'PLACE_STOP' || intent.kind === 'PROTECT_CAPITAL') {
      return { rejection: this.reject('SIMULATOR_REJECTED', 'This intent is handled by the session domain.') };
    }
    if (intent.kind === 'SCALE_IN') {
      return { action: { ...base, type: 'SCALE_IN', quoteNotionalWei: DEFAULT_FIRST_TICKET_WEI } };
    }
    if (intent.kind === 'SELL_ALL') {
      if (!sim.position) return { rejection: this.reject('NO_OPEN_POSITION', 'There is no open position to close.') };
      return { action: { ...base, type: 'FULL_CLOSE' } };
    }

    if (!sim.position) return { rejection: this.reject('NO_OPEN_POSITION', 'There is no open position to reduce.') };
    const percent = BigInt(Math.trunc(intent.percent));
    if (percent <= 0n || percent >= 100n) {
      return { rejection: this.reject('INVALID_QUANTITY', 'A partial close must be between 1% and 99% of the open position.') };
    }
    const quantity = mulDiv(sim.position.openQuantityAtoms, percent, 100n, 'floor');
    if (quantity <= 0n || quantity >= sim.position.openQuantityAtoms) {
      return { rejection: this.reject('INVALID_QUANTITY', 'That fraction does not leave a tradable remainder at this position size.') };
    }
    return { action: { ...base, type: 'PARTIAL_CLOSE', quantityAtoms: quantityAtoms(quantity) } };
  }

  /**
   * Fold the accepted simulator result into session state and feed Career from
   * the facts the simulator recorded — never from the click that caused them.
   */
  private applyAccepted(intent: PracticeIntent, nextSim: SimState, instrumentId: string): void {
    const previousSummaryCount = this.snapshot.sim.tradeSummaries.length;
    const newSummaries = nextSim.tradeSummaries.slice(previousSummaryCount);
    const acceptedFillId = nextSim.appliedFillIds[nextSim.appliedFillIds.length - 1];

    let career = this.snapshot.career;
    const careerEvents: CareerEvent[] = [];

    if (intent.kind === 'SCALE_IN' && acceptedFillId) {
      careerEvents.push({ type: 'SCALE_IN_USED', eventId: `${acceptedFillId}:scale-in`, sourceReceiptId: acceptedFillId });
    }
    if (intent.kind === 'PARTIAL_CLOSE' && acceptedFillId) {
      careerEvents.push({ type: 'PARTIAL_EXIT_USED', eventId: `${acceptedFillId}:partial-exit`, sourceReceiptId: acceptedFillId });
    }
    for (const summary of newSummaries) {
      careerEvents.push({
        type: 'TRADE_CLOSED',
        eventId: `${nextSim.sessionId}:${summary.tradeId}:closed`,
        sourceReceiptId: `${nextSim.sessionId}:${summary.tradeId}`,
        summary: {
          tradeId: summary.tradeId,
          sessionId: summary.sessionId,
          mode: summary.mode,
          realizedPnlWei: summary.realizedPnlWei,
          accountEquityAtCloseWei: summary.accountEquityAtCloseWei,
          lossBpsOfThenCurrentEquity: summary.lossBpsOfThenCurrentEquity,
          accountEquityAtOpenWei: summary.accountEquityAtOpenWei,
          exitReason: summary.exitReason,
          stopUsed: summary.stopUsed,
          partialExitUsed: summary.partialExitUsed,
          liquidated: summary.liquidated,
        },
      });
      if (summary.stopUsed) careerEvents.push({ type: 'STOP_HIT', eventId: `${nextSim.sessionId}:${summary.tradeId}:stop-hit`, sourceReceiptId: `${nextSim.sessionId}:${summary.tradeId}` });
    }

    const careerBefore = career;
    for (const event of careerEvents) career = reduceCareer(career, event);

    const closedSummary = newSummaries[newSummaries.length - 1];
    const tradeReview: TradeReview | null = closedSummary
      ? {
          summary: closedSummary,
          economics: deriveTradeEconomics(nextSim.events, closedSummary),
          // Read the verdict off Career's own counter rather than restating the rule here.
          countedTowardQualification: career.stats.qualifyingScaleTrades > careerBefore.stats.qualifyingScaleTrades,
          careerAfter: career,
          unlockedSkills: career.unlockedSkills.filter((skill) => !careerBefore.unlockedSkills.includes(skill)),
        }
      : this.snapshot.tradeReview;

    this.commit({
      sim: nextSim,
      career,
      instrumentId,
      lastRejection: null,
      tradeReview,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* marking                                                                 */
  /* ---------------------------------------------------------------------- */

  /**
   * Push a fresh mark into the simulator so equity and unrealized PnL stay
   * simulator truth rather than a UI calculation.
   *
   * Called on a slow cadence and only while a position is open. If the market
   * gate is closed, nothing is marked — a stale feed must not silently keep
   * revaluing an open position.
   */
  markToMarket(): boolean {
    const { sim } = this.snapshot;
    if (!sim.position) return false;
    const quote = this.getQuote();
    if (!quote) return false;
    const eventTimeMs = this.eventTime();
    const gate = evaluatePracticeEligibility(quote, eventTimeMs);
    if (gate.status === 'BLOCKED') return false;
    if (gate.observation.instrumentId !== sim.position.instrumentId) return false;
    // An unchanged price revalues to the same equity. Skipping it keeps the
    // append-only log from growing once per second in a quiet market.
    if (gate.observation.referencePriceX18 === sim.markPriceX18 && !(sim.activeStop && gate.observation.referencePriceX18 <= sim.activeStop.stopPriceX18)) return false;

    const result = markSpot(sim, gate.observation, eventTimeMs, DEFAULT_SPOT_FILL_CONFIG);
    if (!result.accepted || result.state === sim) return false;
    // Marks are revaluations, not new commitments, so they do not trigger a
    // save; the next fill persists them along with itself. A reload mid-position
    // restores the same position and balance and re-marks within a second.
    if (result.state.tradeSummaries.length > sim.tradeSummaries.length) this.applyAccepted({ kind: 'SELL_ALL' }, result.state, gate.observation.instrumentId);
    else this.commit({ sim: result.state }, false);
    return true;
  }

  /* ---------------------------------------------------------------------- */
  /* session controls                                                        */
  /* ---------------------------------------------------------------------- */

  dismissTradeReview(): void {
    if (!this.snapshot.tradeReview) return;
    this.commit({ tradeReview: null }, false);
  }

  clearRejection(): void {
    if (!this.snapshot.lastRejection) return;
    this.commit({ lastRejection: null }, false);
  }

  /** Start a clean bankroll. Career progress is intentionally preserved. */
  resetSession(): void {
    const startedAtMs = this.now();
    this.commit({
      sim: openedSession(`practice-${startedAtMs}`, startedAtMs),
      instrumentId: null,
      lastRejection: null,
      tradeReview: null,
      restoreStatus: 'FRESH',
    });
  }

  dispose(): void {
    if (this.persistTimer !== null) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    this.listeners.clear();
  }
}
