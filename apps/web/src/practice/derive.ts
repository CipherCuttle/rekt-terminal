/**
 * Pure derivations over the simulator's immutable event log.
 *
 * Everything here is a read. The chart stamps and the trade review are
 * reconstructed from recorded FILL_APPLIED events and TradeSummary facts, never
 * from UI timing, click position, or React state.
 */
import {
  priceX18,
  quantityAtoms,
  wei,
  weightedAveragePrice,
  type PriceX18,
  type QuantityAtoms,
  type SimEvent,
  type SpotFill,
  type SimState,
  type SpotSide,
  type TradeSummary,
  type Wei,
} from '@rekt-ink/sim';

/**
 * A chart marker derived from one executed fill.
 *
 * `fillPriceX18` and `executedAtMs` are the simulator's own values.
 * `barTimeSeconds` only decides which candle the glyph is anchored to; it never
 * replaces the recorded price or time shown to the user.
 */
export interface FillStamp {
  fillId: string;
  side: SpotSide;
  fillPriceX18: PriceX18;
  executedAtMs: number;
  quantityAtoms: QuantityAtoms;
  barTimeSeconds: number;
}

export const DEFAULT_BAR_SECONDS = 60;

export function fillStampsFromEvents(events: readonly SimEvent[], barSeconds = DEFAULT_BAR_SECONDS): FillStamp[] {
  const stamps: FillStamp[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    if (event.type !== 'FILL_APPLIED') continue;
    const fill = event.fill;
    if (seen.has(fill.fillId)) continue;
    seen.add(fill.fillId);
    const seconds = Math.floor(fill.executedAtMs / 1000);
    stamps.push({
      fillId: fill.fillId,
      side: fill.side,
      fillPriceX18: priceX18(fill.fillPriceX18),
      executedAtMs: fill.executedAtMs,
      quantityAtoms: quantityAtoms(fill.quantityAtoms),
      barTimeSeconds: seconds - (seconds % barSeconds),
    });
  }
  return stamps;
}

/**
 * Group applied fills into the ledger's own trade cycles.
 *
 * The cycle boundary is reconstructed the same way the ledger derives
 * `trade-${closedCycleCount + 1}`: a BUY against flat quantity opens a cycle and
 * the cycle closes when open quantity returns to zero. This avoids depending on
 * event-id string shapes.
 */
export function fillsByCycle(events: readonly SimEvent[]): Map<string, SpotFill[]> {
  const cycles = new Map<string, SpotFill[]>();
  const seen = new Set<string>();
  let closedCycles = 0;
  let openQuantity = 0n;
  let currentCycle: string | null = null;

  for (const event of events) {
    if (event.type !== 'FILL_APPLIED') continue;
    const fill = event.fill;
    if (seen.has(fill.fillId)) continue;
    seen.add(fill.fillId);

    if (fill.side === 'BUY') {
      if (openQuantity === 0n) {
        currentCycle = `trade-${closedCycles + 1}`;
        cycles.set(currentCycle, []);
      }
      openQuantity += fill.quantityAtoms;
    } else {
      if (currentCycle === null) continue;
      openQuantity -= fill.quantityAtoms;
    }

    if (currentCycle !== null) cycles.get(currentCycle)!.push(fill);

    if (fill.side === 'SELL' && openQuantity <= 0n) {
      closedCycles += 1;
      currentCycle = null;
      openQuantity = 0n;
    }
  }
  return cycles;
}

export interface TradeReviewEconomics {
  exitPriceX18: PriceX18;
  exitQuantityAtoms: QuantityAtoms;
  exitProceedsWei: Wei;
  totalFeesWei: Wei;
  entryFillCount: number;
  exitFillCount: number;
}

/**
 * Reconstruct the exit side of a closed trade from its recorded fills.
 *
 * TradeSummary carries entry prices and fees but not an exit price, so the exit
 * is the quantity-weighted average of the cycle's actual SELL fills.
 */
export function deriveTradeEconomics(events: readonly SimEvent[], summary: TradeSummary): TradeReviewEconomics {
  const fills = fillsByCycle(events).get(summary.tradeId) ?? [];
  let exitQuantity = 0n;
  let exitProceeds = 0n;
  let entryFillCount = 0;
  let exitFillCount = 0;

  for (const fill of fills) {
    if (fill.side === 'SELL') {
      exitQuantity += fill.quantityAtoms;
      exitProceeds += fill.executedQuoteWei;
      exitFillCount += 1;
    } else {
      entryFillCount += 1;
    }
  }

  return {
    exitPriceX18: exitQuantity > 0n ? weightedAveragePrice(wei(exitProceeds), quantityAtoms(exitQuantity)) : priceX18(0n),
    exitQuantityAtoms: quantityAtoms(exitQuantity),
    exitProceedsWei: wei(exitProceeds),
    totalFeesWei: wei(summary.entryFeesWei + summary.exitFeesWei),
    entryFillCount,
    exitFillCount,
  };
}

/**
 * The trade cycle the chart should stamp.
 *
 * While a position is open it is the cycle being built; when flat it is the one
 * most recently closed. This mirrors the ledger's own
 * `trade-${closedCycleCount + 1}` numbering.
 */
export function chartCycleId(sim: Pick<SimState, 'position' | 'closedCycleCount'>): string | null {
  if (sim.position) return `trade-${sim.closedCycleCount + 1}`;
  return sim.closedCycleCount > 0 ? `trade-${sim.closedCycleCount}` : null;
}

/**
 * Fill stamps for one trade cycle.
 *
 * Stamping every fill in the session piles overlapping labels on top of each
 * other, because practice fills cluster at the newest bar. Scoping to a single
 * cycle keeps each execution readable at its own price. Nothing is lost: the
 * full history stays in the event log and in the trade review.
 */
export function fillStampsForCycle(
  events: readonly SimEvent[],
  cycleId: string | null,
  barSeconds = DEFAULT_BAR_SECONDS,
): FillStamp[] {
  if (cycleId === null) return [];
  const fills = fillsByCycle(events).get(cycleId);
  if (!fills || fills.length === 0) return [];
  const wanted = new Set(fills.map((fill) => fill.fillId));
  return fillStampsFromEvents(events, barSeconds).filter((stamp) => wanted.has(stamp.fillId));
}
