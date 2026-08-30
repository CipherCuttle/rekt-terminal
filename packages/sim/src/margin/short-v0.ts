import { mulDiv, type Rounding } from '../math.js';
import {
  MARGIN_BPS_SCALE,
  MARGIN_FX_MODEL_VERSION,
  MARGIN_STOP_LIQ_BUFFER_BPS,
  PERP_FILL_MODEL_VERSION,
  PPM_SCALE,
  SIM_MARGIN_MODEL_VERSION,
  USD_MICRO_SCALE,
  assertMarginEpisode,
  careerEthToMarginUsdMicros,
  type MarginCloseReason,
  type MarginEpisode,
  type MarginEvent,
  type MarginLeverage,
  type MarginMarketProvenance,
  type MarginRejectCode,
} from './margin-v0.js';

export interface ShortMarginPosition {
  positionId: string;
  side: 'SHORT';
  leverage: MarginLeverage;
  isolatedMarginUsdMicros: bigint;
  quantityMicros: bigint;
  entryFillPriceUsdMicros: bigint;
  entryFeeUsdMicros: bigint;
  stopPriceUsdMicros: bigint | null;
  /** Positive = short paid funding. Negative = short received funding. */
  accruedFundingUsdMicros: bigint;
  openedAtMs: number;
  openedMarkIndex: number;
}

export interface ShortMarginTradeSummary {
  tradeId: string;
  episodeId: string;
  instrumentId: string;
  side: 'SHORT';
  leverage: MarginLeverage;
  openedAtMs: number;
  closedAtMs: number;
  entryPriceUsdMicros: bigint;
  exitPriceUsdMicros: bigint;
  isolatedMarginUsdMicros: bigint;
  quantityMicros: bigint;
  grossPnlUsdMicros: bigint;
  entryFeeUsdMicros: bigint;
  exitFeeUsdMicros: bigint;
  fundingUsdMicros: bigint;
  liquidationFeeUsdMicros: bigint;
  netPnlUsdMicros: bigint;
  closeReason: MarginCloseReason;
  liquidated: boolean;
  protectiveStopUsed: boolean;
  marketProvenance: MarginMarketProvenance;
  simulationProvenance: 'SYNTHETIC';
  modelVersions: readonly [typeof SIM_MARGIN_MODEL_VERSION, typeof PERP_FILL_MODEL_VERSION, typeof MARGIN_FX_MODEL_VERSION];
}

export interface ShortMarginSessionState {
  sessionId: string;
  episodeId: string;
  modelVersion: typeof SIM_MARGIN_MODEL_VERSION;
  initialCareerEquityWei: bigint;
  initialCollateralUsdMicros: bigint;
  freeCollateralUsdMicros: bigint;
  currentMarkIndex: number;
  currentMarkPriceUsdMicros: bigint;
  position: ShortMarginPosition | null;
  realizedPnlUsdMicros: bigint;
  events: readonly MarginEvent[];
  appliedActionIds: readonly string[];
  appliedFundingIds: readonly string[];
  lastSequence: number;
  closed: boolean;
  liquidated: boolean;
  lastTrade: ShortMarginTradeSummary | null;
}

export interface ShortMarginPositionSnapshot {
  markPriceUsdMicros: bigint;
  markNotionalUsdMicros: bigint;
  unrealizedPnlUsdMicros: bigint;
  accruedFundingUsdMicros: bigint;
  positionEquityUsdMicros: bigint;
  accountEquityUsdMicros: bigint;
  maintenanceMarginUsdMicros: bigint;
  liquidationFeeReserveUsdMicros: bigint;
  liquidationPriceUsdMicros: bigint | null;
  netPnlAfterEntryFeeUsdMicros: bigint;
  roeBps: bigint;
}

export interface ShortMarginActionResult {
  state: ShortMarginSessionState;
  accepted: boolean;
  events: readonly MarginEvent[];
  code?: MarginRejectCode;
  reason?: string;
}

