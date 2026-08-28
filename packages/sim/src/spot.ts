import { applySimEvent } from './ledger.js';
import { createSpotFill, DEFAULT_SPOT_FILL_CONFIG, makeFixtureObservation } from './fill-models/spot-fill-v0.js';
import { quoteForQuantity } from './math.js';
import { nextEventSequence, type SimEvent } from './events.js';
import {
  SimError,
  DEFAULT_FIRST_TICKET_WEI,
  priceX18,
  type MarketObservation,
  type QuantityAtoms,
  type SimState,
  type SpotFillConfig,
  type Wei,
} from './types.js';

export type SpotAction =
  | {
      type: 'BUY';
      intentId: string;
      fillId: string;
      eventTimeMs: number;
      observation: MarketObservation;
      quoteNotionalWei?: Wei;
      config?: SpotFillConfig;
    }
  | {
      type: 'SCALE_IN';
      intentId: string;
      fillId: string;
      eventTimeMs: number;
      observation: MarketObservation;
      quoteNotionalWei: Wei;
      config?: SpotFillConfig;
    }
  | {
      type: 'PARTIAL_CLOSE';
      intentId: string;
      fillId: string;
      eventTimeMs: number;
      observation: MarketObservation;
      quantityAtoms: QuantityAtoms;
      config?: SpotFillConfig;
    }
  | {
      type: 'FULL_CLOSE';
      intentId: string;
      fillId: string;
      eventTimeMs: number;
      observation: MarketObservation;
      config?: SpotFillConfig;
    };

export interface SpotActionResult {
  state: SimState;
  accepted: boolean;
  events: readonly SimEvent[];
  reason?: string;
}

function actionConfig(action: SpotAction): SpotFillConfig {
  return action.config ?? DEFAULT_SPOT_FILL_CONFIG;
}

function rejectAction(state: SimState, action: SpotAction, error: unknown): SpotActionResult {
  const code = error instanceof SimError ? error.code : 'INVALID_EVENT';
  const reason = error instanceof Error ? error.message : String(error);
  const event: SimEvent = {
    type: 'ORDER_INTENT_REJECTED',
    eventId: `${action.intentId}:rejected:${state.lastSequence + 1}`,
    sequence: nextEventSequence(state),
    sessionId: state.sessionId,
    modelVersion: state.modelVersion,
    eventTimeMs: Math.max(state.events[state.events.length - 1]?.eventTimeMs ?? state.startedAtMs, action.eventTimeMs),
    intentId: action.intentId,
    reason: `${code}:${reason}`,
  };
  const next = applySimEvent(state, event);
  return { state: next, accepted: false, events: [event], reason: event.reason };
}

function validateActionShape(state: SimState, action: SpotAction): void {
  if (!action.intentId || !action.fillId) throw new SimError('MODEL_INPUT_UNAVAILABLE', 'intent and fill identities are required');
  if (!Number.isSafeInteger(action.eventTimeMs) || action.eventTimeMs < state.startedAtMs) throw new SimError('INVALID_TIME', 'action time must be a valid session time');
  if (action.type === 'BUY' && state.position) throw new SimError('POSITION_ALREADY_OPEN', 'use SCALE_IN for an existing spot position');
  if (action.type === 'SCALE_IN' && !state.position) throw new SimError('NO_OPEN_POSITION', 'scale-in requires an open spot position');
  if ((action.type === 'PARTIAL_CLOSE' || action.type === 'FULL_CLOSE') && !state.position) throw new SimError('NO_OPEN_POSITION', 'close requires an open spot position');
  if (action.type === 'PARTIAL_CLOSE' && action.quantityAtoms <= 0n) throw new SimError('INVALID_QUANTITY', 'partial close quantity must be positive');
  if (action.type === 'PARTIAL_CLOSE' && state.position && action.quantityAtoms >= state.position.openQuantityAtoms) throw new SimError('OVER_CLOSE_ATTEMPT', 'partial close must leave an open remainder');
}

