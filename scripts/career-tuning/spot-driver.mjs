/**
 * CAREER_TUNING_HARNESS_V0 — spot session driver.
 *
 * Wraps the *real* shipped spot simulator (`executeSpotAction`, `placeSpotStop`,
 * `setSpotRiskPlan`, `markSpot`) and the *real* shipped `reduceCareer`. It
 * mirrors the intent set, capability gate, id scheme and event derivation of
 * `apps/web/src/practice/store.ts` so a policy exercises exactly the production
 * economic + progression path, minus React/persistence.
 *
 * It introduces no Career authority: it fabricates no facts and never touches
 * `isGradableEvidence`. A locked capability is refused here exactly as the store
 * refuses it (`CAPABILITY_LOCKED`).
 *
 * ## Provenance boundary (FINDING 1 repair)
 *
 * The synthetic tuning paths enter the sim HONESTLY labelled `SYNTHETIC`, under
 * a `DEMO_ALLOW_SYNTHETIC` session (the explicit synthetic/demo evidence policy
 * required for simulator operation on fabricated scenarios). The resulting sim
 * `TradeSummary` facts therefore carry `evidenceProvenance: 'SYNTHETIC'`.
 *
 *   - `this.career` is the REAL shipped `reduceCareer`, fed every derived event.
 *     Because `isGradableEvidence('SYNTHETIC') === false` it grades NOTHING from
 *     the synthetic spot path and stays at `SPOT_BASIC` forever. The harness
 *     asserts this (test 2 / test "production Career refuses synthetic"). No
 *     SYNTHETIC fact is ever relabelled DERIVED.
 *   - `this.tuning` is the harness-local, NON-AUTHORITATIVE `TuningCareerEvaluator`
 *     (`TUNING_ANALYSIS_ONLY`). It applies the CURRENT SHIPPED qualification
 *     semantics to the simulator-produced synthetic facts and is what gates
 *     capabilities in this harness. It answers "how would the current numerical
 *     rules respond", never "production Career would grade this".
 */
import {
  DEFAULT_FIRST_TICKET_WEI,
  DEFAULT_SPOT_FILL_CONFIG,
  createInitialSimState,
  createSessionOpenedEvent,
  executeSpotAction,
  markSpot,
  mulDiv,
  placeSpotStop,
  quantityAtoms,
  replayEvents,
  setSpotRiskPlan,
} from '@rekt-ink/sim';
import { createInitialCareer, reduceCareer } from '@rekt-ink/career';
import { TUNING_EVIDENCE_POLICY, SYNTHETIC_PROVENANCE } from './config.mjs';
import { TuningCareerEvaluator } from './tuning-evaluator.mjs';
import {
  marginCompletionEvent,
  riskPlannedEntryEvents,
  spotAcceptedEvents,
  stopPlacedEvents,
} from './career-bridge.mjs';

/** Mirrors store.ts `CAPABILITY_FOR_INTENT`. */
const CAPABILITY_FOR_INTENT = {
  BUY_FIXED: 'SPOT_MARKET_BUY_FIXED',
  SELL_ALL: 'SPOT_SELL_ALL',
  SCALE_IN: 'SCALE_IN',
  PARTIAL_CLOSE: 'PARTIAL_EXIT',
  PLACE_STOP: 'STOP_MARKET',
  BUY_RISK_PLANNED: 'RISK_PERCENT_SIZING',
};

export class SpotCareerRun {
  constructor({ sessionId, startedAtMs }) {
    const initial = createInitialSimState({ sessionId, startedAtMs, evidencePolicy: TUNING_EVIDENCE_POLICY });
    this.sim = replayEvents([createSessionOpenedEvent(initial, startedAtMs)], initial);
    // REAL shipped reducer — fed every derived event, grades nothing synthetic.
    this.career = createInitialCareer(`career-${sessionId}`, startedAtMs);
    // Harness-local analysis seam — TUNING_ANALYSIS_ONLY, gates this harness.
    this.tuning = new TuningCareerEvaluator();
    this.tradesClosed = 0;
    this.lastClosedSummary = null;
    this.rejectedActions = 0;
    this.acceptedActions = 0;
    this.stopWidenCount = 0;
    this.violatedRiskTrades = 0;
    this.respectedRiskTrades = 0;
    this.unverifiedRiskTrades = 0;
    this.marginEpisodesAttempted = new Set();
  }