export type ShortMarginReplayAction =
  | { type: 'OPEN_SHORT'; actionId: string; marginUsdMicros: bigint; leverage: number; stopPriceUsdMicros?: bigint | null }
  | { type: 'PLACE_SHORT_STOP'; actionId: string; stopPriceUsdMicros: bigint }
  | { type: 'ADVANCE'; actionId: string }
  | { type: 'CLOSE'; actionId: string };

function quoteForBase(quantityMicros: bigint, priceUsdMicros: bigint, rounding: Rounding = 'floor'): bigint {
  return mulDiv(quantityMicros, priceUsdMicros, USD_MICRO_SCALE, rounding);
}

function quantityForQuote(quoteUsdMicros: bigint, priceUsdMicros: bigint, rounding: Rounding = 'floor'): bigint {
  return mulDiv(quoteUsdMicros, USD_MICRO_SCALE, priceUsdMicros, rounding);
}

function bpsOf(value: bigint, rateBps: bigint, rounding: Rounding = 'ceil'): bigint {
  return mulDiv(value, rateBps, MARGIN_BPS_SCALE, rounding);
}

/** Adverse SHORT execution: opening SELL below mark, closing BUY above mark. */
function shortFillPrice(markPriceUsdMicros: bigint, slippageBps: bigint, opening: boolean): bigint {
  const factor = opening ? MARGIN_BPS_SCALE - slippageBps : MARGIN_BPS_SCALE + slippageBps;
  return mulDiv(markPriceUsdMicros, factor, MARGIN_BPS_SCALE, opening ? 'floor' : 'ceil');
}

function append(state: ShortMarginSessionState, payload: Omit<MarginEvent, 'sequence' | 'sessionId' | 'modelVersion'>): { state: ShortMarginSessionState; event: MarginEvent } {
  const event: MarginEvent = {
    ...payload,
    sequence: state.lastSequence + 1,
    sessionId: state.sessionId,
    modelVersion: SIM_MARGIN_MODEL_VERSION,
  };
  return { state: { ...state, events: [...state.events, event], lastSequence: event.sequence }, event };
}

function withAction(state: ShortMarginSessionState, actionId: string): ShortMarginSessionState {
  return state.appliedActionIds.includes(actionId) ? state : { ...state, appliedActionIds: [...state.appliedActionIds, actionId] };
}

function duplicate(state: ShortMarginSessionState, actionId: string): ShortMarginActionResult | null {
  return state.appliedActionIds.includes(actionId) ? { state, accepted: true, events: [] } : null;
}

function currentEventTime(state: ShortMarginSessionState, episode: MarginEpisode): number {
  return episode.marks[state.currentMarkIndex]?.eventTimeMs ?? state.events.at(-1)?.eventTimeMs ?? episode.startTimeMs;
}

function reject(state: ShortMarginSessionState, episode: MarginEpisode, actionId: string, code: MarginRejectCode, reason: string): ShortMarginActionResult {
  const duplicated = duplicate(state, actionId);
  if (duplicated) return duplicated;
  const recorded = append(withAction(state, actionId), {
    type: 'ORDER_INTENT_REJECTED',
    eventId: `${state.sessionId}:${actionId}:rejected`,
    eventTimeMs: currentEventTime(state, episode),
    actionId,
    reason: `${code}:${reason}`,
  });
  return { state: recorded.state, accepted: false, events: [recorded.event], code, reason };
}

