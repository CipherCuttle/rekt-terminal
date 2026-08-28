/**
 * Bridge from recorded simulator fills to chart markers.
 *
 * The float conversion happens here and only here, at the presentation edge:
 * chart coordinates are floats, ledger truth is not. The label keeps the exact
 * fixed-point price so the user reads the simulator's number, not a rounded one.
 */
import { formatFixed, type SimState } from '@rekt-ink/sim';
import type { ChartFillStamp } from '../lib/chart';
import { chartCycleId, fillStampsForCycle, type FillStamp } from './derive';
import { formatPriceEth } from './format';

export function toChartFillStamp(stamp: FillStamp): ChartFillStamp {
  return {
    id: stamp.fillId,
    side: stamp.side,
    timeSeconds: stamp.barTimeSeconds,
    price: Number(formatFixed(stamp.fillPriceX18, 18)),
    label: `${stamp.side} ${formatPriceEth(stamp.fillPriceX18)}`,
  };
}

/** Chart stamps for the trade cycle currently in view. */
export function chartFillStampsForSim(sim: SimState, barSeconds?: number): ChartFillStamp[] {
  return fillStampsForCycle(sim.events, chartCycleId(sim), barSeconds).map(toChartFillStamp);
}
