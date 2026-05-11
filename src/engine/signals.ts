import type { Bar } from '../data/types';
import { sma } from './indicators';

export type Signal = {
  time: number;
  price: number;
  side: 'buy' | 'sell';
};

export type SmaCrossResult = {
  fast: (number | undefined)[];
  slow: (number | undefined)[];
  signals: Signal[];
};

// Generate buy/sell signals from an SMA crossover.
// A "buy" fires when the fast SMA crosses from below to above the slow SMA;
// a "sell" fires on the opposite cross. We compare today's relationship to
// yesterday's — that flip is the crossing event.
export function smaCrossover(
  bars: Bar[],
  fastPeriod: number,
  slowPeriod: number,
): SmaCrossResult {
  const closes = bars.map((b) => b.close);
  const fast = sma(closes, fastPeriod);
  const slow = sma(closes, slowPeriod);
  const signals: Signal[] = [];

  for (let i = 1; i < bars.length; i++) {
    const f0 = fast[i - 1], s0 = slow[i - 1];
    const f1 = fast[i],     s1 = slow[i];
    if (f0 === undefined || s0 === undefined) continue;
    if (f1 === undefined || s1 === undefined) continue;

    const wasBelow = f0 <= s0;
    const isAbove = f1 > s1;
    const wasAbove = f0 >= s0;
    const isBelow = f1 < s1;

    if (wasBelow && isAbove) {
      signals.push({ time: bars[i].time, price: bars[i].close, side: 'buy' });
    } else if (wasAbove && isBelow) {
      signals.push({ time: bars[i].time, price: bars[i].close, side: 'sell' });
    }
  }
  return { fast, slow, signals };
}
