import { BPS_SCALE, INITIAL_BANKROLL_WEI, bps, priceX18, quantityAtoms, wei, type AccountState, type PositionState, type PriceX18, type Wei } from './types.js';
import { drawdownBps, mulDiv, quoteForQuantity } from './math.js';

export function createInitialAccount(): AccountState {
  return {
    freeEthWei: INITIAL_BANKROLL_WEI,
    realizedPnlWei: wei(0n),
    unrealizedPnlWei: wei(0n),
    equityWei: INITIAL_BANKROLL_WEI,
    highWaterEquityWei: INITIAL_BANKROLL_WEI,
    maxDrawdownBps: bps(0n),
  };
}

export function markToMarket(account: AccountState, position: PositionState | null, markPriceX18: PriceX18 | null): AccountState {
  if (position && (!markPriceX18 || markPriceX18 <= 0n)) throw new RangeError('an open position requires a positive mark price');
  const markValue = position && markPriceX18 && markPriceX18 > 0n
    ? quoteForQuantity(quantityAtoms(position.openQuantityAtoms), priceX18(markPriceX18), 'floor')
    : wei(0n);
  const unrealized = position && markPriceX18 && markPriceX18 > 0n
    ? wei(markValue - position.costBasisWei - position.remainingEntryFeesWei)
    : wei(0n);
  const equity = wei(account.freeEthWei + markValue);
  const highWater = equity > account.highWaterEquityWei ? equity : account.highWaterEquityWei;
  const currentDrawdown = drawdownBps(highWater, equity);
  return {
    ...account,
    unrealizedPnlWei: unrealized,
    equityWei: equity,
    highWaterEquityWei: highWater,
    maxDrawdownBps: currentDrawdown > account.maxDrawdownBps ? currentDrawdown : account.maxDrawdownBps,
  };
}

export function applyEntryDebit(account: AccountState, costBasisWei: Wei, feeWei: Wei): AccountState {
  const debit = costBasisWei + feeWei;
  if (debit > account.freeEthWei) throw new RangeError('entry debit exceeds free balance');
  return { ...account, freeEthWei: wei(account.freeEthWei - debit) };
}

export function applyExitCredit(account: AccountState, proceedsWei: Wei, feeWei: Wei, realizedPnlWei: Wei): AccountState {
  if (proceedsWei < 0n || feeWei < 0n || feeWei > proceedsWei) throw new RangeError('exit proceeds and fee would make free ETH negative');
  return {
    ...account,
    freeEthWei: wei(account.freeEthWei + proceedsWei - feeWei),
    realizedPnlWei: wei(account.realizedPnlWei + realizedPnlWei),
  };
}

export function lossBpsOfEquity(realizedPnlWei: Wei, equityAtOpenWei: Wei): bigint {
  if (realizedPnlWei >= 0n || equityAtOpenWei <= 0n) return 0n;
  return mulDiv(-(realizedPnlWei), BPS_SCALE, equityAtOpenWei, 'floor');
}
