import { getNextObjective } from './objective.js';
import { capabilitiesForSkill, SCALE_CONTROL_CAPABILITIES, STARTING_CAPABILITIES, STARTING_SKILL } from './skills.js';
import { createInitialQualification, updateQualification, evaluateScaleControl } from './qualification.js';
import type { CareerEvent } from './events.js';
import type { CareerEffect, CareerState, CareerStats, CareerTradeSummaryFact, SkillId } from './types.js';

export const CAREER_SAVE_VERSION = 1;

function initialStats(): CareerStats {
  return {
    closedSpotTrades: 0,
    scaleInsUsed: 0,
    partialExitsUsed: 0,
    qualifyingScaleTrades: 0,
    maxClosedLossBps: 0,
    lastClosedTradeAccountPositive: true,
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
      text: 'NEXT // Close 3 more spot positions.',
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

function normalizeLossBps(value: bigint): number {
  if (value <= 0n) return 0;
  if (value > 10_000n) return 10_001;
  return Number(value);
}

function reduceTradeClosed(state: CareerState, summary: CareerTradeSummaryFact): CareerState {
  if (summary.mode !== 'SPOT' || summary.liquidated) return state;
  if (state.processedTradeIds.includes(summary.tradeId)) return state;
  const lossBps = normalizeLossBps(summary.lossBpsOfThenCurrentEquity);
  const stats: CareerStats = {
    ...state.stats,
    closedSpotTrades: state.stats.closedSpotTrades + 1,
    qualifyingScaleTrades: state.stats.qualifyingScaleTrades + (lossBps <= 1_000 && summary.accountEquityAtCloseWei > 0n ? 1 : 0),
    maxClosedLossBps: Math.max(state.stats.maxClosedLossBps, lossBps),
    lastClosedTradeAccountPositive: summary.accountEquityAtCloseWei > 0n,
  };
  let next: CareerState = {
    ...state,
    stats,
    processedTradeIds: [...state.processedTradeIds, summary.tradeId],
  };
  next = { ...next, qualification: updateQualification(next.stats, next.qualification) };
  if (!state.unlockedSkills.includes('SCALE_CONTROL') && evaluateScaleControl(next.stats)) next = unlockScaleControl(next);
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
      if (event.sourceReceiptId) next = { ...next, stats: { ...next.stats, scaleInsUsed: next.stats.scaleInsUsed + 1 } };
      break;
    case 'PARTIAL_EXIT_USED':
      if (event.sourceReceiptId) next = { ...next, stats: { ...next.stats, partialExitsUsed: next.stats.partialExitsUsed + 1 } };
      break;
    case 'SKILL_UNLOCKED':
      if (event.skillId === 'SPOT_BASIC' || event.skillId === 'SCALE_CONTROL') {
        const skill: SkillId = event.skillId;
        next = {
          ...next,
          unlockedSkills: addUnique(next.unlockedSkills, skill),
          unlockedCapabilities: [...next.unlockedCapabilities, ...capabilitiesForSkill(skill).filter((capability) => !next.unlockedCapabilities.includes(capability))],
        };
      }
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
