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
import {
  markerProjectionKey,
  nextFillMarkerLod,
  projectFillMarkers,
  visibleDataBars,
  type FillMarkerLod,
} from './chart-marker-lod';

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

export interface MarketChartOptions {
  onRealtimeStateChange?: (awayFromRealtime: boolean) => void;
}

const BUY_COLOR = '#8BFF58';
const SELL_COLOR = '#FF2E6C';
const MIXED_COLOR = '#A884FF';
const DEFAULT_RIGHT_OFFSET = 12;
const DEFAULT_VISIBLE_BARS = 84;

export class MarketChart {
  chart: IChartApi;
  candle: ISeriesApi<'Candlestick'>;
  volume: ISeriesApi<'Histogram'>;
  markers: ISeriesMarkersPluginApi<Time>;
  last: Bar | null = null;
  private entryLine: IPriceLine | null = null;
  private stopLine: IPriceLine | null = null;
  private entryPrice: number | null = null;
  private entryTitle = '';
  private fillStamps: readonly ChartFillStamp[] = [];
  private markerLod: FillMarkerLod = 'DETAIL';
  private visibleBars = DEFAULT_VISIBLE_BARS;
  private markerKey = markerProjectionKey('DETAIL', DEFAULT_VISIBLE_BARS);
  private lastDataIndex: number | null = null;
  private realtimeOffset = DEFAULT_RIGHT_OFFSET;
  private awayFromRealtime = false;
  private readonly onRealtimeStateChange?: (awayFromRealtime: boolean) => void;

  private readonly handleVisibleRange = (range: { from: number; to: number } | null) => {
    if (!range) return;
    // Right-side whitespace is navigation chrome, not market history. Counting it
    // as bars made the default 84-bar view immediately collapse to COMPACT.
    const visibleBars = visibleDataBars(range, this.lastDataIndex);
    const nextLod = nextFillMarkerLod(this.markerLod, visibleBars);
    const nextKey = markerProjectionKey(nextLod, visibleBars);
    this.visibleBars = visibleBars;

    if (nextKey !== this.markerKey) {
      this.markerLod = nextLod;
      this.markerKey = nextKey;
      this.renderFillMarkers();
      this.renderEntryLine();
    } else {
      this.markerLod = nextLod;
    }

    if (this.last) {
      const away = Math.abs(this.chart.timeScale().scrollPosition() - this.realtimeOffset) > 2;
      if (away !== this.awayFromRealtime) {
        this.awayFromRealtime = away;
        this.onRealtimeStateChange?.(away);
      }
    }
  };

  constructor(el: HTMLElement, options: MarketChartOptions = {}) {
    this.onRealtimeStateChange = options.onRealtimeStateChange;
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
      timeScale: {
        borderColor: '#262243',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: DEFAULT_RIGHT_OFFSET,
        barSpacing: 8,
        minBarSpacing: 2,
        maxBarSpacing: 24,
        rightBarStaysOnScroll: true,
        shiftVisibleRangeOnNewBar: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        // Let the page retain vertical touch gestures on narrow/mobile layouts.
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
      },
      kineticScroll: { mouse: true, touch: true },
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
    // Marker labels must not stretch the Y axis; the axis describes market data,
    // while semantic zoom is only a presentation of immutable simulator fills.
    this.markers = createSeriesMarkers(this.candle, [], { autoScale: false });
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(this.handleVisibleRange);
  }

  load(bars: Bar[]) {
    this.last = bars.at(-1) || null;
    this.lastDataIndex = bars.length > 0 ? bars.length - 1 : null;
    this.candle.setData(bars.map((bar) => ({ ...bar, time: bar.time as UTCTimestamp })));
    this.volume.setData(
      bars.map((bar) => ({
        time: bar.time as UTCTimestamp,
        value: bar.volume,
        color: bar.close >= bar.open ? 'rgba(58,255,110,.20)' : 'rgba(255,46,108,.20)',
      })),
    );

    const timeScale = this.chart.timeScale();
    if (bars.length > DEFAULT_VISIBLE_BARS) {
      const lastIndex = bars.length - 1;
      timeScale.setVisibleLogicalRange({
        from: Math.max(0, lastIndex - (DEFAULT_VISIBLE_BARS - 1)),
        to: lastIndex + DEFAULT_RIGHT_OFFSET,
      });
    } else {
      timeScale.fitContent();
    }
    this.realtimeOffset = timeScale.scrollPosition();
    this.handleVisibleRange(timeScale.getVisibleLogicalRange());
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
      if (this.lastDataIndex !== null) this.lastDataIndex += 1;
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
      color: side > 0 ? 'rgba(58,255,110,.20)' : 'rgba(255,46,108,.20)',
    });
  }

  /**
   * Stamp executed fills onto the chart. Zoom changes their presentation only:
   * close views show exact labels, medium views keep exact price with B/S labels,
   * and far views show count clusters without inventing one execution price.
   */
  setFillStamps(stamps: readonly ChartFillStamp[]) {
    this.fillStamps = [...stamps];
    this.renderFillMarkers();
  }

  private renderFillMarkers() {
    const projected = projectFillMarkers(this.fillStamps, this.markerLod, this.visibleBars);
    const markers: SeriesMarker<Time>[] = projected.map((marker) => {
      if (marker.exactPrice && marker.price !== null) {
        return {
          id: marker.id,
          time: marker.timeSeconds as UTCTimestamp,
          position: 'atPriceMiddle',
          price: marker.price,
          shape: marker.side === 'BUY' ? 'arrowUp' : 'arrowDown',
          color: marker.side === 'BUY' ? BUY_COLOR : SELL_COLOR,
          text: marker.text,
          size: this.markerLod === 'DETAIL' ? 1 : 0.8,
        };
      }

      return {
        id: marker.id,
        time: marker.timeSeconds as UTCTimestamp,
        position: marker.side === 'BUY' ? 'belowBar' : 'aboveBar',
        shape: marker.side === 'BUY' ? 'arrowUp' : marker.side === 'SELL' ? 'arrowDown' : 'circle',
        color: marker.side === 'BUY' ? BUY_COLOR : marker.side === 'SELL' ? SELL_COLOR : MIXED_COLOR,
        text: marker.text,
        size: 1,
      };
    });
    this.markers.setMarkers(markers);
  }

  /** Horizontal reference for the open position's average entry. */
  setEntryLine(price: number | null, title: string) {
    this.entryPrice = price;
    this.entryTitle = title;
    this.renderEntryLine();
  }

  private renderEntryLine() {
    if (this.entryLine) {
      this.candle.removePriceLine(this.entryLine);
      this.entryLine = null;
    }
    const price = this.entryPrice;
    if (price === null || !Number.isFinite(price) || price <= 0) return;
    this.entryLine = this.candle.createPriceLine({
      price,
      color: '#A884FF',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      // ENTRY is useful at close zoom but competes with clustered fills far out.
      title: this.markerLod === 'DETAIL' ? this.entryTitle : '',
    });
  }

  setStopLine(price: number | null) {
    if (this.stopLine) {
      this.candle.removePriceLine(this.stopLine);
      this.stopLine = null;
    }
    if (price !== null) {
      this.stopLine = this.candle.createPriceLine({
        price,
        color: '#FF2E6C',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'STOP',
      });
    }
  }

  scrollToRealtime() {
    this.chart.timeScale().scrollToRealTime();
  }

  destroy() {
    this.chart.timeScale().unsubscribeVisibleLogicalRangeChange(this.handleVisibleRange);
    this.entryLine = null;
    this.stopLine = null;
    this.chart.remove();
  }
}
