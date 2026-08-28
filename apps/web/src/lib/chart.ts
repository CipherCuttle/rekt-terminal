import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  createSeriesMarkers,
  ColorType,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Bar } from '../types/api';

/**
 * A chart marker for one executed simulator fill.
 *
 * Every field originates from the recorded `SpotFill`. Nothing here is derived
 * from pointer position, animation timing, or when React happened to render.
 */
export interface ChartFillStamp {
  /** Fill identity; also the marker id, so re-applying is idempotent. */
  id: string;
  side: 'BUY' | 'SELL';
  /** Bar the fill belongs to, in seconds. */
  timeSeconds: number;
  /** The exact fill price, used for Y-axis placement. */
  price: number;
  /** Pre-formatted label, e.g. "BUY 0.025137". */
  label: string;
}

const BUY_COLOR = '#8BFF58';
const SELL_COLOR = '#FF2E6C';

export class MarketChart {
  chart: IChartApi;
  candle: ISeriesApi<'Candlestick'>;
  volume: ISeriesApi<'Histogram'>;
  markers: ISeriesMarkersPluginApi<Time>;
  last: Bar | null = null;
  private entryLine: IPriceLine | null = null;

  constructor(el: HTMLElement) {
    this.chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b87a6',
        fontFamily: 'JetBrains Mono',
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(122,92,255,.07)' },
        horzLines: { color: 'rgba(122,92,255,.07)' },
      },
      rightPriceScale: { borderColor: '#262243' },
      // rightOffset leaves room for fill stamps: executions land on the newest
      // bar, and with a tight offset the marker label collides with the price
      // scale and the signature interaction becomes unreadable.
      timeScale: { borderColor: '#262243', timeVisible: true, secondsVisible: false, rightOffset: 16, barSpacing: 7 },
      crosshair: {
        vertLine: { color: 'rgba(58,255,110,.4)', labelBackgroundColor: '#1A1730' },
        horzLine: { color: 'rgba(58,255,110,.4)', labelBackgroundColor: '#1A1730' },
      },
    });
    this.candle = this.chart.addSeries(CandlestickSeries, {
      upColor: '#3AFF6E',
      downColor: '#FF2E6C',
      wickUpColor: '#3AFF6E',
      wickDownColor: '#FF2E6C',
      borderVisible: false,
    });
    this.volume = this.chart.addSeries(HistogramSeries, {
      priceScaleId: 'vol',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    this.chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    this.markers = createSeriesMarkers(this.candle, []);
  }

  load(bars: Bar[]) {
    this.last = bars.at(-1) || null;
    this.candle.setData(bars.map((bar) => ({ ...bar, time: bar.time as UTCTimestamp })));
    this.volume.setData(
      bars.map((bar) => ({
        time: bar.time as UTCTimestamp,
        value: bar.volume,
        color: bar.close >= bar.open ? 'rgba(58,255,110,.28)' : 'rgba(255,46,108,.28)',
      })),
    );
    this.chart.timeScale().fitContent();
  }

  update(price: number, side: number, volume: number, timeSeconds: number) {
    if (!this.last || !Number.isFinite(price) || price <= 0) return;
    const bt = timeSeconds - (timeSeconds % 60);
    if (bt > this.last.time) {
      this.last = {
        time: bt,
        open: this.last.close,
        high: Math.max(this.last.close, price),
        low: Math.min(this.last.close, price),
        close: price,
        volume,
      };
    } else {
      this.last = {
        ...this.last,
        close: price,
        high: Math.max(this.last.high, price),
        low: Math.min(this.last.low, price),
        volume: this.last.volume + volume,
      };
    }
    this.candle.update({ ...this.last, time: this.last.time as UTCTimestamp });
    this.volume.update({
      time: this.last.time as UTCTimestamp,
      value: this.last.volume,
      color: side > 0 ? 'rgba(58,255,110,.28)' : 'rgba(255,46,108,.28)',
    });
  }

  /**
   * Stamp executed fills onto the chart.
   *
   * Markers are anchored with `atPriceMiddle` so the glyph sits on the price the
   * simulator actually filled at, not merely above or below the candle. This is
   * the whole point of the interaction: a BUY reads as an executed economic
   * event at a specific price and time.
   *
   * Markers are reserved for simulator events. Market noise such as sweeps stays
   * in the tape so this layer keeps one unambiguous meaning, and it extends
   * cleanly to STOP and LIQUIDATION later.
   */
  setFillStamps(stamps: readonly ChartFillStamp[]) {
    const markers: SeriesMarker<Time>[] = stamps.map((stamp) => ({
      id: stamp.id,
      time: stamp.timeSeconds as UTCTimestamp,
      position: 'atPriceMiddle',
      price: stamp.price,
      shape: stamp.side === 'BUY' ? 'arrowUp' : 'arrowDown',
      color: stamp.side === 'BUY' ? BUY_COLOR : SELL_COLOR,
      text: stamp.label,
      size: 1,
    }));
    this.markers.setMarkers(markers);
  }

  /** Horizontal reference for the open position's average entry. */
  setEntryLine(price: number | null, title: string) {
    if (this.entryLine) {
      this.candle.removePriceLine(this.entryLine);
      this.entryLine = null;
    }
    if (price === null || !Number.isFinite(price) || price <= 0) return;
    this.entryLine = this.candle.createPriceLine({
      price,
      color: '#A884FF',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title,
    });
  }

  destroy() {
    this.entryLine = null;
    this.chart.remove();
  }
}
