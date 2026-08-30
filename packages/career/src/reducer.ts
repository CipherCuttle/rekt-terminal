import { getNextObjective } from './objective.js';
import { capabilitiesForSkill, MARGIN_2X_CAPABILITIES, RISK_SIZING_CAPABILITIES, SCALE_CONTROL_CAPABILITIES, STARTING_CAPABILITIES, STARTING_SKILL } from './skills.js';
import { createInitialQualification, updateQualification, evaluateScaleControl, evaluateStopLoss, evaluateRiskSizing, evaluateMargin2x, isStopPlannedTrade, margin2xQualificationFromStats, STOP_LOSS_EQUITY_FLOOR_WEI } from './qualification.js';
import type { CareerEvent } from './events.js';
import type { CareerEffect, CareerState, CareerStats, CareerTradeSummaryFact, ProvenanceState, RiskPlannedOutcome, SkillId } from './types.js';

export function isGradableEvidence(state: ProvenanceState): boolean {
  return state === 'CONFIRMED' || state === 'DERIVED';
}

export const CAREER_SAVE_VERSION = 4;

function initialStats(): CareerStats {
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
  };
}

export function createInitialCareer(careerId = 'career-0', startedAtMs = 0): CareerState {
  if (!careerId) throw new RangeError('career identity is required');
  if (!Number.isSafeInteger(startedAtMs) || startedAtMs < 0) throw new RangeError('career start time must be a non-negative safe integer');
  const state: CareerState = {
    saveVersion: CAREER_SAVE_VERSION,
    careerId,
    startedAtMs,
    unlockedSkills: [STARTING_SKILL],
    unlockedCapabilities: [...STARTING_CAPABILITIES],
    stats: initialStats(),
    qualification: createInitialQualification(),
    receipts: {},
    objective: { id: 'scale-control-close-trades', kind: 'CLOSE_SPOT', text: 'NEXT // Complete 3 controlled spot trades.', progress: 0, target: 3 },
    effectSeq: 0,
    recentEffects: [],
    processedEventIds: [],
    processedTradeIds: [],
  };
  return state;
}

function addUnique<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? [...values] : [...values, value];
}

function addEffect(state: CareerState, effect: Omit<CareerEffect, 'effectSeq'>): CareerState {
  const effectSeq = state.effectSeq + 1;
  return { ...state, effectSeq, recentEffects: [...state.recentEffects, { ...effect, effectSeq }].slice(-8) };
}

function unlockScaleControl(state: CareerState): CareerState {
  if (state.unlockedSkills.includes('SCALE_CONTROL')) return state;
  let next: CareerState = {
    ...state,
    unlockedSkills: addUnique(state.unlockedSkills, 'SCALE_CONTROL'),
    unlockedCapabilities: [...state.unlockedCapabilities, ...SCALE_CONTROL_CAPABILITIES.filter((capability) => !state.unlockedCapabilities.includes(capability))],
  };
  next = addEffect(next, { effectId: 'scale-control-unlocked', kind: 'SKILL_UNLOCKED', text: 'SCALE_CONTROL unlocked: scale in and partial exit are authorized.' });
  next = { ...next, receipts: { ...next.receipts, SCALE_CONTROL_AUTHORIZED: (next.receipts.SCALE_CONTROL_AUTHORIZED ?? 0) + 1 } };
  return addEffect(next, { effectId: 'scale-control-receipt', kind: 'RECEIPT_AWARDED', text: 'Receipt awarded: SCALE CONTROL AUTHORIZED.' });
}

function unlockStopLoss(state: CareerState): CareerState {
  if (state.unlockedSkills.includes('STOP_LOSS')) return state;
  let next = { ...state, unlockedSkills: addUnique(state.unlockedSkills, 'STOP_LOSS' as SkillId), unlockedCapabilities: [...state.unlockedCapabilities, 'STOP_MARKET' as const] };
  next = addEffect(next, { effectId: 'stop-loss-unlocked', kind: 'SKILL_UNLOCKED', text: 'STOP_LOSS unlocked: protective stop market is authorized.' });
  return { ...next, receipts: { ...next.receipts, STOP_LOSS_AUTHORIZED: (next.receipts.STOP_LOSS_AUTHORIZED ?? 0) + 1 } };
}

function unlockRiskSizing(state: CareerState): CareerState {
  if (state.unlockedSkills.includes('RISK_SIZING')) return state;
  let next: CareerState = {
    ...state,
    unlockedSkills: addUnique(state.unlockedSkills, 'RISK_SIZING' as SkillId),
    unlockedCapabilities: [...state.unlockedCapabilities, ...RISK_SIZING_CAPABILITIES.filter((capability) => !state.unlockedCapabilities.includes(capability))],
  };
  next = addEffect(next, { effectId: 'risk-sizing-unlocked', kind: 'SKILL_UNLOCKED', text: 'RISK_SIZING unlocked: size a position from your stop and an account-risk budget.' });
  return { ...next, receipts: { ...next.receipts, RISK_SIZING_AUTHORIZED: (next.receipts.RISK_SIZING_AUTHORIZED ?? 0) + 1 } };
}

