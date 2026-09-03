export const EPISODE_SCHEMA_VERSION = 'EPISODES_V0' as const;
export const EPISODE_DIGEST_ALGORITHM = 'SHA-256' as const;
export const OHLC_PATH_V0 = 'OHLC_PATH_V0' as const;

export type EpisodeEnvironment = 'REPLAY' | 'EXAM';
export type EpisodeMarketType = 'SPOT' | 'PERP';
export type EpisodeProvenance = 'CONFIRMED' | 'DERIVED';
export type EpisodeRegimeTrend = 'UP' | 'DOWN' | 'RANGE' | 'MIXED' | 'UNKNOWN';
export type EpisodeRegimeVolatility = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
export type EpisodeRegimeLiquidity = 'THIN' | 'NORMAL' | 'DEEP' | 'UNKNOWN';

export interface EpisodeRegimeV0 {
  readonly trend?: EpisodeRegimeTrend;
  readonly volatility?: EpisodeRegimeVolatility;
  readonly liquidity?: EpisodeRegimeLiquidity;
}

export interface EpisodeMarketMarkSampleV0 {
  readonly kind: 'MARKET';
  readonly sampleId: string;
  readonly eventTimeMs: number;
  readonly sourceId: string;
  readonly provenance: EpisodeProvenance;
  readonly market: {
    readonly type: 'MARK';
    readonly priceUsdMicros: string;
  };
}

export interface EpisodeMarketBarSampleV0 {
  readonly kind: 'MARKET';
  readonly sampleId: string;
  readonly eventTimeMs: number;
  readonly sourceId: string;
  readonly provenance: EpisodeProvenance;
  readonly market: {
    readonly type: 'BAR';
    readonly openUsdMicros: string;
    readonly highUsdMicros: string;
    readonly lowUsdMicros: string;
    readonly closeUsdMicros: string;
    readonly volumeAtoms?: string;
  };
}

export type EpisodeMarketSampleV0 = EpisodeMarketMarkSampleV0 | EpisodeMarketBarSampleV0;

export interface EpisodeTradeReferenceSampleV0 {
  readonly kind: 'TRADE_REFERENCE';
  readonly sampleId: string;
  readonly eventTimeMs: number;
  readonly sourceId: string;
  readonly provenance: EpisodeProvenance;
  readonly referenceType: 'EXECUTION' | 'TRADE';
  readonly priceUsdMicros: string;
  readonly quantityAtoms?: string;
}

export interface EpisodeFundingSampleV0 {
  readonly kind: 'FUNDING';
  readonly sampleId: string;
  readonly fundingId: string;
  readonly eventTimeMs: number;
  readonly sourceId: string;
  readonly provenance: EpisodeProvenance;
  /** 1_000_000 ppm = 100%. Positive means a long pays. */
  readonly ratePpm: string;
  readonly markPriceUsdMicros: string;
}

export type EpisodeSampleV0 = EpisodeMarketSampleV0 | EpisodeTradeReferenceSampleV0 | EpisodeFundingSampleV0;

/** Fixed-point/integer simulator inputs are strings so JSON cannot round them. */
export type EpisodeSimulatorParametersV0 = Readonly<Record<string, string>>;

export interface EpisodeProvenanceSummaryV0 {
  readonly market: EpisodeProvenance;
  readonly funding?: EpisodeProvenance;
}

export interface EpisodeManifestV0 {
  readonly schemaVersion: typeof EPISODE_SCHEMA_VERSION;
  readonly episodeId: string;
  readonly episodeVersion: string;
  readonly environmentEligibility: readonly EpisodeEnvironment[];
  readonly instrumentId: string;
  readonly marketType: EpisodeMarketType;
  readonly sourceVenue: string;
  readonly sourceLabel: string;
  readonly sourceReference: string;
  readonly timeframe: string;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly provenance: EpisodeProvenanceSummaryV0;
  readonly marketDataModelVersion: string;
  readonly intrabarRule?: string;
  readonly simulatorModelVersions: readonly string[];
  readonly simulatorParameters: EpisodeSimulatorParametersV0;
  readonly sampleDigest: string;
  readonly fundingDigest?: string;
  readonly regime: EpisodeRegimeV0;
}

export interface EpisodeArtifactV0 {
  readonly manifest: EpisodeManifestV0;
  readonly samples: readonly EpisodeSampleV0[];
}

export type EpisodeManifestDraftV0 = Omit<EpisodeManifestV0, 'sampleDigest' | 'fundingDigest'> & {
  readonly sampleDigest?: never;
  readonly fundingDigest?: never;
};

export interface EpisodeArtifactDraftV0 {
  readonly manifest: EpisodeManifestDraftV0;
  readonly samples: readonly EpisodeSampleV0[];
}

export interface EpisodeLoadOptionsV0 {
  readonly expectedMarketDataModelVersion?: string;
  readonly expectedSimulatorModelVersions?: readonly string[];
}

export class EpisodeValidationError extends RangeError {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'EpisodeValidationError';
    this.code = code;
  }
}

export type EpisodeManifest = EpisodeManifestV0;
export type EpisodeSample = EpisodeSampleV0;
export type EpisodeArtifact = EpisodeArtifactV0;
