import { useEffect, useRef } from 'react';
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  AreaSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type LogicalRange,
  type MouseEventParams,
} from 'lightweight-charts';
import type { Bar } from '../data/types';
import type { Signal } from '../engine/signals';
import type { EquityPoint } from '../engine/portfolio';

type Props = {
  bars: Bar[];
  signals: Signal[];
  equity: EquityPoint[];
  startEquity: number;
  onBarClick?: (time: number) => void;
};

const COMMON_OPTS = {
  layout: { background: { color: '#0a0d14' }, textColor: '#a1a8bb' },
  grid: {
    vertLines: { color: '#161b27' },
    horzLines: { color: '#161b27' },
  },
  rightPriceScale: { borderColor: '#232a3b' },
  timeScale: {
    timeVisible: true,
    secondsVisible: false,
    borderColor: '#232a3b',
  },
  crosshair: {
    vertLine: { color: '#5b9dff66', width: 1 as const, labelBackgroundColor: '#5b9dff' },
    horzLine: { color: '#5b9dff66', width: 1 as const, labelBackgroundColor: '#5b9dff' },
  },
};

export function ChartStack({ bars, signals, equity, startEquity, onBarClick }: Props) {
  const priceContainerRef = useRef<HTMLDivElement>(null);
  const equityContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!priceContainerRef.current || !equityContainerRef.current) return;

    const priceChart = createChart(priceContainerRef.current, {
      autoSize: true,
      ...COMMON_OPTS,
    });
    const equityChart = createChart(equityContainerRef.current, {
      autoSize: true,
      ...COMMON_OPTS,
      timeScale: {
        ...COMMON_OPTS.timeScale,
        visible: false, // hide axis on bottom chart; price chart owns the labels
      },
    });

    // ---- Price chart series ----
    const candles = priceChart.addSeries(CandlestickSeries, {
      upColor: '#2ec27e',
      downColor: '#ff5d6c',
      borderVisible: false,
      wickUpColor: '#2ec27e',
      wickDownColor: '#ff5d6c',
    });
    const volume = priceChart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      color: '#3a3f4b',
    });
    priceChart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    candles.setData(
      bars.map((b) => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );
    volume.setData(
      bars.map((b) => ({
        time: b.time as Time,
        value: b.volume,
        color: b.close >= b.open ? '#2ec27e44' : '#ff5d6c44',
      })),
    );
    createSeriesMarkers(
      candles,
      signals.map((s) => ({
        time: s.time as Time,
        position: s.side === 'buy' ? 'belowBar' : 'aboveBar',
        color: s.side === 'buy' ? '#2ec27e' : '#ff5d6c',
        shape: s.side === 'buy' ? 'arrowUp' : 'arrowDown',
        text: s.side.toUpperCase(),
      })),
    );

    // ---- Equity chart: area shaded by direction relative to startEquity ----
    const equityArea = equityChart.addSeries(AreaSeries, {
      lineColor: '#5b9dff',
      topColor: '#5b9dff55',
      bottomColor: '#5b9dff08',
      lineWidth: 2,
    });
    equityArea.setData(
      equity.length
        ? equity.map((p) => ({ time: p.time as Time, value: p.equity }))
        : bars.map((b) => ({ time: b.time as Time, value: startEquity })),
    );
    // Reference line at the starting equity so you see "above water" at a glance.
    const baseline = equityChart.addSeries(LineSeries, {
      color: '#2c3447',
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceLineVisible: false,
      lastValueVisible: false,
    });
    baseline.setData(
      bars.map((b) => ({ time: b.time as Time, value: startEquity })),
    );

    // ---- Sync: time/logical range ----
    let syncing = false;
    const syncRange = (
      from: IChartApi,
      to: IChartApi,
      range: LogicalRange | null,
    ) => {
      if (syncing || !range) return;
      syncing = true;
      to.timeScale().setVisibleLogicalRange(range);
      syncing = false;
      void from;
    };
    priceChart
      .timeScale()
      .subscribeVisibleLogicalRangeChange((r) =>
        syncRange(priceChart, equityChart, r),
      );
    equityChart
      .timeScale()
      .subscribeVisibleLogicalRangeChange((r) =>
        syncRange(equityChart, priceChart, r),
      );

    // ---- Sync: crosshair ----
    type CrosshairTarget = {
      chart: IChartApi;
      series: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'>;
    };
    const targets: { price: CrosshairTarget; equity: CrosshairTarget } = {
      price: { chart: priceChart, series: candles },
      equity: { chart: equityChart, series: equityArea },
    };
    const forwardCrosshair =
      (source: 'price' | 'equity') => (param: MouseEventParams) => {
        if (syncing) return;
        const target = source === 'price' ? targets.equity : targets.price;
        if (!param.time) {
          target.chart.clearCrosshairPosition();
          return;
        }
        const data = param.seriesData.get(
          source === 'price' ? targets.price.series : targets.equity.series,
        );
        const price =
          data && 'close' in data
            ? data.close
            : data && 'value' in data
              ? data.value
              : 0;
        syncing = true;
        target.chart.setCrosshairPosition(price, param.time, target.series);
        syncing = false;
      };
    priceChart.subscribeCrosshairMove(forwardCrosshair('price'));
    equityChart.subscribeCrosshairMove(forwardCrosshair('equity'));

    if (onBarClick) {
      priceChart.subscribeClick((p) => {
        if (typeof p.time === 'number') onBarClick(p.time);
      });
    }

    priceChart.timeScale().fitContent();

    return () => {
      priceChart.remove();
      equityChart.remove();
    };
  }, [bars, signals, equity, startEquity]);

  return (
    <div className="chart-stack">
      <div className="chart-cell price" ref={priceContainerRef} />
      <div className="chart-cell equity">
        <span className="chart-label">Equity</span>
        <div className="chart-cell-host" ref={equityContainerRef} />
      </div>
    </div>
  );
}
