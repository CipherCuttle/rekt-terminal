import { formatFixed, mulDiv, parseFixed, type Rounding } from '../math.js';

export const SIM_MARGIN_MODEL_VERSION = 'SIM_MARGIN_V0' as const;
export const PERP_FILL_MODEL_VERSION = 'PERP_FILL_V0' as const;
export const MARGIN_FX_MODEL_VERSION = 'MARGIN_FX_V0' as const;
export const MARGIN_INTRABAR_MODEL_VERSION = 'OHLC_PATH_V0' as const;
export const USD_MICRO_SCALE = 1_000_000n;
export const ETH_WEI_SCALE = 1_000_000_000_000_000_000n;
export const PPM_SCALE = 1_000_000n;
export const MARGIN_BPS_SCALE = 10_000n;
export const MARGIN_STOP_LIQ_BUFFER_BPS = 100n;

export type MarginLeverage = 1 | 2;
export type MarginMarketProvenance = 'CONFIRMED' | 'DERIVED';
export type MarginCloseReason = 'MANUAL' | 'STOP' | 'LIQUIDATION' | 'EPISODE_END';
export type MarginRejectCode =
  | 'SESSION_CLOSED'
  | 'POSITION_ALREADY_OPEN'
  | 'NO_OPEN_POSITION'
  | 'LEVERAGE_LIMIT'
  | 'INSUFFICIENT_COLLATERAL'
  | 'INVALID_MARGIN'
  | 'INVALID_STOP'
  | 'STOP_TOO_CLOSE_TO_LIQUIDATION'
  | 'EPISODE_ENDED'
  | 'MODEL_INPUT_UNAVAILABLE';

export interface MarginMark {
  markId: string;
  eventTimeMs: number;
  priceUsdMicros: bigint;
  sourceId: string;
  provenance: MarginMarketProvenance;
}

export interface MarginFundingEvent {
  fundingId: string;
  eventTimeMs: number;
  /** 1_000_000 ppm = 100%. Positive means a long pays; negative means it receives. */
  ratePpm: bigint;
  markPriceUsdMicros: bigint;
  sourceId: string;
  provenance: MarginMarketProvenance;
}

export interface MarginEpisode {
  episodeId: string;
  instrumentId: string;
  sourceVenue: string;
  sourceLabel: string;
  startTimeMs: number;
  endTimeMs: number;
  startEthUsdPriceMicros: bigint;
  marks: readonly MarginMark[];
  funding: readonly MarginFundingEvent[];
  maintenanceMarginBps: bigint;
  takerFeeBps: bigint;
  liquidationFeeBps: bigint;
  fillSlippageBps: bigint;
  liquidationSlippageBps: bigint;
  marketProvenance: MarginMarketProvenance;
  intrabarRule: typeof MARGIN_INTRABAR_MODEL_VERSION;
  modelVersion: typeof SIM_MARGIN_MODEL_VERSION;
}

export interface MarginPosition {
  positionId: string;
  side: 'LONG';
  leverage: MarginLeverage;
  isolatedMarginUsdMicros: bigint;
  quantityMicros: bigint;
  entryFillPriceUsdMicros: bigint;
  entryFeeUsdMicros: bigint;
  stopPriceUsdMicros: bigint | null;
  accruedFundingUsdMicros: bigint;
  openedAtMs: number;
  openedMarkIndex: number;
}

