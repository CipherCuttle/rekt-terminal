import type { CareerStats, CareerTradeSummaryFact, Margin2xQualification, MarginEpisodeCompletionFact, QualificationState, RiskSizingQualification, ScaleControlQualification, ShortQualification } from './types.js';

export const SCALE_CONTROL_TRADE_TARGET = 3;
export const SCALE_CONTROL_LOSS_LIMIT_BPS = 1_000;
export const STOP_LOSS_TRADE_TARGET = 5;
export const STOP_LOSS_EQUITY_FLOOR_WEI = 350_000_000_000_000_000n;
export const STOP_PLAN_WINDOW_MS = 60_000;
export const RISK_SIZING_TRADE_TARGET = 3;
export const RISK_SIZING_PARTIAL_EXIT_TARGET = 1;
export const MARGIN_2X_CLOSED_SPOT_TARGET = 8;
export const MARGIN_2X_RISK_PLANNED_TARGET = 3;
export const MARGIN_2X_PARTIAL_EXIT_TARGET = 2;
export const MARGIN_2X_RECENT_RISK_TARGET = 3;
export const MARGIN_2X_DRAWDOWN_LIMIT_BPS = 2_000;
export const SHORT_LONG_EPISODE_TARGET = 2;
export const SHORT_PLANNED_RISK_LIMIT_BPS = 500n;

export function isStopPlannedTrade(fact: Pick<CareerTradeSummaryFact, 'openedAtMs' | 'firstStopPlacedAtMs' | 'stopWidened'>): boolean {
  if (fact.stopWidened || fact.firstStopPlacedAtMs === null) return false;
  if (!Number.isSafeInteger(fact.firstStopPlacedAtMs) || !Number.isSafeInteger(fact.openedAtMs)) return false;
  return fact.firstStopPlacedAtMs - fact.openedAtMs <= STOP_PLAN_WINDOW_MS;
}

export function evaluateScaleControl(stats: CareerStats): boolean {
  return stats.qualifyingScaleTrades >= SCALE_CONTROL_TRADE_TARGET && stats.lastClosedTradeAccountPositive;
}

export function createInitialRiskSizingQualification(): RiskSizingQualification {
  return { stopPlannedTrades: 0, targetStopPlannedTrades: 3, partialExitsUsed: 0, targetPartialExits: 1, qualified: false };
}

export function createInitialMargin2xQualification(): Margin2xQualification {
  return {
    closedSpotTrades: 0,
    targetClosedSpotTrades: 8,
    riskPlannedTrades: 0,
    targetRiskPlannedTrades: 3,
    partialExitsUsed: 0,
    targetPartialExits: 2,
    recentRiskPlannedOutcomes: [],
    targetCleanRecentRiskPlans: 3,
    maxAccountDrawdownBps: null,
    drawdownLimitBps: 2_000,
    accountResetsUsed: 0,
    qualified: false,
  };
}

export function createInitialShortQualification(): ShortQualification {
  return { qualifyingLongEpisodeIds: [], targetQualifyingLongEpisodes: 2, riskLimitBps: 500, qualified: false };
}

export function createInitialQualification(): QualificationState {
  return {
    scaleControl: { closedSpotTrades: 0, targetClosedSpotTrades: 3, maxClosedLossBps: 0, lossLimitBps: 1_000, positiveAccountEquity: true, qualified: false },
    stopLoss: { totalClosedSpotTrades: 0, targetClosedSpotTrades: 5, manualLossCuts: 0, protectCapitalChallenges: 0, accountEquityAtLeast70Percent: true, qualified: false },
    riskSizing: createInitialRiskSizingQualification(),
    margin2x: createInitialMargin2xQualification(),
    short: createInitialShortQualification(),
  };
}

export function updateQualification(stats: CareerStats, previous: QualificationState): QualificationState {
  const scaleControl: ScaleControlQualification = {
    ...previous.scaleControl,
    closedSpotTrades: stats.qualifyingScaleTrades,
    maxClosedLossBps: stats.maxClosedLossBps,
    positiveAccountEquity: stats.lastClosedTradeAccountPositive,
    qualified: previous.scaleControl.qualified || evaluateScaleControl(stats),
  };
  return { ...previous, scaleControl };
}

