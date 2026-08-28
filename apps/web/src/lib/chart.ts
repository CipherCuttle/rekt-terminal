import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  createSeriesMarkers,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Bar } from '../types/api';

export class MarketChart {
  chart: IChartApi;
  candle: ISeriesApi<'Candlestick'>;
  volume: ISeriesApi<'Histogram'>;
  markers: ISeriesMarkersPluginApi<Time>;
  last: Bar | null = null;

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
      timeScale: { borderColor: '#262243', timeVisible: true, secondsVisible: false, rightOffset: 5, barSpacing: 7 },
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
    this.markers.setMarkers([]);
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

  sweep(side: number) {
    if (!this.last) return;
    this.markers.setMarkers([
      {
        time: this.last.time as UTCTimestamp,
        position: side > 0 ? 'belowBar' : 'aboveBar',
        color: side > 0 ? '#3AFF6E' : '#FF2E88',
        shape: side > 0 ? 'arrowUp' : 'arrowDown',
        text: 'SWEEP',
      },
    ]);
  }

  destroy() {
    this.chart.remove();
  }
}