export interface MarginTradeSummary {
  tradeId: string;
  episodeId: string;
  instrumentId: string;
  side: 'LONG';
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

export type MarginEventType =
  | 'MARGIN_SESSION_OPENED'
  | 'MARGIN_ALLOCATED'
  | 'MARGIN_POSITION_OPENED'
  | 'MARGIN_STOP_PLACED'
  | 'MARGIN_STOP_REPLACED'
  | 'MARK_OBSERVED'
  | 'FUNDING_APPLIED'
  | 'LIQUIDATION_TRIGGERED'
  | 'LIQUIDATION_FILLED'
  | 'MARGIN_POSITION_CLOSED'
  | 'MARGIN_SESSION_CLOSED'
  | 'ORDER_INTENT_REJECTED';

export interface MarginEvent {
  type: MarginEventType;
  eventId: string;
  sequence: number;
  sessionId: string;
  modelVersion: typeof SIM_MARGIN_MODEL_VERSION;
  eventTimeMs: number;
  actionId?: string;
  markId?: string;
  fundingId?: string;
  amountUsdMicros?: bigint;
  priceUsdMicros?: bigint;
  reason?: string;
}

export interface MarginSessionState {
  sessionId: string;
  episodeId: string;
  modelVersion: typeof SIM_MARGIN_MODEL_VERSION;
  initialCareerEquityWei: bigint;
  initialCollateralUsdMicros: bigint;
  freeCollateralUsdMicros: bigint;
  currentMarkIndex: number;
  currentMarkPriceUsdMicros: bigint;
  position: MarginPosition | null;
  realizedPnlUsdMicros: bigint;
  events: readonly MarginEvent[];
  appliedActionIds: readonly string[];
  appliedFundingIds: readonly string[];
  lastSequence: number;
  closed: boolean;
  liquidated: boolean;
  lastTrade: MarginTradeSummary | null;
}

export interface MarginPositionSnapshot {
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

export interface MarginActionResult {
  state: MarginSessionState;
  accepted: boolean;
  events: readonly MarginEvent[];
  code?: MarginRejectCode;
  reason?: string;
}

export type MarginReplayAction =
  | { type: 'OPEN_LONG'; actionId: string; marginUsdMicros: bigint; leverage: number; stopPriceUsdMicros?: bigint | null }
  | { type: 'PLACE_STOP'; actionId: string; stopPriceUsdMicros: bigint }
  | { type: 'ADVANCE'; actionId: string }
  | { type: 'CLOSE'; actionId: string };

export function usdMicros(value: string): bigint {
  return parseFixed(value, 6);
}

export function formatUsdMicros(value: bigint, decimals = 2): string {
  const rendered = formatFixed(value, 6, false);
  const [whole, fraction = ''] = rendered.split('.');
  if (decimals <= 0) return whole;
  return `${whole}.${fraction.padEnd(6, '0').slice(0, decimals)}`;
}

export function careerEthToMarginUsdMicros(careerEquityWei: bigint, ethUsdPriceMicros: bigint): bigint {
  if (careerEquityWei <= 0n || ethUsdPriceMicros <= 0n) throw new RangeError('positive Career equity and episode-start ETH/USD are required');
  return mulDiv(careerEquityWei, ethUsdPriceMicros, ETH_WEI_SCALE, 'floor');
}

function assertBps(value: bigint, label: string): void {
  if (value < 0n || value >= MARGIN_BPS_SCALE) throw new RangeError(`${label} must be between 0 and 9999 bps`);
}

export function assertMarginEpisode(episode: MarginEpisode): void {
  if (!episode.episodeId || !episode.instrumentId || !episode.sourceVenue || !episode.sourceLabel) throw new RangeError('episode identity is required');
  if (episode.modelVersion !== SIM_MARGIN_MODEL_VERSION || episode.intrabarRule !== MARGIN_INTRABAR_MODEL_VERSION) throw new RangeError('unsupported margin episode model');
  if (!Number.isSafeInteger(episode.startTimeMs) || !Number.isSafeInteger(episode.endTimeMs) || episode.startTimeMs < 0 || episode.endTimeMs <= episode.startTimeMs) throw new RangeError('invalid episode time bounds');
  if (episode.startEthUsdPriceMicros <= 0n) throw new RangeError('episode-start ETH/USD conversion must be positive');
  if (episode.marks.length < 2) throw new RangeError('margin episode requires at least two ordered marks');
  assertBps(episode.maintenanceMarginBps, 'maintenance margin');
  assertBps(episode.takerFeeBps, 'taker fee');
  assertBps(episode.liquidationFeeBps, 'liquidation fee');
  assertBps(episode.fillSlippageBps, 'fill slippage');
  assertBps(episode.liquidationSlippageBps, 'liquidation slippage');
  if (episode.maintenanceMarginBps + episode.liquidationFeeBps >= MARGIN_BPS_SCALE) throw new RangeError('maintenance plus liquidation fee must remain below 100%');
  let previous = -1;
  for (const mark of episode.marks) {
    if (!mark.markId || !mark.sourceId || mark.priceUsdMicros <= 0n || !Number.isSafeInteger(mark.eventTimeMs) || mark.eventTimeMs <= previous) throw new RangeError('episode marks must have stable identity, positive price, and strict time order');
    previous = mark.eventTimeMs;
  }
  for (const funding of episode.funding) {
    if (!funding.fundingId || !funding.sourceId || funding.markPriceUsdMicros <= 0n || !Number.isSafeInteger(funding.eventTimeMs)) throw new RangeError('invalid funding event');
    if (funding.eventTimeMs < episode.startTimeMs || funding.eventTimeMs > episode.endTimeMs) throw new RangeError('funding event lies outside episode');
  }
}

function append(state: MarginSessionState, payload: Omit<MarginEvent, 'sequence' | 'sessionId' | 'modelVersion'>): { state: MarginSessionState; event: MarginEvent } {
  const event: MarginEvent = {
    ...payload,
    sequence: state.lastSequence + 1,
    sessionId: state.sessionId,
    modelVersion: SIM_MARGIN_MODEL_VERSION,
  };
  return {
    state: { ...state, events: [...state.events, event], lastSequence: event.sequence },
    event,
  };
}

function withAction(state: MarginSessionState, actionId: string): MarginSessionState {
  return state.appliedActionIds.includes(actionId) ? state : { ...state, appliedActionIds: [...state.appliedActionIds, actionId] };
}

function duplicate(state: MarginSessionState, actionId: string): MarginActionResult | null {
  return state.appliedActionIds.includes(actionId) ? { state, accepted: true, events: [] } : null;
}

function reject(state: MarginSessionState, actionId: string, code: MarginRejectCode, reason: string): MarginActionResult {
  const duplicated = duplicate(state, actionId);
  if (duplicated) return duplicated;
  const mark = currentMark(state);
  const recorded = append(withAction(state, actionId), {
    type: 'ORDER_INTENT_REJECTED',
    eventId: `${state.sessionId}:${actionId}:rejected`,
    eventTimeMs: mark.eventTimeMs,
    actionId,
    reason: `${code}:${reason}`,
  });
  return { state: recorded.state, accepted: false, events: [recorded.event], code, reason };
}

export function createMarginSession(input: { sessionId: string; careerEquityWei: bigint; episode: MarginEpisode }): MarginSessionState {
  assertMarginEpisode(input.episode);
  if (!input.sessionId) throw new RangeError('margin session identity is required');
  const collateral = careerEthToMarginUsdMicros(input.careerEquityWei, input.episode.startEthUsdPriceMicros);
  const first = input.episode.marks[0];
  let state: MarginSessionState = {
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
    reason: `${MARGIN_FX_MODEL_VERSION}:SYNTHETIC_BOOKKEEPING`,
  });
  state = opened.state;
  return state;
}

function currentMark(state: MarginSessionState, episode?: MarginEpisode): MarginMark {
  if (episode) return episode.marks[state.currentMarkIndex];
  return {
    markId: `${state.episodeId}:mark:${state.currentMarkIndex}`,
    eventTimeMs: state.events[state.events.length - 1]?.eventTimeMs ?? 0,
    priceUsdMicros: state.currentMarkPriceUsdMicros,
    sourceId: state.episodeId,
    provenance: 'DERIVED',
  };
}

function quoteForBase(quantityMicros: bigint, priceUsdMicros: bigint, rounding: Rounding = 'floor'): bigint {
  return mulDiv(quantityMicros, priceUsdMicros, USD_MICRO_SCALE, rounding);
}

function quantityForQuote(quoteUsdMicros: bigint, priceUsdMicros: bigint, rounding: Rounding = 'floor'): bigint {
  return mulDiv(quoteUsdMicros, USD_MICRO_SCALE, priceUsdMicros, rounding);
}

function bpsOf(value: bigint, rateBps: bigint, rounding: Rounding = 'ceil'): bigint {
  return mulDiv(value, rateBps, MARGIN_BPS_SCALE, rounding);
}

function longFillPrice(markPriceUsdMicros: bigint, slippageBps: bigint, opening: boolean): bigint {
  const factor = opening ? MARGIN_BPS_SCALE + slippageBps : MARGIN_BPS_SCALE - slippageBps;
  return mulDiv(markPriceUsdMicros, factor, MARGIN_BPS_SCALE, opening ? 'ceil' : 'floor');
}

export function estimateLongLiquidationPrice(position: MarginPosition, episode: MarginEpisode): bigint | null {
  const combined = episode.maintenanceMarginBps + episode.liquidationFeeBps;
  if (combined < 0n || combined >= MARGIN_BPS_SCALE || position.quantityMicros <= 0n) return null;
  const entryNotional = quoteForBase(position.quantityMicros, position.entryFillPriceUsdMicros, 'floor');
  const numerator = entryNotional - position.isolatedMarginUsdMicros + position.accruedFundingUsdMicros;
  if (numerator <= 0n) return null;
  const denominator = position.quantityMicros * (MARGIN_BPS_SCALE - combined);
  if (denominator <= 0n) return null;
  return mulDiv(numerator, USD_MICRO_SCALE * MARGIN_BPS_SCALE, denominator, 'ceil');
}

export function marginPositionSnapshot(state: MarginSessionState, episode: MarginEpisode, markPriceUsdMicros = state.currentMarkPriceUsdMicros): MarginPositionSnapshot | null {
  const position = state.position;
  if (!position) return null;
  const markNotional = quoteForBase(position.quantityMicros, markPriceUsdMicros, 'floor');
  const entryNotional = quoteForBase(position.quantityMicros, position.entryFillPriceUsdMicros, 'floor');
  const unrealized = markNotional - entryNotional;
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
    liquidationPriceUsdMicros: estimateLongLiquidationPrice(position, episode),
    netPnlAfterEntryFeeUsdMicros: netPnl,
    roeBps,
  };
}