  /* ----- read-only views (present/past facts only) ----- */

  get positionOpen() { return this.sim.position !== null; }
  get positionQtyAtoms() { return this.sim.position ? this.sim.position.openQuantityAtoms : 0n; }
  get hasActiveStop() { return this.sim.activeStop !== null; }
  get activeStopPriceX18() { return this.sim.activeStop ? this.sim.activeStop.stopPriceX18 : null; }
  get equityWei() { return this.sim.account.equityWei; }
  get freeEthWei() { return this.sim.account.freeEthWei; }
  get maxDrawdownBps() { return this.sim.account.maxDrawdownBps; }
  // Progression views come from the TUNING_ANALYSIS_ONLY evaluator: the real
  // `reduceCareer` grades nothing synthetic, so gating on it would freeze the
  // whole harness at SPOT_BASIC. `this.career` is still fed everything and is
  // asserted to stay at SPOT_BASIC (the fail-closed proof).
  get unlockedSkills() { return this.tuning.unlockedSkills; }
  hasCapability(capability) { return this.tuning.hasCapability(capability); }
  hasSkill(skill) { return this.tuning.hasSkill(skill); }

  /** Kinds a policy may legally choose right now (capability + position state). */
  legalActionKinds() {
    const kinds = ['WAIT'];
    if (!this.positionOpen) {
      if (this.hasCapability('SPOT_MARKET_BUY_FIXED') && this.freeEthWei >= DEFAULT_FIRST_TICKET_WEI) kinds.push('BUY_FIXED');
      if (this.hasCapability('RISK_PERCENT_SIZING') && this.hasCapability('CUSTOM_POSITION_SIZE') && this.freeEthWei > 0n) kinds.push('BUY_RISK_PLANNED');
    } else {
      if (this.hasCapability('SPOT_SELL_ALL')) kinds.push('SELL_ALL');
      if (this.hasCapability('SCALE_IN') && this.freeEthWei >= DEFAULT_FIRST_TICKET_WEI) kinds.push('SCALE_IN');
      if (this.hasCapability('PARTIAL_EXIT') && this.positionQtyAtoms > 1n) kinds.push('PARTIAL_CLOSE');
      if (this.hasCapability('STOP_MARKET')) kinds.push('PLACE_STOP');
    }
    return kinds;
  }

  /**
   * True once the account is flat and can no longer fund the minimum fixed
   * ticket. A wiped career run terminates: the harness does not use the
   * account-reset mechanic (see docs/CAREER_TUNING_HARNESS_V0.md — the
   * reset -> MARGIN_2X interaction is unit-tested in `packages/career`).
   */
  get wiped() {
    return !this.positionOpen && this.freeEthWei < DEFAULT_FIRST_TICKET_WEI;
  }

  /* ----- mutation ----- */

  #ordinal() { return this.sim.lastSequence + 1; }

