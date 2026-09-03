import {
  assertEpisodeArtifact,
  MARGIN_EPISODE_ARTIFACTS,
  type EpisodeArtifactV0,
  type EpisodeFundingSampleV0,
  type EpisodeMarketMarkSampleV0,
} from '@rekt-ink/episodes';
import {
  MARGIN_FX_MODEL_VERSION,
  MARGIN_INTRABAR_MODEL_VERSION,
  PERP_FILL_MODEL_VERSION,
  SIM_MARGIN_MODEL_VERSION,
  type MarginEpisode,
} from './margin-v0.js';

function parameter(artifact: EpisodeArtifactV0, key: string): bigint {
  const value = artifact.manifest.simulatorParameters[key];
  if (value === undefined) throw new RangeError(`episode simulator parameter is missing: ${key}`);
  return BigInt(value);
}

function marginEpisodeFromArtifact(artifact: EpisodeArtifactV0): MarginEpisode {
  assertEpisodeArtifact(artifact, {
    expectedMarketDataModelVersion: 'TRADEIDEA_OHLC_V0',
    expectedSimulatorModelVersions: [SIM_MARGIN_MODEL_VERSION, PERP_FILL_MODEL_VERSION, MARGIN_FX_MODEL_VERSION],
  });
  const marketSamples = artifact.samples.filter((sample): sample is EpisodeMarketMarkSampleV0 => sample.kind === 'MARKET' && sample.market.type === 'MARK');
  if (marketSamples.length !== artifact.samples.filter((sample) => sample.kind === 'MARKET').length) {
    throw new RangeError('SIM_MARGIN_V0 adapter only accepts ordered market mark samples');
  }
  const fundingSamples = artifact.samples.filter((sample): sample is EpisodeFundingSampleV0 => sample.kind === 'FUNDING');
  const { manifest } = artifact;
  const episode: MarginEpisode = {
    episodeId: manifest.episodeId,
    instrumentId: manifest.instrumentId,
    sourceVenue: manifest.sourceVenue,
    sourceLabel: manifest.sourceLabel,
    startTimeMs: manifest.startTimeMs,
    endTimeMs: manifest.endTimeMs,
    startEthUsdPriceMicros: parameter(artifact, 'startEthUsdPriceMicros'),
    marks: marketSamples.map((sample) => ({
      markId: sample.sampleId,
      eventTimeMs: sample.eventTimeMs,
      priceUsdMicros: BigInt(sample.market.priceUsdMicros),
      sourceId: sample.sourceId,
      provenance: sample.provenance,
    })),
    funding: fundingSamples.map((sample) => ({
      fundingId: sample.fundingId,
      eventTimeMs: sample.eventTimeMs,
      ratePpm: BigInt(sample.ratePpm),
      markPriceUsdMicros: BigInt(sample.markPriceUsdMicros),
      sourceId: sample.sourceId,
      provenance: sample.provenance,
    })),
    maintenanceMarginBps: parameter(artifact, 'maintenanceMarginBps'),
    takerFeeBps: parameter(artifact, 'takerFeeBps'),
    liquidationFeeBps: parameter(artifact, 'liquidationFeeBps'),
    fillSlippageBps: parameter(artifact, 'fillSlippageBps'),
    liquidationSlippageBps: parameter(artifact, 'liquidationSlippageBps'),
    marketProvenance: manifest.provenance.market,
    intrabarRule: manifest.intrabarRule as typeof MARGIN_INTRABAR_MODEL_VERSION,
    modelVersion: SIM_MARGIN_MODEL_VERSION,
  };
  return Object.freeze({
    ...episode,
    marks: Object.freeze(episode.marks.map((mark) => Object.freeze(mark))),
    funding: Object.freeze(episode.funding.map((event) => Object.freeze(event))),
  });
}

const [FIRST_MARGIN_EPISODE_ARTIFACT, SECOND_MARGIN_EPISODE_ARTIFACT] = MARGIN_EPISODE_ARTIFACTS;

/**
 * Compatibility exports for the simulator and the existing margin desk.
 * The source of truth is the verified immutable artifact in @rekt-ink/episodes;
 * this adapter only translates fixed-point strings back to the simulator's
 * established bigint execution structure.
 */
export const ETHUSDT_PERP_TRAINING_20260828_0530 = marginEpisodeFromArtifact(FIRST_MARGIN_EPISODE_ARTIFACT);
export const ETHUSDT_PERP_TRAINING_20260805_2055 = marginEpisodeFromArtifact(SECOND_MARGIN_EPISODE_ARTIFACT);

export const MARGIN_TRAINING_EPISODES = Object.freeze([
  ETHUSDT_PERP_TRAINING_20260828_0530,
  ETHUSDT_PERP_TRAINING_20260805_2055,
] as const);
