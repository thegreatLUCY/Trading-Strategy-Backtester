import type { Bar } from '../data/types';
import { sma, rsi } from './indicators';
import type { Signal } from './signals';
import { simulate, type SimResult } from './portfolio';
import { computeStats, type Stats } from './stats';

export type ParamSpec = {
  name: string;
  default: number;
  value: number;
  min: number;
  max: number;
  step: number;
};

export type RunInput = {
  bars: Bar[];
  code: string;
  paramOverrides?: Record<string, number>;
  startingCash?: number;
};

export type RunResult = {
  ok: true;
  signals: Signal[];
  sim: SimResult;
  stats: Stats;
  params: ParamSpec[];
} | {
  ok: false;
  error: string;
  params: ParamSpec[];
};

function makeIndicatorCache(closes: number[]) {
  const smaCache = new Map<number, (number | undefined)[]>();
  const rsiCache = new Map<number, (number | undefined)[]>();
  return {
    sma(period: number) {
      let series = smaCache.get(period);
      if (!series) {
        series = sma(closes, period);
        smaCache.set(period, series);
      }
      return series;
    },
    rsi(period: number) {
      let series = rsiCache.get(period);
      if (!series) {
        series = rsi(closes, period);
        rsiCache.set(period, series);
      }
      return series;
    },
  };
}

export function runStrategy(input: RunInput): RunResult {
  const { bars, code, paramOverrides = {} } = input;

  let userFn: (ctx: unknown) => void;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    userFn = new Function('ctx', code) as (ctx: unknown) => void;
  } catch (e) {
    return { ok: false, error: `Compile error: ${(e as Error).message}`, params: [] };
  }

  const closes = bars.map((b) => b.close);
  const cache = makeIndicatorCache(closes);
  const signals: Signal[] = [];
  const paramRegistry = new Map<string, ParamSpec>();
  let pseudoPos = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    let didEmit: 'buy' | 'sell' | null = null;

    const ctx = {
      i,
      bar,
      bars,
      position: pseudoPos,
      sma(period: number) {
        const series = cache.sma(period);
        return {
          now: series[i],
          prev: i > 0 ? series[i - 1] : undefined,
          series,
        };
      },
      rsi(period: number) {
        const series = cache.rsi(period);
        return {
          now: series[i],
          prev: i > 0 ? series[i - 1] : undefined,
          series,
        };
      },
      param(
        name: string,
        defaultValue: number,
        opts: { min?: number; max?: number; step?: number } = {},
      ): number {
        const min = opts.min ?? Math.max(1, Math.floor(defaultValue / 4));
        const max = opts.max ?? Math.max(defaultValue * 4, defaultValue + 10);
        const step = opts.step ?? 1;
        const override = paramOverrides[name];
        const value = override !== undefined ? override : defaultValue;
        if (!paramRegistry.has(name)) {
          paramRegistry.set(name, {
            name,
            default: defaultValue,
            value,
            min,
            max,
            step,
          });
        }
        return value;
      },
      buy() {
        if (didEmit) return;
        didEmit = 'buy';
      },
      sell() {
        if (didEmit) return;
        didEmit = 'sell';
      },
    };

    try {
      userFn(ctx);
    } catch (e) {
      return {
        ok: false,
        error: `Runtime error at bar ${i}: ${(e as Error).message}`,
        params: Array.from(paramRegistry.values()),
      };
    }

    if (didEmit === 'buy' && pseudoPos === 0) {
      signals.push({ time: bar.time, price: bar.close, side: 'buy' });
      pseudoPos = 1;
    } else if (didEmit === 'sell' && pseudoPos > 0) {
      signals.push({ time: bar.time, price: bar.close, side: 'sell' });
      pseudoPos = 0;
    }
  }

  const sim = simulate(bars, signals, { startingCash: input.startingCash });
  const stats = computeStats(sim.equityCurve, sim.trades);
  return {
    ok: true,
    signals,
    sim,
    stats,
    params: Array.from(paramRegistry.values()),
  };
}
