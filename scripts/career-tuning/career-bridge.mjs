/**
 * CAREER_TUNING_HARNESS_V0 — simulator -> Career event derivation.
 *
 * ## Why this is a transcription, and the seam it documents
 *
 * The single production authority that turns simulator `TradeSummary` /
 * margin-completion facts into `CareerEvent`s is
 * `apps/web/src/practice/store.ts` (`PracticeSessionStore`). The harness does
 * NOT import that class, for one structural reason: `store.ts` pulls in
 * `./persistence`, which imports `dexie` and other browser-only surface, so the
 * module graph does not load under plain Node.
 *
 * Instead, the functions below reconstruct — field for field — the event
 * derivation `store.ts` performs. The result is fed to BOTH the *real*
 * `reduceCareer` (which refuses it — the synthetic spot facts carry
 * `evidenceProvenance: 'SYNTHETIC'`) and the harness-local `TUNING_ANALYSIS_ONLY`
 * evaluator (`tuning-evaluator.mjs`), which is what measures progression here.
 * Nothing in this file is a new Career authority: it fabricates no Career facts,
 * weakens no evidence gate, and relabels no SYNTHETIC fact as DERIVED — the
 * `evidenceProvenance` it carries is exactly what the simulator stamped.
 *
 * Reference points in `apps/web/src/practice/store.ts` (branch base
 * 4843dc91eee91e871072f362618397249eb044e6):
 *
 *   - `submit()` PLACE_STOP branch            -> `stopPlacedEvent`
 *   - `submitRiskPlannedEntry()` /
 *     `applyRiskPlannedCommit()`               -> `riskPlannedEntryEvents`
 *   - `applyAccepted()` lines 252-275          -> `spotAcceptedEvents`
 *   - `recordLongMarginEpisodeCompletion()`    -> `marginCompletionEvent`
 *
 * `scripts/career-tuning/test/bridge-parity.test.mjs` locks the shape of the
 * `TRADE_CLOSED` payload against the exact field list `store.ts` copies.
 */

/** The subset of a sim `TradeSummary` that `store.ts` copies into a
 *  `CareerTradeSummaryFact`. Order and membership mirror store.ts:263-271. */
export function tradeSummaryToCareerFact(summary) {
  return {
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
  };
}

/**
 * Career events for one accepted PLACE_STOP intent (store.ts:182-184).
 * `preSim` is the sim state *before* the stop was placed — `store.ts` forms the
 * ids from `sim.lastSequence + 1` on that pre-action state.
 */
export function stopPlacedEvents(preSim, stopEvents, evidenceProvenance) {
  return [
    {
      type: 'STOP_PLACED',
      eventId: `${preSim.sessionId}:stop:${preSim.lastSequence + 1}:career`,
      sourceReceiptId: stopEvents[0].eventId,
      evidenceProvenance,
    },
  ];
}

/**
 * Career events for a completed risk-planned entry
 * (store.ts `applyRiskPlannedCommit`, lines 225-229). `plan` is the sim's own
 * `RiskPlan`; `nextSim` is the sim state after the sized entry + stop.
 */
export function riskPlannedEntryEvents(nextSim, plan, evidenceProvenance) {
  const events = [
    {
      type: 'RISK_PLAN_CREATED',
      eventId: `${plan.planId}:career`,
      sourceReceiptId: `${plan.planId}:risk-plan`,
      planId: plan.planId,
      evidenceProvenance,
    },
  ];
  if (nextSim.activeStop) {
    events.push({
      type: 'STOP_PLACED',
      eventId: `${nextSim.activeStop.stopId}:career`,
      sourceReceiptId: `${nextSim.activeStop.stopId}:placed`,
      evidenceProvenance,
    });
  }
  return events;
}

/**
 * Career events for an accepted spot action that changed position state
 * (store.ts `applyAccepted`, lines 252-275). `newSummaries` are the
 * `TradeSummary` objects appended by this action; `acceptedFillId` is the last
 * applied fill id.
 */
export function spotAcceptedEvents(intentKind, nextSim, newSummaries, acceptedFillId, evidenceProvenance) {
  const events = [];
  if (intentKind === 'SCALE_IN' && acceptedFillId) {
    events.push({ type: 'SCALE_IN_USED', eventId: `${acceptedFillId}:scale-in`, sourceReceiptId: acceptedFillId, evidenceProvenance });
  }
  if (intentKind === 'PARTIAL_CLOSE' && acceptedFillId) {
    events.push({ type: 'PARTIAL_EXIT_USED', eventId: `${acceptedFillId}:partial-exit`, sourceReceiptId: acceptedFillId, evidenceProvenance });
  }
  for (const summary of newSummaries) {
    events.push({
      type: 'TRADE_CLOSED',
      eventId: `${nextSim.sessionId}:${summary.tradeId}:closed`,
      sourceReceiptId: `${nextSim.sessionId}:${summary.tradeId}`,
      summary: tradeSummaryToCareerFact(summary),
    });
    if (summary.stopUsed) {
      events.push({ type: 'STOP_HIT', eventId: `${nextSim.sessionId}:${summary.tradeId}:stop-hit`, sourceReceiptId: `${nextSim.sessionId}:${summary.tradeId}`, evidenceProvenance: summary.evidenceProvenance });
    }
    if (summary.riskPlan !== null && (summary.riskBudgetViolated || summary.riskBudgetVerified)) {
      events.push({
        type: summary.riskBudgetViolated ? 'RISK_BUDGET_VIOLATED' : 'RISK_BUDGET_RESPECTED',
        eventId: `${nextSim.sessionId}:${summary.tradeId}:risk-budget`,
        sourceReceiptId: `${nextSim.sessionId}:${summary.tradeId}`,
        tradeId: summary.tradeId,
        evidenceProvenance: summary.evidenceProvenance,
      });
    }
  }
  return events;
}

/** Career event for a derived long-margin episode completion (store.ts:149-154). */
export function marginCompletionEvent(completion) {
  return {
    type: 'MARGIN_EPISODE_COMPLETED',
    eventId: `${completion.completionId}:career`,
    sourceReceiptId: completion.completionId,
    summary: completion,
  };
}
