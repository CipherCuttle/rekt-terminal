import { applySimEvent } from './ledger.js';
import { assertUsableObservation } from './observation.js';
import { buildRiskExposureEvent, buildRiskPlanEvent, planRiskSizedEntry, type RiskPlanIntent, type RiskPlanRejectionCode } from './risk.js';
import { createSpotFill, DEFAULT_SPOT_FILL_CONFIG, makeFixtureObservation } from './fill-models/spot-fill-v0.js';
import { quoteForQuantity } from './math.js';
import { nextEventSequence, type SimEvent } from './events.js';
import {
  SimError,
  DEFAULT_FIRST_TICKET_WEI,
  bps,
  priceX18,
  wei,
  type MarketObservation,
  type QuantityAtoms,
  type SimState,
  type SpotFillConfig,
  type Wei,
  type ActiveStop,
  type RiskPlan,
  type PriceX18,
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
      exitReason?: 'MANUAL' | 'STOP' | 'PROTECT_CAPITAL';
      stopPriceX18?: PriceX18;
      stopTriggeredAtMs?: number;
    };

export interface SpotActionResult {
  state: SimState;
  accepted: boolean;
  events: readonly SimEvent[];
  reason?: string;
}

export interface StopPlacementInput {
  stopId: string;
  stopPriceX18: bigint;
  observation: MarketObservation;
  eventTimeMs: number;
}

export interface StopActionResult {
  state: SimState;
  accepted: boolean;
  events: readonly SimEvent[];
  reason?: string;
}

export interface RiskPlanActionResult {
  state: SimState;
  accepted: boolean;
  events: readonly SimEvent[];
  plan?: RiskPlan;
  reason?: string;
  code?: RiskPlanRejectionCode | 'RISK_PLAN_POSITION_OPEN' | 'MODEL_INPUT_UNAVAILABLE';
}

/**
 * Freeze a risk plan onto the session.
 *
 * Only valid while flat: the plan's whole point is to decide invalidation and
 * size *before* exposure exists. Retro-fitting a budget onto a position the
 * player already holds would make the budget meaningless, so it is refused.
 *
 * The plan is recomputed here from simulator state and the gated observation.
 * A caller may preview a plan with `planRiskSizedEntry`, but nothing a caller
 * computed is ever trusted into the ledger.
 */
export function setSpotRiskPlan(state: SimState, intent: RiskPlanIntent, config: SpotFillConfig = DEFAULT_SPOT_FILL_CONFIG): RiskPlanActionResult {
  const refuse = (code: RiskPlanActionResult['code'], message: string): RiskPlanActionResult => ({
    state,
    accepted: false,
    events: [],
    code,
    reason: `${code}:${message}`,
  });

  if (state.position) return refuse('RISK_PLAN_POSITION_OPEN', 'a risk plan is defined before entry; close the open position first');
  try {
    assertUsableObservation(intent.observation, intent.eventTimeMs, config, state.evidencePolicy);
  } catch (error) {
    return refuse('MODEL_INPUT_UNAVAILABLE', error instanceof Error ? error.message : String(error));
  }

  const result = planRiskSizedEntry({
    planId: intent.planId,
    instrumentId: intent.observation.instrumentId,
    quoteAsset: intent.observation.quoteAsset,
    equityAtPlanWei: state.account.equityWei,
    availableCapitalWei: intent.availableCapitalWei ?? state.account.freeEthWei,
    intendedEntryPriceX18: priceX18(intent.observation.referencePriceX18),
    stopPriceX18: priceX18(intent.stopPriceX18),
    riskBps: bps(intent.riskBps),
    usableQuoteLiquidityWei: wei(intent.observation.usableQuoteLiquidityWei),
    createdAtMs: intent.eventTimeMs,
    observationId: intent.observation.observationId,
    sourceId: intent.observation.sourceId,
    config,
  });
  if (!result.ok) return refuse(result.code, result.message);

  const event = buildRiskPlanEvent(state, result.plan, intent.eventTimeMs);
  return { state: applySimEvent(state, event), accepted: true, events: [event], plan: result.plan };
}

/**
 * Record what this action did to an active plan's exposure — a breach, or the
 * fact that the exposure could not be checked at all.
 *
 * Practice never refuses the action — `CAREER_CONTRACT_V0` §13 is explicit that
 * the simulator records the behaviour rather than preventing it.
 */
function withRiskBudgetCheck<T extends { state: SimState; accepted: boolean; events: readonly SimEvent[] }>(
  result: T,
  observation: MarketObservation,
  eventTimeMs: number,
  config: SpotFillConfig,
  options: { positionJustOpened?: boolean } = {},
): T {
  if (!result.accepted) return result;
  const event = buildRiskExposureEvent(result.state, observation, eventTimeMs, config, options);
  if (!event) return result;
  return { ...result, state: applySimEvent(result.state, event), events: [...result.events, event] };
}