  /** Feed every derived event to BOTH the real reducer (fail-closed proof) and
   *  the analysis evaluator (what actually gates this harness). */
  #applyCareerEvents(events) {
    for (const event of events) {
      this.career = reduceCareer(this.career, event);
      this.tuning.ingestSpotEvent(event);
    }
  }

  #ingestNewSummaries(intentKind, nextSim) {
    const previousCount = this.sim.tradeSummaries.length;
    const newSummaries = nextSim.tradeSummaries.slice(previousCount);
    const acceptedFillId = nextSim.appliedFillIds[nextSim.appliedFillIds.length - 1];
    this.#applyCareerEvents(spotAcceptedEvents(intentKind, nextSim, newSummaries, acceptedFillId, SYNTHETIC_PROVENANCE));
    for (const summary of newSummaries) {
      this.tradesClosed += 1;
      this.lastClosedSummary = summary;
      if (summary.riskPlan !== null) {
        if (summary.riskBudgetViolated) this.violatedRiskTrades += 1;
        else if (summary.riskBudgetVerified) this.respectedRiskTrades += 1;
        else this.unverifiedRiskTrades += 1;
      }
    }
    this.sim = nextSim;
    return newSummaries;
  }

  /** Mark-to-market for an open position; routes a stop-trigger close through
   *  the same Career path as store.ts `markToMarket()`. */
  mark(observation, eventTimeMs) {
    if (!this.positionOpen) return { marked: false };
    const result = markSpot(this.sim, observation, eventTimeMs, DEFAULT_SPOT_FILL_CONFIG);
    if (!result.accepted || result.state === this.sim) return { marked: false };
    if (result.state.tradeSummaries.length > this.sim.tradeSummaries.length) {
      const summaries = this.#ingestNewSummaries('SELL_ALL', result.state);
      return { marked: true, producedSummary: summaries[summaries.length - 1] ?? null };
    }
    this.sim = result.state;
    return { marked: true };
  }

  apply(action, observation, eventTimeMs) {
    const capability = CAPABILITY_FOR_INTENT[action.kind];
    if (action.kind !== 'WAIT' && capability && !this.hasCapability(capability)) {
      this.rejectedActions += 1;
      return { accepted: false, reason: `CAPABILITY_LOCKED:${capability}` };
    }
    switch (action.kind) {
      case 'WAIT':
        return { accepted: true, noop: true };
      case 'BUY_FIXED':
      case 'SCALE_IN':
      case 'SELL_ALL':
      case 'PARTIAL_CLOSE':
        return this.#applySpotAction(action, observation, eventTimeMs);
      case 'PLACE_STOP':
        return this.#applyPlaceStop(action, observation, eventTimeMs);
      case 'BUY_RISK_PLANNED':
        return this.#applyRiskPlannedEntry(action, observation, eventTimeMs);
      default:
        this.rejectedActions += 1;
        return { accepted: false, reason: `UNKNOWN_ACTION:${action.kind}` };
    }
  }

  #applySpotAction(action, observation, eventTimeMs) {
    const ordinal = this.#ordinal();
    const base = {
      intentId: `${this.sim.sessionId}:i${ordinal}`,
      fillId: `${this.sim.sessionId}:f${ordinal}`,
      eventTimeMs,
      observation,
      config: DEFAULT_SPOT_FILL_CONFIG,
    };
    let simAction;
    if (action.kind === 'BUY_FIXED') simAction = { ...base, type: 'BUY', quoteNotionalWei: DEFAULT_FIRST_TICKET_WEI };
    else if (action.kind === 'SCALE_IN') simAction = { ...base, type: 'SCALE_IN', quoteNotionalWei: DEFAULT_FIRST_TICKET_WEI };
    else if (action.kind === 'SELL_ALL') {
      if (!this.positionOpen) { this.rejectedActions += 1; return { accepted: false, reason: 'NO_OPEN_POSITION' }; }
      simAction = { ...base, type: 'FULL_CLOSE' };
    } else {
      if (!this.positionOpen) { this.rejectedActions += 1; return { accepted: false, reason: 'NO_OPEN_POSITION' }; }
      const percent = BigInt(Math.trunc(action.percent ?? 25));
      if (percent <= 0n || percent >= 100n) { this.rejectedActions += 1; return { accepted: false, reason: 'INVALID_QUANTITY' }; }
      const quantity = mulDiv(this.sim.position.openQuantityAtoms, percent, 100n, 'floor');
      if (quantity <= 0n || quantity >= this.sim.position.openQuantityAtoms) { this.rejectedActions += 1; return { accepted: false, reason: 'INVALID_QUANTITY' }; }
      simAction = { ...base, type: 'PARTIAL_CLOSE', quantityAtoms: quantityAtoms(quantity) };
    }

    const result = executeSpotAction(this.sim, simAction);
    if (!result.accepted) {
      this.sim = result.state; // store advances sim past the rejection event
      this.rejectedActions += 1;
      return { accepted: false, reason: result.reason };
    }
    const summaries = this.#ingestNewSummaries(action.kind, result.state);
    this.acceptedActions += 1;
    return { accepted: true, producedSummary: summaries[summaries.length - 1] ?? null };
  }

  #applyPlaceStop(action, observation, eventTimeMs) {
    if (!this.positionOpen) { this.rejectedActions += 1; return { accepted: false, reason: 'NO_OPEN_POSITION' }; }
    const preSim = this.sim;
    const stopId = `${preSim.sessionId}:stop:${preSim.lastSequence + 1}`;
    const result = placeSpotStop(preSim, { stopId, stopPriceX18: action.stopPriceX18, observation, eventTimeMs }, DEFAULT_SPOT_FILL_CONFIG);
    if (!result.accepted) {
      // store.ts PLACE_STOP branch discards the rejected-stop state.
      this.rejectedActions += 1;
      return { accepted: false, reason: result.reason };
    }
    this.sim = result.state;
    this.#applyCareerEvents(stopPlacedEvents(preSim, result.events, SYNTHETIC_PROVENANCE));
    this.acceptedActions += 1;
    const widened = result.events.some((event) => event.type === 'STOP_REPLACED' && event.widened);
    if (widened) this.stopWidenCount += 1;
    return { accepted: true, widened };
  }

  #applyRiskPlannedEntry(action, observation, eventTimeMs) {
    if (!this.hasCapability('CUSTOM_POSITION_SIZE')) { this.rejectedActions += 1; return { accepted: false, reason: 'CAPABILITY_LOCKED:CUSTOM_POSITION_SIZE' }; }
    if (this.positionOpen) { this.rejectedActions += 1; return { accepted: false, reason: 'RISK_PLAN_POSITION_OPEN' }; }
    if (action.stopPriceX18 <= 0n || action.stopPriceX18 >= observation.referencePriceX18) { this.rejectedActions += 1; return { accepted: false, reason: 'RISK_PLAN_REJECTED' }; }
    const preSim = this.sim;
    const ordinal = preSim.lastSequence + 1;
    const planId = `${preSim.sessionId}:plan:${ordinal}`;
    const planned = setSpotRiskPlan(preSim, { planId, observation, stopPriceX18: action.stopPriceX18, riskBps: action.riskBps, eventTimeMs }, DEFAULT_SPOT_FILL_CONFIG);
    if (!planned.accepted || !planned.plan) { this.rejectedActions += 1; return { accepted: false, reason: planned.reason ?? 'RISK_PLAN_REJECTED' }; }
    const plan = planned.plan;
    const entry = executeSpotAction(planned.state, {
      type: 'BUY', intentId: `${preSim.sessionId}:i${ordinal}`, fillId: `${preSim.sessionId}:f${ordinal}`,
      eventTimeMs, observation, quoteNotionalWei: plan.plannedNotionalWei, config: DEFAULT_SPOT_FILL_CONFIG,
    });
    if (!entry.accepted) {
      this.sim = entry.state;
      this.rejectedActions += 1;
      return { accepted: false, reason: entry.reason };
    }
    const stop = placeSpotStop(entry.state, { stopId: `${preSim.sessionId}:stop:${ordinal}`, stopPriceX18: plan.stopPriceX18, observation, eventTimeMs }, DEFAULT_SPOT_FILL_CONFIG);
    const nextSim = stop.state; // store passes stop.state through even if the stop was refused
    this.sim = nextSim;
    this.#applyCareerEvents(riskPlannedEntryEvents(nextSim, plan, SYNTHETIC_PROVENANCE));
    this.acceptedActions += 1;
    return { accepted: true, stopProtected: stop.accepted, plan };
  }

  /**
   * Fold a real long-margin episode completion into the analysis evaluator,
   * exactly as `store.ts` `recordLongMarginEpisodeCompletion` does. `completion`
   * is the output of the shipped `deriveLongMarginCompletion` over the REAL
   * frozen historical episodes; the harness never hand-authors one. The
   * completion's `marketProvenance` is `DERIVED` (real historical marks), so the
   * shipped `isQualifyingLongMarginCompletion` accepts it on its own terms —
   * only the ladder-state check (`evaluateShort`, needs MARGIN_2X, itself only
   * reached here via the synthetic spot analysis) lives in the evaluator.
   *
   * It is also handed to the REAL `reduceCareer`, which cannot unlock SHORT from
   * it (real Career never reached MARGIN_2X on synthetic spot evidence) — the
   * fail-closed proof stays intact.
   */
  recordLongMarginCompletion(completion, episodeId) {
    this.marginEpisodesAttempted.add(episodeId);
    if (!completion) return false;
    this.career = reduceCareer(this.career, marginCompletionEvent(completion));
    this.tuning.ingestMarginCompletion(completion);
    return true;
  }
}
