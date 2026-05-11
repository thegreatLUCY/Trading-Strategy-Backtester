import type { Trade } from '../engine/portfolio';
import type { Stats } from '../engine/stats';

type Props = {
  stats: Stats;
  trades: Trade[];
  startEquity: number;
  finalEquity: number;
};

const fmtUsd = (n: number) =>
  (n < 0 ? '-$' : '$') +
  Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

const fmtPct = (n: number) =>
  `${(n * 100).toFixed(2)}%`;

const fmtDate = (sec: number) =>
  new Date(sec * 1000).toISOString().slice(0, 10);

export function StatsPanel({ stats, trades, startEquity, finalEquity }: Props) {
  const items: Array<{ label: string; value: string; tone?: 'pos' | 'neg' }> = [
    {
      label: 'Total return',
      value: fmtPct(stats.totalReturn),
      tone: stats.totalReturn >= 0 ? 'pos' : 'neg',
    },
    { label: 'Equity', value: `${fmtUsd(startEquity)} → ${fmtUsd(finalEquity)}` },
    { label: 'Sharpe (ann.)', value: stats.sharpe.toFixed(2) },
    {
      label: 'Max drawdown',
      value: fmtPct(stats.maxDrawdown),
      tone: 'neg',
    },
    { label: 'Trades', value: String(stats.numTrades) },
    { label: 'Win rate', value: fmtPct(stats.winRate) },
    { label: 'Avg P&L', value: fmtUsd(stats.avgTradePnl) },
    { label: 'Best / worst', value: `${fmtUsd(stats.bestTrade)} / ${fmtUsd(stats.worstTrade)}` },
  ];

  return (
    <aside className="stats-panel">
      <h2>Performance</h2>
      <dl className="metrics">
        {items.map((it) => (
          <div className="metric" key={it.label}>
            <dt>{it.label}</dt>
            <dd className={it.tone}>{it.value}</dd>
          </div>
        ))}
      </dl>
      <h2>Trades</h2>
      <div className="trades">
        {trades.length === 0 && <p className="empty">No completed trades.</p>}
        {trades
          .slice()
          .reverse()
          .map((t, i) => (
            <div className={`trade ${t.pnl >= 0 ? 'pos' : 'neg'}`} key={i}>
              <div className="t-dates">
                {fmtDate(t.entryTime)} → {fmtDate(t.exitTime)}
              </div>
              <div className="t-prices">
                ${t.entryPrice.toFixed(0)} → ${t.exitPrice.toFixed(0)}
              </div>
              <div className="t-pnl">
                {fmtUsd(t.pnl)} <span className="t-pct">({fmtPct(t.pnlPct)})</span>
              </div>
            </div>
          ))}
      </div>
    </aside>
  );
}
