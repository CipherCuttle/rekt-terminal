import { SimError, type EvidencePolicy, type MarketObservation, type SpotFillConfig } from './types.js';

/**
 * Shared observation gate.
 *
 * Every surface that consumes a `MarketObservation` — spot execution, stop
 * placement, risk planning — must agree on what counts as usable evidence, so
 * the checks live in exactly one place. Extracted from `spot.ts` when
 * `RISK_PLAN_V0` became a second caller; the rules are unchanged.
 */
export function assertUsableObservation(
  observation: MarketObservation,
  eventTimeMs: number,
  config: SpotFillConfig,
  policy: EvidencePolicy = 'LIVE_ONLY',
): void {
  if (!observation.observationId || !observation.instrumentId || !observation.sourceId) {
    throw new SimError('MODEL_INPUT_UNAVAILABLE', 'market observation identity is required');
  }
  if (observation.provenance === 'STALE' || observation.provenance === 'UNAVAILABLE') {
    throw new SimError('MODEL_INPUT_UNAVAILABLE', 'this action requires confirmed or derived evidence');
  }
  if (observation.provenance === 'SYNTHETIC' && policy !== 'DEMO_ALLOW_SYNTHETIC') {
    throw new SimError('SYNTHETIC_EVIDENCE_REJECTED', 'synthetic market evidence cannot enter LIVE economic execution');
  }
  if (observation.referencePriceX18 <= 0n) throw new SimError('INVALID_PRICE', 'market price must be positive');
  if (
    !Number.isSafeInteger(eventTimeMs)
    || eventTimeMs < observation.observedAtMs
    || eventTimeMs - observation.observedAtMs > config.maxObservationAgeMs
  ) {
    throw new SimError('STALE_MARKET', 'market observation is outside the configured freshness window');
  }
}