export function createShortMarginSession(input: { sessionId: string; careerEquityWei: bigint; episode: MarginEpisode }): ShortMarginSessionState {
  assertMarginEpisode(input.episode);
  if (!input.sessionId) throw new RangeError('margin session identity is required');
  const collateral = careerEthToMarginUsdMicros(input.careerEquityWei, input.episode.startEthUsdPriceMicros);
  const first = input.episode.marks[0];
  let state: ShortMarginSessionState = {
    sessionId: input.sessionId,
    episodeId: input.episode.episodeId,
    modelVersion: SIM_MARGIN_MODEL_VERSION,
    initialCareerEquityWei: input.careerEquityWei,
    initialCollateralUsdMicros: collateral,
    freeCollateralUsdMicros: collateral,
    currentMarkIndex: 0,
    currentMarkPriceUsdMicros: first.priceUsdMicros,
    position: null,
    realizedPnlUsdMicros: 0n,
    events: [],
    appliedActionIds: [],
    appliedFundingIds: [],
    lastSequence: 0,
    closed: false,
    liquidated: false,
    lastTrade: null,
  };
  const opened = append(state, {
    type: 'MARGIN_SESSION_OPENED',
    eventId: `${input.sessionId}:opened`,
    eventTimeMs: first.eventTimeMs,
    amountUsdMicros: collateral,
    priceUsdMicros: input.episode.startEthUsdPriceMicros,
    reason: `${MARGIN_FX_MODEL_VERSION}:SYNTHETIC_BOOKKEEPING:SHORT`,
  });
  state = opened.state;
  return state;
}

/**
 * Isolated SHORT liquidation threshold.
 *
 * M + entryNotional - fundingCost - markNotional = maintenance + liquidation reserve.
 * Unlike 1x long, a 1x short still has a finite liquidation price because upside loss is unbounded.
 */
export function estimateShortLiquidationPrice(position: ShortMarginPosition, episode: MarginEpisode): bigint | null {
  const combined = episode.maintenanceMarginBps + episode.liquidationFeeBps;
  if (combined < 0n || combined >= MARGIN_BPS_SCALE || position.quantityMicros <= 0n) return null;
  const entryNotional = quoteForBase(position.quantityMicros, position.entryFillPriceUsdMicros, 'floor');
  const numerator = position.isolatedMarginUsdMicros + entryNotional - position.accruedFundingUsdMicros;
  if (numerator <= 0n) return null;
  const denominator = position.quantityMicros * (MARGIN_BPS_SCALE + combined);
  if (denominator <= 0n) return null;
  return mulDiv(numerator, USD_MICRO_SCALE * MARGIN_BPS_SCALE, denominator, 'ceil');
}

export function shortMarginPositionSnapshot(state: ShortMarginSessionState, episode: MarginEpisode, markPriceUsdMicros = state.currentMarkPriceUsdMicros): ShortMarginPositionSnapshot | null {
  const position = state.position;
  if (!position) return null;
  const markNotional = quoteForBase(position.quantityMicros, markPriceUsdMicros, 'ceil');
  const entryNotional = quoteForBase(position.quantityMicros, position.entryFillPriceUsdMicros, 'floor');
  const unrealized = entryNotional - markNotional;
  const positionEquity = position.isolatedMarginUsdMicros + unrealized - position.accruedFundingUsdMicros;
  const maintenance = bpsOf(markNotional, episode.maintenanceMarginBps, 'ceil');
  const liquidationReserve = bpsOf(markNotional, episode.liquidationFeeBps, 'ceil');
  const netPnl = unrealized - position.accruedFundingUsdMicros - position.entryFeeUsdMicros;
  const roeBps = position.isolatedMarginUsdMicros > 0n
    ? mulDiv(netPnl, MARGIN_BPS_SCALE, position.isolatedMarginUsdMicros, 'half-up')
    : 0n;
  return {
    markPriceUsdMicros,
    markNotionalUsdMicros: markNotional,
    unrealizedPnlUsdMicros: unrealized,
    accruedFundingUsdMicros: position.accruedFundingUsdMicros,
    positionEquityUsdMicros: positionEquity,
    accountEquityUsdMicros: state.freeCollateralUsdMicros + positionEquity,
    maintenanceMarginUsdMicros: maintenance,
    liquidationFeeReserveUsdMicros: liquidationReserve,
    liquidationPriceUsdMicros: estimateShortLiquidationPrice(position, episode),
    netPnlAfterEntryFeeUsdMicros: netPnl,
    roeBps,
  };
}

