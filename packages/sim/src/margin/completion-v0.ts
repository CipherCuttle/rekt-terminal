import { mulDiv } from '../math.js';
import {
  MARGIN_BPS_SCALE,
  USD_MICRO_SCALE,
  type MarginEpisode,
  type MarginSessionState,
} from './margin-v0.js';
import type { ShortMarginSessionState } from './short-v0.js';

export const SHORT_QUALIFICATION_RISK_LIMIT_BPS = 500n;

export interface MarginEpisodeCompletion {
  completionId: string;
  sessionId: string;
  episodeId: string;
  tradeId: string;
  side: 'LONG' | 'SHORT';
  leverage: 1 | 2;
  closeReason: 'MANUAL' | 'STOP' | 'LIQUIDATION' | 'EPISODE_END';
  liquidated: boolean;
  protectiveStopUsed: boolean;
  /** Entry-time stop plan only. null means no verifiable stop plan at entry. */
  plannedMaxAccountRiskBps: bigint | null;
  marketProvenance: 'CONFIRMED' | 'DERIVED';
  simulationProvenance: 'SYNTHETIC';
  modelVersion: 'SIM_MARGIN_V0';
}

function quoteForBase(quantityMicros: bigint, priceUsdMicros: bigint, rounding: 'floor' | 'ceil'): bigint {
  return mulDiv(quantityMicros, priceUsdMicros, USD_MICRO_SCALE, rounding);
}

function fee(value: bigint, bps: bigint): bigint {
  return mulDiv(value, bps, MARGIN_BPS_SCALE, 'ceil');
}

function plannedRiskBps(totalLossUsdMicros: bigint, initialCollateralUsdMicros: bigint): bigint | null {
  if (initialCollateralUsdMicros <= 0n) return null;
  const loss = totalLossUsdMicros > 0n ? totalLossUsdMicros : 0n;
  return mulDiv(loss, MARGIN_BPS_SCALE, initialCollateralUsdMicros, 'ceil');
}

function entryTimeStop(state: MarginSessionState | ShortMarginSessionState, openedAtMs: number): bigint | null {
  const opened = state.events.find((event) => event.type === 'MARGIN_POSITION_OPENED' && event.eventTimeMs === openedAtMs);
  if (!opened?.actionId) return null;
  const stop = state.events.find((event) => event.type === 'MARGIN_STOP_PLACED' && event.actionId === opened.actionId && event.eventTimeMs === openedAtMs);
  return stop?.priceUsdMicros ?? null;
}

/**
 * Freeze the process fact Career needs for SHORT qualification from a completed
 * LONG simulator state. Later stop placement never retroactively becomes an
 * entry-time risk plan.
 */
export function deriveLongMarginCompletion(state: MarginSessionState, episode: MarginEpisode): MarginEpisodeCompletion | null {
  const trade = state.lastTrade;
  if (!state.closed || !trade || trade.side !== 'LONG' || trade.episodeId !== episode.episodeId) return null;
  const stop = entryTimeStop(state, trade.openedAtMs);
  let riskBps: bigint | null = null;
  if (stop !== null) {
    const stopExitPrice = mulDiv(stop, MARGIN_BPS_SCALE - episode.fillSlippageBps, MARGIN_BPS_SCALE, 'floor');
    const entryNotional = quoteForBase(trade.quantityMicros, trade.entryPriceUsdMicros, 'floor');
    const stopNotional = quoteForBase(trade.quantityMicros, stopExitPrice, 'floor');
    const grossLoss = entryNotional > stopNotional ? entryNotional - stopNotional : 0n;
    const expectedExitFee = fee(stopNotional, episode.takerFeeBps);
    riskBps = plannedRiskBps(grossLoss + trade.entryFeeUsdMicros + expectedExitFee, state.initialCollateralUsdMicros);
  }
  return {
    completionId: `${state.sessionId}:${episode.episodeId}:completion`,
    sessionId: state.sessionId,
    episodeId: episode.episodeId,
    tradeId: trade.tradeId,
    side: 'LONG',
    leverage: trade.leverage,
    closeReason: trade.closeReason,
    liquidated: trade.liquidated,
    protectiveStopUsed: trade.protectiveStopUsed,
    plannedMaxAccountRiskBps: riskBps,
    marketProvenance: trade.marketProvenance,
    simulationProvenance: 'SYNTHETIC',
    modelVersion: 'SIM_MARGIN_V0',
  };
}

/** Symmetric completion receipt for SHORT replay/review. It does not unlock SHORT. */
export function deriveShortMarginCompletion(state: ShortMarginSessionState, episode: MarginEpisode): MarginEpisodeCompletion | null {
  const trade = state.lastTrade;
  if (!state.closed || !trade || trade.side !== 'SHORT' || trade.episodeId !== episode.episodeId) return null;
  const stop = entryTimeStop(state, trade.openedAtMs);
  let riskBps: bigint | null = null;
  if (stop !== null) {
    const stopExitPrice = mulDiv(stop, MARGIN_BPS_SCALE + episode.fillSlippageBps, MARGIN_BPS_SCALE, 'ceil');
    const entryNotional = quoteForBase(trade.quantityMicros, trade.entryPriceUsdMicros, 'floor');
    const stopNotional = quoteForBase(trade.quantityMicros, stopExitPrice, 'ceil');
    const grossLoss = stopNotional > entryNotional ? stopNotional - entryNotional : 0n;
    const expectedExitFee = fee(stopNotional, episode.takerFeeBps);
    riskBps = plannedRiskBps(grossLoss + trade.entryFeeUsdMicros + expectedExitFee, state.initialCollateralUsdMicros);
  }
  return {
    completionId: `${state.sessionId}:${episode.episodeId}:completion`,
    sessionId: state.sessionId,
    episodeId: episode.episodeId,
    tradeId: trade.tradeId,
    side: 'SHORT',
    leverage: trade.leverage,
    closeReason: trade.closeReason,
    liquidated: trade.liquidated,
    protectiveStopUsed: trade.protectiveStopUsed,
    plannedMaxAccountRiskBps: riskBps,
    marketProvenance: trade.marketProvenance,
    simulationProvenance: 'SYNTHETIC',
    modelVersion: 'SIM_MARGIN_V0',
  };
}
