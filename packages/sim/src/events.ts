import type { AccountState, ActiveStop, PositionState, SimState, SpotFill, TradeSummary, Wei } from './types.js';

export interface EventBase {
  eventId: string;
  sequence: number;
  sessionId: string;
  modelVersion: string;
  eventTimeMs: number;
}

export interface SessionOpenedEvent extends EventBase {
  type: 'SESSION_OPENED';
  initialFreeEthWei: Wei;
}

export interface OrderIntentAcceptedEvent extends EventBase {
  type: 'ORDER_INTENT_ACCEPTED';
  intentId: string;
  action: 'BUY' | 'SCALE_IN' | 'PARTIAL_CLOSE' | 'FULL_CLOSE';
}

export interface OrderIntentRejectedEvent extends EventBase {
  type: 'ORDER_INTENT_REJECTED';
  intentId: string;
  reason: string;
}

export interface FillAppliedEvent extends EventBase {
  type: 'FILL_APPLIED';
  fill: SpotFill;
}

export interface PositionEvent extends EventBase {
  type: 'POSITION_OPENED' | 'POSITION_CHANGED' | 'POSITION_CLOSED';
  cycleId: string;
}

export interface AccountSnapshotEvent extends EventBase {
  type: 'ACCOUNT_SNAPSHOT';
  markPriceX18: bigint | null;
  account: AccountState;
}

export interface TradeSummaryRecordedEvent extends EventBase {
  type: 'TRADE_SUMMARY_RECORDED';
  summary: TradeSummary;
}

export interface StopPlacedEvent extends EventBase {
  type: 'STOP_PLACED';
  stop: ActiveStop;
}

export interface StopReplacedEvent extends EventBase {
  type: 'STOP_REPLACED';
  previousStopId: string;
  stop: ActiveStop;
}

export interface StopTriggeredEvent extends EventBase {
  type: 'STOP_TRIGGERED';
  stopId: string;
  cycleId: string;
  observationId: string;
  triggerPriceX18: bigint;
}

export type SimEvent =
  | SessionOpenedEvent
  | OrderIntentAcceptedEvent
  | OrderIntentRejectedEvent
  | FillAppliedEvent
  | PositionEvent
  | AccountSnapshotEvent
  | TradeSummaryRecordedEvent
  | StopPlacedEvent
  | StopReplacedEvent
  | StopTriggeredEvent;

export function nextEventSequence(state: SimState): number {
  return state.lastSequence + 1;
}
