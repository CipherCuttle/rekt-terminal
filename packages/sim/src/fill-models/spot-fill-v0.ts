import {
  BPS_SCALE,
  SimError,
  SPOT_FILL_MODEL_VERSION,
  bps,
  priceX18,
  quantityAtoms,
  wei,
  type SpotFill,
  type SpotFillConfig,
  type SpotFillRequest,
} from '../types.js';
import { feeForQuote, mulDiv, participationBps, quantityForQuote, quoteForQuantity } from '../math.js';

export const DEFAULT_SPOT_FILL_CONFIG: SpotFillConfig = {
  feeBps: bps(30n),
  baseSlippageBps: bps(5n),
  impactCoefficientBpsPerParticipationBps: 1n,
  maxImpactBps: bps(1_000n),
  maxParticipationBps: bps(5_000n),
  maxObservationAgeMs: 30_000,
  modelVersion: SPOT_FILL_MODEL_VERSION,
};

function assertIdentity(request: SpotFillRequest): void {
  const { fillId, intentId, observation, config } = request;
  if (!fillId || !intentId || !observation.observationId || !observation.instrumentId || !observation.sourceId || !config.modelVersion) {
    throw new SimError('MODEL_INPUT_UNAVAILABLE', 'fill, intent, observation, source, and model identities are required');
  }
  if (!Number.isSafeInteger(request.executedAtMs) || request.executedAtMs < 0 || !Number.isSafeInteger(observation.observedAtMs) || observation.observedAtMs < 0) {
    throw new SimError('INVALID_TIME', 'fill and observation times must be non-negative safe integers');
  }
  if (request.executedAtMs < observation.observedAtMs || request.executedAtMs - observation.observedAtMs > config.maxObservationAgeMs) {
    throw new SimError('STALE_MARKET', 'market observation is outside the configured freshness window');
  }
}

function assertConfig(config: SpotFillConfig): void {
  if (config.modelVersion !== SPOT_FILL_MODEL_VERSION || config.feeBps < 0n || config.feeBps > BPS_SCALE || config.baseSlippageBps < 0n || config.impactCoefficientBpsPerParticipationBps < 0n || config.maxImpactBps < 0n || config.maxParticipationBps <= 0n || config.maxParticipationBps > BPS_SCALE || config.maxImpactBps >= BPS_SCALE || config.maxObservationAgeMs < 0 || !Number.isSafeInteger(config.maxObservationAgeMs)) {
    throw new SimError('MODEL_INPUT_UNAVAILABLE', 'invalid SPOT_FILL_V0 bounds');
  }
}

export function createSpotFill(request: SpotFillRequest): SpotFill {
  assertIdentity(request);
  assertConfig(request.config);
  const { observation, config } = request;

  if (!['ETH', 'WETH'].includes(observation.quoteAsset.toUpperCase())) {
    throw new SimError('UNSUPPORTED_QUOTE', 'spot practice requires an ETH or WETH quote');
  }
  if (observation.provenance === 'STALE' || observation.provenance === 'UNAVAILABLE' || observation.provenance === 'SYNTHETIC') {
    throw new SimError('MODEL_INPUT_UNAVAILABLE', 'spot fill requires confirmed or derived market evidence');
  }
  if (observation.referencePriceX18 <= 0n) throw new SimError('INVALID_PRICE', 'reference price must be positive');
  if (observation.usableQuoteLiquidityWei <= 0n) throw new SimError('MISSING_LIQUIDITY', 'usable quote liquidity is required');
  if (request.requestedQuoteWei <= 0n) throw new SimError('INVALID_QUANTITY', 'requested quote notional must be positive');
  if (request.side === 'SELL' && request.requestedQuantityAtoms !== undefined && request.requestedQuantityAtoms <= 0n) {
    throw new SimError('INVALID_QUANTITY', 'requested sell quantity must be positive');
  }

  const participation = participationBps(request.requestedQuoteWei, observation.usableQuoteLiquidityWei);
  if (participation > config.maxParticipationBps) throw new SimError('PARTICIPATION_LIMIT', 'requested participation exceeds the configured ceiling');

  const impact = config.baseSlippageBps + participation * config.impactCoefficientBpsPerParticipationBps;
  const impactBps = impact > config.maxImpactBps ? config.maxImpactBps : impact;
  const priceNumerator = BPS_SCALE + (request.side === 'BUY' ? impactBps : -impactBps);
  const fillPrice = priceX18(mulDiv(observation.referencePriceX18, priceNumerator, BPS_SCALE, request.side === 'BUY' ? 'ceil' : 'floor'));
  if (fillPrice <= 0n) throw new SimError('INVALID_PRICE', 'model produced a non-positive fill price');

  const quantity = request.side === 'SELL' && request.requestedQuantityAtoms !== undefined
    ? quantityAtoms(request.requestedQuantityAtoms)
    : quantityForQuote(request.requestedQuoteWei, fillPrice, 'floor');
  if (quantity <= 0n) throw new SimError('INVALID_QUANTITY', 'model produced a zero quantity');

  const executedQuote = quoteForQuantity(quantity, fillPrice, 'floor');
  if (executedQuote <= 0n) throw new SimError('INVALID_QUANTITY', 'model produced a zero quote notional');
  const fee = feeForQuote(executedQuote, config.feeBps, 'floor');

  return {
    fillId: request.fillId,
    intentId: request.intentId,
    side: request.side,
    instrumentId: observation.instrumentId,
    quoteAsset: observation.quoteAsset.toUpperCase(),
    requestedQuoteWei: wei(request.requestedQuoteWei),
    executedQuoteWei: wei(executedQuote),
    quantityAtoms: quantityAtoms(quantity),
    referencePriceX18: priceX18(observation.referencePriceX18),
    fillPriceX18: priceX18(fillPrice),
    feeQuoteWei: wei(fee),
    feeBps: bps(config.feeBps),
    impactBps: bps(impactBps),
    observationId: observation.observationId,
    observedAtMs: observation.observedAtMs,
    executedAtMs: request.executedAtMs,
    sourceId: observation.sourceId,
    provenance: 'DERIVED',
    modelVersion: config.modelVersion,
  };
}

export function makeFixtureObservation(overrides: Partial<import('../types.js').MarketObservation> = {}): import('../types.js').MarketObservation {
  return {
    observationId: 'fixture-observation-001',
    instrumentId: 'INK-ETH-SPOT',
    quoteAsset: 'WETH',
    referencePriceX18: priceX18(25_000_000_000_000_000n),
    usableQuoteLiquidityWei: wei(10_000_000_000_000_000_000n),
    observedAtMs: 1_700_000_000_000,
    sourceId: 'PHASE_0_FIXTURE',
    provenance: 'DERIVED',
    ...overrides,
  };
}