export function evaluateRiskSizing(state: { unlockedSkills: readonly string[]; stats: CareerStats }): boolean {
  return state.unlockedSkills.includes('STOP_LOSS')
    && state.stats.stopPlannedTrades >= RISK_SIZING_TRADE_TARGET
    && state.stats.partialExitsUsed >= RISK_SIZING_PARTIAL_EXIT_TARGET;
}

export function evaluateStopLoss(state: { unlockedSkills: readonly string[]; stats: CareerStats }): boolean {
  return state.unlockedSkills.includes('SCALE_CONTROL')
    && state.stats.closedSpotTrades >= STOP_LOSS_TRADE_TARGET
    && state.stats.accountEquityAtLeast70Percent
    && state.stats.manualLossCuts + state.stats.protectCapitalChallenges >= 1;
}

export function evaluateMargin2x(state: { unlockedSkills: readonly string[]; stats: CareerStats }): boolean {
  const recent = state.stats.recentRiskPlannedOutcomes;
  const recentClean = recent.length === MARGIN_2X_RECENT_RISK_TARGET && recent.every((entry) => entry.outcome === 'RESPECTED');
  const drawdownKnownAndControlled = state.stats.maxAccountDrawdownBps !== null && state.stats.maxAccountDrawdownBps <= MARGIN_2X_DRAWDOWN_LIMIT_BPS;
  return state.unlockedSkills.includes('RISK_SIZING')
    && state.stats.closedSpotTrades >= MARGIN_2X_CLOSED_SPOT_TARGET
    && state.stats.riskPlannedTrades >= MARGIN_2X_RISK_PLANNED_TARGET
    && state.stats.partialExitsUsed >= MARGIN_2X_PARTIAL_EXIT_TARGET
    && recentClean
    && drawdownKnownAndControlled
    && state.stats.accountResetsUsed === 0;
}

export function margin2xQualificationFromStats(stats: CareerStats, previous: Margin2xQualification): Margin2xQualification {
  return {
    ...previous,
    closedSpotTrades: stats.closedSpotTrades,
    riskPlannedTrades: stats.riskPlannedTrades,
    partialExitsUsed: stats.partialExitsUsed,
    recentRiskPlannedOutcomes: [...stats.recentRiskPlannedOutcomes],
    maxAccountDrawdownBps: stats.maxAccountDrawdownBps,
    accountResetsUsed: stats.accountResetsUsed,
  };
}

/** Exact process receipt required by CAREER_CONTRACT_V0 §10. */
export function isQualifyingLongMarginCompletion(summary: MarginEpisodeCompletionFact): boolean {
  return summary.side === 'LONG'
    // "Complete an episode" means the replay reached its terminal historical mark.
    // A manual close immediately after entry is a valid simulated trade but is not
    // evidence that the player completed the leverage-training episode.
    && summary.closeReason === 'EPISODE_END'
    && !summary.liquidated
    && summary.protectiveStopUsed
    && summary.plannedMaxAccountRiskBps !== null
    && summary.plannedMaxAccountRiskBps <= SHORT_PLANNED_RISK_LIMIT_BPS
    && (summary.marketProvenance === 'CONFIRMED' || summary.marketProvenance === 'DERIVED')
    && summary.simulationProvenance === 'SYNTHETIC'
    && summary.modelVersion === 'SIM_MARGIN_V0';
}

export function evaluateShort(state: { unlockedSkills: readonly string[]; stats: CareerStats }): boolean {
  return state.unlockedSkills.includes('MARGIN_2X')
    && state.stats.qualifyingLongMarginEpisodeIds.length >= SHORT_LONG_EPISODE_TARGET;
}

export function shortQualificationFromStats(stats: CareerStats, previous: ShortQualification): ShortQualification {
  return {
    ...previous,
    qualifyingLongEpisodeIds: [...stats.qualifyingLongMarginEpisodeIds],
    qualified: previous.qualified || stats.qualifyingLongMarginEpisodeIds.length >= SHORT_LONG_EPISODE_TARGET,
  };
}