function validateShortStop(position: ShortMarginPosition, stopPriceUsdMicros: bigint, episode: MarginEpisode): MarginRejectCode | null {
  if (stopPriceUsdMicros <= position.entryFillPriceUsdMicros) return 'INVALID_STOP';
  const liquidation = estimateShortLiquidationPrice(position, episode);
  if (liquidation !== null) {
    const buffered = mulDiv(liquidation, MARGIN_BPS_SCALE - MARGIN_STOP_LIQ_BUFFER_BPS, MARGIN_BPS_SCALE, 'floor');
    if (stopPriceUsdMicros >= buffered) return 'STOP_TOO_CLOSE_TO_LIQUIDATION';
  }
  return null;
}

function openMarginShortUnsafe(
  state: ShortMarginSessionState,
  episode: MarginEpisode,
  input: { actionId: string; marginUsdMicros: bigint; leverage: number; stopPriceUsdMicros?: bigint | null },
): ShortMarginActionResult {
  const duplicated = duplicate(state, input.actionId);
  if (duplicated) return duplicated;
  if (state.closed) return reject(state, episode, input.actionId, 'SESSION_CLOSED', 'the training episode is already closed');
  if (state.position) return reject(state, episode, input.actionId, 'POSITION_ALREADY_OPEN', 'only one isolated position is allowed');
  if (input.leverage !== 1 && input.leverage !== 2) return reject(state, episode, input.actionId, 'LEVERAGE_LIMIT', 'SIM_MARGIN_V0 authorizes 1x or 2x only');
  if (input.marginUsdMicros <= 0n) return reject(state, episode, input.actionId, 'INVALID_MARGIN', 'isolated margin must be positive');
  const leverage = input.leverage as MarginLeverage;
  const mark = episode.marks[state.currentMarkIndex];
  const requestedNotional = input.marginUsdMicros * BigInt(leverage);
  const fillPrice = shortFillPrice(mark.priceUsdMicros, episode.fillSlippageBps, true);
  const quantity = quantityForQuote(requestedNotional, fillPrice, 'floor');
  if (quantity <= 0n) return reject(state, episode, input.actionId, 'MODEL_INPUT_UNAVAILABLE', 'entry quantity rounded to zero');
  const executedNotional = quoteForBase(quantity, fillPrice, 'floor');
  const entryFee = bpsOf(executedNotional, episode.takerFeeBps, 'ceil');
  if (input.marginUsdMicros + entryFee > state.freeCollateralUsdMicros) {
    return reject(state, episode, input.actionId, 'INSUFFICIENT_COLLATERAL', 'isolated margin plus entry fee exceeds free collateral');
  }
  const position: ShortMarginPosition = {
    positionId: `${state.sessionId}:p1`,
    side: 'SHORT',
    leverage,
    isolatedMarginUsdMicros: input.marginUsdMicros,
    quantityMicros: quantity,
    entryFillPriceUsdMicros: fillPrice,
    entryFeeUsdMicros: entryFee,
    stopPriceUsdMicros: input.stopPriceUsdMicros ?? null,
    accruedFundingUsdMicros: 0n,
    openedAtMs: mark.eventTimeMs,
    openedMarkIndex: state.currentMarkIndex,
  };
  if (position.stopPriceUsdMicros !== null) {
    const stopError = validateShortStop(position, position.stopPriceUsdMicros, episode);
    if (stopError) return reject(state, episode, input.actionId, stopError, stopError === 'INVALID_STOP' ? 'short stop must sit above entry' : 'protective stop must remain below the liquidation safety buffer');
  }
  let next = withAction({
    ...state,
    freeCollateralUsdMicros: state.freeCollateralUsdMicros - input.marginUsdMicros - entryFee,
    position,
  }, input.actionId);
  const events: MarginEvent[] = [];
  for (const payload of [
    { type: 'MARGIN_ALLOCATED' as const, eventId: `${state.sessionId}:${input.actionId}:margin`, eventTimeMs: mark.eventTimeMs, actionId: input.actionId, amountUsdMicros: input.marginUsdMicros },
    { type: 'MARGIN_POSITION_OPENED' as const, eventId: `${state.sessionId}:${input.actionId}:opened`, eventTimeMs: mark.eventTimeMs, actionId: input.actionId, amountUsdMicros: executedNotional, priceUsdMicros: fillPrice, reason: 'SHORT' },
  ]) {
    const recorded = append(next, payload);
    next = recorded.state;
    events.push(recorded.event);
  }
  if (position.stopPriceUsdMicros !== null) {
    const recorded = append(next, {
      type: 'MARGIN_STOP_PLACED',
      eventId: `${state.sessionId}:${input.actionId}:stop`,
      eventTimeMs: mark.eventTimeMs,
      actionId: input.actionId,
      priceUsdMicros: position.stopPriceUsdMicros,
      reason: 'SHORT',
    });
    next = recorded.state;
    events.push(recorded.event);
  }
  return { state: next, accepted: true, events };
}

