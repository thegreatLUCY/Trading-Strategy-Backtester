import type { EquityPoint, Trade } from './portfolio';

export type Stats = {
  totalReturn: number;       // fraction, e.g. 0.42 = +42%
  winRate: number;           // fraction of trades with pnl > 0
  numTrades: number;
  maxDrawdown: number;       // fraction, positive number (e.g. 0.27)
  sharpe: number;            // annualized, assuming daily bars
  avgTradePnl: number;
  bestTrade: number;
  worstTrade: number;
};

export function computeStats(
  equity: EquityPoint[],
  trades: Trade[],
  barsPerYear = 252,
): Stats {
  if (equity.length === 0) return zeroStats();

  const start = equity[0].equity;
  const end = equity[equity.length - 1].equity;
  const totalReturn = end / start - 1;

  // Max drawdown: track running peak, take the worst (peak - equity)/peak.
  let peak = -Infinity;
  let maxDd = 0;
  for (const p of equity) {
    if (p.equity > peak) peak = p.equity;
    const dd = (peak - p.equity) / peak;
    if (dd > maxDd) maxDd = dd;
  }

  // Sharpe: per-bar log returns, mean / stdev, annualized.
  // (Excluding risk-free rate for simplicity — common in backtest reports.)
  const rets: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    const a = equity[i - 1].equity;
    const b = equity[i].equity;
    if (a > 0) rets.push(Math.log(b / a));
  }
  const mean = rets.reduce((s, x) => s + x, 0) / (rets.length || 1);
  const variance =
    rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length || 1);
  const stdev = Math.sqrt(variance);
  const sharpe = stdev > 0 ? (mean / stdev) * Math.sqrt(barsPerYear) : 0;

  const wins = trades.filter((t) => t.pnl > 0).length;
  const winRate = trades.length ? wins / trades.length : 0;
  const avgTradePnl = trades.length
    ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length
    : 0;
  const bestTrade = trades.reduce((m, t) => Math.max(m, t.pnl), -Infinity);
  const worstTrade = trades.reduce((m, t) => Math.min(m, t.pnl), Infinity);

  return {
    totalReturn,
    winRate,
    numTrades: trades.length,
    maxDrawdown: maxDd,
    sharpe,
    avgTradePnl,
    bestTrade: isFinite(bestTrade) ? bestTrade : 0,
    worstTrade: isFinite(worstTrade) ? worstTrade : 0,
  };
}

function zeroStats(): Stats {
  return {
    totalReturn: 0,
    winRate: 0,
    numTrades: 0,
    maxDrawdown: 0,
    sharpe: 0,
    avgTradePnl: 0,
    bestTrade: 0,
    worstTrade: 0,
  };
}