function validateStop(position: MarginPosition, stopPriceUsdMicros: bigint, episode: MarginEpisode): MarginRejectCode | null {
  if (stopPriceUsdMicros <= 0n || stopPriceUsdMicros >= position.entryFillPriceUsdMicros) return 'INVALID_STOP';
  const liquidation = estimateLongLiquidationPrice(position, episode);
  if (liquidation !== null) {
    const buffered = mulDiv(liquidation, MARGIN_BPS_SCALE + MARGIN_STOP_LIQ_BUFFER_BPS, MARGIN_BPS_SCALE, 'ceil');
    if (stopPriceUsdMicros <= buffered) return 'STOP_TOO_CLOSE_TO_LIQUIDATION';
  }
  return null;
}

export function openMarginLong(
  state: MarginSessionState,
  episode: MarginEpisode,
  input: { actionId: string; marginUsdMicros: bigint; leverage: number; stopPriceUsdMicros?: bigint | null },
): MarginActionResult {
  const duplicated = duplicate(state, input.actionId);
  if (duplicated) return duplicated;
  if (state.closed) return reject(state, input.actionId, 'SESSION_CLOSED', 'the training episode is already closed');
  if (state.position) return reject(state, input.actionId, 'POSITION_ALREADY_OPEN', 'only one isolated position is allowed');
  if (input.leverage !== 1 && input.leverage !== 2) return reject(state, input.actionId, 'LEVERAGE_LIMIT', 'SIM_MARGIN_V0 authorizes 1x or 2x only');
  if (input.marginUsdMicros <= 0n) return reject(state, input.actionId, 'INVALID_MARGIN', 'isolated margin must be positive');
  const leverage = input.leverage as MarginLeverage;
  const mark = episode.marks[state.currentMarkIndex];
  const requestedNotional = input.marginUsdMicros * BigInt(leverage);
  const fillPrice = longFillPrice(mark.priceUsdMicros, episode.fillSlippageBps, true);
  const quantity = quantityForQuote(requestedNotional, fillPrice, 'floor');
  if (quantity <= 0n) return reject(state, input.actionId, 'MODEL_INPUT_UNAVAILABLE', 'entry quantity rounded to zero');
  const executedNotional = quoteForBase(quantity, fillPrice, 'floor');
  const entryFee = bpsOf(executedNotional, episode.takerFeeBps, 'ceil');
  if (input.marginUsdMicros + entryFee > state.freeCollateralUsdMicros) {
    return reject(state, input.actionId, 'INSUFFICIENT_COLLATERAL', 'isolated margin plus entry fee exceeds free collateral');
  }
  const position: MarginPosition = {
    positionId: `${state.sessionId}:p1`,
    side: 'LONG',
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
    const stopError = validateStop(position, position.stopPriceUsdMicros, episode);
    if (stopError) return reject(state, input.actionId, stopError, stopError === 'INVALID_STOP' ? 'long stop must be positive and below entry' : 'protective stop must remain above the liquidation safety buffer');
  }

  let next = withAction({
    ...state,
    freeCollateralUsdMicros: state.freeCollateralUsdMicros - input.marginUsdMicros - entryFee,
    position,
  }, input.actionId);
  const events: MarginEvent[] = [];
  for (const payload of [
    { type: 'MARGIN_ALLOCATED' as const, eventId: `${state.sessionId}:${input.actionId}:margin`, eventTimeMs: mark.eventTimeMs, actionId: input.actionId, amountUsdMicros: input.marginUsdMicros },
    { type: 'MARGIN_POSITION_OPENED' as const, eventId: `${state.sessionId}:${input.actionId}:opened`, eventTimeMs: mark.eventTimeMs, actionId: input.actionId, amountUsdMicros: executedNotional, priceUsdMicros: fillPrice },
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
    });
    next = recorded.state;
    events.push(recorded.event);
  }
  return { state: next, accepted: true, events };
}

