import { createEpisodeArtifact } from './episode.js';
import type { EpisodeArtifactV0, EpisodeArtifactDraftV0 } from './schema.js';

const SOURCE_REFERENCE = 'https://tradeidea.io/en/contract/binance/ethusdt';
const SIMULATOR_MODELS = ['SIM_MARGIN_V0', 'PERP_FILL_V0', 'MARGIN_FX_V0'] as const;

function marginParameters(startEthUsdPriceMicros: string): Readonly<Record<string, string>> {
  return {
    startEthUsdPriceMicros,
    maintenanceMarginBps: '50',
    takerFeeBps: '5',
    liquidationFeeBps: '50',
    fillSlippageBps: '5',
    liquidationSlippageBps: '25',
  };
}

/** Canonical source artifact for the existing first margin training episode. */
const FIRST_MARGIN_EPISODE: EpisodeArtifactDraftV0 = {
  manifest: {
    schemaVersion: 'EPISODES_V0',
    episodeId: 'ETHUSDT_PERP_20260828_0530_OHLC_PATH_V0',
    episodeVersion: 'V0',
    environmentEligibility: ['REPLAY', 'EXAM'],
    instrumentId: 'ETHUSDT-PERP',
    marketType: 'PERP',
    sourceVenue: 'BINANCE',
    sourceLabel: 'BINANCE ETHUSDT PERPETUAL / TRADEIDEA MIRROR',
    sourceReference: SOURCE_REFERENCE,
    timeframe: '15m',
    startTimeMs: 1_787_895_000_000,
    endTimeMs: 1_787_897_700_000,
    provenance: { market: 'DERIVED' },
    marketDataModelVersion: 'TRADEIDEA_OHLC_V0',
    intrabarRule: 'OHLC_PATH_V0',
    simulatorModelVersions: SIMULATOR_MODELS,
    simulatorParameters: marginParameters('2488930000'),
    regime: { trend: 'RANGE', volatility: 'LOW', liquidity: 'NORMAL' },
  },
  samples: [
    { kind: 'MARKET', sampleId: 'open', eventTimeMs: 1_787_895_000_000, sourceId: 'TRADEIDEA:BINANCE:ETHUSDT:2026-08-28T05:30Z:OPEN', provenance: 'DERIVED', market: { type: 'MARK', priceUsdMicros: '2488930000' } },
    { kind: 'MARKET', sampleId: 'low', eventTimeMs: 1_787_895_900_000, sourceId: 'TRADEIDEA:BINANCE:ETHUSDT:2026-08-28T05:30Z:LOW', provenance: 'DERIVED', market: { type: 'MARK', priceUsdMicros: '2488620000' } },
    { kind: 'MARKET', sampleId: 'high', eventTimeMs: 1_787_896_800_000, sourceId: 'TRADEIDEA:BINANCE:ETHUSDT:2026-08-28T05:30Z:HIGH', provenance: 'DERIVED', market: { type: 'MARK', priceUsdMicros: '2488990000' } },
    { kind: 'MARKET', sampleId: 'close', eventTimeMs: 1_787_897_700_000, sourceId: 'TRADEIDEA:BINANCE:ETHUSDT:2026-08-28T05:30Z:CLOSE', provenance: 'DERIVED', market: { type: 'MARK', priceUsdMicros: '2488840000' } },
  ],
};

/** Canonical source artifact for the existing second margin training episode. */
const SECOND_MARGIN_EPISODE: EpisodeArtifactDraftV0 = {
  manifest: {
    schemaVersion: 'EPISODES_V0',
    episodeId: 'ETHUSDT_PERP_20260805_2055_OHLC_PATH_V0',
    episodeVersion: 'V0',
    environmentEligibility: ['REPLAY', 'EXAM'],
    instrumentId: 'ETHUSDT-PERP',
    marketType: 'PERP',
    sourceVenue: 'BINANCE',
    sourceLabel: 'BINANCE ETHUSDT PERPETUAL / TRADEIDEA MIRROR',
    sourceReference: SOURCE_REFERENCE,
    timeframe: '1m',
    startTimeMs: 1_785_963_300_000,
    endTimeMs: 1_785_963_480_000,
    provenance: { market: 'DERIVED' },
    marketDataModelVersion: 'TRADEIDEA_OHLC_V0',
    intrabarRule: 'OHLC_PATH_V0',
    simulatorModelVersions: SIMULATOR_MODELS,
    simulatorParameters: marginParameters('1919990000'),
    regime: { trend: 'DOWN', volatility: 'LOW', liquidity: 'NORMAL' },
  },
  samples: [
    { kind: 'MARKET', sampleId: 'open', eventTimeMs: 1_785_963_300_000, sourceId: 'TRADEIDEA:BINANCE:ETHUSDT:2026-08-05T20:55Z:OPEN', provenance: 'DERIVED', market: { type: 'MARK', priceUsdMicros: '1919990000' } },
    { kind: 'MARKET', sampleId: 'low', eventTimeMs: 1_785_963_360_000, sourceId: 'TRADEIDEA:BINANCE:ETHUSDT:2026-08-05T20:55Z:LOW', provenance: 'DERIVED', market: { type: 'MARK', priceUsdMicros: '1916820000' } },
    { kind: 'MARKET', sampleId: 'high', eventTimeMs: 1_785_963_420_000, sourceId: 'TRADEIDEA:BINANCE:ETHUSDT:2026-08-05T20:55Z:HIGH', provenance: 'DERIVED', market: { type: 'MARK', priceUsdMicros: '1919990000' } },
    { kind: 'MARKET', sampleId: 'close', eventTimeMs: 1_785_963_480_000, sourceId: 'TRADEIDEA:BINANCE:ETHUSDT:2026-08-05T20:55Z:CLOSE', provenance: 'DERIVED', market: { type: 'MARK', priceUsdMicros: '1917000000' } },
  ],
};

function freezeFixture(draft: EpisodeArtifactDraftV0, sampleDigest: string): EpisodeArtifactV0 {
  const artifact = createEpisodeArtifact(draft);
  if (artifact.manifest.sampleDigest !== sampleDigest) {
    throw new Error(`fixture digest changed for ${draft.manifest.episodeId}`);
  }
  return artifact;
}

export const ETHUSDT_PERP_EPISODE_20260828_0530: EpisodeArtifactV0 = freezeFixture(
  FIRST_MARGIN_EPISODE,
  'SHA-256:1e3418a0f3360ca1f46b8dcbaa7c30e998e8b45df3dd919854aef72d8bc925dd',
);
export const ETHUSDT_PERP_EPISODE_20260805_2055: EpisodeArtifactV0 = freezeFixture(
  SECOND_MARGIN_EPISODE,
  'SHA-256:47b38d4833cd2ef58e4e3a89f336114c0040e3383435c2cb06d8171540f6044f',
);

export const MARGIN_EPISODE_ARTIFACTS = Object.freeze([
  ETHUSDT_PERP_EPISODE_20260828_0530,
  ETHUSDT_PERP_EPISODE_20260805_2055,
] as const);
