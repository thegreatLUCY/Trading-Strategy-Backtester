import { useEffect, useRef } from 'react';
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type Time,
} from 'lightweight-charts';
import type { Bar } from '../data/types';
import type { Signal } from '../engine/signals';

type Props = {
  bars: Bar[];
  signals: Signal[];
};

export function PriceChart({ bars, signals }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: '#0e1117' },
        textColor: '#d0d4dc',
      },
      grid: {
        vertLines: { color: '#1c2230' },
        horzLines: { color: '#1c2230' },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      color: '#3a3f4b',
    });
    chart.priceScale('vol').applyOptions({
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
        color: b.close >= b.open ? '#26a69a55' : '#ef535055',
      })),
    );

    createSeriesMarkers(
      candles,
      signals.map((s) => ({
        time: s.time as Time,
        position: s.side === 'buy' ? 'belowBar' : 'aboveBar',
        color: s.side === 'buy' ? '#26a69a' : '#ef5350',
        shape: s.side === 'buy' ? 'arrowUp' : 'arrowDown',
        text: s.side.toUpperCase(),
      })),
    );

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, signals]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
