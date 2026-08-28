import { priceX18, quantityAtoms, wei, type EntryFill, type PositionState, type PriceX18, type QuantityAtoms, type SpotFill, type Wei } from './types.js';
import { divRound, mulDiv, weightedAveragePrice } from './math.js';

export function quantityWeightedMedianEntry(fills: readonly EntryFill[]): PriceX18 {
  if (fills.length === 0) return priceX18(0n);
  const sorted = [...fills].sort((a, b) => (a.fillPriceX18 < b.fillPriceX18 ? -1 : a.fillPriceX18 > b.fillPriceX18 ? 1 : a.fillId.localeCompare(b.fillId)));
  const total = sorted.reduce((sum, fill) => sum + fill.quantityAtoms, 0n);
  if (total <= 0n) return priceX18(0n);
  const halfway = divRound(total, 2n, 'ceil');
  let cumulative = 0n;
  for (const fill of sorted) {
    cumulative += fill.quantityAtoms;
    if (cumulative >= halfway) return priceX18(fill.fillPriceX18);
  }
  return priceX18(sorted[sorted.length - 1].fillPriceX18);
}

export function entryFromFill(fill: SpotFill): EntryFill {
  return {
    fillId: fill.fillId,
    quantityAtoms: quantityAtoms(fill.quantityAtoms),
    fillPriceX18: priceX18(fill.fillPriceX18),
    costBasisWei: wei(fill.executedQuoteWei),
    feeQuoteWei: wei(fill.feeQuoteWei),
    executedAtMs: fill.executedAtMs,
  };
}

export function openPosition(cycleId: string, fill: SpotFill): PositionState {
  const entry = entryFromFill(fill);
  return {
    status: 'OPEN',
    cycleId,
    instrumentId: fill.instrumentId,
    quoteAsset: fill.quoteAsset,
    side: 'LONG',
    openedAtMs: fill.executedAtMs,
    openQuantityAtoms: quantityAtoms(fill.quantityAtoms),
    costBasisWei: wei(fill.executedQuoteWei),
    remainingEntryFeesWei: wei(fill.feeQuoteWei),
    averageEntryPriceX18: priceX18(fill.fillPriceX18),
    medianEntryPriceX18: priceX18(fill.fillPriceX18),
    entryFills: [entry],
    entryCount: 1,
    exitCount: 0,
    partialExitUsed: false,
  };
}

export function addEntry(position: PositionState, fill: SpotFill): PositionState {
  const entry = entryFromFill(fill);
  const quantity = position.openQuantityAtoms + fill.quantityAtoms;
  const costBasis = position.costBasisWei + fill.executedQuoteWei;
  return {
    ...position,
    openQuantityAtoms: quantityAtoms(quantity),
    costBasisWei: wei(costBasis),
    remainingEntryFeesWei: wei(position.remainingEntryFeesWei + fill.feeQuoteWei),
    averageEntryPriceX18: weightedAveragePrice(wei(costBasis), quantityAtoms(quantity)),
    medianEntryPriceX18: quantityWeightedMedianEntry([...position.entryFills, entry]),
    entryFills: [...position.entryFills, entry],
    entryCount: position.entryCount + 1,
  };
}

export interface CloseAllocation {
  closed: boolean;
  quantityAtoms: QuantityAtoms;
  allocatedCostBasisWei: Wei;
  allocatedEntryFeesWei: Wei;
  remainingPosition: PositionState | null;
}

export function allocateClose(position: PositionState, closeQuantity: QuantityAtoms): CloseAllocation {
  if (closeQuantity <= 0n) throw new RangeError('close quantity must be positive');
  if (closeQuantity > position.openQuantityAtoms) throw new RangeError('close quantity exceeds open quantity');
  const isFull = closeQuantity === position.openQuantityAtoms;
  const allocatedCost = isFull ? position.costBasisWei : wei(mulDiv(position.costBasisWei, closeQuantity, position.openQuantityAtoms, 'floor'));
  const allocatedFees = isFull ? position.remainingEntryFeesWei : wei(mulDiv(position.remainingEntryFeesWei, closeQuantity, position.openQuantityAtoms, 'floor'));
  if (isFull) {
    return {
      closed: true,
      quantityAtoms: quantityAtoms(closeQuantity),
      allocatedCostBasisWei: wei(allocatedCost),
      allocatedEntryFeesWei: wei(allocatedFees),
      remainingPosition: null,
    };
  }
  const remainingQuantity = position.openQuantityAtoms - closeQuantity;
  const remainingCost = position.costBasisWei - allocatedCost;
  const remainingFees = position.remainingEntryFeesWei - allocatedFees;
  return {
    closed: false,
    quantityAtoms: quantityAtoms(closeQuantity),
    allocatedCostBasisWei: wei(allocatedCost),
    allocatedEntryFeesWei: wei(allocatedFees),
    remainingPosition: {
      ...position,
      openQuantityAtoms: quantityAtoms(remainingQuantity),
      costBasisWei: wei(remainingCost),
      remainingEntryFeesWei: wei(remainingFees),
      averageEntryPriceX18: weightedAveragePrice(wei(remainingCost), quantityAtoms(remainingQuantity)),
      exitCount: position.exitCount + 1,
      partialExitUsed: true,
    },
  };
}

export function closePosition(position: PositionState, fill: SpotFill): CloseAllocation {
  return allocateClose(position, fill.quantityAtoms);
}
