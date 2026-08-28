import type { CareerStats, QualificationState, ScaleControlQualification } from './types.js';

export const SCALE_CONTROL_TRADE_TARGET = 3;
export const SCALE_CONTROL_LOSS_LIMIT_BPS = 1_000;
export const STOP_LOSS_TRADE_TARGET = 5;
export const STOP_LOSS_EQUITY_FLOOR_WEI = 350_000_000_000_000_000n;

export function evaluateScaleControl(stats: CareerStats): boolean {
  return stats.qualifyingScaleTrades >= SCALE_CONTROL_TRADE_TARGET
    && stats.lastClosedTradeAccountPositive;
}

export function createInitialQualification(): QualificationState {
  return {
    scaleControl: {
      closedSpotTrades: 0,
      targetClosedSpotTrades: 3,
      maxClosedLossBps: 0,
      lossLimitBps: 1_000,
      positiveAccountEquity: true,
      qualified: false,
    },
    stopLoss: {
      totalClosedSpotTrades: 0,
      targetClosedSpotTrades: 5,
      manualLossCuts: 0,
      protectCapitalChallenges: 0,
      accountEquityAtLeast70Percent: true,
      qualified: false,
    },
  };
}

export function updateQualification(stats: CareerStats, previous: QualificationState): QualificationState {
  const scaleControl: ScaleControlQualification = {
    ...previous.scaleControl,
    // Keep the historical field name for save compatibility; this is now
    // explicitly the user-facing controlled-trade progress.
    closedSpotTrades: stats.qualifyingScaleTrades,
    maxClosedLossBps: stats.maxClosedLossBps,
    positiveAccountEquity: stats.lastClosedTradeAccountPositive,
    qualified: previous.scaleControl.qualified || evaluateScaleControl(stats),
  };
  return { ...previous, scaleControl };
}

export function evaluateStopLoss(state: { unlockedSkills: readonly string[]; stats: CareerStats }): boolean {
  return state.unlockedSkills.includes('SCALE_CONTROL')
    && state.stats.closedSpotTrades >= STOP_LOSS_TRADE_TARGET
    && state.stats.accountEquityAtLeast70Percent
    && state.stats.manualLossCuts + state.stats.protectCapitalChallenges >= 1;
}
