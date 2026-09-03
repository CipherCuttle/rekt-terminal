import type { SimEvent, SimState } from '@rekt-ink/sim';
import type { MissionId, MissionSimulatorEvidenceV0 } from './types.js';

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  }
  return value;
}

function fills(state: SimState) {
  return state.events.filter((event): event is Extract<SimEvent, { type: 'FILL_APPLIED' }> => event.type === 'FILL_APPLIED').map((event) => event.fill);
}

function acceptedActions(state: SimState) {
  return state.events.filter((event): event is Extract<SimEvent, { type: 'ORDER_INTENT_ACCEPTED' }> => event.type === 'ORDER_INTENT_ACCEPTED');
}

function rejectedActionReasons(state: SimState): readonly string[] {
  return state.events
    .filter((event): event is Extract<SimEvent, { type: 'ORDER_INTENT_REJECTED' }> => event.type === 'ORDER_INTENT_REJECTED')
    .map((event) => event.reason);
}

function emptyExecution(state: SimState): MissionSimulatorEvidenceV0 {
  return {
    kind: 'EX-01',
    modelVersion: 'SPOT_FILL_V0',
    entryAccepted: false,
    exitAccepted: false,
    rejectedActionReasons: rejectedActionReasons(state),
  };
}

function executionEvidence(state: SimState): MissionSimulatorEvidenceV0 {
  const actions = acceptedActions(state);
  const entry = fills(state).find((fill) => fill.side === 'BUY');
  const exit = fills(state).find((fill) => fill.side === 'SELL');
  const mark = state.events.find((event): event is Extract<SimEvent, { type: 'ACCOUNT_SNAPSHOT' }> => event.type === 'ACCOUNT_SNAPSHOT' && event.eventId.endsWith(':mark'));
  const summary = state.tradeSummaries.find((candidate) => candidate.exitReason === 'MANUAL');
  return freeze({
    ...emptyExecution(state),
    modelVersion: entry?.modelVersion ?? exit?.modelVersion ?? 'SPOT_FILL_V0',
    entryAccepted: actions.some((action) => action.action === 'BUY' || action.action === 'SCALE_IN'),
    exitAccepted: actions.some((action) => action.action === 'FULL_CLOSE') && state.events.some((event) => event.type === 'POSITION_CLOSED'),
    ...(entry ? { entryFillId: entry.fillId, entryReferencePriceX18: entry.referencePriceX18.toString(), entryFillPriceX18: entry.fillPriceX18.toString(), entryImpactBps: entry.impactBps.toString(), entryFeeWei: entry.feeQuoteWei.toString() } : {}),
    ...(mark ? { markPriceX18: mark.markPriceX18?.toString() } : {}),
    ...(exit ? { exitFillId: exit.fillId, exitReferencePriceX18: exit.referencePriceX18.toString(), exitFillPriceX18: exit.fillPriceX18.toString(), exitImpactBps: exit.impactBps.toString(), exitFeeWei: exit.feeQuoteWei.toString() } : {}),
    ...(mark ? { unrealizedPnlBeforeCloseWei: mark.account.unrealizedPnlWei.toString() } : {}),
    ...(summary ? { realizedPnlWei: summary.realizedPnlWei.toString() } : {}),
  });
}

function emptyStop(state: SimState): MissionSimulatorEvidenceV0 {
  return {
    kind: 'ST-01',
    modelVersion: 'SPOT_FILL_V0',
    entryAccepted: false,
    stopPlacementAccepted: false,
    stopTriggered: false,
    exitCompleted: false,
    stopWidened: false,
    rejectedActionReasons: rejectedActionReasons(state),
  };
}

function stopEvidence(state: SimState): MissionSimulatorEvidenceV0 {
  const actions = acceptedActions(state);
  const entry = fills(state).find((fill) => fill.side === 'BUY');
  const exit = fills(state).find((fill) => fill.side === 'SELL' && fill.exitReason === 'STOP');
  const placed = state.events.find((event): event is Extract<SimEvent, { type: 'STOP_PLACED' }> => event.type === 'STOP_PLACED');
  const replaced = state.events.some((event): event is Extract<SimEvent, { type: 'STOP_REPLACED' }> => event.type === 'STOP_REPLACED' && event.widened);
  const triggered = state.events.find((event): event is Extract<SimEvent, { type: 'STOP_TRIGGERED' }> => event.type === 'STOP_TRIGGERED');
  const summary = state.tradeSummaries.find((candidate) => candidate.exitReason === 'STOP');
  return freeze({
    ...emptyStop(state),
    modelVersion: entry?.modelVersion ?? exit?.modelVersion ?? 'SPOT_FILL_V0',
    entryAccepted: actions.some((action) => action.action === 'BUY' || action.action === 'SCALE_IN'),
    stopPlacementAccepted: Boolean(placed),
    stopTriggered: Boolean(triggered),
    exitCompleted: Boolean(triggered && exit && state.events.some((event) => event.type === 'POSITION_CLOSED' && event.cycleId === triggered.cycleId)),
    stopWidened: replaced,
    ...(placed ? { stopId: placed.stop.stopId, planPriceX18: placed.stop.stopPriceX18.toString() } : {}),
    ...(triggered ? { triggerEventId: triggered.eventId, triggerPriceX18: triggered.triggerPriceX18.toString() } : {}),
    ...(exit ? { exitFillId: exit.fillId, actualFillPriceX18: exit.fillPriceX18.toString(), impactBps: exit.impactBps.toString(), feesWei: ((entry?.feeQuoteWei ?? 0n) + exit.feeQuoteWei).toString() } : {}),
    ...(summary ? { realizedPnlWei: summary.realizedPnlWei.toString() } : {}),
  });
}

/** Derive learner-action evidence exclusively from production simulator state/events. */
export function deriveMissionSimulatorEvidence(missionId: MissionId, state: SimState | null | undefined): MissionSimulatorEvidenceV0 {
  if (!state) {
    return missionId === 'EX-01'
      ? { kind: 'EX-01', modelVersion: 'SPOT_FILL_V0', entryAccepted: false, exitAccepted: false, rejectedActionReasons: [] }
      : { kind: 'ST-01', modelVersion: 'SPOT_FILL_V0', entryAccepted: false, stopPlacementAccepted: false, stopTriggered: false, exitCompleted: false, stopWidened: false, rejectedActionReasons: [] };
  }
  return missionId === 'EX-01' ? executionEvidence(state) : stopEvidence(state);
}
