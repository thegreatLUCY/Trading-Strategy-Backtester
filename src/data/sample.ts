import type { Bar } from './types';

// Deterministic geometric-Brownian-motion-ish synthetic OHLCV.
// Daily bars going back N days from today.
export function generateSampleBars(days = 500, seed = 42): Bar[] {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };

  const bars: Bar[] = [];
  let price = 30000;
  const dayMs = 86400;
  const startSec = Math.floor(Date.now() / 1000) - days * dayMs;

  for (let i = 0; i < days; i++) {
    const drift = 0.0003;
    const vol = 0.025;
    const ret = drift + vol * (rand() * 2 - 1);
    const open = price;
    const close = open * (1 + ret);
    const high = Math.max(open, close) * (1 + rand() * 0.012);
    const low = Math.min(open, close) * (1 - rand() * 0.012);
    const volume = 1000 + rand() * 5000;
    bars.push({
      time: startSec + i * dayMs,
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }
  return bars;
}
