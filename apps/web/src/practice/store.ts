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
  placeSpotStop,
  markSpot,
  mulDiv,
  quantityAtoms,
  replayEvents,
  setSpotRiskPlan,
  type EvidencePolicy,
  type MarketObservation,
  type RiskPlan,
  type ProvenanceState,
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
import type { MarketEnvironment } from '../types/api';

/** A DEMO session is the only way fabricated evidence reaches the simulator. */
export const EVIDENCE_POLICY_FOR_ENVIRONMENT: Record<MarketEnvironment, EvidencePolicy> = {
  LIVE: 'LIVE_ONLY',
  DEMO: 'DEMO_ALLOW_SYNTHETIC',
};

export type PracticeIntent =
  | { kind: 'BUY_FIXED' }
  | { kind: 'SCALE_IN' }
  | { kind: 'SELL_ALL' }
  | { kind: 'PARTIAL_CLOSE'; percent: number }
  | { kind: 'PLACE_STOP'; stopPriceX18: bigint }
  | { kind: 'BUY_RISK_PLANNED'; stopPriceX18: bigint; riskBps: bigint };

export type PracticeRejectionCode = PracticeBlockCode | 'CAPABILITY_LOCKED' | 'NO_MARKET_INPUT' | 'INSTRUMENT_LOCKED' | 'NO_OPEN_POSITION' | 'INVALID_QUANTITY' | 'SIMULATOR_REJECTED' | 'RISK_PLAN_REJECTED' | 'RISK_PLAN_UNPROTECTED';

export interface PracticeRejection {
  code: PracticeRejectionCode;
  message: string;
  atMs: number;
}

export interface PracticeIntentResult {
  accepted: boolean;
  rejection?: PracticeRejection;
}

export interface TradeReview {
  summary: TradeSummary;
  economics: TradeReviewEconomics;
  countedTowardQualification: boolean;
  careerAfter: CareerState;
  unlockedSkills: readonly string[];
}

export type PracticeRestoreStatus = 'FRESH' | 'RESTORED' | 'RESET_SAVE_UNUSABLE' | 'RESET_ENVIRONMENT_CHANGED';

export interface PracticeSnapshot {
  sim: SimState;
  career: CareerState;
  environment: MarketEnvironment;
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
  BUY_RISK_PLANNED: 'RISK_PERCENT_SIZING',
};

export interface PracticeStoreOptions {
  sessionId?: string;
  environment?: MarketEnvironment;
  now?: () => number;
  storage?: PracticeStorage;
  getQuote?: () => PracticeQuote | null;
  persistDebounceMs?: number;
}

