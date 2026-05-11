import type { Bar } from './types';
import { generateSampleBars } from './sample';
import { fetchBinance, type BinanceInterval } from './binance';

export type DatasetSource =
  | { kind: 'synthetic'; id: string; label: string }
  | { kind: 'binance'; id: string; label: string; symbol: string }
  | { kind: 'csv'; id: 'csv'; label: 'Custom (upload)' };

export const DATASETS: DatasetSource[] = [
  { kind: 'synthetic', id: 'synth-btc', label: 'Synthetic BTC' },
  { kind: 'binance', id: 'btc', label: 'BTC / USDT', symbol: 'BTCUSDT' },
  { kind: 'binance', id: 'eth', label: 'ETH / USDT', symbol: 'ETHUSDT' },
  { kind: 'binance', id: 'sol', label: 'SOL / USDT', symbol: 'SOLUSDT' },
  { kind: 'binance', id: 'bnb', label: 'BNB / USDT', symbol: 'BNBUSDT' },
  { kind: 'binance', id: 'xrp', label: 'XRP / USDT', symbol: 'XRPUSDT' },
  { kind: 'binance', id: 'doge', label: 'DOGE / USDT', symbol: 'DOGEUSDT' },
  { kind: 'binance', id: 'ada', label: 'ADA / USDT', symbol: 'ADAUSDT' },
  { kind: 'binance', id: 'link', label: 'LINK / USDT', symbol: 'LINKUSDT' },
  { kind: 'csv', id: 'csv', label: 'Custom (upload)' },
];

export type LoadOpts = {
  interval: BinanceInterval;
  totalBars: number;
  onProgress?: (loaded: number, target: number) => void;
};

export async function loadDataset(
  src: DatasetSource,
  opts: LoadOpts,
): Promise<Bar[]> {
  if (src.kind === 'synthetic') return generateSampleBars(Math.min(opts.totalBars, 2000));
  if (src.kind === 'binance')
    return fetchBinance({
      symbol: src.symbol,
      interval: opts.interval,
      totalBars: opts.totalBars,
      onProgress: opts.onProgress,
    });
  throw new Error('CSV must be loaded via parseCsv directly');
}