function unlockMargin2x(state: CareerState): CareerState {
  if (state.unlockedSkills.includes('MARGIN_2X')) return state;
  let next: CareerState = {
    ...state,
    unlockedSkills: addUnique(state.unlockedSkills, 'MARGIN_2X'),
    unlockedCapabilities: [...state.unlockedCapabilities, ...MARGIN_2X_CAPABILITIES.filter((capability) => !state.unlockedCapabilities.includes(capability))],
  };
  next = addEffect(next, { effectId: 'margin-2x-unlocked', kind: 'SKILL_UNLOCKED', text: 'MARGIN_2X unlocked: isolated historical long training at 1x / 2x is authorized.' });
  next = { ...next, receipts: { ...next.receipts, MARGIN_2X_AUTHORIZED: (next.receipts.MARGIN_2X_AUTHORIZED ?? 0) + 1 } };
  return addEffect(next, { effectId: 'margin-2x-receipt', kind: 'RECEIPT_AWARDED', text: 'NEW DESK AUTHORIZED // MARGIN // 2x' });
}

function normalizeBps(value: bigint): number {
  if (value <= 0n) return 0;
  if (value > 10_000n) return 10_001;
  return Number(value);
}

function riskOutcome(summary: CareerTradeSummaryFact): RiskPlannedOutcome['outcome'] {
  if (summary.riskBudgetViolated) return 'VIOLATED';
  if (summary.riskBudgetVerified) return 'RESPECTED';
  return 'UNVERIFIED';
}

function pushRecentRiskOutcome(stats: CareerStats, summary: CareerTradeSummaryFact): RiskPlannedOutcome[] {
  if (!summary.riskPlanned) return [...stats.recentRiskPlannedOutcomes];
  return [...stats.recentRiskPlannedOutcomes, { tradeId: summary.tradeId, outcome: riskOutcome(summary) }].slice(-3);
}

function reduceTradeClosed(state: CareerState, summary: CareerTradeSummaryFact): CareerState {
  if (summary.mode !== 'SPOT' || summary.liquidated) return state;
  if (state.processedTradeIds.includes(summary.tradeId)) return state;
  if (!isGradableEvidence(summary.evidenceProvenance)) return { ...state, processedTradeIds: [...state.processedTradeIds, summary.tradeId] };

  const lossBps = normalizeBps(summary.lossBpsOfThenCurrentEquity);
  const drawdownBps = normalizeBps(summary.maxDrawdownBpsAtClose);
  const stats: CareerStats = {
    ...state.stats,
    closedSpotTrades: state.stats.closedSpotTrades + 1,
    qualifyingScaleTrades: state.stats.qualifyingScaleTrades + (lossBps <= 1_000 && summary.accountEquityAtCloseWei > 0n ? 1 : 0),
    maxClosedLossBps: Math.max(state.stats.maxClosedLossBps, lossBps),
    lastClosedTradeAccountPositive: summary.accountEquityAtCloseWei > 0n,
    manualLossCuts: state.stats.manualLossCuts + (summary.exitReason === 'MANUAL' && summary.realizedPnlWei < 0n && lossBps < 500 && summary.accountEquityAtOpenWei > 0n ? 1 : 0),
    protectCapitalChallenges: state.stats.protectCapitalChallenges + (summary.exitReason === 'PROTECT_CAPITAL' && summary.realizedPnlWei < 0n && lossBps < 500 && summary.accountEquityAtOpenWei > 0n ? 1 : 0),
    accountEquityAtLeast70Percent: state.stats.accountEquityAtLeast70Percent && summary.accountEquityAtCloseWei >= STOP_LOSS_EQUITY_FLOOR_WEI,
    stopPlannedTrades: state.stats.stopPlannedTrades + (isStopPlannedTrade(summary) ? 1 : 0),
    riskPlannedTrades: state.stats.riskPlannedTrades + (summary.riskPlanned ? 1 : 0),
    recentRiskPlannedOutcomes: pushRecentRiskOutcome(state.stats, summary),
    maxAccountDrawdownBps: state.stats.maxAccountDrawdownBps === null ? drawdownBps : Math.max(state.stats.maxAccountDrawdownBps, drawdownBps),
  };
  let next: CareerState = { ...state, stats, processedTradeIds: [...state.processedTradeIds, summary.tradeId] };
  next = { ...next, qualification: updateQualification(next.stats, next.qualification) };
  next = { ...next, qualification: { ...next.qualification, stopLoss: { ...next.qualification.stopLoss, totalClosedSpotTrades: next.stats.closedSpotTrades, manualLossCuts: next.stats.manualLossCuts, protectCapitalChallenges: next.stats.protectCapitalChallenges, accountEquityAtLeast70Percent: next.stats.accountEquityAtLeast70Percent, qualified: next.qualification.stopLoss.qualified || evaluateStopLoss(next) } } };
  next = { ...next, qualification: { ...next.qualification, riskSizing: { ...next.qualification.riskSizing, stopPlannedTrades: next.stats.stopPlannedTrades, partialExitsUsed: next.stats.partialExitsUsed } } };
  if (!state.unlockedSkills.includes('SCALE_CONTROL') && evaluateScaleControl(next.stats)) next = unlockScaleControl(next);
  if (!next.unlockedSkills.includes('STOP_LOSS') && next.qualification.stopLoss.qualified) next = unlockStopLoss(next);
  next = applyRiskSizingQualification(next);
  return applyMargin2xQualification(next);
}