function openedSession(sessionId: string, startedAtMs: number, environment: MarketEnvironment): SimState {
  const initial = createInitialSimState({ sessionId, startedAtMs, evidencePolicy: EVIDENCE_POLICY_FOR_ENVIRONMENT[environment] });
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
    const environment = options.environment ?? 'LIVE';
    const sessionId = options.sessionId ?? `practice-${startedAtMs}`;
    this.snapshot = {
      sim: openedSession(sessionId, startedAtMs, environment),
      career: createInitialCareer(`career-${sessionId}`, startedAtMs),
      environment,
      instrumentId: null,
      lastRejection: null,
      tradeReview: null,
      restoreStatus: 'FRESH',
      hydrated: false,
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
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

  hydrate(): Promise<void> {
    return (this.hydration ??= this.runHydration());
  }

  private async runHydration(): Promise<void> {
    let loaded: unknown = null;
    try { loaded = await this.storage.load(); } catch { loaded = null; }
    if (loaded === null || loaded === undefined) {
      this.commit({ hydrated: true, restoreStatus: 'FRESH' }, false);
      return;
    }
    try {
      const restored = restorePracticeSave(loaded);
      if (restored.environment !== this.snapshot.environment) {
        await this.storage.clear();
        this.commit({ hydrated: true, restoreStatus: 'RESET_ENVIRONMENT_CHANGED' }, false);
        return;
      }
      this.commit({ sim: restored.sim, career: restored.career.state, instrumentId: restored.instrumentId, hydrated: true, restoreStatus: 'RESTORED' }, false);
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
    const { sim, career, instrumentId, environment } = this.snapshot;
    const envelope = createPracticeSave({ sim, career: createCareerSave(career), instrumentId, environment, savedAtMs: this.now() });
    await this.storage.save(envelope);
  }

  private eventTime(): number {
    const last = this.snapshot.sim.events[this.snapshot.sim.events.length - 1]?.eventTimeMs ?? this.snapshot.sim.startedAtMs;
    return Math.max(this.now(), last);
  }

  hasCapability(capability: CapabilityId): boolean {
    return this.snapshot.career.unlockedCapabilities.includes(capability);
  }

  private reject(code: PracticeRejectionCode, message: string): PracticeIntentResult {
    const rejection: PracticeRejection = { code, message, atMs: this.now() };
    this.commit({ lastRejection: rejection }, false);
    return { accepted: false, rejection };
  }

  submit(intent: PracticeIntent): PracticeIntentResult {
    const capability = CAPABILITY_FOR_INTENT[intent.kind];
    if (!this.hasCapability(capability)) return this.reject('CAPABILITY_LOCKED', `${capability} is not authorised by your Career yet.`);

    const quote = this.getQuote();
    if (!quote) return this.reject('NO_MARKET_INPUT', 'No market observation is available for this instrument.');

    const eventTimeMs = this.eventTime();
    const gate = evaluatePracticeEligibility(quote, eventTimeMs, { evidencePolicy: this.snapshot.sim.evidencePolicy });
    if (gate.status === 'BLOCKED') return this.reject(gate.code, gate.detail);

    const { sim } = this.snapshot;
    const position = sim.position;
    if (position && position.instrumentId !== gate.observation.instrumentId) {
      return this.reject('INSTRUMENT_LOCKED', `An open position on ${position.instrumentId} must be closed before trading another instrument.`);
    }

    if (intent.kind === 'BUY_RISK_PLANNED') {
      if (!this.hasCapability('CUSTOM_POSITION_SIZE')) return this.reject('CAPABILITY_LOCKED', 'CUSTOM_POSITION_SIZE is not authorised by your Career yet.');
      return this.submitRiskPlannedEntry(intent, gate.observation, eventTimeMs);
    }

    if (intent.kind === 'PLACE_STOP') {
      const result = placeSpotStop(sim, { stopId: `${sim.sessionId}:stop:${sim.lastSequence + 1}`, stopPriceX18: intent.stopPriceX18, observation: gate.observation, eventTimeMs }, DEFAULT_SPOT_FILL_CONFIG);
      if (!result.accepted) return this.reject('SIMULATOR_REJECTED', result.reason ?? 'The simulator refused this stop.');
      const career = reduceCareer(this.snapshot.career, { type: 'STOP_PLACED', eventId: `${sim.sessionId}:stop:${sim.lastSequence + 1}:career`, sourceReceiptId: result.events[0].eventId, evidenceProvenance: gate.observation.provenance });
      this.commit({ sim: result.state, career, instrumentId: gate.observation.instrumentId, lastRejection: null });
      return { accepted: true };
    }

    const action = this.buildAction(intent, gate, eventTimeMs);
    if ('rejection' in action) return action.rejection;

    const result = executeSpotAction(sim, action.action);
    if (!result.accepted) {
      const rejection: PracticeRejection = { code: 'SIMULATOR_REJECTED', message: result.reason ?? 'The simulator refused this intent.', atMs: eventTimeMs };
      this.commit({ sim: result.state, lastRejection: rejection });
      return { accepted: false, rejection };
    }

    this.applyAccepted(intent, result.state, gate.observation.instrumentId, gate.observation.provenance);
    return { accepted: true };
  }

  private submitRiskPlannedEntry(
    intent: Extract<PracticeIntent, { kind: 'BUY_RISK_PLANNED' }>,
    observation: MarketObservation,
    eventTimeMs: number,
  ): PracticeIntentResult {
    const { sim } = this.snapshot;
    if (sim.position) return this.reject('SIMULATOR_REJECTED', 'A risk plan is defined before entry; close the open position first.');
    if (intent.stopPriceX18 <= 0n || intent.stopPriceX18 >= observation.referencePriceX18) return this.reject('RISK_PLAN_REJECTED', 'The stop must sit strictly below the current market price.');

    const ordinal = sim.lastSequence + 1;
    const planId = `${sim.sessionId}:plan:${ordinal}`;
    const planned = setSpotRiskPlan(sim, { planId, observation, stopPriceX18: intent.stopPriceX18, riskBps: intent.riskBps, eventTimeMs }, DEFAULT_SPOT_FILL_CONFIG);
    if (!planned.accepted || !planned.plan) return this.reject('RISK_PLAN_REJECTED', planned.reason ?? 'The simulator refused this risk plan.');
    const plan = planned.plan;

    const entry = executeSpotAction(planned.state, {
      type: 'BUY', intentId: `${sim.sessionId}:i${ordinal}`, fillId: `${sim.sessionId}:f${ordinal}`, eventTimeMs, observation,
      quoteNotionalWei: plan.plannedNotionalWei, config: DEFAULT_SPOT_FILL_CONFIG,
    });
    if (!entry.accepted) {
      const rejection: PracticeRejection = { code: 'SIMULATOR_REJECTED', message: entry.reason ?? 'The simulator refused the planned entry.', atMs: eventTimeMs };
      this.commit({ sim: entry.state, lastRejection: rejection });
      return { accepted: false, rejection };
    }

    const stop = placeSpotStop(entry.state, { stopId: `${sim.sessionId}:stop:${ordinal}`, stopPriceX18: plan.stopPriceX18, observation, eventTimeMs }, DEFAULT_SPOT_FILL_CONFIG);
    if (!stop.accepted) {
      const rejection: PracticeRejection = { code: 'RISK_PLAN_UNPROTECTED', message: `The sized entry filled but the protective stop was refused (${stop.reason ?? 'unknown'}). Place a stop now.`, atMs: eventTimeMs };
      this.applyRiskPlannedCommit(stop.state, observation.instrumentId, observation.provenance, plan, rejection);
      return { accepted: false, rejection };
    }

    this.applyRiskPlannedCommit(stop.state, observation.instrumentId, observation.provenance, plan, null);
    return { accepted: true };
  }

  private applyRiskPlannedCommit(nextSim: SimState, instrumentId: string, evidenceProvenance: ProvenanceState, plan: RiskPlan, rejection: PracticeRejection | null): void {
    let career = reduceCareer(this.snapshot.career, {
      type: 'RISK_PLAN_CREATED', eventId: `${plan.planId}:career`, sourceReceiptId: `${plan.planId}:risk-plan`, planId: plan.planId, evidenceProvenance,
    });
    if (nextSim.activeStop) {
      career = reduceCareer(career, {
        type: 'STOP_PLACED', eventId: `${nextSim.activeStop.stopId}:career`, sourceReceiptId: `${nextSim.activeStop.stopId}:placed`, evidenceProvenance,
      });
    }
    this.commit({ sim: nextSim, career, instrumentId, lastRejection: rejection });
  }

  private buildAction(intent: PracticeIntent, gate: Extract<PracticeEligibility, { status: 'SUPPORTED' }>, eventTimeMs: number): { action: SpotAction } | { rejection: PracticeIntentResult } {
    const { sim } = this.snapshot;
    const ordinal = sim.lastSequence + 1;
    const intentId = `${sim.sessionId}:i${ordinal}`;
    const fillId = `${sim.sessionId}:f${ordinal}`;
    const base = { intentId, fillId, eventTimeMs, observation: gate.observation, config: DEFAULT_SPOT_FILL_CONFIG };

    if (intent.kind === 'BUY_FIXED') return { action: { ...base, type: 'BUY', quoteNotionalWei: DEFAULT_FIRST_TICKET_WEI } };
    if (intent.kind === 'PLACE_STOP' || intent.kind === 'BUY_RISK_PLANNED') return { rejection: this.reject('SIMULATOR_REJECTED', 'This intent is handled by the session domain.') };
    if (intent.kind === 'SCALE_IN') return { action: { ...base, type: 'SCALE_IN', quoteNotionalWei: DEFAULT_FIRST_TICKET_WEI } };
    if (intent.kind === 'SELL_ALL') {
      if (!sim.position) return { rejection: this.reject('NO_OPEN_POSITION', 'There is no open position to close.') };
      return { action: { ...base, type: 'FULL_CLOSE' } };
    }

    if (!sim.position) return { rejection: this.reject('NO_OPEN_POSITION', 'There is no open position to reduce.') };
    const percent = BigInt(Math.trunc(intent.percent));
    if (percent <= 0n || percent >= 100n) return { rejection: this.reject('INVALID_QUANTITY', 'A partial close must be between 1% and 99% of the open position.') };
    const quantity = mulDiv(sim.position.openQuantityAtoms, percent, 100n, 'floor');
    if (quantity <= 0n || quantity >= sim.position.openQuantityAtoms) return { rejection: this.reject('INVALID_QUANTITY', 'That fraction does not leave a tradable remainder at this position size.') };
    return { action: { ...base, type: 'PARTIAL_CLOSE', quantityAtoms: quantityAtoms(quantity) } };
  }

  private applyAccepted(intent: PracticeIntent, nextSim: SimState, instrumentId: string, evidenceProvenance: ProvenanceState): void {
    const previousSummaryCount = this.snapshot.sim.tradeSummaries.length;
    const newSummaries = nextSim.tradeSummaries.slice(previousSummaryCount);
    const acceptedFillId = nextSim.appliedFillIds[nextSim.appliedFillIds.length - 1];

    let career = this.snapshot.career;
    const careerEvents: CareerEvent[] = [];

    if (intent.kind === 'SCALE_IN' && acceptedFillId) careerEvents.push({ type: 'SCALE_IN_USED', eventId: `${acceptedFillId}:scale-in`, sourceReceiptId: acceptedFillId, evidenceProvenance });
    if (intent.kind === 'PARTIAL_CLOSE' && acceptedFillId) careerEvents.push({ type: 'PARTIAL_EXIT_USED', eventId: `${acceptedFillId}:partial-exit`, sourceReceiptId: acceptedFillId, evidenceProvenance });
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
          maxDrawdownBpsAtClose: summary.maxDrawdownBpsAtClose,
          exitReason: summary.exitReason,
          stopUsed: summary.stopUsed,
          partialExitUsed: summary.partialExitUsed,
          liquidated: summary.liquidated,
          openedAtMs: summary.openedAtMs,
          firstStopPlacedAtMs: summary.firstStopPlacedAtMs,
          stopWidened: summary.stopWidened,
          riskPlanned: summary.riskPlan !== null,
          riskBudgetViolated: summary.riskBudgetViolated,
          riskBudgetVerified: summary.riskBudgetVerified,
          evidenceProvenance: summary.evidenceProvenance,
        },
      });
      if (summary.stopUsed) careerEvents.push({ type: 'STOP_HIT', eventId: `${nextSim.sessionId}:${summary.tradeId}:stop-hit`, sourceReceiptId: `${nextSim.sessionId}:${summary.tradeId}`, evidenceProvenance: summary.evidenceProvenance });
      if (summary.riskPlan !== null && (summary.riskBudgetViolated || summary.riskBudgetVerified)) {
        careerEvents.push({
          type: summary.riskBudgetViolated ? 'RISK_BUDGET_VIOLATED' : 'RISK_BUDGET_RESPECTED',
          eventId: `${nextSim.sessionId}:${summary.tradeId}:risk-budget`,
          sourceReceiptId: `${nextSim.sessionId}:${summary.tradeId}`,
          tradeId: summary.tradeId,
          evidenceProvenance: summary.evidenceProvenance,
        });
      }
    }

    const careerBefore = career;
    for (const event of careerEvents) career = reduceCareer(career, event);

    const closedSummary = newSummaries[newSummaries.length - 1];
    const tradeReview: TradeReview | null = closedSummary
      ? {
          summary: closedSummary,
          economics: deriveTradeEconomics(nextSim.events, closedSummary),
          countedTowardQualification: career.stats.qualifyingScaleTrades > careerBefore.stats.qualifyingScaleTrades,
          careerAfter: career,
          unlockedSkills: career.unlockedSkills.filter((skill) => !careerBefore.unlockedSkills.includes(skill)),
        }
      : this.snapshot.tradeReview;

    this.commit({ sim: nextSim, career, instrumentId, lastRejection: null, tradeReview });
  }

  markToMarket(): boolean {
    const { sim } = this.snapshot;
    if (!sim.position) return false;
    const quote = this.getQuote();
    if (!quote) return false;
    const eventTimeMs = this.eventTime();
    const gate = evaluatePracticeEligibility(quote, eventTimeMs, { evidencePolicy: this.snapshot.sim.evidencePolicy });
    if (gate.status === 'BLOCKED') return false;
    if (gate.observation.instrumentId !== sim.position.instrumentId) return false;
    if (gate.observation.referencePriceX18 === sim.markPriceX18 && !(sim.activeStop && gate.observation.referencePriceX18 <= sim.activeStop.stopPriceX18)) return false;

    const result = markSpot(sim, gate.observation, eventTimeMs, DEFAULT_SPOT_FILL_CONFIG);
    if (!result.accepted || result.state === sim) return false;
    if (result.state.tradeSummaries.length > sim.tradeSummaries.length) this.applyAccepted({ kind: 'SELL_ALL' }, result.state, gate.observation.instrumentId, gate.observation.provenance);
    else this.commit({ sim: result.state }, false);
    return true;
  }

  dismissTradeReview(): void {
    if (!this.snapshot.tradeReview) return;
    this.commit({ tradeReview: null }, false);
  }

  clearRejection(): void {
    if (!this.snapshot.lastRejection) return;
    this.commit({ lastRejection: null }, false);
  }

  /** Every clean-bankroll restart is a Career fact before a new session exists. */
  private careerAfterAccountReset(): CareerState {
    const { career } = this.snapshot;
    return reduceCareer(career, {
      type: 'ACCOUNT_RESET_USED',
      eventId: `${career.careerId}:account-reset:${career.processedEventIds.length + 1}`,
    });
  }

  /** Start a clean bankroll. Career progress is preserved, so the reset is recorded. */
  resetSession(): void {
    const startedAtMs = this.now();
    const career = this.careerAfterAccountReset();
    this.commit({
      sim: openedSession(`practice-${startedAtMs}`, startedAtMs, this.snapshot.environment),
      career,
      instrumentId: null,
      lastRejection: null,
      tradeReview: null,
      restoreStatus: 'FRESH',
    });
  }

  /** Switching environment also starts a clean bankroll and therefore counts as a reset. */
  setEnvironment(environment: MarketEnvironment): void {
    if (this.snapshot.environment === environment) return;
    const startedAtMs = this.now();
    const career = this.careerAfterAccountReset();
    this.commit({
      environment,
      sim: openedSession(`practice-${environment.toLowerCase()}-${startedAtMs}`, startedAtMs, environment),
      career,
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
