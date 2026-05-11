import type { Bar } from '../data/types';
import type { Signal } from './signals';

export type Trade = {
  entryTime: number;
  entryPrice: number;
  exitTime: number;
  exitPrice: number;
  qty: number;
  pnl: number;        // dollar profit/loss after fees
  pnlPct: number;     // % return on the capital used for entry
};

export type EquityPoint = {
  time: number;
  equity: number;
  cash: number;
  position: number;
};

export type SimResult = {
  equityCurve: EquityPoint[];
  trades: Trade[];
  finalEquity: number;
  startEquity: number;
};

export type SimOptions = {
  startingCash?: number;
  feeRate?: number; // e.g. 0.001 = 0.1% per fill
};

// Walk through bars; on each bar, mark equity. If a signal fires on this bar,
// execute it at the bar's close (a common simplification — real backtests
// often fill on next bar's open to avoid lookahead bias; we'll address that
// later). All-in / all-out sizing.
export function simulate(
  bars: Bar[],
  signals: Signal[],
  opts: SimOptions = {},
): SimResult {
  const startingCash = opts.startingCash ?? 10_000;
  const feeRate = opts.feeRate ?? 0.001;

  // Index signals by time for O(1) lookup per bar.
  const signalByTime = new Map<number, Signal>();
  for (const s of signals) signalByTime.set(s.time, s);

  let cash = startingCash;
  let position = 0;     // units of asset held
  let entryPrice = 0;   // price at which the current position was opened
  let entryTime = 0;
  const trades: Trade[] = [];
  const equityCurve: EquityPoint[] = [];

  for (const bar of bars) {
    const sig = signalByTime.get(bar.time);
    if (sig) {
      if (sig.side === 'buy' && position === 0) {
        // Spend all cash on the asset, minus fee.
        const grossQty = cash / bar.close;
        const fee = cash * feeRate;
        const qty = (cash - fee) / bar.close;
        position = qty;
        entryPrice = bar.close;
        entryTime = bar.time;
        cash = 0;
        void grossQty; // illustrative
      } else if (sig.side === 'sell' && position > 0) {
        const gross = position * bar.close;
        const fee = gross * feeRate;
        const proceeds = gross - fee;
        const costBasis = position * entryPrice; // entry fee already netted into qty
        const pnl = proceeds - costBasis;
        const pnlPct = pnl / costBasis;
        trades.push({
          entryTime,
          entryPrice,
          exitTime: bar.time,
          exitPrice: bar.close,
          qty: position,
          pnl,
          pnlPct,
        });
        cash = proceeds;
        position = 0;
        entryPrice = 0;
      }
    }
    const equity = cash + position * bar.close;
    equityCurve.push({ time: bar.time, equity, cash, position });
  }

  return {
    equityCurve,
    trades,
    finalEquity: equityCurve[equityCurve.length - 1]?.equity ?? startingCash,
    startEquity: startingCash,
  };
}
