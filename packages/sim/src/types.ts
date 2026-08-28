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

/**
 * Whether a session is allowed to execute against fabricated market evidence.
 *
 * `LIVE_ONLY` is the default and the normal product posture: the simulator
 * refuses SYNTHETIC observations outright. `DEMO_ALLOW_SYNTHETIC` is the
 * explicit DEMO session policy — it exists so development/testing can exercise
 * the simulator against seeded data, and every trade it produces is stamped
 * SYNTHETIC so Career refuses to grade it.
 *
 * This is a per-session opt-in. It never widens the LIVE gate globally.
 */
export type EvidencePolicy = 'LIVE_ONLY' | 'DEMO_ALLOW_SYNTHETIC';

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
  /** Session evidence gate; omitted means the strict LIVE_ONLY default. */
  evidencePolicy?: EvidencePolicy;
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
  /**
   * The fill itself is always a DERIVED model output (`SPOT_FILL_V0`); this is
   * the provenance of the *market observation* it was computed from, kept so a
   * fill can never be read as stronger evidence than its own input.
   */
  observationProvenance: ProvenanceState;
  provenance: 'DERIVED';
  modelVersion: string;
  exitReason?: 'MANUAL' | 'STOP' | 'PROTECT_CAPITAL';
  stopPriceX18?: PriceX18;
  stopTriggeredAtMs?: number;
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
  exitReason: 'MANUAL' | 'STOP' | 'PROTECT_CAPITAL';
  stopPriceX18: PriceX18 | null;
  stopTriggeredAtMs: number | null;
  stopUsed: boolean;
  stopWidened: boolean;
  liquidated: false;
  /**
   * Weakest market-evidence provenance across every fill in this trade cycle.
   * Career refuses to advance qualification from anything that is not
   * CONFIRMED or DERIVED, which is what keeps DEMO out of real progression.
   */
  evidenceProvenance: ProvenanceState;
  modelVersions: readonly string[];
}

export interface ActiveStop {
  stopId: string;
  cycleId: string;
  instrumentId: string;
  quoteAsset: string;
  stopPriceX18: PriceX18;
  placedAtMs: number;
  placedObservationId: string;
  sourceId: string;
}

export interface SimState {
  sessionId: string;
  modelVersion: string;
  /** Session-scoped evidence gate; defaults to LIVE_ONLY. */
  evidencePolicy: EvidencePolicy;
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
  /** Weakest observation provenance seen so far in the open cycle. */
  cycleEvidenceProvenance: ProvenanceState | null;
  activeStop: ActiveStop | null;
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
  | 'INVALID_TIME'
  | 'STOP_INVALID_SIDE'
  | 'STOP_NOT_TRIGGERED'
  | 'SYNTHETIC_EVIDENCE_REJECTED';

export class SimError extends Error {
  readonly code: SimErrorCode;

  constructor(code: SimErrorCode, message: string) {
    super(message);
    this.name = 'SimError';
    this.code = code;
  }
}
