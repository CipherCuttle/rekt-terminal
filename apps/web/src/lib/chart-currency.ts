/**
 * Chart denomination guard — LIVE_CHART_CURRENCY_V1.
 *
 * The terminal draws two things on one price axis:
 *
 *   1. historical OHLCV from a market data provider;
 *   2. economic overlays from the simulator — fill stamps, average entry, the
 *      stop line — which are ETH-denominated because the account unit is wei.
 *
 * They must therefore share a denomination. The previous implementation fetched
 * 200 USD candles and divided every one of them by a single *current* ETH/USD
 * ratio to produce an "ETH" axis. That is arithmetically wrong for every bar
 * except the newest: it back-projects today's exchange rate onto yesterday's
 * prices and silently deforms the entire history.
 *
 * This module replaces that with a decision, not a conversion:
 *
 *   A. bars already denominated in the pool's quote token -> render them;
 *   C. anything else -> render nothing and say why.
 *
 * There is deliberately no rescaling path. A chart is either drawn in the
 * currency its numbers are actually in, or it is not drawn.
 */
import type { Bar, BarSeries, ChartCurrency } from '../types/api';

export type ChartSeriesResolution =
  | { status: 'OK'; bars: Bar[]; currency: ChartCurrency; currencyLabel: string }
  | { status: 'UNAVAILABLE'; reason: string; code: 'CURRENCY_MISMATCH' | 'NO_HISTORY' | 'UNKNOWN_CURRENCY' };

export interface ResolveChartSeriesInput {
  series: BarSeries | null;
  /** Denomination the overlays are in. The simulator is always QUOTE_TOKEN (ETH). */
  overlayCurrency: ChartCurrency;
  overlayCurrencyLabel: string;
}

export function resolveChartSeries(input: ResolveChartSeriesInput): ChartSeriesResolution {
  const { series, overlayCurrency, overlayCurrencyLabel } = input;
  if (!series || series.bars.length === 0) {
    return { status: 'UNAVAILABLE', code: 'NO_HISTORY', reason: 'No historical OHLCV is available for this pair.' };
  }
  if (series.currency !== 'USD' && series.currency !== 'QUOTE_TOKEN') {
    return { status: 'UNAVAILABLE', code: 'UNKNOWN_CURRENCY', reason: 'Historical OHLCV arrived without a stated denomination.' };
  }
  if (series.currency !== overlayCurrency) {
    return {
      status: 'UNAVAILABLE',
      code: 'CURRENCY_MISMATCH',
      // Naming both currencies matters: the user is being told the history was
      // withheld because it is not comparable, not that the pair has no history.
      reason: `History is denominated in ${series.currencyLabel} but position overlays are in ${overlayCurrencyLabel}. Rescaling historical bars by a current exchange rate would misstate every past bar, so history is withheld.`,
    };
  }
  return { status: 'OK', bars: series.bars, currency: series.currency, currencyLabel: series.currencyLabel };
}
