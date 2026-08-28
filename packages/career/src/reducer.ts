import { getNextObjective } from './objective.js';
import { capabilitiesForSkill, SCALE_CONTROL_CAPABILITIES, STARTING_CAPABILITIES, STARTING_SKILL } from './skills.js';
import { createInitialQualification, updateQualification, evaluateScaleControl, evaluateStopLoss, STOP_LOSS_EQUITY_FLOOR_WEI } from './qualification.js';
import type { CareerEvent } from './events.js';
import type { CareerEffect, CareerState, CareerStats, CareerTradeSummaryFact, ProvenanceState, SkillId } from './types.js';

/**
 * Evidence classes Career is willing to grade.
 *
 * MARKET_TRUTH_V1: qualification claims a player demonstrated a behaviour in a
 * real market. A trade executed against fabricated data demonstrates nothing,
 * so SYNTHETIC / STALE / UNAVAILABLE evidence advances no statistic, no
 * qualification, and no unlock. This is the single choke point that keeps DEMO
 * activity and the deterministic PROTECT_CAPITAL rehearsal out of real Career
 * progression.
 */
export function isGradableEvidence(state: ProvenanceState): boolean {
  return state === 'CONFIRMED' || state === 'DERIVED';
}

export const CAREER_SAVE_VERSION = 2;

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
    objective: {
      id: 'scale-control-close-trades',
      kind: 'CLOSE_SPOT',
      text: 'NEXT // Complete 3 controlled spot trades.',
      progress: 0,
      target: 3,
    },
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
  return {
    ...state,
    effectSeq,
    recentEffects: [...state.recentEffects, { ...effect, effectSeq }].slice(-8),
  };
}

function unlockScaleControl(state: CareerState): CareerState {
  if (state.unlockedSkills.includes('SCALE_CONTROL')) return state;
  let next: CareerState = {
    ...state,
    unlockedSkills: addUnique(state.unlockedSkills, 'SCALE_CONTROL'),
    unlockedCapabilities: [...state.unlockedCapabilities, ...SCALE_CONTROL_CAPABILITIES.filter((capability) => !state.unlockedCapabilities.includes(capability))],
  };
  next = addEffect(next, {
    effectId: 'scale-control-unlocked',
    kind: 'SKILL_UNLOCKED',
    text: 'SCALE_CONTROL unlocked: scale in and partial exit are authorized.',
  });
  next = {
    ...next,
    receipts: { ...next.receipts, SCALE_CONTROL_AUTHORIZED: (next.receipts.SCALE_CONTROL_AUTHORIZED ?? 0) + 1 },
  };
  return addEffect(next, {
    effectId: 'scale-control-receipt',
    kind: 'RECEIPT_AWARDED',
    text: 'Receipt awarded: SCALE CONTROL AUTHORIZED.',
  });
}

function unlockStopLoss(state: CareerState): CareerState {
  if (state.unlockedSkills.includes('STOP_LOSS')) return state;
  let next = { ...state, unlockedSkills: addUnique(state.unlockedSkills, 'STOP_LOSS' as SkillId), unlockedCapabilities: [...state.unlockedCapabilities, 'STOP_MARKET' as const] };
  next = addEffect(next, { effectId: 'stop-loss-unlocked', kind: 'SKILL_UNLOCKED', text: 'STOP_LOSS unlocked: protective stop market is authorized.' });
  return { ...next, receipts: { ...next.receipts, STOP_LOSS_AUTHORIZED: (next.receipts.STOP_LOSS_AUTHORIZED ?? 0) + 1 } };
}

function normalizeLossBps(value: bigint): number {
  if (value <= 0n) return 0;
  if (value > 10_000n) return 10_001;
  return Number(value);
}

