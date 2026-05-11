import type { Bar } from './types';

export const BINANCE_INTERVALS = [
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '1d',
  '1w',
] as const;
export type BinanceInterval = (typeof BINANCE_INTERVALS)[number];

const BINANCE_PAGE_SIZE = 1000;

type FetchOpts = {
  symbol: string;
  interval: BinanceInterval;
  totalBars?: number;        // how many bars to fetch in total (paginates)
  onProgress?: (loaded: number, target: number) => void;
};

// Binance public klines, paginated backward. Each request fills in up to 1000
// bars; we use each batch's oldest openTime as the next request's endTime to
// walk further back in history.
//
// Each kline is:
// [openTime, open, high, low, close, volume, closeTime, ...]
// Times are in ms; we normalize to seconds for lightweight-charts.
export async function fetchBinance({
  symbol,
  interval,
  totalBars = 1000,
  onProgress,
}: FetchOpts): Promise<Bar[]> {
  const all: Bar[] = [];
  let endTime: number | undefined = undefined;
  const seen = new Set<number>();

  while (all.length < totalBars) {
    const remaining = totalBars - all.length;
    const limit = Math.min(BINANCE_PAGE_SIZE, remaining);

    let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    if (endTime !== undefined) url += `&endTime=${endTime}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance ${res.status}: ${await res.text()}`);
    const raw = (await res.json()) as unknown[][];
    if (raw.length === 0) break; // exchange has no more history

    const batch: Bar[] = raw.map((k) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));

    let added = 0;
    for (const b of batch) {
      if (seen.has(b.time)) continue;
      seen.add(b.time);
      all.push(b);
      added++;
    }
    if (added === 0) break; // we've walked past available history

    onProgress?.(all.length, totalBars);

    // Next page ends one millisecond before this page's oldest bar.
    const oldestMs = Number(raw[0][0]);
    endTime = oldestMs - 1;
    if (batch.length < limit) break; // exchange returned a short page → end of history
  }

  all.sort((a, b) => a.time - b.time);
  return all;
}