function rejectStop(state: SimState, stopId: string, eventTimeMs: number, reason: string): StopActionResult {
  const event: SimEvent = {
    type: 'ORDER_INTENT_REJECTED',
    eventId: `${stopId}:rejected:${state.lastSequence + 1}`,
    sequence: nextEventSequence(state),
    sessionId: state.sessionId,
    modelVersion: state.modelVersion,
    eventTimeMs: Math.max(state.events.at(-1)?.eventTimeMs ?? state.startedAtMs, eventTimeMs),
    intentId: stopId,
    reason,
  };
  return { state: applySimEvent(state, event), accepted: false, events: [event], reason };
}

export function placeSpotStop(state: SimState, input: StopPlacementInput, config: SpotFillConfig = DEFAULT_SPOT_FILL_CONFIG): StopActionResult {
  try {
    if (!state.position) throw new SimError('NO_OPEN_POSITION', 'stop requires an open spot position');
    assertUsableObservation(input.observation, input.eventTimeMs, config, state.evidencePolicy);
    if (input.observation.instrumentId !== state.position.instrumentId || input.observation.quoteAsset.toUpperCase() !== state.position.quoteAsset.toUpperCase()) throw new SimError('INVALID_EVENT', 'stop belongs to another instrument');
    if (!input.stopId || input.stopPriceX18 <= 0n || input.stopPriceX18 >= input.observation.referencePriceX18) throw new SimError('STOP_INVALID_SIDE', 'a long protective stop must be positive and below the current market price');
    const stop: ActiveStop = {
      stopId: input.stopId,
      cycleId: state.position.cycleId,
      instrumentId: state.position.instrumentId,
      quoteAsset: state.position.quoteAsset,
      stopPriceX18: priceX18(input.stopPriceX18),
      placedAtMs: input.eventTimeMs,
      placedObservationId: input.observation.observationId,
      sourceId: input.observation.sourceId,
    };
    const replacing = state.activeStop;
    const event: SimEvent = replacing
      ? { type: 'STOP_REPLACED', eventId: `${input.stopId}:replaced`, sequence: nextEventSequence(state), sessionId: state.sessionId, modelVersion: state.modelVersion, eventTimeMs: input.eventTimeMs, previousStopId: replacing.stopId, previousStopPriceX18: replacing.stopPriceX18, widened: input.stopPriceX18 < replacing.stopPriceX18, stop }
      : { type: 'STOP_PLACED', eventId: `${input.stopId}:placed`, sequence: nextEventSequence(state), sessionId: state.sessionId, modelVersion: state.modelVersion, eventTimeMs: input.eventTimeMs, stop };
    const placed: StopActionResult = { state: applySimEvent(state, event), accepted: true, events: [event] };
    return withRiskBudgetCheck(placed, input.observation, input.eventTimeMs, config);
  } catch (error) {
    const reason = error instanceof SimError ? `${error.code}:${error.message}` : String(error);
    return rejectStop(state, input.stopId || 'stop', input.eventTimeMs, reason);
  }
}

/** Estimate the result of a stop fill with the same SPOT_FILL_V0 sell model. */
export function estimateStopLossWei(state: SimState, observation: MarketObservation, eventTimeMs: number, config: SpotFillConfig = DEFAULT_SPOT_FILL_CONFIG): Wei | null {
  try {
    const stop = state.activeStop;
    const position = state.position;
    if (!stop || !position || position.cycleId !== stop.cycleId) return null;
    assertUsableObservation(observation, eventTimeMs, config, state.evidencePolicy);
    if (observation.instrumentId !== position.instrumentId || observation.quoteAsset.toUpperCase() !== position.quoteAsset.toUpperCase()) return null;
    const fill = createSpotFill({ fillId: `${stop.stopId}:estimate`, intentId: `${stop.stopId}:estimate`, side: 'SELL', observation, requestedQuoteWei: quoteForQuantity(position.openQuantityAtoms, observation.referencePriceX18, 'ceil'), requestedQuantityAtoms: position.openQuantityAtoms, executedAtMs: observation.observedAtMs, config, evidencePolicy: state.evidencePolicy });
    return wei(fill.executedQuoteWei - position.costBasisWei - position.remainingEntryFeesWei - fill.feeQuoteWei);
  } catch {
    return null;
  }
}

/**
 * Deterministic SYNTHETIC rehearsal of the PROTECT_CAPITAL behaviour.
 *
 * MARKET_TRUTH_V1 repair. This used to be a one-click Career shortcut: it
 * manufactured `referencePrice x 0.96`, labelled that fabricated future
 * observation DERIVED, executed it, and the resulting trade counted toward
 * STOP_LOSS qualification. Pressing one button proved nothing about the
 * player's behaviour, so it could not be allowed to continue.
 *
 * What remains is a development/test fixture only:
 *
 *   - the fabricated observation is labelled SYNTHETIC, which is what it is;
 *   - it therefore requires a session opened with `DEMO_ALLOW_SYNTHETIC`, so it
 *     is unreachable from a normal LIVE session;
 *   - the resulting TradeSummary carries `evidenceProvenance: 'SYNTHETIC'`, and
 *     the Career reducer refuses to grade synthetic evidence.
 *
 * `CAREER_CONTRACT_V0` §7 keeps PROTECT_CAPITAL as a conceptual alternate path
 * to STOP_LOSS. That path stays in the types and in the Career reducer, waiting
 * for a real historical Replay mission to supply CONFIRMED/DERIVED evidence for
 * it. This function is not that mission and must never be wired into product UI.
 */
