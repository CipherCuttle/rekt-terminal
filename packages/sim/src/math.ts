import {
  BPS_SCALE,
  PRICE_SCALE,
  bps,
  priceX18,
  quantityAtoms,
  wei,
  type Bps,
  type PriceX18,
  type QuantityAtoms,
  type Wei,
} from './types.js';

export type Rounding = 'floor' | 'ceil' | 'half-up';

export function divRound(numerator: bigint, denominator: bigint, rounding: Rounding): bigint {
  if (denominator <= 0n) throw new RangeError('denominator must be positive');
  if (numerator === 0n) return 0n;

  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  let rounded = quotient;

  if (rounding === 'floor') {
    if (negative && remainder !== 0n) rounded += 1n;
  } else if (rounding === 'ceil') {
    if (!negative && remainder !== 0n) rounded += 1n;
  } else if (remainder * 2n >= denominator) {
    rounded += 1n;
  }

  return negative ? -rounded : rounded;
}

export function mulDiv(numerator: bigint, multiplier: bigint, denominator: bigint, rounding: Rounding): bigint {
  return divRound(numerator * multiplier, denominator, rounding);
}

export function parseFixed(value: string, decimals = 18): bigint {
  if (!Number.isInteger(decimals) || decimals < 0) throw new RangeError('invalid decimal scale');
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new RangeError(`invalid fixed-point value: ${value}`);
  const [, sign, whole, fraction = ''] = match;
  if (fraction.length > decimals) throw new RangeError(`too many decimal places: ${value}`);
  const scaled = BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
  return sign === '-' ? -scaled : scaled;
}

export function formatFixed(value: bigint, decimals = 18, trim = true): string {
  if (!Number.isInteger(decimals) || decimals < 0) throw new RangeError('invalid decimal scale');
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = absolute / scale;
  const fraction = decimals === 0 ? '' : (absolute % scale).toString().padStart(decimals, '0');
  const renderedFraction = trim ? fraction.replace(/0+$/, '') : fraction;
  return `${negative ? '-' : ''}${whole.toString()}${renderedFraction ? `.${renderedFraction}` : ''}`;
}

export function quoteForQuantity(quantity: QuantityAtoms, price: PriceX18, rounding: Rounding = 'floor'): Wei {
  if (quantity < 0n || price < 0n) throw new RangeError('quantity and price must be non-negative');
  return wei(mulDiv(quantity, price, PRICE_SCALE, rounding));
}

export function quantityForQuote(quote: Wei, price: PriceX18, rounding: Rounding = 'floor'): QuantityAtoms {
  if (quote < 0n || price <= 0n) throw new RangeError('quote must be non-negative and price positive');
  return quantityAtoms(mulDiv(quote, PRICE_SCALE, price, rounding));
}

export function feeForQuote(quote: Wei, feeRate: Bps, rounding: Rounding = 'floor'): Wei {
  if (quote < 0n || feeRate < 0n) throw new RangeError('quote and fee rate must be non-negative');
  return wei(mulDiv(quote, feeRate, BPS_SCALE, rounding));
}

export function participationBps(requestedQuote: Wei, liquidity: Wei): Bps {
  if (requestedQuote < 0n || liquidity <= 0n) throw new RangeError('invalid participation inputs');
  return bps(mulDiv(requestedQuote, BPS_SCALE, liquidity, 'ceil'));
}

export function drawdownBps(highWater: Wei, equity: Wei): Bps {
  if (highWater <= 0n) return bps(0n);
  if (equity >= highWater) return bps(0n);
  return bps(mulDiv(highWater - equity, BPS_SCALE, highWater, 'floor'));
}

export function weightedAveragePrice(costBasis: Wei, quantity: QuantityAtoms): PriceX18 {
  if (quantity <= 0n) return priceX18(0n);
  return priceX18(mulDiv(costBasis, PRICE_SCALE, quantity, 'half-up'));
}

export function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}
