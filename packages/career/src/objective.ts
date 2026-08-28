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
  return {
    id: 'stop-loss-authorized',
    // Keep the existing objective kind stable for consumers; the copy now
    // points to the next STOP_LOSS milestone.
    kind: 'SCALE_CONTROL_UNLOCKED',
    text: 'STOP_LOSS AUTHORIZED // Place a protective stop.',
    progress: 1,
    target: 1,
  };
}