function applyRiskSizingQualification(state: CareerState): CareerState {
  const qualified = state.qualification.riskSizing.qualified || evaluateRiskSizing(state);
  let next: CareerState = {
    ...state,
    qualification: { ...state.qualification, riskSizing: { ...state.qualification.riskSizing, stopPlannedTrades: state.stats.stopPlannedTrades, partialExitsUsed: state.stats.partialExitsUsed, qualified } },
  };
  if (qualified && !next.unlockedSkills.includes('RISK_SIZING')) next = unlockRiskSizing(next);
  return next;
}

function applyMargin2xQualification(state: CareerState): CareerState {
  const synced = margin2xQualificationFromStats(state.stats, state.qualification.margin2x);
  const qualified = state.qualification.margin2x.qualified || evaluateMargin2x(state);
  let next: CareerState = { ...state, qualification: { ...state.qualification, margin2x: { ...synced, qualified } } };
  if (qualified && !next.unlockedSkills.includes('MARGIN_2X')) next = unlockMargin2x(next);
  return next;
}

export function reduceCareer(state: CareerState, event: CareerEvent): CareerState {
  if (!event.eventId) throw new RangeError('career events require an identity');
  if (state.processedEventIds.includes(event.eventId)) return state;
  let next: CareerState = { ...state, processedEventIds: [...state.processedEventIds, event.eventId] };
  switch (event.type) {
    case 'TRADE_CLOSED':
      next = reduceTradeClosed(next, event.summary);
      break;
    case 'SCALE_IN_USED':
      if (event.sourceReceiptId && isGradableEvidence(event.evidenceProvenance ?? 'UNAVAILABLE')) next = { ...next, stats: { ...next.stats, scaleInsUsed: next.stats.scaleInsUsed + 1 } };
      break;
    case 'PARTIAL_EXIT_USED':
      if (event.sourceReceiptId && isGradableEvidence(event.evidenceProvenance ?? 'UNAVAILABLE')) {
        next = { ...next, stats: { ...next.stats, partialExitsUsed: next.stats.partialExitsUsed + 1 } };
        next = applyRiskSizingQualification(next);
        next = applyMargin2xQualification(next);
      }
      break;
    case 'RISK_PLAN_CREATED':
      if (event.sourceReceiptId && isGradableEvidence(event.evidenceProvenance ?? 'UNAVAILABLE')) next = { ...next, stats: { ...next.stats, riskPlansCreated: next.stats.riskPlansCreated + 1 } };
      break;
    case 'RISK_BUDGET_RESPECTED':
      if (event.sourceReceiptId && isGradableEvidence(event.evidenceProvenance ?? 'UNAVAILABLE')) next = { ...next, stats: { ...next.stats, riskBudgetsRespected: next.stats.riskBudgetsRespected + 1 } };
      break;
    case 'RISK_BUDGET_VIOLATED':
      if (event.sourceReceiptId && isGradableEvidence(event.evidenceProvenance ?? 'UNAVAILABLE')) next = { ...next, stats: { ...next.stats, riskBudgetViolations: next.stats.riskBudgetViolations + 1 } };
      break;
    case 'ACCOUNT_RESET_USED':
      next = { ...next, stats: { ...next.stats, accountResetsUsed: next.stats.accountResetsUsed === null ? null : next.stats.accountResetsUsed + 1 } };
      next = applyMargin2xQualification(next);
      break;
    case 'SKILL_UNLOCKED':
      if (event.skillId === 'SPOT_BASIC' || event.skillId === 'SCALE_CONTROL' || event.skillId === 'STOP_LOSS' || event.skillId === 'RISK_SIZING' || event.skillId === 'MARGIN_2X') {
        const skill: SkillId = event.skillId;
        next = { ...next, unlockedSkills: addUnique(next.unlockedSkills, skill), unlockedCapabilities: [...next.unlockedCapabilities, ...capabilitiesForSkill(skill).filter((capability) => !next.unlockedCapabilities.includes(capability))] };
      }
      break;
    case 'STOP_PLACED':
      if (isGradableEvidence(event.evidenceProvenance ?? 'UNAVAILABLE')) next = { ...next, stats: { ...next.stats, stopUses: next.stats.stopUses + 1 } };
      break;
    case 'STOP_HIT':
    case 'CAREER_STARTED':
    case 'NON_ECONOMIC_ACTION':
      break;
  }
  return { ...next, objective: getNextObjective(next) };
}

export function reduceCareerEvents(initial: CareerState, events: readonly CareerEvent[]): CareerState {
  return events.reduce(reduceCareer, initial);
}