/** Public SHORT entry gate: a protective stop must still be above the current mark. */
export function openMarginShort(
  state: ShortMarginSessionState,
  episode: MarginEpisode,
  input: { actionId: string; marginUsdMicros: bigint; leverage: number; stopPriceUsdMicros?: bigint | null },
): ShortMarginActionResult {
  const currentMark = episode.marks[state.currentMarkIndex]?.priceUsdMicros ?? 0n;
  if (input.stopPriceUsdMicros !== undefined && input.stopPriceUsdMicros !== null && input.stopPriceUsdMicros <= currentMark) {
    const forced = openMarginShortUnsafe(state, episode, { ...input, stopPriceUsdMicros: 1n });
    return { ...forced, code: 'INVALID_STOP', reason: 'a short protective stop must be above the current mark before exposure opens' };
  }
  return openMarginShortUnsafe(state, episode, input);
}

function placeShortStopUnsafe(state: ShortMarginSessionState, episode: MarginEpisode, input: { actionId: string; stopPriceUsdMicros: bigint }): ShortMarginActionResult {
  const duplicated = duplicate(state, input.actionId);
  if (duplicated) return duplicated;
  if (state.closed) return reject(state, episode, input.actionId, 'SESSION_CLOSED', 'the training episode is already closed');
  const position = state.position;
  if (!position) return reject(state, episode, input.actionId, 'NO_OPEN_POSITION', 'a stop requires an open isolated short');
  const stopError = validateShortStop(position, input.stopPriceUsdMicros, episode);
  if (stopError) return reject(state, episode, input.actionId, stopError, stopError === 'INVALID_STOP' ? 'short stop must sit above entry' : 'protective stop must remain below the liquidation safety buffer');
  const replacing = position.stopPriceUsdMicros !== null;
  let next = withAction({ ...state, position: { ...position, stopPriceUsdMicros: input.stopPriceUsdMicros } }, input.actionId);
  const recorded = append(next, {
    type: replacing ? 'MARGIN_STOP_REPLACED' : 'MARGIN_STOP_PLACED',
    eventId: `${state.sessionId}:${input.actionId}:stop`,
    eventTimeMs: episode.marks[state.currentMarkIndex].eventTimeMs,
    actionId: input.actionId,
    priceUsdMicros: input.stopPriceUsdMicros,
    reason: 'SHORT',
  });
  next = recorded.state;
  return { state: next, accepted: true, events: [recorded.event] };
}

export function placeMarginShortStop(state: ShortMarginSessionState, episode: MarginEpisode, input: { actionId: string; stopPriceUsdMicros: bigint }): ShortMarginActionResult {
  if (state.position && input.stopPriceUsdMicros <= state.currentMarkPriceUsdMicros) {
    const forced = placeShortStopUnsafe(state, episode, { ...input, stopPriceUsdMicros: state.position.entryFillPriceUsdMicros });
    return { ...forced, code: 'INVALID_STOP', reason: 'a short protective stop must remain above the current mark' };
  }
  return placeShortStopUnsafe(state, episode, input);
}