export function executeSpotAction(state: SimState, action: SpotAction): SpotActionResult {
  try {
    validateActionShape(state, action);
    const config = actionConfig(action);
    const isEntry = action.type === 'BUY' || action.type === 'SCALE_IN';
    const quantityToClose = action.type === 'FULL_CLOSE' ? state.position?.openQuantityAtoms : action.type === 'PARTIAL_CLOSE' ? action.quantityAtoms : undefined;
    const requestedQuoteWei = isEntry
      ? action.type === 'BUY' ? action.quoteNotionalWei ?? DEFAULT_FIRST_TICKET_WEI : action.quoteNotionalWei
      : quoteForQuantity(quantityToClose!, priceX18(action.observation.referencePriceX18), 'ceil');
    const fill = createSpotFill({
      fillId: action.fillId,
      intentId: action.intentId,
      side: isEntry ? 'BUY' : 'SELL',
      observation: action.observation,
      requestedQuoteWei,
      requestedQuantityAtoms: quantityToClose,
      executedAtMs: action.eventTimeMs,
      config,
    });
    if (isEntry && fill.executedQuoteWei + fill.feeQuoteWei > state.account.freeEthWei) {
      throw new SimError('INSUFFICIENT_BALANCE', 'entry cost and fee exceed free ETH');
    }

    const acceptedEvent: SimEvent = {
      type: 'ORDER_INTENT_ACCEPTED',
      eventId: `${action.intentId}:accepted`,
      sequence: nextEventSequence(state),
      sessionId: state.sessionId,
      modelVersion: state.modelVersion,
      eventTimeMs: action.eventTimeMs,
      intentId: action.intentId,
      action: action.type,
    };
    const fillEvent: SimEvent = {
      type: 'FILL_APPLIED',
      eventId: `${action.fillId}:applied`,
      sequence: acceptedEvent.sequence + 1,
      sessionId: state.sessionId,
      modelVersion: state.modelVersion,
      eventTimeMs: action.eventTimeMs,
      fill,
    };
    const wasOpen = state.position !== null;
    const wasFullClose = !isEntry && state.position !== null && fill.quantityAtoms === state.position.openQuantityAtoms;
    const positionEvent: SimEvent = {
      type: wasFullClose ? 'POSITION_CLOSED' : wasOpen ? 'POSITION_CHANGED' : 'POSITION_OPENED',
      eventId: `${action.fillId}:position`,
      sequence: fillEvent.sequence + 1,
      sessionId: state.sessionId,
      modelVersion: state.modelVersion,
      eventTimeMs: action.eventTimeMs,
      cycleId: state.position?.cycleId ?? `trade-${state.closedCycleCount + 1}`,
    };
    let next = applySimEvent(state, acceptedEvent);
    next = applySimEvent(next, fillEvent);
    next = applySimEvent(next, positionEvent);
    const emitted: SimEvent[] = [acceptedEvent, fillEvent, positionEvent];
    if (wasFullClose) {
      const summary = next.tradeSummaries[next.tradeSummaries.length - 1];
      if (summary) {
        const summaryEvent: SimEvent = {
          type: 'TRADE_SUMMARY_RECORDED',
          eventId: `${summary.tradeId}:summary`,
          sequence: nextEventSequence(next),
          sessionId: state.sessionId,
          modelVersion: state.modelVersion,
          eventTimeMs: action.eventTimeMs,
          summary,
        };
        next = applySimEvent(next, summaryEvent);
        emitted.push(summaryEvent);
      }
    }
    const snapshotEvent: SimEvent = {
      type: 'ACCOUNT_SNAPSHOT',
      eventId: `${action.fillId}:account`,
      sequence: nextEventSequence(next),
      sessionId: state.sessionId,
      modelVersion: state.modelVersion,
      eventTimeMs: action.eventTimeMs,
      markPriceX18: fill.fillPriceX18,
      account: next.account,
    };
    next = applySimEvent(next, snapshotEvent);
    emitted.push(snapshotEvent);
    return { state: next, accepted: true, events: emitted };
  } catch (error) {
    return rejectAction(state, action, error);
  }
}

export function markSpot(state: SimState, observation: MarketObservation, eventTimeMs: number, config: SpotFillConfig = DEFAULT_SPOT_FILL_CONFIG): SpotActionResult {
  try {
    if (!observation.observationId || !observation.instrumentId || !observation.sourceId) throw new SimError('MODEL_INPUT_UNAVAILABLE', 'market observation identity is required');
    if (state.position && (state.position.instrumentId !== observation.instrumentId || state.position.quoteAsset !== observation.quoteAsset.toUpperCase())) throw new SimError('INVALID_EVENT', 'mark belongs to another spot instrument');
    if (observation.provenance === 'STALE' || observation.provenance === 'UNAVAILABLE' || observation.provenance === 'SYNTHETIC') throw new SimError('MODEL_INPUT_UNAVAILABLE', 'mark requires confirmed or derived evidence');
    if (observation.referencePriceX18 <= 0n) throw new SimError('INVALID_PRICE', 'mark price must be positive');
    if (!Number.isSafeInteger(eventTimeMs) || eventTimeMs < observation.observedAtMs || eventTimeMs - observation.observedAtMs > config.maxObservationAgeMs) throw new SimError('STALE_MARKET', 'market mark is outside the configured freshness window');
    const event: SimEvent = {
      type: 'ACCOUNT_SNAPSHOT',
      eventId: `${observation.observationId}:mark`,
      sequence: nextEventSequence(state),
      sessionId: state.sessionId,
      modelVersion: state.modelVersion,
      eventTimeMs,
      markPriceX18: observation.referencePriceX18,
      account: state.account,
    };
    return { state: applySimEvent(state, event), accepted: true, events: [event] };
  } catch (error) {
    const fallbackAction: SpotAction = {
      type: 'BUY',
      intentId: `${observation.observationId}:mark`,
      fillId: `${observation.observationId}:mark-fill`,
      eventTimeMs,
      observation: makeFixtureObservation({ ...observation }),
    };
    return rejectAction(state, fallbackAction, error);
  }
}

export function createFixedBuyAction(input: Omit<Extract<SpotAction, { type: 'BUY' }>, 'quoteNotionalWei'>): SpotAction {
  return { ...input, type: 'BUY', quoteNotionalWei: DEFAULT_FIRST_TICKET_WEI };
}
