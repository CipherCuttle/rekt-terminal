import {
  MARGIN_INTRABAR_MODEL_VERSION,
  SIM_MARGIN_MODEL_VERSION,
  usdMicros,
  type MarginEpisode,
} from './margin-v0.js';

/**
 * First MARGIN//TRAINING episode.
 *
 * Market source observation:
 *   Binance ETHUSDT perpetual via TradeIdea, 2026-08-28 05:30 UTC
 *   O 2488.93 / H 2488.99 / L 2488.62 / C 2488.84
 *
 * The source exposes OHLC, not an authoritative tick ordering. SIM_MARGIN_V0
 * therefore freezes `OHLC_PATH_V0 = OPEN -> LOW -> HIGH -> CLOSE` and labels the
 * resulting ordered marks DERIVED. The 15-minute sub-times are deterministic
 * training anchors, not a claim that the venue printed the extrema then.
 *
 * Source URL frozen in docs/MARGIN_2X_V0.md. No funding timestamp lies inside
 * this short episode, so the immutable funding series is empty. Funding support
 * is still part of SIM_MARGIN_V0 and is covered by deterministic tests.
 */
export const ETHUSDT_PERP_TRAINING_20260828_0530: MarginEpisode = {
  episodeId: 'ETHUSDT_PERP_20260828_0530_OHLC_PATH_V0',
  instrumentId: 'ETHUSDT-PERP',
  sourceVenue: 'BINANCE',
  sourceLabel: 'BINANCE ETHUSDT PERPETUAL / TRADEIDEA MIRROR',
  startTimeMs: 1_787_895_000_000,
  endTimeMs: 1_787_897_700_000,
  startEthUsdPriceMicros: usdMicros('2488.93'),
  marks: [
    {
      markId: 'open',
      eventTimeMs: 1_787_895_000_000,
      priceUsdMicros: usdMicros('2488.93'),
      sourceId: 'TRADEIDEA:BINANCE:ETHUSDT:2026-08-28T05:30Z:OPEN',
      provenance: 'DERIVED',
    },
    {
      markId: 'low',
      eventTimeMs: 1_787_895_900_000,
      priceUsdMicros: usdMicros('2488.62'),
      sourceId: 'TRADEIDEA:BINANCE:ETHUSDT:2026-08-28T05:30Z:LOW',
      provenance: 'DERIVED',
    },
    {
      markId: 'high',
      eventTimeMs: 1_787_896_800_000,
      priceUsdMicros: usdMicros('2488.99'),
      sourceId: 'TRADEIDEA:BINANCE:ETHUSDT:2026-08-28T05:30Z:HIGH',
      provenance: 'DERIVED',
    },
    {
      markId: 'close',
      eventTimeMs: 1_787_897_700_000,
      priceUsdMicros: usdMicros('2488.84'),
      sourceId: 'TRADEIDEA:BINANCE:ETHUSDT:2026-08-28T05:30Z:CLOSE',
      provenance: 'DERIVED',
    },
  ],
  funding: [],
  // Venue-neutral training assumptions. These are simulator parameters, not a
  // claim about Binance's account-specific liquidation schedule.
  maintenanceMarginBps: 50n,
  takerFeeBps: 5n,
  liquidationFeeBps: 50n,
  fillSlippageBps: 5n,
  liquidationSlippageBps: 25n,
  marketProvenance: 'DERIVED',
  intrabarRule: MARGIN_INTRABAR_MODEL_VERSION,
  modelVersion: SIM_MARGIN_MODEL_VERSION,
};
