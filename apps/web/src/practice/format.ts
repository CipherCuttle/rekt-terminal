/**
 * Display formatting for domain fixed-point values.
 *
 * This module is presentation-only. It never rounds a value that is then fed
 * back into the simulator: every function here takes a domain bigint and
 * returns a string. Economic truth stays in `@rekt-ink/sim`.
 */
import { BPS_SCALE, PRICE_SCALE, type Bps, type PriceX18, type QuantityAtoms, type Wei } from '@rekt-ink/sim';

/** Round-half-up a fixed-point bigint to `dp` decimal places and render it. */
export function formatFixedDp(value: bigint, decimals: number, dp: number): string {
  if (dp > decimals) throw new RangeError('dp cannot exceed the fixed-point scale');
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const factor = 10n ** BigInt(decimals - dp);
  const scaled = factor === 1n ? absolute : (absolute + factor / 2n) / factor;
  const dpScale = 10n ** BigInt(dp);
  const whole = scaled / dpScale;
  const fraction = dp === 0 ? '' : `.${(scaled % dpScale).toString().padStart(dp, '0')}`;
  return `${negative ? '-' : ''}${whole.toString()}${fraction}`;
}

/** Account-scale ETH. Always 4dp so the balance column never reflows. */
export function formatEth(value: Wei, dp = 4): string {
  return formatFixedDp(value, 18, dp);
}

/** Signed ETH for PnL. Explicit `+` so sign is never carried by colour alone. */
export function formatSignedEth(value: Wei, dp = 4): string {
  const rendered = formatEth(value, dp);
  return value > 0n ? `+${rendered}` : rendered;
}

/**
 * Prices on Ink span several orders of magnitude, so precision adapts to the
 * value. Tabular figures keep the columns aligned regardless of dp.
 */
export function formatPriceEth(value: PriceX18): string {
  if (value === 0n) return '0.0000';
  const absolute = value < 0n ? -value : value;
  if (absolute < PRICE_SCALE / 1_000n) return formatFixedDp(value, 18, 9);
  if (absolute < PRICE_SCALE) return formatFixedDp(value, 18, 6);
  return formatFixedDp(value, 18, 4);
}

/** Token quantity. Atoms are 1e18-scaled, same as wei. */
export function formatQuantity(value: QuantityAtoms, dp = 4): string {
  return formatFixedDp(value, 18, dp);
}

/** Basis points as a percentage, e.g. 1_000n -> "10.00%". */
export function formatBpsPercent(value: Bps | bigint): string {
  return `${formatFixedDp(value * 100n, 4, 2)}%`;
}

/** Ratio of a wei value to a wei base, in bps, for display only. */
export function ratioBps(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) return 0n;
  return (numerator * BPS_SCALE) / denominator;
}