export function placeMarginStop(state: MarginSessionState, episode: MarginEpisode, input: { actionId: string; stopPriceUsdMicros: bigint }): MarginActionResult {
  const duplicated = duplicate(state, input.actionId);
  if (duplicated) return duplicated;
  if (state.closed) return reject(state, input.actionId, 'SESSION_CLOSED', 'the training episode is already closed');
  const position = state.position;
  if (!position) return reject(state, input.actionId, 'NO_OPEN_POSITION', 'a stop requires an open isolated long');
  const stopError = validateStop(position, input.stopPriceUsdMicros, episode);
  if (stopError) return reject(state, input.actionId, stopError, stopError === 'INVALID_STOP' ? 'long stop must be positive and below entry' : 'protective stop must remain above the liquidation safety buffer');
  const replacing = position.stopPriceUsdMicros !== null;
  let next = withAction({ ...state, position: { ...position, stopPriceUsdMicros: input.stopPriceUsdMicros } }, input.actionId);
  const recorded = append(next, {
    type: replacing ? 'MARGIN_STOP_REPLACED' : 'MARGIN_STOP_PLACED',
    eventId: `${state.sessionId}:${input.actionId}:stop`,
    eventTimeMs: episode.marks[state.currentMarkIndex].eventTimeMs,
    actionId: input.actionId,
    priceUsdMicros: input.stopPriceUsdMicros,
  });
  next = recorded.state;
  return { state: next, accepted: true, events: [recorded.event] };
}

