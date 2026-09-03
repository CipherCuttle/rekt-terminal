import { canonicalEpisodeJson } from './serialization.js';
import { sha256Hex } from './sha256.js';
import {
  EPISODE_DIGEST_ALGORITHM,
  EPISODE_SCHEMA_VERSION,
  OHLC_PATH_V0,
  EpisodeValidationError,
  type EpisodeArtifactDraftV0,
  type EpisodeArtifactV0,
  type EpisodeEnvironment,
  type EpisodeFundingSampleV0,
  type EpisodeLoadOptionsV0,
  type EpisodeManifestV0,
  type EpisodeMarketSampleV0,
  type EpisodeProvenance,
  type EpisodeSampleV0,
} from './schema.js';

const DIGEST_PATTERN = /^SHA-256:[0-9a-f]{64}$/;
const INTEGER_PATTERN = /^(?:0|-?[1-9][0-9]*)$/;
const ENVIRONMENTS = new Set<EpisodeEnvironment>(['REPLAY', 'EXAM']);
const PROVENANCE = new Set<EpisodeProvenance>(['CONFIRMED', 'DERIVED']);
const INTRABAR_RULES = new Set<string>([OHLC_PATH_V0]);
const MARKET_TYPES = new Set(['SPOT', 'PERP']);
const REGIME_TREND = new Set(['UP', 'DOWN', 'RANGE', 'MIXED', 'UNKNOWN']);
const REGIME_VOLATILITY = new Set(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']);
const REGIME_LIQUIDITY = new Set(['THIN', 'NORMAL', 'DEEP', 'UNKNOWN']);

type UnknownRecord = Record<string, unknown>;
type NormalizedArtifact = { manifest: EpisodeManifestV0; samples: readonly EpisodeSampleV0[] };

function record(value: unknown, label: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new EpisodeValidationError('MALFORMED_OBJECT', `${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new EpisodeValidationError('MALFORMED_OBJECT', `${label} must be a plain object`);
  }
  return value as UnknownRecord;
}

function exactKeys(value: UnknownRecord, allowed: readonly string[], label: string): void {
  const accepted = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!accepted.has(key)) throw new EpisodeValidationError('UNKNOWN_FIELD', `${label}.${key} is not part of EPISODES_V0`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new EpisodeValidationError('MISSING_REQUIRED_FIELD', `${label} must be a non-empty string`);
  }
  return value;
}

function optionalText(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  return text(value, label);
}

function safeTime(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new EpisodeValidationError('INVALID_TIMESTAMP', `${label} must be a non-negative safe integer`);
  }
  return value;
}

function fixedInteger(value: unknown, label: string, positive = false): string {
  if (typeof value !== 'string' || !INTEGER_PATTERN.test(value)) {
    throw new EpisodeValidationError('MALFORMED_FIXED_POINT', `${label} must be a canonical integer string`);
  }
  try {
    const parsed = BigInt(value);
    if (positive ? parsed <= 0n : parsed < 0n) {
      throw new EpisodeValidationError('MALFORMED_FIXED_POINT', `${label} has an invalid sign`);
    }
  } catch (error) {
    if (error instanceof EpisodeValidationError) throw error;
    throw new EpisodeValidationError('MALFORMED_FIXED_POINT', `${label} is not parseable as an integer`);
  }
  return value;
}

function copyFrozen<T extends object>(value: T): T {
  return Object.freeze(value);
}

function normalizeSample(value: unknown): EpisodeSampleV0 {
  const sample = record(value, 'sample');
  const kind = text(sample.kind, 'sample.kind');
  if (kind === 'MARKET') {
    exactKeys(sample, ['kind', 'sampleId', 'eventTimeMs', 'sourceId', 'provenance', 'market'], 'market sample');
    const market = record(sample.market, 'sample.market');
    const marketType = text(market.type, 'sample.market.type');
    const common = {
      kind: 'MARKET' as const,
      sampleId: text(sample.sampleId, 'sample.sampleId'),
      eventTimeMs: safeTime(sample.eventTimeMs, 'sample.eventTimeMs'),
      sourceId: text(sample.sourceId, 'sample.sourceId'),
      provenance: normalizeProvenance(sample.provenance, 'sample.provenance'),
    };
    if (marketType === 'MARK') {
      exactKeys(market, ['type', 'priceUsdMicros'], 'market mark');
      return copyFrozen({ ...common, market: copyFrozen({ type: 'MARK' as const, priceUsdMicros: fixedInteger(market.priceUsdMicros, 'sample.market.priceUsdMicros', true) }) });
    }
    if (marketType === 'BAR') {
      exactKeys(market, ['type', 'openUsdMicros', 'highUsdMicros', 'lowUsdMicros', 'closeUsdMicros', 'volumeAtoms'], 'market bar');
      const open = fixedInteger(market.openUsdMicros, 'sample.market.openUsdMicros', true);
      const high = fixedInteger(market.highUsdMicros, 'sample.market.highUsdMicros', true);
      const low = fixedInteger(market.lowUsdMicros, 'sample.market.lowUsdMicros', true);
      const close = fixedInteger(market.closeUsdMicros, 'sample.market.closeUsdMicros', true);
      const openValue = BigInt(open);
      const highValue = BigInt(high);
      const lowValue = BigInt(low);
      const closeValue = BigInt(close);
      if (highValue < openValue || highValue < lowValue || highValue < closeValue || lowValue > openValue || lowValue > closeValue) {
        throw new EpisodeValidationError('INVALID_BAR', 'bar high/low bounds do not contain open and close');
      }
      const volume = market.volumeAtoms === undefined ? undefined : fixedInteger(market.volumeAtoms, 'sample.market.volumeAtoms');
      return copyFrozen({
        ...common,
        market: copyFrozen({ type: 'BAR' as const, openUsdMicros: open, highUsdMicros: high, lowUsdMicros: low, closeUsdMicros: close, ...(volume === undefined ? {} : { volumeAtoms: volume }) }),
      });
    }
    throw new EpisodeValidationError('UNSUPPORTED_SAMPLE', `unknown market sample type ${marketType}`);
  }
  if (kind === 'TRADE_REFERENCE') {
    exactKeys(sample, ['kind', 'sampleId', 'eventTimeMs', 'sourceId', 'provenance', 'referenceType', 'priceUsdMicros', 'quantityAtoms'], 'trade reference sample');
    const referenceType = text(sample.referenceType, 'sample.referenceType');
    if (referenceType !== 'EXECUTION' && referenceType !== 'TRADE') throw new EpisodeValidationError('UNSUPPORTED_SAMPLE', `unknown trade reference type ${referenceType}`);
    const quantity = sample.quantityAtoms === undefined ? undefined : fixedInteger(sample.quantityAtoms, 'sample.quantityAtoms', true);
    return copyFrozen({
      kind: 'TRADE_REFERENCE' as const,
      sampleId: text(sample.sampleId, 'sample.sampleId'),
      eventTimeMs: safeTime(sample.eventTimeMs, 'sample.eventTimeMs'),
      sourceId: text(sample.sourceId, 'sample.sourceId'),
      provenance: normalizeProvenance(sample.provenance, 'sample.provenance'),
      referenceType,
      priceUsdMicros: fixedInteger(sample.priceUsdMicros, 'sample.priceUsdMicros', true),
      ...(quantity === undefined ? {} : { quantityAtoms: quantity }),
    });
  }
  if (kind === 'FUNDING') {
    exactKeys(sample, ['kind', 'sampleId', 'fundingId', 'eventTimeMs', 'sourceId', 'provenance', 'ratePpm', 'markPriceUsdMicros'], 'funding sample');
    return copyFrozen({
      kind: 'FUNDING' as const,
      sampleId: text(sample.sampleId, 'sample.sampleId'),
      fundingId: text(sample.fundingId, 'sample.fundingId'),
      eventTimeMs: safeTime(sample.eventTimeMs, 'sample.eventTimeMs'),
      sourceId: text(sample.sourceId, 'sample.sourceId'),
      provenance: normalizeProvenance(sample.provenance, 'sample.provenance'),
      ratePpm: fixedInteger(sample.ratePpm, 'sample.ratePpm'),
      markPriceUsdMicros: fixedInteger(sample.markPriceUsdMicros, 'sample.markPriceUsdMicros', true),
    });
  }
  throw new EpisodeValidationError('UNSUPPORTED_SAMPLE', `unknown sample kind ${kind}`);
}

function normalizeProvenance(value: unknown, label: string): EpisodeProvenance {
  if (typeof value !== 'string' || !PROVENANCE.has(value as EpisodeProvenance)) {
    throw new EpisodeValidationError('UNSUPPORTED_PROVENANCE', `${label} must be CONFIRMED or DERIVED`);
  }
  return value as EpisodeProvenance;
}

function normalizeManifest(value: unknown, requireDigest: boolean): EpisodeManifestV0 {
  const input = record(value, 'manifest');
  exactKeys(input, [
    'schemaVersion', 'episodeId', 'episodeVersion', 'environmentEligibility', 'instrumentId', 'marketType',
    'sourceVenue', 'sourceLabel', 'sourceReference', 'timeframe', 'startTimeMs', 'endTimeMs', 'provenance',
    'marketDataModelVersion', 'intrabarRule', 'simulatorModelVersions', 'simulatorParameters', 'sampleDigest',
    'fundingDigest', 'regime',
  ], 'manifest');
  if (input.schemaVersion !== EPISODE_SCHEMA_VERSION) throw new EpisodeValidationError('UNKNOWN_SCHEMA_VERSION', 'only EPISODES_V0 artifacts are supported');
  const environmentEligibility = input.environmentEligibility;
  if (!Array.isArray(environmentEligibility) || environmentEligibility.length === 0) throw new EpisodeValidationError('INVALID_ELIGIBILITY', 'at least one environment eligibility is required');
  const environments = environmentEligibility.map((environment, index) => {
    if (typeof environment !== 'string' || !ENVIRONMENTS.has(environment as EpisodeEnvironment)) throw new EpisodeValidationError('INVALID_ELIGIBILITY', `environmentEligibility[${index}] is unsupported`);
    return environment as EpisodeEnvironment;
  });
  if (new Set(environments).size !== environments.length) throw new EpisodeValidationError('INVALID_ELIGIBILITY', 'environment eligibility must not contain duplicates');
  const marketType = input.marketType;
  if (typeof marketType !== 'string' || !MARKET_TYPES.has(marketType)) throw new EpisodeValidationError('UNSUPPORTED_MARKET_TYPE', 'marketType must be SPOT or PERP');
  const startTimeMs = safeTime(input.startTimeMs, 'manifest.startTimeMs');
  const endTimeMs = safeTime(input.endTimeMs, 'manifest.endTimeMs');
  if (endTimeMs <= startTimeMs) throw new EpisodeValidationError('INVALID_TIMESTAMP_BOUNDS', 'endTimeMs must be after startTimeMs');
  const provenanceInput = record(input.provenance, 'manifest.provenance');
  exactKeys(provenanceInput, ['market', 'funding'], 'manifest.provenance');
  const fundingProvenance = provenanceInput.funding === undefined ? undefined : normalizeProvenance(provenanceInput.funding, 'manifest.provenance.funding');
  const modelVersions = input.simulatorModelVersions;
  if (!Array.isArray(modelVersions) || modelVersions.length === 0) throw new EpisodeValidationError('INCOMPATIBLE_MODEL', 'at least one simulator model version is required');
  const simulatorModelVersions = modelVersions.map((version, index) => text(version, `manifest.simulatorModelVersions[${index}]`));
  if (new Set(simulatorModelVersions).size !== simulatorModelVersions.length) throw new EpisodeValidationError('INCOMPATIBLE_MODEL', 'simulator model versions must be unique');
  const parameterInput = record(input.simulatorParameters, 'manifest.simulatorParameters');
  const simulatorParameters: Record<string, string> = {};
  for (const key of Object.keys(parameterInput)) {
    if (key.trim().length === 0) throw new EpisodeValidationError('MALFORMED_FIXED_POINT', 'simulator parameter keys must be non-empty');
    simulatorParameters[key] = fixedInteger(parameterInput[key], `manifest.simulatorParameters.${key}`);
  }
  const regimeInput = record(input.regime, 'manifest.regime');
  exactKeys(regimeInput, ['trend', 'volatility', 'liquidity'], 'manifest.regime');
  const trend = regimeInput.trend === undefined ? undefined : text(regimeInput.trend, 'manifest.regime.trend');
  const volatility = regimeInput.volatility === undefined ? undefined : text(regimeInput.volatility, 'manifest.regime.volatility');
  const liquidity = regimeInput.liquidity === undefined ? undefined : text(regimeInput.liquidity, 'manifest.regime.liquidity');
  if (trend !== undefined && !REGIME_TREND.has(trend)) throw new EpisodeValidationError('INVALID_REGIME', `unsupported trend ${trend}`);
  if (volatility !== undefined && !REGIME_VOLATILITY.has(volatility)) throw new EpisodeValidationError('INVALID_REGIME', `unsupported volatility ${volatility}`);
  if (liquidity !== undefined && !REGIME_LIQUIDITY.has(liquidity)) throw new EpisodeValidationError('INVALID_REGIME', `unsupported liquidity ${liquidity}`);
  const intrabarRule = optionalText(input.intrabarRule, 'manifest.intrabarRule');
  if (intrabarRule !== undefined && !INTRABAR_RULES.has(intrabarRule)) throw new EpisodeValidationError('UNKNOWN_INTRABAR_RULE', `unsupported intrabar rule ${intrabarRule}`);
  const sampleDigest = input.sampleDigest === undefined ? '' : text(input.sampleDigest, 'manifest.sampleDigest');
  const fundingDigest = input.fundingDigest === undefined ? undefined : text(input.fundingDigest, 'manifest.fundingDigest');
  if (requireDigest && !DIGEST_PATTERN.test(sampleDigest)) throw new EpisodeValidationError('MALFORMED_DIGEST', 'sampleDigest must use SHA-256:<64 lowercase hex>');
  if (fundingDigest !== undefined && !DIGEST_PATTERN.test(fundingDigest)) throw new EpisodeValidationError('MALFORMED_DIGEST', 'fundingDigest must use SHA-256:<64 lowercase hex>');

  return copyFrozen({
    schemaVersion: EPISODE_SCHEMA_VERSION,
    episodeId: text(input.episodeId, 'manifest.episodeId'),
    episodeVersion: text(input.episodeVersion, 'manifest.episodeVersion'),
    environmentEligibility: copyFrozen(environments),
    instrumentId: text(input.instrumentId, 'manifest.instrumentId'),
    marketType: marketType as 'SPOT' | 'PERP',
    sourceVenue: text(input.sourceVenue, 'manifest.sourceVenue'),
    sourceLabel: text(input.sourceLabel, 'manifest.sourceLabel'),
    sourceReference: text(input.sourceReference, 'manifest.sourceReference'),
    timeframe: text(input.timeframe, 'manifest.timeframe'),
    startTimeMs,
    endTimeMs,
    provenance: copyFrozen({ market: normalizeProvenance(provenanceInput.market, 'manifest.provenance.market'), ...(fundingProvenance === undefined ? {} : { funding: fundingProvenance }) }),
    marketDataModelVersion: text(input.marketDataModelVersion, 'manifest.marketDataModelVersion'),
    ...(intrabarRule === undefined ? {} : { intrabarRule }),
    simulatorModelVersions: copyFrozen(simulatorModelVersions),
    simulatorParameters: copyFrozen(simulatorParameters),
    sampleDigest,
    ...(fundingDigest === undefined ? {} : { fundingDigest }),
    regime: copyFrozen({ ...(trend === undefined ? {} : { trend: trend as 'UP' | 'DOWN' | 'RANGE' | 'MIXED' | 'UNKNOWN' }), ...(volatility === undefined ? {} : { volatility: volatility as 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' }), ...(liquidity === undefined ? {} : { liquidity: liquidity as 'THIN' | 'NORMAL' | 'DEEP' | 'UNKNOWN' }) }),
  });
}

function sampleRank(sample: EpisodeSampleV0): number {
  if (sample.kind === 'MARKET') return 0;
  if (sample.kind === 'TRADE_REFERENCE') return 1;
  return 2;
}

function compareSamples(left: EpisodeSampleV0, right: EpisodeSampleV0): number {
  if (left.eventTimeMs !== right.eventTimeMs) return left.eventTimeMs < right.eventTimeMs ? -1 : 1;
  const leftRank = sampleRank(left);
  const rightRank = sampleRank(right);
  if (leftRank !== rightRank) return leftRank < rightRank ? -1 : 1;
  return left.sampleId < right.sampleId ? -1 : left.sampleId > right.sampleId ? 1 : 0;
}

function aggregateProvenance(samples: readonly EpisodeSampleV0[]): EpisodeProvenance {
  return samples.some((sample) => sample.provenance === 'DERIVED') ? 'DERIVED' : 'CONFIRMED';
}

function digestMaterial(artifact: { manifest: EpisodeManifestV0; samples: readonly EpisodeSampleV0[] }): unknown {
  const { sampleDigest: _sampleDigest, fundingDigest: _fundingDigest, ...manifest } = artifact.manifest;
  return { manifest, samples: artifact.samples };
}

export function computeEpisodeDigest(artifact: { manifest: EpisodeManifestV0; samples: readonly EpisodeSampleV0[] }): string {
  return `${EPISODE_DIGEST_ALGORITHM}:${sha256Hex(canonicalEpisodeJson(digestMaterial(artifact)))}`;
}

export function computeFundingDigest(artifact: { manifest: EpisodeManifestV0; samples: readonly EpisodeSampleV0[] }): string | undefined {
  const funding = artifact.samples.filter((sample): sample is EpisodeFundingSampleV0 => sample.kind === 'FUNDING');
  if (funding.length === 0) return undefined;
  return `${EPISODE_DIGEST_ALGORITHM}:${sha256Hex(canonicalEpisodeJson({ episodeId: artifact.manifest.episodeId, episodeVersion: artifact.manifest.episodeVersion, funding }))}`;
}

function normalizeArtifact(input: unknown, requireDigest: boolean): NormalizedArtifact {
  const artifact = record(input, 'episode artifact');
  exactKeys(artifact, ['manifest', 'samples'], 'episode artifact');
  const manifest = normalizeManifest(artifact.manifest, requireDigest);
  if (!Array.isArray(artifact.samples) || artifact.samples.length === 0) throw new EpisodeValidationError('EMPTY_SAMPLE_STREAM', 'episode requires at least one sample');
  const samples = artifact.samples.map(normalizeSample);
  const sampleIds = new Set<string>();
  for (const sample of samples) {
    if (sampleIds.has(sample.sampleId)) throw new EpisodeValidationError('DUPLICATE_SAMPLE_ID', `duplicate sample ID ${sample.sampleId}`);
    sampleIds.add(sample.sampleId);
    if (sample.eventTimeMs < manifest.startTimeMs || sample.eventTimeMs > manifest.endTimeMs) throw new EpisodeValidationError('SAMPLE_OUT_OF_BOUNDS', `${sample.sampleId} lies outside episode bounds`);
  }
  for (let index = 1; index < samples.length; index += 1) {
    if (compareSamples(samples[index - 1], samples[index]) >= 0) throw new EpisodeValidationError('UNORDERED_SAMPLE_STREAM', 'samples must be strictly ordered by event time, kind, and sample ID');
  }
  const marketSamples = samples.filter((sample): sample is EpisodeMarketSampleV0 => sample.kind === 'MARKET');
  if (marketSamples.length === 0) throw new EpisodeValidationError('MISSING_MARKET_STREAM', 'episode requires at least one market sample');
  const hasBar = marketSamples.some((sample) => sample.market.type === 'BAR');
  if ((hasBar || /OHLC/i.test(manifest.marketDataModelVersion)) && manifest.intrabarRule === undefined) {
    throw new EpisodeValidationError('MISSING_INTRABAR_RULE', 'OHLC-derived ordering requires an intrabar rule');
  }
  if (manifest.provenance.market !== aggregateProvenance(samples.filter((sample) => sample.kind !== 'FUNDING'))) {
    throw new EpisodeValidationError('PROVENANCE_SUMMARY_MISMATCH', 'manifest market provenance cannot strengthen or weaken sample provenance');
  }
  const funding = samples.filter((sample): sample is EpisodeFundingSampleV0 => sample.kind === 'FUNDING');
  if (funding.length > 0) {
    if (manifest.provenance.funding !== aggregateProvenance(funding)) throw new EpisodeValidationError('PROVENANCE_SUMMARY_MISMATCH', 'manifest funding provenance does not match funding samples');
    if (requireDigest && manifest.fundingDigest === undefined) throw new EpisodeValidationError('MISSING_FUNDING_DIGEST', 'funding samples require fundingDigest');
  } else if (manifest.provenance.funding !== undefined || manifest.fundingDigest !== undefined) {
    throw new EpisodeValidationError('UNEXPECTED_FUNDING_METADATA', 'funding metadata requires at least one funding sample');
  }
  const normalized: NormalizedArtifact = { manifest, samples: copyFrozen(samples) };
  if (requireDigest) {
    if (manifest.sampleDigest !== computeEpisodeDigest(normalized)) throw new EpisodeValidationError('DIGEST_MISMATCH', 'sampleDigest does not match normalized manifest and sample content');
    if (manifest.fundingDigest !== computeFundingDigest(normalized)) throw new EpisodeValidationError('FUNDING_DIGEST_MISMATCH', 'fundingDigest does not match the ordered funding series');
  }
  return normalized;
}

function deepFreezeArtifact(artifact: NormalizedArtifact): EpisodeArtifactV0 {
  return copyFrozen({ manifest: artifact.manifest, samples: artifact.samples });
}

export function createEpisodeArtifact(input: EpisodeArtifactDraftV0): EpisodeArtifactV0 {
  const base = normalizeArtifact(input, false);
  const sampleDigest = computeEpisodeDigest(base);
  const fundingDigest = computeFundingDigest(base);
  return deepFreezeArtifact(normalizeArtifact({
    manifest: { ...base.manifest, sampleDigest, ...(fundingDigest === undefined ? {} : { fundingDigest }) },
    samples: base.samples,
  }, true));
}

/** Validate an artifact without exposing a mutable normalized copy. */
export function assertEpisodeArtifact(input: unknown, options: EpisodeLoadOptionsV0 = {}): void {
  const normalized = normalizeArtifact(input, true);
  if (options.expectedMarketDataModelVersion !== undefined && normalized.manifest.marketDataModelVersion !== options.expectedMarketDataModelVersion) {
    throw new EpisodeValidationError('INCOMPATIBLE_MODEL', `expected market data model ${options.expectedMarketDataModelVersion}`);
  }
  for (const expected of options.expectedSimulatorModelVersions ?? []) {
    if (!normalized.manifest.simulatorModelVersions.includes(expected)) throw new EpisodeValidationError('INCOMPATIBLE_MODEL', `simulator model ${expected} is not declared by the episode`);
  }
}

export interface EpisodeCursor {
  readonly availableSamples: readonly EpisodeSampleV0[];
  readonly currentTimeMs: number;
  readonly isComplete: boolean;
  advance(): EpisodeCursor;
}

class EpisodeCursorImpl implements EpisodeCursor {
  #samples: readonly EpisodeSampleV0[];
  #position: number;

  constructor(samples: readonly EpisodeSampleV0[], position = 0) {
    this.#samples = samples;
    this.#position = position;
  }

  get availableSamples(): readonly EpisodeSampleV0[] {
    return copyFrozen(this.#samples.slice(0, this.#position + 1));
  }

  get currentTimeMs(): number {
    return this.#samples[this.#position].eventTimeMs;
  }

  get isComplete(): boolean {
    return this.#position === this.#samples.length - 1;
  }

  advance(): EpisodeCursor {
    if (this.isComplete) throw new EpisodeValidationError('EPISODE_EXHAUSTED', 'episode cursor is already at the final sample');
    return new EpisodeCursorImpl(this.#samples, this.#position + 1);
  }
}

export interface LoadedEpisode {
  readonly manifest: EpisodeManifestV0;
  start(environment?: EpisodeEnvironment): EpisodeCursor;
}

class LoadedEpisodeImpl implements LoadedEpisode {
  #artifact: EpisodeArtifactV0;

  constructor(artifact: EpisodeArtifactV0) {
    this.#artifact = artifact;
  }

  get manifest(): EpisodeManifestV0 {
    return this.#artifact.manifest;
  }

  start(environment?: EpisodeEnvironment): EpisodeCursor {
    if (environment !== undefined && !this.manifest.environmentEligibility.includes(environment)) {
      throw new EpisodeValidationError('INELIGIBLE_ENVIRONMENT', `${environment} is not declared as eligible for this episode`);
    }
    return new EpisodeCursorImpl(this.#artifact.samples);
  }
}

export function loadEpisode(input: unknown, options: EpisodeLoadOptionsV0 = {}): LoadedEpisode {
  const normalized = normalizeArtifact(input, true);
  if (options.expectedMarketDataModelVersion !== undefined && normalized.manifest.marketDataModelVersion !== options.expectedMarketDataModelVersion) {
    throw new EpisodeValidationError('INCOMPATIBLE_MODEL', `expected market data model ${options.expectedMarketDataModelVersion}`);
  }
  for (const expected of options.expectedSimulatorModelVersions ?? []) {
    if (!normalized.manifest.simulatorModelVersions.includes(expected)) throw new EpisodeValidationError('INCOMPATIBLE_MODEL', `simulator model ${expected} is not declared by the episode`);
  }
  return new LoadedEpisodeImpl(deepFreezeArtifact(normalized));
}

export { canonicalEpisodeJson };
