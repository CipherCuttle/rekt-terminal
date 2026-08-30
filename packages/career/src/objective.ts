import type { CareerState, ObjectiveState } from './types.js';

export function getNextObjective(state: Pick<CareerState, 'unlockedSkills' | 'qualification'>): ObjectiveState {
  const qualification = state.qualification.scaleControl;
  if (!state.unlockedSkills.includes('SCALE_CONTROL')) {
    if (qualification.closedSpotTrades < qualification.targetClosedSpotTrades) {
      const remaining = qualification.targetClosedSpotTrades - qualification.closedSpotTrades;
      return {
        id: 'scale-control-close-trades',
        kind: 'CLOSE_SPOT',
        text: `NEXT // Complete ${remaining} more controlled spot ${remaining === 1 ? 'trade' : 'trades'}.`,
        progress: qualification.closedSpotTrades,
        target: qualification.targetClosedSpotTrades,
      };
    }
    if (!qualification.positiveAccountEquity) {
      return {
        id: 'scale-control-positive-equity',
        kind: 'PROTECT_EQUITY',
        text: 'NEXT // Keep account equity positive to unlock SCALE_CONTROL.',
        progress: 0,
        target: 1,
      };
    }
  }
  const stop = state.qualification.stopLoss;
  if (!state.unlockedSkills.includes('STOP_LOSS')) {
    if (stop.totalClosedSpotTrades < stop.targetClosedSpotTrades) {
      const remaining = stop.targetClosedSpotTrades - stop.totalClosedSpotTrades;
      return { id: 'stop-loss-trades', kind: 'SCALE_CONTROL_UNLOCKED', text: `NEXT // Complete ${remaining} more spot ${remaining === 1 ? 'trade' : 'trades'} for STOP_LOSS.`, progress: stop.totalClosedSpotTrades, target: stop.targetClosedSpotTrades };
    }
    if (stop.manualLossCuts + stop.protectCapitalChallenges < 1) {
      return { id: 'stop-loss-controlled-loss', kind: 'SCALE_CONTROL_UNLOCKED', text: 'NEXT // Cut one losing trade before -5% account loss.', progress: 0, target: 1 };
    }
    return { id: 'stop-loss-equity-floor', kind: 'SCALE_CONTROL_UNLOCKED', text: 'NEXT // Keep account equity at least 70% of starting equity.', progress: stop.accountEquityAtLeast70Percent ? 1 : 0, target: 1 };
  }
  const risk = state.qualification.riskSizing;
  if (!state.unlockedSkills.includes('RISK_SIZING')) {
    if (risk.stopPlannedTrades < risk.targetStopPlannedTrades) {
      const remaining = risk.targetStopPlannedTrades - risk.stopPlannedTrades;
      return {
        id: 'risk-sizing-planned-stops',
        kind: 'RISK_SIZING_UNLOCKED',
        text: `NEXT // Close ${remaining} more ${remaining === 1 ? 'trade' : 'trades'} with a stop set at entry and never widened.`,
        progress: risk.stopPlannedTrades,
        target: risk.targetStopPlannedTrades,
      };
    }
    if (risk.partialExitsUsed < risk.targetPartialExits) {
      return {
        id: 'risk-sizing-partial-exit',
        kind: 'RISK_SIZING_UNLOCKED',
        text: 'NEXT // Use a partial exit.',
        progress: risk.partialExitsUsed,
        target: risk.targetPartialExits,
      };
    }
  }

  const margin = state.qualification.margin2x;
  if (!state.unlockedSkills.includes('MARGIN_2X')) {
    if (margin.closedSpotTrades < margin.targetClosedSpotTrades) {
      const remaining = margin.targetClosedSpotTrades - margin.closedSpotTrades;
      return { id: 'margin-2x-spot-trades', kind: 'MARGIN_2X_UNLOCKED', text: `NEXT // Close ${remaining} more spot ${remaining === 1 ? 'trade' : 'trades'} before leverage.`, progress: margin.closedSpotTrades, target: margin.targetClosedSpotTrades };
    }
    if (margin.riskPlannedTrades < margin.targetRiskPlannedTrades) {
      const remaining = margin.targetRiskPlannedTrades - margin.riskPlannedTrades;
      return { id: 'margin-2x-risk-plans', kind: 'MARGIN_2X_UNLOCKED', text: `NEXT // Complete ${remaining} more risk-planned ${remaining === 1 ? 'trade' : 'trades'}.`, progress: margin.riskPlannedTrades, target: margin.targetRiskPlannedTrades };
    }
    if (margin.partialExitsUsed < margin.targetPartialExits) {
      return { id: 'margin-2x-partial-exits', kind: 'MARGIN_2X_UNLOCKED', text: 'NEXT // Use one more partial exit before leverage.', progress: margin.partialExitsUsed, target: margin.targetPartialExits };
    }
    const clean = margin.recentRiskPlannedOutcomes.filter((entry) => entry.outcome === 'RESPECTED').length;
    if (margin.recentRiskPlannedOutcomes.length < margin.targetCleanRecentRiskPlans || clean < margin.targetCleanRecentRiskPlans) {
      return { id: 'margin-2x-recent-risk', kind: 'MARGIN_2X_UNLOCKED', text: 'NEXT // Finish 3 consecutive risk-planned trades with verified budget discipline.', progress: clean, target: margin.targetCleanRecentRiskPlans };
    }
    if (margin.maxAccountDrawdownBps === null) {
      return { id: 'margin-2x-drawdown-evidence', kind: 'MARGIN_2X_UNLOCKED', text: 'NEXT // Close one real-evidence trade so current account drawdown can be verified.', progress: 0, target: 1 };
    }
    if (margin.maxAccountDrawdownBps > margin.drawdownLimitBps) {
      return { id: 'margin-2x-drawdown', kind: 'MARGIN_2X_UNLOCKED', text: 'MARGIN_2X BLOCKED // Career max drawdown exceeded 20%.', progress: margin.drawdownLimitBps, target: margin.maxAccountDrawdownBps };
    }
    if (margin.accountResetsUsed > 0) {
      return { id: 'margin-2x-reset', kind: 'MARGIN_2X_UNLOCKED', text: 'MARGIN_2X BLOCKED // This Career used an account reset.', progress: 0, target: 1 };
    }
  }

  if (state.unlockedSkills.includes('MARGIN_2X')) {
    return {
      id: 'margin-2x-authorized',
      kind: 'MARGIN_2X_UNLOCKED',
      text: 'MARGIN // 2x AUTHORIZED // Historical isolated long training is available.',
      progress: 1,
      target: 1,
    };
  }
  if (state.unlockedSkills.includes('RISK_SIZING')) {
    return {
      id: 'risk-sizing-authorized',
      kind: 'RISK_SIZING_UNLOCKED',
      text: 'RISK_SIZING AUTHORIZED // Set a stop, then let account risk size the trade.',
      progress: 1,
      target: 1,
    };
  }
  return {
    id: 'stop-loss-authorized',
    kind: 'SCALE_CONTROL_UNLOCKED',
    text: 'STOP_LOSS AUTHORIZED // Place a protective stop.',
    progress: 1,
    target: 1,
  };
}