function applyFundingBetween(state: ShortMarginSessionState, episode: MarginEpisode, fromTimeMs: number, toTimeMs: number): { state: ShortMarginSessionState; events: MarginEvent[] } {
  let next = state;
  const events: MarginEvent[] = [];
  for (const funding of episode.funding) {
    if (funding.eventTimeMs <= fromTimeMs || funding.eventTimeMs > toTimeMs || next.appliedFundingIds.includes(funding.fundingId)) continue;
    if (!next.position) {
      next = { ...next, appliedFundingIds: [...next.appliedFundingIds, funding.fundingId] };
      continue;
    }
    const markNotional = quoteForBase(next.position.quantityMicros, funding.markPriceUsdMicros, 'ceil');
    // Existing contract: positive funding means LONG pays. SHORT receives, so its
    // signed funding *cost* is the negation of the long-side amount.
    const amount = -mulDiv(markNotional, funding.ratePpm, PPM_SCALE, 'half-up');
    next = {
      ...next,
      position: { ...next.position, accruedFundingUsdMicros: next.position.accruedFundingUsdMicros + amount },
      appliedFundingIds: [...next.appliedFundingIds, funding.fundingId],
    };
    const recorded = append(next, {
      type: 'FUNDING_APPLIED',
      eventId: `${next.sessionId}:funding:${funding.fundingId}`,
      eventTimeMs: funding.eventTimeMs,
      fundingId: funding.fundingId,
      amountUsdMicros: amount,
      priceUsdMicros: funding.markPriceUsdMicros,
      reason: 'SHORT_SIGNED_COST',
    });
    next = recorded.state;
    events.push(recorded.event);
  }
  return { state: next, events };
}

