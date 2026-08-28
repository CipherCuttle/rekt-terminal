import type { SimEvent } from './events.js';

declare const weiBrand: unique symbol;
declare const priceBrand: unique symbol;
declare const quantityBrand: unique symbol;
declare const bpsBrand: unique symbol;

export type Wei = bigint & { readonly [weiBrand]: 'Wei' };
export type PriceX18 = bigint & { readonly [priceBrand]: 'PriceX18' };
export type QuantityAtoms = bigint & { readonly [quantityBrand]: 'QuantityAtoms' };
export type Bps = bigint & { readonly [bpsBrand]: 'Bps' };

export const wei = (value: bigint): Wei => value as Wei;
export const priceX18 = (value: bigint): PriceX18 => value as PriceX18;
export const quantityAtoms = (value: bigint): QuantityAtoms => value as QuantityAtoms;
export const bps = (value: bigint): Bps => value as Bps;

export const WEI_PER_ETH = wei(1_000_000_000_000_000_000n);
export const PRICE_SCALE = 1_000_000_000_000_000_000n;
export const BPS_SCALE = 10_000n;
export const INITIAL_BANKROLL_WEI = wei(500_000_000_000_000_000n);
export const DEFAULT_FIRST_TICKET_WEI = wei(50_000_000_000_000_000n);
export const SPOT_FILL_MODEL_VERSION = 'SPOT_FILL_V0';

export type ProvenanceState = 'CONFIRMED' | 'DERIVED' | 'SYNTHETIC' | 'STALE' | 'UNAVAILABLE';
export type SpotSide = 'BUY' | 'SELL';
export type PositionStatus = 'OPEN' | 'CLOSED';

export interface MarketObservation {
  observationId: string;
  instrumentId: string;
  quoteAsset: string;
  referencePriceX18: PriceX18;
  usableQuoteLiquidityWei: Wei;
  observedAtMs: number;
  sourceId: string;
  provenance: ProvenanceState;
}

export interface SpotFillConfig {
  feeBps: Bps;
  baseSlippageBps: Bps;
  impactCoefficientBpsPerParticipationBps: bigint;
  maxImpactBps: Bps;
  maxParticipationBps: Bps;
  maxObservationAgeMs: number;
  modelVersion: string;
}

export interface SpotFillRequest {
  fillId: string;
  intentId: string;
  side: SpotSide;
  observation: MarketObservation;
  requestedQuoteWei: Wei;
  requestedQuantityAtoms?: QuantityAtoms;
  executedAtMs: number;
  config: SpotFillConfig;
}

export interface SpotFill {
  fillId: string;
  intentId: string;
  side: SpotSide;
  instrumentId: string;
  quoteAsset: string;
  requestedQuoteWei: Wei;
  executedQuoteWei: Wei;
  quantityAtoms: QuantityAtoms;
  referencePriceX18: PriceX18;
  fillPriceX18: PriceX18;
  feeQuoteWei: Wei;
  feeBps: Bps;
  impactBps: Bps;
  observationId: string;
  observedAtMs: number;
  executedAtMs: number;
  sourceId: string;
  provenance: 'DERIVED';
  modelVersion: string;
}

export interface EntryFill {
  fillId: string;
  quantityAtoms: QuantityAtoms;
  fillPriceX18: PriceX18;
  costBasisWei: Wei;
  feeQuoteWei: Wei;
  executedAtMs: number;
}

export interface PositionState {
  status: PositionStatus;
  cycleId: string;
  instrumentId: string;
  quoteAsset: string;
  side: 'LONG';
  openedAtMs: number;
  openQuantityAtoms: QuantityAtoms;
  costBasisWei: Wei;
  remainingEntryFeesWei: Wei;
  averageEntryPriceX18: PriceX18;
  medianEntryPriceX18: PriceX18;
  entryFills: readonly EntryFill[];
  entryCount: number;
  exitCount: number;
  partialExitUsed: boolean;
}

export interface AccountState {
  freeEthWei: Wei;
  realizedPnlWei: Wei;
  unrealizedPnlWei: Wei;
  equityWei: Wei;
  highWaterEquityWei: Wei;
  maxDrawdownBps: Bps;
}

export interface TradeSummary {
  tradeId: string;
  sessionId: string;
  instrumentId: string;
  mode: 'SPOT';
  side: 'LONG';
  openedAtMs: number;
  closedAtMs: number;
  entryCount: number;
  exitCount: number;
  averageEntryPriceX18: PriceX18;
  medianEntryPriceX18: PriceX18;
  realizedPnlWei: Wei;
  entryFeesWei: Wei;
  exitFeesWei: Wei;
  fundingWei: Wei;
  accountEquityAtOpenWei: Wei;
  accountEquityAtCloseWei: Wei;
  lossBpsOfThenCurrentEquity: Bps;
  maxDrawdownBpsAtClose: Bps;
  partialExitUsed: boolean;
  stopUsed: boolean;
  stopWidened: boolean;
  liquidated: false;
  modelVersions: readonly string[];
}

export interface SimState {
  sessionId: string;
  modelVersion: string;
  startedAtMs: number;
  account: AccountState;
  position: PositionState | null;
  markPriceX18: PriceX18 | null;
  events: readonly SimEvent[];
  tradeSummaries: readonly TradeSummary[];
  appliedEventIds: readonly string[];
  appliedFillIds: readonly string[];
  lastSequence: number;
  closedCycleCount: number;
  cycleOpeningEquityWei: Wei | null;
  cycleRealizedPnlWei: Wei;
  cycleAllocatedEntryFeesWei: Wei;
  cycleExitFeesWei: Wei;
}

export type SimErrorCode =
  | 'INSUFFICIENT_BALANCE'
  | 'UNSUPPORTED_QUOTE'
  | 'STALE_MARKET'
  | 'MISSING_LIQUIDITY'
  | 'PARTICIPATION_LIMIT'
  | 'INVALID_QUANTITY'
  | 'INVALID_PRICE'
  | 'MODEL_INPUT_UNAVAILABLE'
  | 'POSITION_ALREADY_OPEN'
  | 'NO_OPEN_POSITION'
  | 'OVER_CLOSE_ATTEMPT'
  | 'OUT_OF_ORDER_EVENT'
  | 'DUPLICATE_EVENT'
  | 'INVALID_EVENT'
  | 'INVALID_TIME';

export class SimError extends Error {
  readonly code: SimErrorCode;

  constructor(code: SimErrorCode, message: string) {
    super(message);
    this.name = 'SimError';
    this.code = code;
  }
}
