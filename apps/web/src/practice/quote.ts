/**
 * Market-data adapter.
 *
 * Converts loosely-typed feed/Radar rows into the narrow, explicitly-scaled
 * `PracticeQuote` the simulator adapter is willing to look at. Nothing here
 * touches simulator state; it only decides what evidence exists.
 */
import { mulDiv, parseFixed, priceX18, wei, type PriceX18, type ProvenanceState, type Wei } from '@rekt-ink/sim';
import type { Provenance, RadarAsset } from '../types/api';

/** Quote asset symbols that Ink spot practice is enabled for. */
export const SUPPORTED_QUOTE_ASSETS: readonly string[] = ['ETH', 'WETH'];

/**
 * Token addresses that make a pool's quote side ETH-equivalent.
 *
 * Ink is an OP-stack chain, so WETH is the standard predeploy. Address identity
 * is checked *before* symbol, because a symbol can collide and a display name
 * can lie; an address cannot.
 */
export const ETH_EQUIVALENT_QUOTE_ADDRESSES: readonly string[] = ['0x4200000000000000000000000000000000000006'];

/**
 * Explicit quote identity for a pair.
 *
 * MARKET_TRUTH_V1 repair: eligibility used to depend on a symbol that the LIVE
 * adapter obtained by splitting the human-readable pool name on `/`. A pool
 * named `FOO / WETH v2` or `A/B / WETH` produced the wrong quote, and a token
 * that merely renders as "WETH" was treated as ETH-equivalent.
 *
 * Now the decision is made from provider token identity:
 *   1. the quote token *address*, when the provider supplied one;
 *   2. otherwise the provider's own quote token *symbol* field;
 *   3. otherwise UNRESOLVED, which fails the practice gate closed.
 */
export type QuoteIdentity =
  | { resolved: true; asset: string; byAddress: boolean; address: string | null }
  | { resolved: false; asset: string; byAddress: false; address: string | null };

export function isEthEquivalentQuoteAddress(address: string | null | undefined): boolean {
  return typeof address === 'string' && ETH_EQUIVALENT_QUOTE_ADDRESSES.includes(address.toLowerCase());
}

export function resolveQuoteIdentity(asset: Pick<RadarAsset, 'quote' | 'quoteTokenAddress' | 'quoteIdentityResolved'>): QuoteIdentity {
  const address = asset.quoteTokenAddress ? asset.quoteTokenAddress.toLowerCase() : null;
  if (isEthEquivalentQuoteAddress(address)) return { resolved: true, asset: 'WETH', byAddress: true, address };
  const symbol = (asset.quote || '').toUpperCase();
  // An address that is present but not ETH-equivalent is still resolved
  // identity — it simply is not a supported quote.
  if (address !== null) return { resolved: true, asset: symbol || 'UNKNOWN', byAddress: true, address };
  if (asset.quoteIdentityResolved === false || symbol === '' || symbol === 'UNKNOWN') {
    return { resolved: false, asset: 'UNKNOWN', byAddress: false, address: null };
  }
  return { resolved: true, asset: symbol, byAddress: false, address: null };
}

export interface PracticeQuote {
  /** Stable economic identity of the instrument, independent of display symbol. */
  instrumentId: string;
  symbol: string;
  name: string;
  venue: string;
  pairAddress: string;
  tokenAddress: string;
  quoteAsset: string;
  /** Quote token address when the provider supplied one. */
  quoteTokenAddress?: string | null;
  /** False when quote identity could not be established from provider fields. */
  quoteIdentityResolved?: boolean;
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
 * Web and simulator now share one vocabulary, so this is an identity mapping
 * with a fail-closed default. It is kept as a function so any future vocabulary
 * drift has exactly one place to be caught, and so that an unrecognised value
 * from the wire becomes UNAVAILABLE rather than being trusted.
 */
export function toSimProvenance(state: ProvenanceState | string): ProvenanceState {
  switch (state) {
    case 'CONFIRMED':
      return 'CONFIRMED';
    case 'DERIVED':
      return 'DERIVED';
    case 'SYNTHETIC':
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

/**
 * Parse a user-typed decimal price straight into 1e18 fixed point.
 *
 * The stop price is the load-bearing input of a risk plan — it sets the stop
 * distance, the position size, the projected loss, and the recorded stop — so it
 * must not detour through a JS double. `parseFixed` is the parser
 * `SIM_CONTRACT_V0` §3 mandates at the adapter boundary: it is exact, and it
 * rejects the hex and exponent forms `Number()` silently accepts (`Number('0x10')`
 * is 16, which would become a 16 ETH stop).
 */
export function priceX18FromDecimalString(value: string): PriceX18 | null {
  const trimmed = value.trim();
  if (trimmed === '' || !/^\d*(?:\.\d*)?$/.test(trimmed)) return null;
  try {
    const scaled = parseFixed(trimmed === '.' ? '0' : trimmed, 18);
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
  const identity = resolveQuoteIdentity(asset);
  return {
    instrumentId: instrumentIdForPair(asset.pairAddress),
    symbol: asset.symbol,
    name: asset.name,
    venue: asset.venue,
    pairAddress: asset.pairAddress,
    tokenAddress: asset.tokenAddress,
    quoteAsset: identity.asset,
    quoteTokenAddress: identity.address,
    quoteIdentityResolved: identity.resolved,
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
