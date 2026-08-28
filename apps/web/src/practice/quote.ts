/**
 * Market-data adapter.
 *
 * Converts loosely-typed feed/Radar rows into the narrow, explicitly-scaled
 * `PracticeQuote` the simulator adapter is willing to look at. Nothing here
 * touches simulator state; it only decides what evidence exists.
 */
import { mulDiv, parseFixed, priceX18, wei, type PriceX18, type ProvenanceState, type Wei } from '@rekt-ink/sim';
import type { Provenance, ProvenanceState as WebProvenanceState, RadarAsset } from '../types/api';

/** Quote assets that Ink spot practice is enabled for. */
export const SUPPORTED_QUOTE_ASSETS: readonly string[] = ['ETH', 'WETH'];

export interface PracticeQuote {
  /** Stable economic identity of the instrument, independent of display symbol. */
  instrumentId: string;
  symbol: string;
  name: string;
  venue: string;
  pairAddress: string;
  tokenAddress: string;
  quoteAsset: string;
  priceEth: number | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  observedAtMs: number;
  sourceId: string;
  provenance: ProvenanceState;
  /** Monotonic per-instrument counter; makes each observation identity unique. */
  sequence: number;
}

/**
 * The web provenance vocabulary carries `ESTIMATED`, which the simulator does
 * not accept as economic evidence. It maps to `SYNTHETIC` so it fails closed.
 */
export function toSimProvenance(state: WebProvenanceState): ProvenanceState {
  switch (state) {
    case 'CONFIRMED':
      return 'CONFIRMED';
    case 'DERIVED':
      return 'DERIVED';
    case 'ESTIMATED':
      return 'SYNTHETIC';
    case 'STALE':
      return 'STALE';
    default:
      return 'UNAVAILABLE';
  }
}

/** Largest double we will convert without exponent notation creeping in. */
const MAX_CONVERTIBLE = 1e21;

/**
 * Deterministic double -> 1e18 fixed point. `toFixed(18)` gives the exact
 * decimal expansion of the double, so the same input always yields the same
 * bigint. Returns null rather than guessing when the value is unusable.
 */
export function priceX18FromNumber(value: number | null | undefined): PriceX18 | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= MAX_CONVERTIBLE) return null;
  try {
    const scaled = parseFixed(value.toFixed(18), 18);
    return scaled > 0n ? priceX18(scaled) : null;
  } catch {
    return null;
  }
}

function usdMicros(value: number | null | undefined): bigint | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= MAX_CONVERTIBLE) return null;
  try {
    const scaled = parseFixed(value.toFixed(6), 6);
    return scaled > 0n ? scaled : null;
  } catch {
    return null;
  }
}

/**
 * Usable quote liquidity in wei, derived from the USD liquidity figure and the
 * pair's own USD/ETH prices:
 *
 *   liquidityWei = liquidityUsdMicros * priceEthX18 / priceUsdMicros
 *
 * Returns null when the evidence to derive it is absent — the caller then fails
 * closed with MISSING_LIQUIDITY rather than inventing a depth number.
 */
export function usableLiquidityWei(quote: PracticeQuote): Wei | null {
  const liquidity = usdMicros(quote.liquidityUsd);
  const priceUsd = usdMicros(quote.priceUsd);
  const priceEth = priceX18FromNumber(quote.priceEth);
  if (liquidity === null || priceUsd === null || priceEth === null) return null;
  const derived = mulDiv(liquidity, priceEth, priceUsd, 'floor');
  return derived > 0n ? wei(derived) : null;
}

export function instrumentIdForPair(pairAddress: string): string {
  return `INK:${pairAddress.toLowerCase()}`;
}

function provenanceAtMs(provenance: Provenance, fallbackMs: number): number {
  const parsed = Date.parse(provenance.asOf);
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

/**
 * Snapshot a Radar row as a practice quote. Used before any live tick arrives.
 *
 * `observedAtMsOverride` exists for fixture mode, where the row carries a frozen
 * replay timestamp rather than a wall-clock observation. The source id still
 * says it is a fixture, so nothing is relabelled as live evidence.
 */
export function quoteFromRadarAsset(
  asset: RadarAsset,
  nowMs: number,
  sequence = 0,
  observedAtMsOverride?: number,
): PracticeQuote {
  return {
    instrumentId: instrumentIdForPair(asset.pairAddress),
    symbol: asset.symbol,
    name: asset.name,
    venue: asset.venue,
    pairAddress: asset.pairAddress,
    tokenAddress: asset.tokenAddress,
    quoteAsset: asset.quote.toUpperCase(),
    priceEth: asset.priceEth,
    priceUsd: asset.priceUsd,
    liquidityUsd: asset.liquidityUsd,
    observedAtMs: observedAtMsOverride ?? Math.min(provenanceAtMs(asset.provenance, nowMs), nowMs),
    sourceId: asset.provenance.source,
    provenance: toSimProvenance(asset.provenance.state),
    sequence,
  };
}

/** Apply a live tick on top of the instrument's base identity. */
export function quoteWithTick(
  base: PracticeQuote,
  tick: { priceEth: number | null; priceUsd: number | null; observedAtMs: number; sourceId: string; provenance: ProvenanceState },
  sequence: number,
): PracticeQuote {
  return {
    ...base,
    priceEth: tick.priceEth,
    priceUsd: tick.priceUsd ?? base.priceUsd,
    observedAtMs: tick.observedAtMs,
    sourceId: tick.sourceId,
    provenance: tick.provenance,
    sequence,
  };
}
