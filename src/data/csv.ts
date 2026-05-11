import type { Bar } from './types';

// Tolerant CSV parser. Looks for columns named time/date, open, high, low,
// close, volume (case-insensitive). Time can be a unix-seconds, unix-ms, or
// ISO date string.
export function parseCsv(text: string): Bar[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (names: string[]) =>
    names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;

  const tIdx = idx(['time', 'date', 'timestamp']);
  const oIdx = idx(['open']);
  const hIdx = idx(['high']);
  const lIdx = idx(['low']);
  const cIdx = idx(['close']);
  const vIdx = idx(['volume', 'vol']);

  if (tIdx < 0 || oIdx < 0 || cIdx < 0)
    throw new Error('CSV must have at least time, open, close columns');

  const bars: Bar[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const tStr = cols[tIdx]?.trim();
    if (!tStr) continue;
    let time: number;
    if (/^\d+$/.test(tStr)) {
      const n = Number(tStr);
      time = n > 1e12 ? Math.floor(n / 1000) : n;
    } else {
      time = Math.floor(new Date(tStr).getTime() / 1000);
    }
    if (!isFinite(time)) continue;
    const open = Number(cols[oIdx]);
    const close = Number(cols[cIdx]);
    const high = hIdx >= 0 ? Number(cols[hIdx]) : Math.max(open, close);
    const low = lIdx >= 0 ? Number(cols[lIdx]) : Math.min(open, close);
    const volume = vIdx >= 0 ? Number(cols[vIdx]) : 0;
    bars.push({ time, open, high, low, close, volume });
  }
  bars.sort((a, b) => a.time - b.time);
  return bars;
}