function reduceTradeClosed(state: CareerState, summary: CareerTradeSummaryFact): CareerState {
  if (summary.mode !== 'SPOT' || summary.liquidated) return state;
  if (state.processedTradeIds.includes(summary.tradeId)) return state;
  // Record the trade as seen so it cannot be re-offered under a stronger
  // label later, but advance nothing from evidence Career cannot grade.
  if (!isGradableEvidence(summary.evidenceProvenance)) {
    return { ...state, processedTradeIds: [...state.processedTradeIds, summary.tradeId] };
  }
  const lossBps = normalizeLossBps(summary.lossBpsOfThenCurrentEquity);
  const stats: CareerStats = {
    ...state.stats,
    closedSpotTrades: state.stats.closedSpotTrades + 1,
    qualifyingScaleTrades: state.stats.qualifyingScaleTrades + (lossBps <= 1_000 && summary.accountEquityAtCloseWei > 0n ? 1 : 0),
    maxClosedLossBps: Math.max(state.stats.maxClosedLossBps, lossBps),
    lastClosedTradeAccountPositive: summary.accountEquityAtCloseWei > 0n,
    manualLossCuts: state.stats.manualLossCuts + (summary.exitReason === 'MANUAL' && summary.realizedPnlWei < 0n && lossBps < 500 && summary.accountEquityAtOpenWei > 0n ? 1 : 0),
    protectCapitalChallenges: state.stats.protectCapitalChallenges + (summary.exitReason === 'PROTECT_CAPITAL' && summary.realizedPnlWei < 0n && lossBps < 500 && summary.accountEquityAtOpenWei > 0n ? 1 : 0),
    accountEquityAtLeast70Percent: state.stats.accountEquityAtLeast70Percent && summary.accountEquityAtCloseWei >= STOP_LOSS_EQUITY_FLOOR_WEI,
  };
  let next: CareerState = {
    ...state,
    stats,
    processedTradeIds: [...state.processedTradeIds, summary.tradeId],
  };
  next = { ...next, qualification: updateQualification(next.stats, next.qualification) };
  next = { ...next, qualification: { ...next.qualification, stopLoss: { ...next.qualification.stopLoss, totalClosedSpotTrades: next.stats.closedSpotTrades, manualLossCuts: next.stats.manualLossCuts, protectCapitalChallenges: next.stats.protectCapitalChallenges, accountEquityAtLeast70Percent: next.stats.accountEquityAtLeast70Percent, qualified: next.qualification.stopLoss.qualified || evaluateStopLoss(next) } } };
  if (!state.unlockedSkills.includes('SCALE_CONTROL') && evaluateScaleControl(next.stats)) next = unlockScaleControl(next);
  if (!next.unlockedSkills.includes('STOP_LOSS') && next.qualification.stopLoss.qualified) next = unlockStopLoss(next);
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
      if (event.sourceReceiptId && isGradableEvidence(event.evidenceProvenance ?? 'UNAVAILABLE')) next = { ...next, stats: { ...next.stats, partialExitsUsed: next.stats.partialExitsUsed + 1 } };
      break;
    case 'SKILL_UNLOCKED':
      if (event.skillId === 'SPOT_BASIC' || event.skillId === 'SCALE_CONTROL' || event.skillId === 'STOP_LOSS') {
        const skill: SkillId = event.skillId;
        next = {
          ...next,
          unlockedSkills: addUnique(next.unlockedSkills, skill),
          unlockedCapabilities: [...next.unlockedCapabilities, ...capabilitiesForSkill(skill).filter((capability) => !next.unlockedCapabilities.includes(capability))],
        };
      }
      break;
    case 'STOP_PLACED':
      if (isGradableEvidence(event.evidenceProvenance ?? 'UNAVAILABLE')) next = { ...next, stats: { ...next.stats, stopUses: next.stats.stopUses + 1 } };
      break;
    case 'STOP_HIT':
      break;
    case 'CAREER_STARTED':
    case 'NON_ECONOMIC_ACTION':
      break;
  }
  return { ...next, objective: getNextObjective(next) };
}

export function reduceCareerEvents(initial: CareerState, events: readonly CareerEvent[]): CareerState {
  return events.reduce(reduceCareer, initial);
}
