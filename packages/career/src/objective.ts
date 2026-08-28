import type { CareerState, ObjectiveState } from './types.js';

export function getNextObjective(state: Pick<CareerState, 'unlockedSkills' | 'qualification'>): ObjectiveState {
  const qualification = state.qualification.scaleControl;
  if (!state.unlockedSkills.includes('SCALE_CONTROL')) {
    if (qualification.closedSpotTrades < qualification.targetClosedSpotTrades) {
      const remaining = qualification.targetClosedSpotTrades - qualification.closedSpotTrades;
      return {
        id: 'scale-control-close-trades',
        kind: 'CLOSE_SPOT',
        text: `NEXT // Close ${remaining} more spot ${remaining === 1 ? 'position' : 'positions'}.`,
        progress: qualification.closedSpotTrades,
        target: qualification.targetClosedSpotTrades,
      };
    }
    if (qualification.maxClosedLossBps > qualification.lossLimitBps) {
      return {
        id: 'scale-control-protect-equity',
        kind: 'PROTECT_EQUITY',
        text: 'NEXT // Keep one closed loss within 10% of account equity.',
        progress: qualification.lossLimitBps,
        target: qualification.maxClosedLossBps,
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
  return {
    id: 'scale-control-practice',
    kind: 'SCALE_CONTROL_UNLOCKED',
    text: 'NEXT // Use one scale-in or partial exit.',
    progress: 0,
    target: 1,
  };
}
