/**
 * CAREER_TUNING_HARNESS_V0 — TUNING_ANALYSIS_ONLY Career evaluator.
 *
 * ## What this is, and what it is NOT
 *
 * The synthetic tuning price paths (`scenarios.mjs`) are fabricated market
 * evidence. They now enter the simulator honestly labelled `SYNTHETIC`, under a
 * `DEMO_ALLOW_SYNTHETIC` session, so the resulting sim `TradeSummary` facts
 * carry `evidenceProvenance: 'SYNTHETIC'`. The shipped `reduceCareer` /
 * `isGradableEvidence` therefore — correctly — REFUSE to grade them. Production
 * Career progression from synthetic spot evidence is impossible, and the harness
 * proves that (see spot-driver's real `career` object and test 2 / test 6).
 *
 * This evaluator is the analysis seam authorised by `CAREER_TUNING_HARNESS_V0`:
 * it answers ONE question —
 *
 *   > Given these simulator-produced synthetic outcomes, how would the current
 *   > numerical / behavioural qualification rules respond?
 *
 * It does NOT, and must never be read as, "production Career would grade this
 * synthetic evidence." It is explicitly NON-AUTHORITATIVE:
 *
 *   - it is `scripts/`-only; nothing here is exported into product/runtime code;
 *   - `TUNING_ANALYSIS_ONLY` is stamped on its result and carried in the receipt;
 *   - it reuses the shipped PURE qualification functions + constants verbatim
 *     (`evaluateScaleControl`, `evaluateStopLoss`, `evaluateRiskSizing`,
 *     `evaluateMargin2x`, `evaluateShort`, `isStopPlannedTrade`,
 *     `isQualifyingLongMarginCompletion`, `capabilitiesForSkill`, …);
 *   - it MIRRORS only the aggregation `reducer.ts` performs that is not a pure
 *     exported function — the per-`TRADE_CLOSED` stat fold and the tiny
 *     per-event counters — field for field, with `reducer.ts` line references;
 *   - `test/tuning-evaluator.test.mjs` shape-locks the mirrored stat object and
 *     rule set against the shipped `createInitialCareer().stats` /
 *     `reduceCareer` so a future production drift is caught.
 *
 * No SYNTHETIC fact is relabelled to DERIVED anywhere. The evaluator accepts
 * SYNTHETIC facts *because it is the tuning analysis*, not by pretending they
 * are real.
 */
import {
  STARTING_SKILL,
  STARTING_CAPABILITIES,
  capabilitiesForSkill,
  createInitialCareer,
  evaluateScaleControl,
  evaluateStopLoss,
  evaluateRiskSizing,
  evaluateMargin2x,
  evaluateShort,
  isStopPlannedTrade,
  isQualifyingLongMarginCompletion,
  updateQualification,
  createInitialQualification,
  STOP_LOSS_EQUITY_FLOOR_WEI,
} from '@rekt-ink/career';

/** Provenance the *analysis* accepts. This is not `isGradableEvidence`; it is
 *  the explicit synthetic/demo evidence policy the tuning phase runs under. The
 *  shipped `isGradableEvidence` is unchanged and still rejects 'SYNTHETIC'. */
const TUNING_GRADABLE = new Set(['CONFIRMED', 'DERIVED', 'SYNTHETIC']);
export function isTuningGradable(provenance) {
  return TUNING_GRADABLE.has(provenance);
}

/* ---- mirrored helpers (reducer.ts:101-106) -------------------------------- */

/** reducer.ts:101 `normalizeBps`. */
function normalizeBps(value) {
  if (value <= 0n) return 0;
  if (value > 10_000n) return 10_001;
  return Number(value);
}

/** reducer.ts:102 `riskOutcome`. */
function riskOutcome(summary) {
  if (summary.riskBudgetViolated) return 'VIOLATED';
  if (summary.riskBudgetVerified) return 'RESPECTED';
  return 'UNVERIFIED';
}

/** reducer.ts:103-106 `pushRecentRiskOutcome` (slice(-3)). */
function pushRecentRiskOutcome(stats, summary) {
  if (!summary.riskPlanned) return [...stats.recentRiskPlannedOutcomes];
  return [...stats.recentRiskPlannedOutcomes, { tradeId: summary.tradeId, outcome: riskOutcome(summary) }].slice(-3);
}

/**
 * The exact key set `reducer.ts` `initialStats()` produces. Shape-locked by the
 * evaluator test against `createInitialCareer().stats`.
 */
function initialTuningStats() {
  return {
    closedSpotTrades: 0,
    scaleInsUsed: 0,
    partialExitsUsed: 0,
    qualifyingScaleTrades: 0,
    maxClosedLossBps: 0,
    lastClosedTradeAccountPositive: true,
    manualLossCuts: 0,
    protectCapitalChallenges: 0,
    stopUses: 0,
    accountEquityAtLeast70Percent: true,
    stopPlannedTrades: 0,
    riskPlannedTrades: 0,
    riskPlansCreated: 0,
    riskBudgetsRespected: 0,
    riskBudgetViolations: 0,
    recentRiskPlannedOutcomes: [],
    maxAccountDrawdownBps: null,
    accountResetsUsed: 0,
    qualifyingLongMarginEpisodeIds: [],
  };
}

