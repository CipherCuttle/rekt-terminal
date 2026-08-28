/**
 * Canonical truth taxonomy — CANONICAL_PROVENANCE_V1.
 *
 * Exactly five states, shared verbatim with `packages/sim`, `packages/career`
 * and the web app. `ESTIMATED` was removed in MARKET_TRUTH_V1: it had no
 * defined meaning, and in practice it labelled real aggregate provider data as
 * something weaker while labelling fabricated fixtures as something stronger.
 *
 *   CONFIRMED    direct evidence with identity strong enough to justify it
 *                (a swap with a transaction hash; a signed chain head)
 *   DERIVED      deterministic/aggregate calculation over observed inputs
 *                (a GeckoTerminal/Dexscreener pool snapshot; a simulator fill)
 *   SYNTHETIC    fabricated/demo/simulator-generated scenario evidence
 *   STALE        exceeded the freshness contract
 *   UNAVAILABLE  the evidence required for the claim does not exist
 *
 * Do not add synonyms.
 */
export type ProvenanceState = 'CONFIRMED' | 'DERIVED' | 'SYNTHETIC' | 'STALE' | 'UNAVAILABLE';

/**
 * Data environment.
 *
 * LIVE  = real current market evidence from external providers.
 * DEMO  = seeded synthetic development data. Explicitly selected, never
 *         reached by falling back from a failed LIVE request.
 */
export type MarketEnvironment = 'LIVE' | 'DEMO';

/** Denomination of a returned OHLCV series. Never implicit. */
export type ChartCurrency = 'USD' | 'QUOTE_TOKEN';

export interface Provenance {
  state: ProvenanceState;
  source: string;
  asOf: string;
  block?: number;
  method: string;
}

export interface RadarAsset {
  id: string;
  symbol: string;
  name: string;
  chainId: 57073;
  /** Quote asset symbol, from provider token identity — never parsed from `name`. */
  quote: string;
  venue: string;
  pairAddress: string;
  tokenAddress: string;
  /** Explicit provider token identity for the base side, when supplied. */
  baseTokenAddress: string | null;
  /** Explicit provider token identity for the quote side, when supplied. */
  quoteTokenAddress: string | null;
  /** True when the quote side was established from provider identity fields. */
  quoteIdentityResolved: boolean;
  verified: boolean;
  priceEth: number | null;
  priceUsd: number | null;
  change5m: number | null;
  change1h: number | null;
  change6h: number | null;
  buys: number | null;
  sells: number | null;
  buyers: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  fdvUsd: number | null;
  ageMinutes: number | null;
  heat: number | null;
  freshness: ProvenanceState;
  imageUrl?: string;
  provenance: Provenance;
}

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** OHLCV plus the denomination it is expressed in. The pair is inseparable. */
export interface OhlcvSeries {
  pair: string;
  currency: ChartCurrency;
  /** Human label for the denomination, e.g. `WETH` or `USD`. */
  currencyLabel: string;
  quoteTokenAddress: string | null;
  bars: Bar[];
  provenance: Provenance;
}

/** One recent pool trade. CONFIRMED only when transaction identity is present. */
export interface PoolTrade {
  id: string;
  side: string;
  txHash: string | null;
  wallet: string | null;
  priceUsd: number | null;
  priceQuoteToken: number | null;
  volumeUsd: number | null;
  blockNumber: number | null;
  at: string | null;
  provenance: Provenance;
}

export interface StreamEnvelope {
  type: string;
  seq: number;
  serverTime: number;
  payload: Record<string, unknown>;
}
