/**
 * Fail-closed practice gate.
 *
 * Every trading control in the terminal is downstream of this function. If it
 * does not return SUPPORTED, no simulator intent is constructed, no mark is
 * applied, and the UI shows PRACTICE_UNAVAILABLE_V0 with the reason.
 *
 * The checks mirror the simulator's own rejection codes deliberately: the UI
 * must never offer an action the domain would refuse.
 */
import {
  DEFAULT_SPOT_FILL_CONFIG,
  type EvidencePolicy,
  type MarketObservation,
  type ProvenanceState,
} from '@rekt-ink/sim';
import {
  SUPPORTED_QUOTE_ASSETS,
  isEthEquivalentQuoteAddress,
  priceX18FromNumber,
  usableLiquidityWei,
  type PracticeQuote,
} from './quote';

export const PRACTICE_UNAVAILABLE_LABEL = 'PRACTICE_UNAVAILABLE_V0';

export type PracticeBlockCode =
  | 'UNSUPPORTED_QUOTE'
  | 'QUOTE_IDENTITY_UNRESOLVED'
  | 'MODEL_INPUT_UNAVAILABLE'
  | 'SYNTHETIC_EVIDENCE'
  | 'INVALID_PRICE'
  | 'MISSING_LIQUIDITY'
  | 'STALE_MARKET';

export interface PracticeSupported {
  status: 'SUPPORTED';
  observation: MarketObservation;
  ageMs: number;
  truthLabel: ProvenanceState;
}

export interface PracticeBlocked {
  status: 'BLOCKED';
  code: PracticeBlockCode;
  detail: string;
  truthLabel: ProvenanceState;
}

export type PracticeEligibility = PracticeSupported | PracticeBlocked;

/** Provenance states the simulator will accept as economic evidence. */
const USABLE_PROVENANCE: readonly ProvenanceState[] = ['CONFIRMED', 'DERIVED'];

export const MAX_OBSERVATION_AGE_MS = DEFAULT_SPOT_FILL_CONFIG.maxObservationAgeMs;

export interface PracticeEligibilityOptions {
  maxAgeMs?: number;
  /**
   * Session evidence gate. Defaults to the strict LIVE posture, in which
   * SYNTHETIC evidence is refused. A DEMO session opts in explicitly, which
   * lets fabricated data exercise the simulator while every resulting trade
   * stays stamped SYNTHETIC and ungradable by Career.
   */
  evidencePolicy?: EvidencePolicy;
}

export function evaluatePracticeEligibility(
  quote: PracticeQuote,
  nowMs: number,
  options: PracticeEligibilityOptions = {},
): PracticeEligibility {
  const maxAgeMs = options.maxAgeMs ?? MAX_OBSERVATION_AGE_MS;
  const evidencePolicy: EvidencePolicy = options.evidencePolicy ?? 'LIVE_ONLY';
  const blocked = (code: PracticeBlockCode, detail: string, truthLabel: ProvenanceState = quote.provenance): PracticeBlocked => ({
    status: 'BLOCKED',
    code,
    detail,
    truthLabel,
  });

  // Quote eligibility is decided from provider token identity. A pool whose
  // quote side could not be identified is refused rather than guessed at, and
  // the pool's display name is never consulted.
  // `undefined` means the quote never went through identity resolution, which
  // is treated as unresolved rather than trusted.
  if (quote.quoteIdentityResolved !== true) {
    return blocked('QUOTE_IDENTITY_UNRESOLVED', 'The quote token for this pool could not be identified from provider data, so practice is not offered.');
  }
  const ethEquivalentByAddress = isEthEquivalentQuoteAddress(quote.quoteTokenAddress);
  if (!ethEquivalentByAddress && !SUPPORTED_QUOTE_ASSETS.includes(quote.quoteAsset.toUpperCase())) {
    return blocked('UNSUPPORTED_QUOTE', `Spot practice requires an ETH or WETH quote; this pair quotes ${quote.quoteAsset.toUpperCase()}.`);
  }
  if (quote.provenance === 'SYNTHETIC') {
    // Named separately from MODEL_INPUT_UNAVAILABLE so DEMO reads as "this is
    // fabricated data", not "the feed is broken".
    if (evidencePolicy !== 'DEMO_ALLOW_SYNTHETIC') {
      return blocked('SYNTHETIC_EVIDENCE', 'This is synthetic data. It cannot enter LIVE economic execution.');
    }
  } else if (!USABLE_PROVENANCE.includes(quote.provenance)) {
    return blocked('MODEL_INPUT_UNAVAILABLE', `Market evidence is ${quote.provenance}; practice needs CONFIRMED or DERIVED input.`);
  }

  const referencePriceX18 = priceX18FromNumber(quote.priceEth);
  if (referencePriceX18 === null) {
    return blocked('INVALID_PRICE', 'No usable ETH reference price for this pair.');
  }

  const usableQuoteLiquidityWei = usableLiquidityWei(quote);
  if (usableQuoteLiquidityWei === null) {
    return blocked('MISSING_LIQUIDITY', 'Usable ETH-denominated depth cannot be derived from the available evidence.');
  }

  // The simulator refuses an execution time before its observation time, and
  // refuses anything older than the freshness window. Both fail here first.
  const ageMs = nowMs - quote.observedAtMs;
  if (ageMs < 0) {
    return blocked('STALE_MARKET', 'Market observation is timestamped ahead of the session clock.', 'STALE');
  }
  if (ageMs > maxAgeMs) {
    return blocked('STALE_MARKET', `Last usable observation is ${Math.round(ageMs / 1000)}s old; the limit is ${Math.round(maxAgeMs / 1000)}s.`, 'STALE');
  }

  return {
    status: 'SUPPORTED',
    ageMs,
    truthLabel: quote.provenance,
    observation: {
      observationId: `${quote.instrumentId}:${quote.sequence}`,
      instrumentId: quote.instrumentId,
      // The simulator's own quote check is symbol based; an address-verified
      // ETH-equivalent quote is normalised to WETH so identity, not the
      // provider's display symbol, is what reaches the economic layer.
      quoteAsset: ethEquivalentByAddress ? 'WETH' : quote.quoteAsset.toUpperCase(),
      referencePriceX18,
      usableQuoteLiquidityWei,
      observedAtMs: quote.observedAtMs,
      sourceId: quote.sourceId,
      provenance: quote.provenance,
    },
  };
}
