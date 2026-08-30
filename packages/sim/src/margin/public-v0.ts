import {
  advanceMarginMark,
  closeMarginLong,
  createMarginSession,
  openMarginLong as openMarginLongUnsafe,
  placeMarginStop as placeMarginStopUnsafe,
  type MarginActionResult,
  type MarginEpisode,
  type MarginReplayAction,
  type MarginSessionState,
} from './margin-v0.js';

export {
  SIM_MARGIN_MODEL_VERSION,
  PERP_FILL_MODEL_VERSION,
  MARGIN_FX_MODEL_VERSION,
  MARGIN_INTRABAR_MODEL_VERSION,
  USD_MICRO_SCALE,
  ETH_WEI_SCALE,
  PPM_SCALE,
  MARGIN_BPS_SCALE,
  MARGIN_STOP_LIQ_BUFFER_BPS,
  usdMicros,
  formatUsdMicros,
  careerEthToMarginUsdMicros,
  assertMarginEpisode,
  createMarginSession,
  estimateLongLiquidationPrice,
  marginPositionSnapshot,
  closeMarginLong,
  advanceMarginMark,
  serializeMarginState,
  type MarginLeverage,
  type MarginMarketProvenance,
  type MarginCloseReason,
  type MarginRejectCode,
  type MarginMark,
  type MarginFundingEvent,
  type MarginEpisode,
  type MarginPosition,
  type MarginTradeSummary,
  type MarginEventType,
  type MarginEvent,
  type MarginSessionState,
  type MarginPositionSnapshot,
  type MarginActionResult,
  type MarginReplayAction,
} from './margin-v0.js';

/**
 * Public isolated-long entry gate.
 *
 * The fill model moves a BUY against the taker, so a stop can be below the
 * eventual fill but already above the current mark. Such a stop is not usable
 * protection: the market has already crossed it. Force the ordinary domain
 * rejection path instead of opening exposure behind a stale stop.
 */
export function openMarginLong(
  state: MarginSessionState,
  episode: MarginEpisode,
  input: { actionId: string; marginUsdMicros: bigint; leverage: number; stopPriceUsdMicros?: bigint | null },
): MarginActionResult {
  const currentMark = episode.marks[state.currentMarkIndex]?.priceUsdMicros ?? 0n;
  if (input.stopPriceUsdMicros !== undefined && input.stopPriceUsdMicros !== null && input.stopPriceUsdMicros >= currentMark) {
    const forced = openMarginLongUnsafe(state, episode, {
      ...input,
      // This deliberately violates the raw entry-side check so the rejection is
      // appended to the immutable margin event log with the real action id.
      stopPriceUsdMicros: currentMark * 2n,
    });
    return { ...forced, code: 'INVALID_STOP', reason: 'a long protective stop must be below the current mark before exposure opens' };
  }
  return openMarginLongUnsafe(state, episode, input);
}

/**
 * Public stop-replacement gate. A stop at/above the current mark has already
 * been crossed and cannot be treated as future protection.
 */
export function placeMarginStop(
  state: MarginSessionState,
  episode: MarginEpisode,
  input: { actionId: string; stopPriceUsdMicros: bigint },
): MarginActionResult {
  if (state.position && input.stopPriceUsdMicros >= state.currentMarkPriceUsdMicros) {
    const forced = placeMarginStopUnsafe(state, episode, {
      ...input,
      stopPriceUsdMicros: state.position.entryFillPriceUsdMicros,
    });
    return { ...forced, code: 'INVALID_STOP', reason: 'a long protective stop must remain below the current mark' };
  }
  return placeMarginStopUnsafe(state, episode, input);
}

/**
 * Replay is part of the public authority boundary, not a backdoor into the raw
 * engine. Every action is therefore folded through the exact same open/stop
 * gates used by interactive training so one action stream cannot produce a
 * different state merely because it was replayed.
 */
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
