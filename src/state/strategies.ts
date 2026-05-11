export type SavedStrategy = {
  id: string;
  name: string;
  code: string;
  builtin?: boolean;
};

const STORAGE_KEY = 'backtester:strategies:v1';

export const PRESETS: SavedStrategy[] = [
  {
    id: 'preset-sma-cross',
    name: 'SMA Crossover',
    builtin: true,
    code: `// Buy when fast SMA crosses above slow SMA; sell on opposite cross.
const fastN = ctx.param('fastSMA', 10, { min: 2, max: 50 });
const slowN = ctx.param('slowSMA', 30, { min: 5, max: 200 });

const fast = ctx.sma(fastN);
const slow = ctx.sma(slowN);
if (fast.prev === undefined || slow.prev === undefined) return;

if (fast.prev <= slow.prev && fast.now > slow.now) ctx.buy();
if (fast.prev >= slow.prev && fast.now < slow.now) ctx.sell();
`,
  },
  {
    id: 'preset-rsi',
    name: 'RSI Mean Reversion',
    builtin: true,
    code: `// Buy when RSI dips below oversold threshold; sell when it crosses overbought.
const period   = ctx.param('rsiPeriod', 14, { min: 2, max: 50 });
const buyAt    = ctx.param('oversold', 30, { min: 5, max: 45 });
const sellAt   = ctx.param('overbought', 70, { min: 55, max: 95 });

const r = ctx.rsi(period);
if (r.now === undefined || r.prev === undefined) return;

if (r.prev > buyAt && r.now <= buyAt) ctx.buy();
if (r.prev < sellAt && r.now >= sellAt) ctx.sell();
`,
  },
  {
    id: 'preset-buy-and-hold',
    name: 'Buy & Hold',
    builtin: true,
    code: `// Baseline: buy at first bar, never sell.
if (ctx.i === 0) ctx.buy();
`,
  },
];

export function loadStrategies(): SavedStrategy[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const userSaved = raw ? (JSON.parse(raw) as SavedStrategy[]) : [];
    return [...PRESETS, ...userSaved];
  } catch {
    return [...PRESETS];
  }
}

export function saveUserStrategies(all: SavedStrategy[]) {
  const userOnly = all.filter((s) => !s.builtin);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly));
}