function closeAtMark(state: ShortMarginSessionState, episode: MarginEpisode, input: { actionId: string; reason: MarginCloseReason; mark: MarginEpisode['marks'][number] }): ShortMarginActionResult {
  const position = state.position;
  if (!position) return reject(state, episode, input.actionId, 'NO_OPEN_POSITION', 'no isolated short is open');
  const slippage = input.reason === 'LIQUIDATION' ? episode.liquidationSlippageBps : episode.fillSlippageBps;
  const exitPrice = shortFillPrice(input.mark.priceUsdMicros, slippage, false);
  const exitNotional = quoteForBase(position.quantityMicros, exitPrice, 'ceil');
  const entryNotional = quoteForBase(position.quantityMicros, position.entryFillPriceUsdMicros, 'floor');
  const grossPnl = entryNotional - exitNotional;
  const exitFee = bpsOf(exitNotional, episode.takerFeeBps, 'ceil');
  const markNotional = quoteForBase(position.quantityMicros, input.mark.priceUsdMicros, 'ceil');
  const liquidationFee = input.reason === 'LIQUIDATION' ? bpsOf(markNotional, episode.liquidationFeeBps, 'ceil') : 0n;
  const returnable = position.isolatedMarginUsdMicros + grossPnl - position.accruedFundingUsdMicros - exitFee - liquidationFee;
  const returned = returnable > 0n ? returnable : 0n;
  const netPnl = grossPnl - position.entryFeeUsdMicros - position.accruedFundingUsdMicros - exitFee - liquidationFee;
  const summary: ShortMarginTradeSummary = {
    tradeId: position.positionId,
    episodeId: episode.episodeId,
    instrumentId: episode.instrumentId,
    side: 'SHORT',
    leverage: position.leverage,
    openedAtMs: position.openedAtMs,
    closedAtMs: input.mark.eventTimeMs,
    entryPriceUsdMicros: position.entryFillPriceUsdMicros,
    exitPriceUsdMicros: exitPrice,
    isolatedMarginUsdMicros: position.isolatedMarginUsdMicros,
    quantityMicros: position.quantityMicros,
    grossPnlUsdMicros: grossPnl,
    entryFeeUsdMicros: position.entryFeeUsdMicros,
    exitFeeUsdMicros: exitFee,
    fundingUsdMicros: position.accruedFundingUsdMicros,
    liquidationFeeUsdMicros: liquidationFee,
    netPnlUsdMicros: netPnl,
    closeReason: input.reason,
    liquidated: input.reason === 'LIQUIDATION',
    protectiveStopUsed: position.stopPriceUsdMicros !== null,
    marketProvenance: episode.marketProvenance,
    simulationProvenance: 'SYNTHETIC',
    modelVersions: [SIM_MARGIN_MODEL_VERSION, PERP_FILL_MODEL_VERSION, MARGIN_FX_MODEL_VERSION],
  };
  let next = withAction({
    ...state,
    freeCollateralUsdMicros: state.freeCollateralUsdMicros + returned,
    realizedPnlUsdMicros: state.realizedPnlUsdMicros + netPnl,
    position: null,
    closed: true,
    liquidated: input.reason === 'LIQUIDATION',
    lastTrade: summary,
  }, input.actionId);
  const events: MarginEvent[] = [];
  if (input.reason === 'LIQUIDATION') {
    const triggered = append(next, {
      type: 'LIQUIDATION_TRIGGERED', eventId: `${state.sessionId}:${input.actionId}:liq-trigger`, eventTimeMs: input.mark.eventTimeMs,
      actionId: input.actionId, priceUsdMicros: input.mark.priceUsdMicros, reason: 'SHORT',
    });
    next = triggered.state;
    events.push(triggered.event);
    const filled = append(next, {
      type: 'LIQUIDATION_FILLED', eventId: `${state.sessionId}:${input.actionId}:liq-fill`, eventTimeMs: input.mark.eventTimeMs,
      actionId: input.actionId, priceUsdMicros: exitPrice, amountUsdMicros: liquidationFee, reason: 'SHORT',
    });
    next = filled.state;
    events.push(filled.event);
  }
  const closed = append(next, {
    type: 'MARGIN_POSITION_CLOSED', eventId: `${state.sessionId}:${input.actionId}:closed`, eventTimeMs: input.mark.eventTimeMs,
    actionId: input.actionId, priceUsdMicros: exitPrice, amountUsdMicros: netPnl, reason: `${input.reason}:SHORT`,
  });
  next = closed.state;
  events.push(closed.event);
  const sessionClosed = append(next, {
    type: 'MARGIN_SESSION_CLOSED', eventId: `${state.sessionId}:${input.actionId}:session-closed`, eventTimeMs: input.mark.eventTimeMs,
    actionId: input.actionId, amountUsdMicros: next.freeCollateralUsdMicros, reason: `${input.reason}:SHORT`,
  });
  next = sessionClosed.state;
  events.push(sessionClosed.event);
  return { state: next, accepted: true, events };
}

export function closeMarginShort(state: ShortMarginSessionState, episode: MarginEpisode, input: { actionId: string }): ShortMarginActionResult {
  const duplicated = duplicate(state, input.actionId);
  if (duplicated) return duplicated;
  if (state.closed) return reject(state, episode, input.actionId, 'SESSION_CLOSED', 'the training episode is already closed');
  if (!state.position) return reject(state, episode, input.actionId, 'NO_OPEN_POSITION', 'no isolated short is open');
  return closeAtMark(state, episode, { actionId: input.actionId, reason: 'MANUAL', mark: episode.marks[state.currentMarkIndex] });
}