export class TuningCareerEvaluator {
  constructor() {
    this.mode = 'TUNING_ANALYSIS_ONLY';
    this.unlockedSkills = [STARTING_SKILL];
    this.unlockedCapabilities = [...STARTING_CAPABILITIES];
    this.stats = initialTuningStats();
    this.qualification = createInitialQualification();
    this.receipts = {};
    this.processedTradeIds = [];
    this.processedEventIds = [];
  }

  hasSkill(skill) { return this.unlockedSkills.includes(skill); }
  hasCapability(capability) { return this.unlockedCapabilities.includes(capability); }

  #unlock(skill, receiptKey) {
    if (this.unlockedSkills.includes(skill)) return;
    this.unlockedSkills = [...this.unlockedSkills, skill];
    for (const capability of capabilitiesForSkill(skill)) {
      if (!this.unlockedCapabilities.includes(capability)) this.unlockedCapabilities.push(capability);
    }
    this.receipts[receiptKey] = (this.receipts[receiptKey] ?? 0) + 1;
  }

  /** reducer.ts:108-113 `applyRiskSizingQualification`. */
  #applyRiskSizing() {
    const qualified = this.qualification.riskSizing.qualified || evaluateRiskSizing(this);
    this.qualification = {
      ...this.qualification,
      riskSizing: {
        ...this.qualification.riskSizing,
        stopPlannedTrades: this.stats.stopPlannedTrades,
        partialExitsUsed: this.stats.partialExitsUsed,
        qualified,
      },
    };
    if (qualified) this.#unlock('RISK_SIZING', 'RISK_SIZING_AUTHORIZED');
  }

  /** reducer.ts:115-121 `applyMargin2xQualification`. */
  #applyMargin2x() {
    const qualified = this.qualification.margin2x.qualified || evaluateMargin2x(this);
    this.qualification = {
      ...this.qualification,
      margin2x: {
        ...this.qualification.margin2x,
        closedSpotTrades: this.stats.closedSpotTrades,
        riskPlannedTrades: this.stats.riskPlannedTrades,
        partialExitsUsed: this.stats.partialExitsUsed,
        recentRiskPlannedOutcomes: [...this.stats.recentRiskPlannedOutcomes],
        maxAccountDrawdownBps: this.stats.maxAccountDrawdownBps,
        accountResetsUsed: this.stats.accountResetsUsed,
        qualified,
      },
    };
    if (qualified) this.#unlock('MARGIN_2X', 'MARGIN_2X_AUTHORIZED');
  }

  /** reducer.ts:123-129 `applyShortQualification`. */
  #applyShort() {
    const qualified = this.qualification.short.qualified || evaluateShort(this);
    this.qualification = {
      ...this.qualification,
      short: {
        ...this.qualification.short,
        qualifyingLongEpisodeIds: [...this.stats.qualifyingLongMarginEpisodeIds],
        qualified,
      },
    };
    if (qualified) this.#unlock('SHORT', 'SHORT_AUTHORIZED');
  }

  /**
   * MIRROR of reducer.ts:131-159 `reduceTradeClosed` — the stat fold. Every
   * line is annotated with the production line it copies. The pure gate
   * functions themselves are imported, not copied.
   */
  ingestTradeClosed(summary) {
    if (summary.mode !== 'SPOT' || summary.liquidated) return;                       // reducer.ts:132
    if (this.processedTradeIds.includes(summary.tradeId)) return;                    // reducer.ts:133
    this.processedTradeIds.push(summary.tradeId);
    if (!isTuningGradable(summary.evidenceProvenance)) return;                       // reducer.ts:134 (TUNING policy)

    const lossBps = normalizeBps(summary.lossBpsOfThenCurrentEquity);               // reducer.ts:135
    const drawdownBps = normalizeBps(summary.maxDrawdownBpsAtClose);                // reducer.ts:136
    const s = this.stats;
    this.stats = {
      ...s,
      closedSpotTrades: s.closedSpotTrades + 1,                                     // reducer.ts:139
      qualifyingScaleTrades: s.qualifyingScaleTrades
        + (lossBps <= 1_000 && summary.accountEquityAtCloseWei > 0n ? 1 : 0),       // reducer.ts:140
      maxClosedLossBps: Math.max(s.maxClosedLossBps, lossBps),                      // reducer.ts:141
      lastClosedTradeAccountPositive: summary.accountEquityAtCloseWei > 0n,         // reducer.ts:142
      manualLossCuts: s.manualLossCuts
        + (summary.exitReason === 'MANUAL' && summary.realizedPnlWei < 0n
          && lossBps < 500 && summary.accountEquityAtOpenWei > 0n ? 1 : 0),         // reducer.ts:143
      protectCapitalChallenges: s.protectCapitalChallenges
        + (summary.exitReason === 'PROTECT_CAPITAL' && summary.realizedPnlWei < 0n
          && lossBps < 500 && summary.accountEquityAtOpenWei > 0n ? 1 : 0),         // reducer.ts:144
      accountEquityAtLeast70Percent: s.accountEquityAtLeast70Percent
        && summary.accountEquityAtCloseWei >= STOP_LOSS_EQUITY_FLOOR_WEI,           // reducer.ts:145
      stopPlannedTrades: s.stopPlannedTrades + (isStopPlannedTrade(summary) ? 1 : 0), // reducer.ts:146
      riskPlannedTrades: s.riskPlannedTrades + (summary.riskPlanned ? 1 : 0),       // reducer.ts:147
      recentRiskPlannedOutcomes: pushRecentRiskOutcome(s, summary),                 // reducer.ts:148
      maxAccountDrawdownBps: s.maxAccountDrawdownBps === null
        ? drawdownBps
        : Math.max(s.maxAccountDrawdownBps, drawdownBps),                           // reducer.ts:149
    };

    // reducer.ts:152 — scaleControl via the shipped updateQualification
    this.qualification = updateQualification(this.stats, this.qualification);
    // reducer.ts:153 — stopLoss qualification fields + gate
    this.qualification = {
      ...this.qualification,
      stopLoss: {
        ...this.qualification.stopLoss,
        totalClosedSpotTrades: this.stats.closedSpotTrades,
        manualLossCuts: this.stats.manualLossCuts,
        protectCapitalChallenges: this.stats.protectCapitalChallenges,
        accountEquityAtLeast70Percent: this.stats.accountEquityAtLeast70Percent,
        qualified: this.qualification.stopLoss.qualified || evaluateStopLoss(this),
      },
    };
    // reducer.ts:155-158 — cascade unlocks in ladder order
    if (!this.hasSkill('SCALE_CONTROL') && evaluateScaleControl(this.stats)) {
      this.#unlock('SCALE_CONTROL', 'SCALE_CONTROL_AUTHORIZED');
    }
    if (!this.hasSkill('STOP_LOSS') && this.qualification.stopLoss.qualified) {
      this.#unlock('STOP_LOSS', 'STOP_LOSS_AUTHORIZED');
    }
    this.#applyRiskSizing();
    this.#applyMargin2x();
  }

  /** reducer.ts:170-186 — the tiny per-event counters. `sourceReceiptId` is
   *  always present for harness-emitted events; the guard here is the evidence
   *  policy. */
  ingestSpotEvent(event) {
    if (this.processedEventIds.includes(event.eventId)) return;
    this.processedEventIds.push(event.eventId);
    const gradable = isTuningGradable(event.evidenceProvenance ?? 'UNAVAILABLE');
    switch (event.type) {
      case 'SCALE_IN_USED':
        if (gradable) this.stats = { ...this.stats, scaleInsUsed: this.stats.scaleInsUsed + 1 };
        break;
      case 'PARTIAL_EXIT_USED':
        if (gradable) {
          this.stats = { ...this.stats, partialExitsUsed: this.stats.partialExitsUsed + 1 };
          this.#applyRiskSizing();
          this.#applyMargin2x();
        }
        break;
      case 'RISK_PLAN_CREATED':
        if (gradable) this.stats = { ...this.stats, riskPlansCreated: this.stats.riskPlansCreated + 1 };
        break;
      case 'RISK_BUDGET_RESPECTED':
        if (gradable) this.stats = { ...this.stats, riskBudgetsRespected: this.stats.riskBudgetsRespected + 1 };
        break;
      case 'RISK_BUDGET_VIOLATED':
        if (gradable) this.stats = { ...this.stats, riskBudgetViolations: this.stats.riskBudgetViolations + 1 };
        break;
      case 'STOP_PLACED':
        if (gradable) this.stats = { ...this.stats, stopUses: this.stats.stopUses + 1 };
        break;
      case 'TRADE_CLOSED':
        this.ingestTradeClosed(event.summary);
        break;
      default:
        break;
    }
  }

  /**
   * reducer.ts:192-197 `MARGIN_EPISODE_COMPLETED`. The completion fact itself is
   * produced by the *shipped* `deriveLongMarginCompletion` over the *real frozen
   * historical episodes*, and gated by the *shipped* `isQualifyingLongMarginCompletion`.
   * Only the ladder-state check (`evaluateShort`, which needs MARGIN_2X, itself
   * only reachable here via the synthetic spot analysis) runs in the mirror.
   */
  ingestMarginCompletion(completion) {
    if (!completion) return;
    if (!isQualifyingLongMarginCompletion(completion)) return;
    if (this.stats.qualifyingLongMarginEpisodeIds.includes(completion.episodeId)) return;
    this.stats = {
      ...this.stats,
      qualifyingLongMarginEpisodeIds: [...this.stats.qualifyingLongMarginEpisodeIds, completion.episodeId],
    };
    this.#applyShort();
  }
}

/**
 * Shape-lock helper: the exact `CareerStats` key set this mirror must keep in
 * step with `createInitialCareer().stats`. Exported for the evaluator test.
 */
export function tuningStatsKeys() {
  return Object.keys(initialTuningStats()).sort();
}

export function productionStatsKeys() {
  return Object.keys(createInitialCareer().stats).sort();
}