function applyFundingBetween(state: MarginSessionState, episode: MarginEpisode, fromTimeMs: number, toTimeMs: number): { state: MarginSessionState; events: MarginEvent[] } {
  let next = state;
  const events: MarginEvent[] = [];
  for (const funding of episode.funding) {
    if (funding.eventTimeMs <= fromTimeMs || funding.eventTimeMs > toTimeMs || next.appliedFundingIds.includes(funding.fundingId)) continue;
    if (!next.position) {
      next = { ...next, appliedFundingIds: [...next.appliedFundingIds, funding.fundingId] };
      continue;
    }
    const markNotional = quoteForBase(next.position.quantityMicros, funding.markPriceUsdMicros, 'floor');
    const amount = mulDiv(markNotional, funding.ratePpm, PPM_SCALE, 'half-up');
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
    });
    next = recorded.state;
    events.push(recorded.event);
  }
  return { state: next, events };
}

function closeAtMark(
  state: MarginSessionState,
  episode: MarginEpisode,
  input: { actionId: string; reason: MarginCloseReason; mark: MarginMark },
): MarginActionResult {
  const position = state.position;
  if (!position) return reject(state, input.actionId, 'NO_OPEN_POSITION', 'no isolated position is open');
  const slippage = input.reason === 'LIQUIDATION' ? episode.liquidationSlippageBps : episode.fillSlippageBps;
  const exitPrice = longFillPrice(input.mark.priceUsdMicros, slippage, false);
  const exitNotional = quoteForBase(position.quantityMicros, exitPrice, 'floor');
  const entryNotional = quoteForBase(position.quantityMicros, position.entryFillPriceUsdMicros, 'floor');
  const grossPnl = exitNotional - entryNotional;
  const exitFee = bpsOf(exitNotional, episode.takerFeeBps, 'ceil');
  const markNotional = quoteForBase(position.quantityMicros, input.mark.priceUsdMicros, 'floor');
  const liquidationFee = input.reason === 'LIQUIDATION' ? bpsOf(markNotional, episode.liquidationFeeBps, 'ceil') : 0n;
  const returnable = position.isolatedMarginUsdMicros + grossPnl - position.accruedFundingUsdMicros - exitFee - liquidationFee;
  const returned = returnable > 0n ? returnable : 0n;
  const netPnl = grossPnl - position.entryFeeUsdMicros - position.accruedFundingUsdMicros - exitFee - liquidationFee;
  const summary: MarginTradeSummary = {
    tradeId: position.positionId,
    episodeId: episode.episodeId,
    instrumentId: episode.instrumentId,
    side: 'LONG',
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
      type: 'LIQUIDATION_TRIGGERED',
      eventId: `${state.sessionId}:${input.actionId}:liq-trigger`,
      eventTimeMs: input.mark.eventTimeMs,
      actionId: input.actionId,
      priceUsdMicros: input.mark.priceUsdMicros,
    });
    next = triggered.state;
    events.push(triggered.event);
    const filled = append(next, {
      type: 'LIQUIDATION_FILLED',
      eventId: `${state.sessionId}:${input.actionId}:liq-fill`,
      eventTimeMs: input.mark.eventTimeMs,
      actionId: input.actionId,
      priceUsdMicros: exitPrice,
      amountUsdMicros: liquidationFee,
    });
    next = filled.state;
    events.push(filled.event);
  }
  const closed = append(next, {
    type: 'MARGIN_POSITION_CLOSED',
    eventId: `${state.sessionId}:${input.actionId}:closed`,
    eventTimeMs: input.mark.eventTimeMs,
    actionId: input.actionId,
    priceUsdMicros: exitPrice,
    amountUsdMicros: netPnl,
    reason: input.reason,
  });
  next = closed.state;
  events.push(closed.event);
  const sessionClosed = append(next, {
    type: 'MARGIN_SESSION_CLOSED',
    eventId: `${state.sessionId}:${input.actionId}:session-closed`,
    eventTimeMs: input.mark.eventTimeMs,
    actionId: input.actionId,
    amountUsdMicros: next.freeCollateralUsdMicros,
    reason: input.reason,
  });
  next = sessionClosed.state;
  events.push(sessionClosed.event);
  return { state: next, accepted: true, events };
}