export function advanceMarginShortMark(state: ShortMarginSessionState, episode: MarginEpisode, input: { actionId: string }): ShortMarginActionResult {
  const duplicated = duplicate(state, input.actionId);
  if (duplicated) return duplicated;
  if (state.closed) return reject(state, episode, input.actionId, 'SESSION_CLOSED', 'the training episode is already closed');
  if (state.currentMarkIndex >= episode.marks.length - 1) return reject(state, episode, input.actionId, 'EPISODE_ENDED', 'no later historical mark exists');
  const previousMark = episode.marks[state.currentMarkIndex];
  const nextIndex = state.currentMarkIndex + 1;
  const mark = episode.marks[nextIndex];
  let next = withAction({ ...state, currentMarkIndex: nextIndex, currentMarkPriceUsdMicros: mark.priceUsdMicros }, input.actionId);
  const events: MarginEvent[] = [];
  const observed = append(next, {
    type: 'MARK_OBSERVED', eventId: `${state.sessionId}:${input.actionId}:mark:${mark.markId}`, eventTimeMs: mark.eventTimeMs,
    actionId: input.actionId, markId: mark.markId, priceUsdMicros: mark.priceUsdMicros, reason: 'SHORT',
  });
  next = observed.state;
  events.push(observed.event);
  const funded = applyFundingBetween(next, episode, previousMark.eventTimeMs, mark.eventTimeMs);
  next = funded.state;
  events.push(...funded.events);

  if (next.position) {
    const snapshot = shortMarginPositionSnapshot(next, episode, mark.priceUsdMicros);
    if (!snapshot) return reject(next, episode, `${input.actionId}:snapshot`, 'MODEL_INPUT_UNAVAILABLE', 'position snapshot could not be derived');
    if (snapshot.positionEquityUsdMicros <= snapshot.maintenanceMarginUsdMicros + snapshot.liquidationFeeReserveUsdMicros) {
      const closed = closeAtMark(next, episode, { actionId: `${input.actionId}:liquidate`, reason: 'LIQUIDATION', mark });
      return { ...closed, events: [...events, ...closed.events] };
    }
    if (next.position.stopPriceUsdMicros !== null && mark.priceUsdMicros >= next.position.stopPriceUsdMicros) {
      const closed = closeAtMark(next, episode, { actionId: `${input.actionId}:stop`, reason: 'STOP', mark });
      return { ...closed, events: [...events, ...closed.events] };
    }
    if (nextIndex === episode.marks.length - 1) {
      const closed = closeAtMark(next, episode, { actionId: `${input.actionId}:episode-end`, reason: 'EPISODE_END', mark });
      return { ...closed, events: [...events, ...closed.events] };
    }
  } else if (nextIndex === episode.marks.length - 1) {
    const closedSession = append(next, {
      type: 'MARGIN_SESSION_CLOSED', eventId: `${state.sessionId}:${input.actionId}:empty-end`, eventTimeMs: mark.eventTimeMs,
      actionId: input.actionId, amountUsdMicros: next.freeCollateralUsdMicros, reason: 'EPISODE_END:SHORT',
    });
    next = { ...closedSession.state, closed: true };
    events.push(closedSession.event);
  }
  return { state: next, accepted: true, events };
}

/** Replay uses the same public SHORT gates as interactive execution. */
export function replayMarginShortActions(input: { sessionId: string; careerEquityWei: bigint; episode: MarginEpisode; actions: readonly ShortMarginReplayAction[] }): ShortMarginSessionState {
  let state = createShortMarginSession({ sessionId: input.sessionId, careerEquityWei: input.careerEquityWei, episode: input.episode });
  for (const action of input.actions) {
    let result: ShortMarginActionResult;
    if (action.type === 'OPEN_SHORT') result = openMarginShort(state, input.episode, action);
    else if (action.type === 'PLACE_SHORT_STOP') result = placeMarginShortStop(state, input.episode, action);
    else if (action.type === 'ADVANCE') result = advanceMarginShortMark(state, input.episode, action);
    else result = closeMarginShort(state, input.episode, action);
    state = result.state;
  }
  return state;
}

export function serializeShortMarginState(state: ShortMarginSessionState): string {
  return JSON.stringify(state, (_key, value) => typeof value === 'bigint' ? `${value.toString()}n` : value);
}
