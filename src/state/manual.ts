import type { Signal } from '../engine/signals';

const KEY_PREFIX = 'backtester:manual:';

export function loadManualSignals(datasetId: string): Signal[] {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + datasetId);
    return raw ? (JSON.parse(raw) as Signal[]) : [];
  } catch {
    return [];
  }
}

export function saveManualSignals(datasetId: string, signals: Signal[]) {
  localStorage.setItem(KEY_PREFIX + datasetId, JSON.stringify(signals));
}