export function executeSyntheticProtectCapitalRehearsal(state: SimState, observation: MarketObservation, eventTimeMs: number, config: SpotFillConfig = DEFAULT_SPOT_FILL_CONFIG): SpotActionResult {
  const entryObservation: MarketObservation = { ...observation, observationId: `${observation.observationId}:protect-capital-entry`, sourceId: `${observation.sourceId}:protect-capital`, provenance: 'SYNTHETIC' };
  const buyAction = { type: 'BUY', intentId: `${state.sessionId}:protect:buy`, fillId: `${state.sessionId}:protect:buy-fill`, eventTimeMs, observation: entryObservation, quoteNotionalWei: DEFAULT_FIRST_TICKET_WEI, config } as const;
  if (state.evidencePolicy !== 'DEMO_ALLOW_SYNTHETIC') {
    return rejectAction(state, buyAction, new SimError('SYNTHETIC_EVIDENCE_REJECTED', 'the protect-capital rehearsal is synthetic and requires an explicit DEMO session'));
  }
  if (state.position) return rejectAction(state, buyAction, new SimError('POSITION_ALREADY_OPEN', 'protect-capital rehearsal requires a flat session'));
  const buy = executeSpotAction(state, buyAction);
  if (!buy.accepted) return buy;
  const lossObservation: MarketObservation = { ...entryObservation, observationId: `${observation.observationId}:protect-capital`, referencePriceX18: priceX18((observation.referencePriceX18 * 9_600n) / 10_000n), observedAtMs: eventTimeMs };
  const close = executeSpotAction(buy.state, { type: 'FULL_CLOSE', intentId: `${state.sessionId}:protect:close`, fillId: `${state.sessionId}:protect:close-fill`, eventTimeMs, observation: lossObservation, config, exitReason: 'PROTECT_CAPITAL' });
  return { state: close.state, accepted: close.accepted, events: [...buy.events, ...close.events], reason: close.reason };
}

function executeStopTrigger(state: SimState, observation: MarketObservation, eventTimeMs: number, config: SpotFillConfig): SpotActionResult {
  const stop = state.activeStop;
  if (!stop || !state.position || observation.referencePriceX18 > stop.stopPriceX18) return { state, accepted: false, events: [], reason: 'STOP_NOT_TRIGGERED' };
  const trigger: SimEvent = {
    type: 'STOP_TRIGGERED',
    eventId: `${stop.stopId}:trigger:${observation.observationId}`,
    sequence: nextEventSequence(state),
    sessionId: state.sessionId,
    modelVersion: state.modelVersion,
    eventTimeMs,
    stopId: stop.stopId,
    cycleId: stop.cycleId,
    observationId: observation.observationId,
    triggerPriceX18: observation.referencePriceX18,
  };
  const triggered = applySimEvent(state, trigger);
  const exit = executeSpotAction(triggered, {
    type: 'FULL_CLOSE',
    intentId: `${stop.stopId}:exit:${observation.observationId}`,
    fillId: `${stop.stopId}:fill:${observation.observationId}`,
    eventTimeMs,
    observation,
    config,
    exitReason: 'STOP',
    stopPriceX18: stop.stopPriceX18,
    stopTriggeredAtMs: eventTimeMs,
  });
  return { state: exit.state, accepted: exit.accepted, events: [trigger, ...exit.events], reason: exit.reason };
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
      evidencePolicy: state.evidencePolicy,
    });
    if (!isEntry && action.type === 'FULL_CLOSE' && action.exitReason) {
      fill.exitReason = action.exitReason;
      fill.stopPriceX18 = action.stopPriceX18;
      fill.stopTriggeredAtMs = action.stopTriggeredAtMs;
    }
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
    // Scaling in, or reducing, changes projected exposure against a frozen
    // budget. Evaluated after the position event so the check sees real state.
    return withRiskBudgetCheck({ state: next, accepted: true, events: emitted }, action.observation, action.eventTimeMs, config, { positionJustOpened: !wasOpen });
  } catch (error) {
    return rejectAction(state, action, error);
  }
}

export function markSpot(state: SimState, observation: MarketObservation, eventTimeMs: number, config: SpotFillConfig = DEFAULT_SPOT_FILL_CONFIG): SpotActionResult {
  try {
    assertUsableObservation(observation, eventTimeMs, config, state.evidencePolicy);
    if (state.position && (state.position.instrumentId !== observation.instrumentId || state.position.quoteAsset !== observation.quoteAsset.toUpperCase())) throw new SimError('INVALID_EVENT', 'mark belongs to another spot instrument');
    if (state.activeStop && state.position && observation.referencePriceX18 <= state.activeStop.stopPriceX18) return executeStopTrigger(state, observation, eventTimeMs, config);
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