export function closeMarginLong(state: MarginSessionState, episode: MarginEpisode, input: { actionId: string }): MarginActionResult {
  const duplicated = duplicate(state, input.actionId);
  if (duplicated) return duplicated;
  if (state.closed) return reject(state, input.actionId, 'SESSION_CLOSED', 'the training episode is already closed');
  if (!state.position) return reject(state, input.actionId, 'NO_OPEN_POSITION', 'no isolated position is open');
  return closeAtMark(state, episode, { actionId: input.actionId, reason: 'MANUAL', mark: episode.marks[state.currentMarkIndex] });
}

export function advanceMarginMark(state: MarginSessionState, episode: MarginEpisode, input: { actionId: string }): MarginActionResult {
  const duplicated = duplicate(state, input.actionId);
  if (duplicated) return duplicated;
  if (state.closed) return reject(state, input.actionId, 'SESSION_CLOSED', 'the training episode is already closed');
  if (state.currentMarkIndex >= episode.marks.length - 1) return reject(state, input.actionId, 'EPISODE_ENDED', 'no later historical mark exists');
  const previousMark = episode.marks[state.currentMarkIndex];
  const nextIndex = state.currentMarkIndex + 1;
  const mark = episode.marks[nextIndex];
  let next = withAction({ ...state, currentMarkIndex: nextIndex, currentMarkPriceUsdMicros: mark.priceUsdMicros }, input.actionId);
  const events: MarginEvent[] = [];
  const observed = append(next, {
    type: 'MARK_OBSERVED',
    eventId: `${state.sessionId}:${input.actionId}:mark:${mark.markId}`,
    eventTimeMs: mark.eventTimeMs,
    actionId: input.actionId,
    markId: mark.markId,
    priceUsdMicros: mark.priceUsdMicros,
  });
  next = observed.state;
  events.push(observed.event);
  const funded = applyFundingBetween(next, episode, previousMark.eventTimeMs, mark.eventTimeMs);
  next = funded.state;
  events.push(...funded.events);

  if (next.position) {
    const snapshot = marginPositionSnapshot(next, episode, mark.priceUsdMicros);
    if (!snapshot) return reject(next, `${input.actionId}:snapshot`, 'MODEL_INPUT_UNAVAILABLE', 'position snapshot could not be derived');
    // Frozen V0 ordering for a sampled mark that crosses both levels: liquidation
    // is evaluated first because mark-price maintenance authority has already
    // failed before a voluntary stop can be assumed to fill inside the gap.
    if (snapshot.positionEquityUsdMicros <= snapshot.maintenanceMarginUsdMicros + snapshot.liquidationFeeReserveUsdMicros) {
      const closed = closeAtMark(next, episode, { actionId: `${input.actionId}:liquidate`, reason: 'LIQUIDATION', mark });
      return { ...closed, events: [...events, ...closed.events] };
    }
    if (next.position.stopPriceUsdMicros !== null && mark.priceUsdMicros <= next.position.stopPriceUsdMicros) {
      const closed = closeAtMark(next, episode, { actionId: `${input.actionId}:stop`, reason: 'STOP', mark });
      return { ...closed, events: [...events, ...closed.events] };
    }
    if (nextIndex === episode.marks.length - 1) {
      const closed = closeAtMark(next, episode, { actionId: `${input.actionId}:episode-end`, reason: 'EPISODE_END', mark });
      return { ...closed, events: [...events, ...closed.events] };
    }
  } else if (nextIndex === episode.marks.length - 1) {
    const closedSession = append(next, {
      type: 'MARGIN_SESSION_CLOSED',
      eventId: `${state.sessionId}:${input.actionId}:empty-end`,
      eventTimeMs: mark.eventTimeMs,
      actionId: input.actionId,
      amountUsdMicros: next.freeCollateralUsdMicros,
      reason: 'EPISODE_END',
    });
    next = { ...closedSession.state, closed: true };
    events.push(closedSession.event);
  }
  return { state: next, accepted: true, events };
}

export function replayMarginActions(input: { sessionId: string; careerEquityWei: bigint; episode: MarginEpisode; actions: readonly MarginReplayAction[] }): MarginSessionState {
  let state = createMarginSession({ sessionId: input.sessionId, careerEquityWei: input.careerEquityWei, episode: input.episode });
  for (const action of input.actions) {
    let result: MarginActionResult;
    if (action.type === 'OPEN_LONG') result = openMarginLong(state, input.episode, action);
    else if (action.type === 'PLACE_STOP') result = placeMarginStop(state, input.episode, action);
    else if (action.type === 'ADVANCE') result = advanceMarginMark(state, input.episode, action);
    else result = closeMarginLong(state, input.episode, action);
    state = result.state;
  }
  return state;
}

export function serializeMarginState(state: MarginSessionState): string {
  return JSON.stringify(state, (_key, value) => typeof value === 'bigint' ? `${value.toString()}n` : value);
}
