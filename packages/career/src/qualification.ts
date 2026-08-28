import type { CareerStats, QualificationState, ScaleControlQualification } from './types.js';

export const SCALE_CONTROL_TRADE_TARGET = 3;
export const SCALE_CONTROL_LOSS_LIMIT_BPS = 1_000;

export function evaluateScaleControl(stats: CareerStats): boolean {
  return stats.closedSpotTrades >= SCALE_CONTROL_TRADE_TARGET
    && stats.maxClosedLossBps <= SCALE_CONTROL_LOSS_LIMIT_BPS
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
  };
}

export function updateQualification(stats: CareerStats, previous: QualificationState): QualificationState {
  const scaleControl: ScaleControlQualification = {
    ...previous.scaleControl,
    closedSpotTrades: stats.closedSpotTrades,
    maxClosedLossBps: stats.maxClosedLossBps,
    positiveAccountEquity: stats.lastClosedTradeAccountPositive,
    qualified: previous.scaleControl.qualified || evaluateScaleControl(stats),
  };
  return { ...previous, scaleControl };
}
