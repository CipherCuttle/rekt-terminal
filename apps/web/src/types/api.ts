/**
 * Canonical truth taxonomy — CANONICAL_PROVENANCE_V1.
 *
 * Identical to `apps/api/src/types.ts` and `packages/sim`. There is no
 * `ESTIMATED` and there are no synonyms.
 */
export type ProvenanceState = 'CONFIRMED' | 'DERIVED' | 'SYNTHETIC' | 'STALE' | 'UNAVAILABLE';

/**
 * Data environment. LIVE is real current market evidence; DEMO is seeded
 * synthetic development data that must be chosen explicitly.
 */
export type MarketEnvironment = 'LIVE' | 'DEMO';

/** Denomination of a bar series. Always travels with the bars. */
export type ChartCurrency = 'USD' | 'QUOTE_TOKEN';

export type Provenance = { state: ProvenanceState; source: string; asOf: string; block?: number; method: string };

export type RadarAsset = {
  id: string;
  symbol: string;
  name: string;
  chainId: 57073;
  quote: string;
  venue: string;
  pairAddress: string;
  tokenAddress: string;
  baseTokenAddress?: string | null;
  quoteTokenAddress?: string | null;
  quoteIdentityResolved?: boolean;
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
};

export type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number };

/** Bars plus their denomination. Never pass bars around without this. */
export type BarSeries = {
  bars: Bar[];
  currency: ChartCurrency;
  currencyLabel: string;
  provenance?: Provenance;
};

export type PoolTrade = {
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
};

export type WalletTrace = {
  address: string;
  classifier: string;
  confidence: number | null;
  visibleValueUsd: number | null;
  eth: number | null;
  addressAgeDays: number | null;
  rektHeld: number | null;
  rektBought30d: number | null;
  rektSold30d: number | null;
  medianHold: string | null;
  longestHold: string | null;
  reasons: string[];
  provenance: Provenance;
};

export type StreamEnvelope = { type: string; seq: number; serverTime: number; payload: any };
