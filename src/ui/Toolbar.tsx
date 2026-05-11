import { useRef } from 'react';
import { DATASETS, type DatasetSource } from '../data/sources';
import { BINANCE_INTERVALS, type BinanceInterval } from '../data/binance';
import type { SavedStrategy } from '../state/strategies';

type Mode = 'strategy' | 'manual';

type Props = {
  mode: Mode;
  onModeChange: (m: Mode) => void;

  datasetId: string;
  onDatasetChange: (id: string, csvText?: string, csvName?: string) => void;
  interval: BinanceInterval;
  onIntervalChange: (i: BinanceInterval) => void;
  totalBars: number;
  onTotalBarsChange: (n: number) => void;
  loadingDataset: boolean;
  loadProgress: { loaded: number; target: number } | null;

  strategies: SavedStrategy[];
  selectedStrategyId: string;
  onSelectStrategy: (id: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onDelete: () => void;
  canDelete: boolean;

  running: boolean;
  onRun: () => void;

  manualSignalCount: number;
  onClearManual: () => void;

  startingCash: number;
  onStartingCashChange: (n: number) => void;
};

const BAR_COUNTS = [500, 1000, 3000, 5000, 10000];

export function Toolbar(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isBinance = DATASETS.find((d) => d.id === props.datasetId)?.kind === 'binance';

  const handleDatasetSelect = (id: string) => {
    if (id === 'csv') {
      fileRef.current?.click();
      return;
    }
    props.onDatasetChange(id);
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    props.onDatasetChange('csv', text, file.name);
  };

  const progressPct =
    props.loadProgress && props.loadProgress.target > 0
      ? Math.round((props.loadProgress.loaded / props.loadProgress.target) * 100)
      : 0;

  return (
    <header className="toolbar">
      <div className="brand">
        <img className="brand-mark" src="/logo.png" alt="" />
        <span className="brand-name">Backtester</span>
      </div>

      <div className="seg">
        <button
          className={props.mode === 'strategy' ? 'seg-btn active' : 'seg-btn'}
          onClick={() => props.onModeChange('strategy')}
        >
          Strategy
        </button>
        <button
          className={props.mode === 'manual' ? 'seg-btn active' : 'seg-btn'}
          onClick={() => props.onModeChange('manual')}
        >
          Manual
        </button>
      </div>

      <div className="tool-group">
        <label className="tool-label">Dataset</label>
        <select
          className="tool-select"
          value={props.datasetId}
          onChange={(e) => handleDatasetSelect(e.target.value)}
          disabled={props.loadingDataset}
        >
          {DATASETS.map((d: DatasetSource) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {isBinance && (
        <div className="tool-group">
          <label className="tool-label">Interval</label>
          <select
            className="tool-select"
            value={props.interval}
            onChange={(e) => props.onIntervalChange(e.target.value as BinanceInterval)}
            disabled={props.loadingDataset}
          >
            {BINANCE_INTERVALS.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <label className="tool-label">Bars</label>
          <select
            className="tool-select"
            value={props.totalBars}
            onChange={(e) => props.onTotalBarsChange(Number(e.target.value))}
            disabled={props.loadingDataset}
          >
            {BAR_COUNTS.map((n) => (
              <option key={n} value={n}>{n.toLocaleString()}</option>
            ))}
          </select>
        </div>
      )}

      {props.loadingDataset && (
        <div className="loader">
          <div className="loader-bar"><div className="loader-fill" style={{ width: `${progressPct}%` }} /></div>
          <span className="hint">
            {props.loadProgress
              ? `${props.loadProgress.loaded.toLocaleString()} / ${props.loadProgress.target.toLocaleString()}`
              : 'loading…'}
          </span>
        </div>
      )}

      {props.mode === 'strategy' && !props.loadingDataset && (
        <div className="tool-group">
          <label className="tool-label">Strategy</label>
          <select
            className="tool-select"
            value={props.selectedStrategyId}
            onChange={(e) => props.onSelectStrategy(e.target.value)}
          >
            <optgroup label="Built-in">
              {props.strategies
                .filter((s) => s.builtin)
                .map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </optgroup>
            {props.strategies.some((s) => !s.builtin) && (
              <optgroup label="Saved">
                {props.strategies
                  .filter((s) => !s.builtin)
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </optgroup>
            )}
          </select>
          <button className="btn-ghost" onClick={props.onSave}>Save</button>
          <button className="btn-ghost" onClick={props.onSaveAs}>Save As</button>
          {props.canDelete && (
            <button className="btn-ghost danger" onClick={props.onDelete}>Delete</button>
          )}
        </div>
      )}

      {props.mode === 'manual' && (
        <div className="tool-group">
          <span className="hint">
            {props.manualSignalCount} marker{props.manualSignalCount === 1 ? '' : 's'}
          </span>
          <button
            className="btn-ghost danger"
            onClick={props.onClearManual}
            disabled={props.manualSignalCount === 0}
          >
            Clear
          </button>
        </div>
      )}

      <div className="tool-group">
        <label className="tool-label">Capital</label>
        <div className="cash-input">
          <span className="cash-prefix">$</span>
          <input
            type="number"
            min={100}
            step={1000}
            value={props.startingCash}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) props.onStartingCashChange(n);
            }}
          />
        </div>
      </div>

      <div className="tool-spacer" />

      {props.mode === 'strategy' && (
        <button
          className="btn-primary"
          onClick={props.onRun}
          disabled={props.running}
        >
          {props.running ? 'Running…' : 'Run ▶'}
        </button>
      )}
    </header>
  );
}
