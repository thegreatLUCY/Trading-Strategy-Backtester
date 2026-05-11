import { useEffect, useMemo, useRef, useState } from 'react';
import { generateSampleBars } from './data/sample';
import { DATASETS, loadDataset, type DatasetSource } from './data/sources';
import type { BinanceInterval } from './data/binance';
import { parseCsv } from './data/csv';
import type { Bar } from './data/types';
import { simulate, type SimResult } from './engine/portfolio';
import { computeStats, type Stats } from './engine/stats';
import type { Signal } from './engine/signals';
import type { ParamSpec, RunInput, RunResult } from './engine/strategy-runner';
import {
  loadStrategies,
  saveUserStrategies,
  type SavedStrategy,
} from './state/strategies';
import { loadManualSignals, saveManualSignals } from './state/manual';
import { ChartStack } from './ui/ChartStack';
import { StatsPanel } from './ui/StatsPanel';
import { StrategyEditor } from './ui/StrategyEditor';
import { Toolbar } from './ui/Toolbar';
import { ParamsPanel } from './ui/ParamsPanel';
import { Splitter } from './ui/Splitter';
import './App.css';

const RUN_TIMEOUT_MS = 5000;
const PARAM_DEBOUNCE_MS = 200;

function emptySim(): SimResult {
  return { equityCurve: [], trades: [], finalEquity: 0, startEquity: 0 };
}

type Mode = 'strategy' | 'manual';

const LAYOUT_KEY = 'backtester:layout:v1';
type Layout = { editorWidth: number; statsWidth: number };
const DEFAULT_LAYOUT: Layout = { editorWidth: 380, statsWidth: 320 };

const CASH_KEY = 'backtester:startingCash:v1';
const DEFAULT_CASH = 10_000;
function loadCash(): number {
  const raw = localStorage.getItem(CASH_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CASH;
}

function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? { ...DEFAULT_LAYOUT, ...JSON.parse(raw) } : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function App() {
  const [mode, setMode] = useState<Mode>('strategy');
  const [startingCash, setStartingCashState] = useState<number>(() => loadCash());
  const setStartingCash = (n: number) => {
    setStartingCashState(n);
    localStorage.setItem(CASH_KEY, String(n));
  };
  const [layout, setLayout] = useState<Layout>(() => loadLayout());
  const updateLayout = (patch: Partial<Layout>) => {
    const next = { ...layout, ...patch };
    setLayout(next);
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
  };

  // ---- Datasets ----
  const [datasetId, setDatasetId] = useState<string>('synth-btc');
  const [datasetLabel, setDatasetLabel] = useState<string>('Synthetic BTC');
  const [bars, setBars] = useState<Bar[]>(() => generateSampleBars(500));
  const [loadingDataset, setLoadingDataset] = useState(false);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [interval, setIntervalState] = useState<BinanceInterval>('1d');
  const [totalBars, setTotalBars] = useState<number>(1000);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; target: number } | null>(null);

  // ---- Strategies ----
  const [strategies, setStrategies] = useState<SavedStrategy[]>(() => loadStrategies());
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(
    strategies[0]?.id ?? 'preset-sma-cross',
  );
  const selected = strategies.find((s) => s.id === selectedStrategyId)!;
  const [code, setCode] = useState<string>(selected.code);

  // ---- Manual mode ----
  const [manualSignals, setManualSignals] = useState<Signal[]>(() =>
    loadManualSignals('synth-btc'),
  );

  // ---- Run results (strategy mode) ----
  const [signals, setSignals] = useState<Signal[]>([]);
  const [sim, setSim] = useState<SimResult>(emptySim);
  const [stats, setStats] = useState<Stats | null>(null);
  const [params, setParams] = useState<ParamSpec[]>([]);
  const [paramOverrides, setParamOverrides] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Re-load editor code whenever the selected strategy changes.
  useEffect(() => {
    if (!selected) return;
    setCode(selected.code);
    setParamOverrides({});
  }, [selectedStrategyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull manual signals from localStorage when the dataset changes.
  useEffect(() => {
    setManualSignals(loadManualSignals(datasetId));
  }, [datasetId]);

  const runCode = (codeArg: string, overrides: Record<string, number>) => {
    setError(null);
    setRunning(true);
    if (workerRef.current) workerRef.current.terminate();
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    const worker = new Worker(
      new URL('./engine/runner.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    timeoutRef.current = window.setTimeout(() => {
      worker.terminate();
      workerRef.current = null;
      setError(`Strategy timed out after ${RUN_TIMEOUT_MS} ms.`);
      setRunning(false);
    }, RUN_TIMEOUT_MS);

    worker.onmessage = (e: MessageEvent<RunResult>) => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      const res = e.data;
      setParams(res.params);
      if (res.ok) {
        setSignals(res.signals);
        setSim(res.sim);
        setStats(res.stats);
      } else {
        setError(res.error);
      }
      worker.terminate();
      workerRef.current = null;
      setRunning(false);
    };
    worker.onerror = (e) => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      setError(e.message || 'Worker crashed');
      worker.terminate();
      workerRef.current = null;
      setRunning(false);
    };

    const input: RunInput = {
      bars,
      code: codeArg,
      paramOverrides: overrides,
      startingCash,
    };
    worker.postMessage(input);
  };

  // Auto-run strategy on bars/code/cash change. Param changes debounce.
  useEffect(() => {
    if (mode !== 'strategy') return;
    runCode(code, paramOverrides);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, code, mode, startingCash]);

  const onBarClick = (time: number) => {
    // If the clicked bar already has a signal, remove it. Otherwise append
    // — side determined by what would keep buy/sell alternating.
    const existing = manualSignals.findIndex((s) => s.time === time);
    let next: Signal[];
    if (existing >= 0) {
      next = manualSignals.filter((_, i) => i !== existing);
    } else {
      const last = manualSignals[manualSignals.length - 1];
      const side: 'buy' | 'sell' = !last || last.side === 'sell' ? 'buy' : 'sell';
      const bar = bars.find((b) => b.time === time);
      if (!bar) return;
      next = [...manualSignals, { time, price: bar.close, side }].sort(
        (a, b) => a.time - b.time,
      );
    }
    setManualSignals(next);
    saveManualSignals(datasetId, next);
  };

  const onClearManual = () => {
    setManualSignals([]);
    saveManualSignals(datasetId, []);
  };

  const onParamChange = (name: string, value: number) => {
    const next = { ...paramOverrides, [name]: value };
    setParamOverrides(next);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(
      () => runCode(code, next),
      PARAM_DEBOUNCE_MS,
    );
  };

  const loadBinanceOrSynthetic = async (id: string, src: DatasetSource) => {
    setLoadingDataset(true);
    setLoadProgress({ loaded: 0, target: totalBars });
    try {
      const fetched = await loadDataset(src, {
        interval,
        totalBars,
        onProgress: (loaded, target) => setLoadProgress({ loaded, target }),
      });
      setBars(fetched);
      setDatasetId(id);
      setDatasetLabel(src.label);
    } catch (e) {
      setDatasetError((e as Error).message);
    } finally {
      setLoadingDataset(false);
      setLoadProgress(null);
    }
  };

  const onDatasetChange = async (
    id: string,
    csvText?: string,
    csvName?: string,
  ) => {
    setDatasetError(null);
    if (id === 'csv' && csvText) {
      try {
        const parsed = parseCsv(csvText);
        if (parsed.length === 0) throw new Error('No bars parsed');
        setBars(parsed);
        setDatasetId('csv');
        setDatasetLabel(csvName ?? 'Custom CSV');
      } catch (e) {
        setDatasetError(`CSV: ${(e as Error).message}`);
      }
      return;
    }
    const src = DATASETS.find((d) => d.id === id) as DatasetSource | undefined;
    if (!src) return;
    await loadBinanceOrSynthetic(id, src);
  };

  // Re-fetch when interval or bar count changes for the currently-loaded
  // Binance dataset. Synthetic + CSV ignore these knobs.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const src = DATASETS.find((d) => d.id === datasetId);
    if (!src || src.kind !== 'binance') return;
    loadBinanceOrSynthetic(datasetId, src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, totalBars]);

  const handleSave = () => {
    if (selected.builtin) {
      handleSaveAs();
      return;
    }
    const next = strategies.map((s) =>
      s.id === selected.id ? { ...s, code } : s,
    );
    setStrategies(next);
    saveUserStrategies(next);
  };

  const handleSaveAs = () => {
    const name = window.prompt('Strategy name:', `${selected.name} (copy)`);
    if (!name) return;
    const id = `user-${Date.now()}`;
    const newStrat: SavedStrategy = { id, name, code };
    const next = [...strategies, newStrat];
    setStrategies(next);
    saveUserStrategies(next);
    setSelectedStrategyId(id);
  };

  const handleDelete = () => {
    if (selected.builtin) return;
    if (!window.confirm(`Delete "${selected.name}"?`)) return;
    const next = strategies.filter((s) => s.id !== selected.id);
    setStrategies(next);
    saveUserStrategies(next);
    setSelectedStrategyId(next[0]?.id ?? 'preset-sma-cross');
  };

  // In strategy mode, displayed signals come from the worker run. In manual
  // mode, they come from clicks — and the (cheap) simulator runs on the main
  // thread.
  const activeSignals = mode === 'manual' ? manualSignals : signals;
  const manualSim = useMemo(
    () =>
      mode === 'manual'
        ? simulate(bars, manualSignals, { startingCash })
        : null,
    [bars, manualSignals, mode, startingCash],
  );
  const fallbackSim = useMemo(
    () => simulate(bars, activeSignals, { startingCash }),
    [bars, activeSignals, startingCash],
  );
  const displaySim =
    mode === 'manual' && manualSim
      ? manualSim
      : sim.equityCurve.length
        ? sim
        : fallbackSim;
  const displayStats =
    mode === 'manual'
      ? computeStats(displaySim.equityCurve, displaySim.trades)
      : (stats ?? computeStats(fallbackSim.equityCurve, fallbackSim.trades));

  return (
    <div className="app">
      <Toolbar
        mode={mode}
        onModeChange={setMode}
        datasetId={datasetId}
        onDatasetChange={onDatasetChange}
        interval={interval}
        onIntervalChange={setIntervalState}
        totalBars={totalBars}
        onTotalBarsChange={setTotalBars}
        loadingDataset={loadingDataset}
        loadProgress={loadProgress}
        startingCash={startingCash}
        onStartingCashChange={setStartingCash}
        strategies={strategies}
        selectedStrategyId={selectedStrategyId}
        onSelectStrategy={setSelectedStrategyId}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onDelete={handleDelete}
        canDelete={!selected.builtin}
        running={running}
        onRun={() => runCode(code, paramOverrides)}
        manualSignalCount={manualSignals.length}
        onClearManual={onClearManual}
      />
      {datasetError && <div className="banner-error">Dataset error: {datasetError}</div>}
      <div className="app-body">
        {mode === 'strategy' && (
          <>
            <aside className="left-panel" style={{ width: layout.editorWidth }}>
              <div className="panel-header">
                <span className="panel-title">{selected.name}</span>
                <span className="panel-sub">
                  {datasetLabel} · {bars.length.toLocaleString()} bars
                  {DATASETS.find((d) => d.id === datasetId)?.kind === 'binance' && ` · ${interval}`}
                </span>
              </div>
              <StrategyEditor code={code} onChange={setCode} error={error} />
              <ParamsPanel
                params={params}
                overrides={paramOverrides}
                onChange={onParamChange}
              />
            </aside>
            <Splitter
              side="after"
              width={layout.editorWidth}
              min={260}
              max={640}
              onChange={(w) => updateLayout({ editorWidth: w })}
            />
          </>
        )}
        <main className="chart-pane">
          {mode === 'manual' && (
            <div className="manual-banner">
              <span className="manual-dot" />
              <span>
                Manual mode — click a bar to {
                  manualSignals.length % 2 === 0 ? 'BUY' : 'SELL'
                }. Click an existing marker to remove it.
              </span>
            </div>
          )}
          <ChartStack
            bars={bars}
            signals={activeSignals}
            equity={displaySim.equityCurve}
            startEquity={displaySim.startEquity || startingCash}
            onBarClick={mode === 'manual' ? onBarClick : undefined}
          />
        </main>
        <Splitter
          side="before"
          width={layout.statsWidth}
          min={260}
          max={520}
          onChange={(w) => updateLayout({ statsWidth: w })}
        />
        <aside className="stats-wrap" style={{ width: layout.statsWidth }}>
          <StatsPanel
            stats={displayStats}
            trades={displaySim.trades}
            startEquity={displaySim.startEquity || startingCash}
            finalEquity={displaySim.finalEquity || startingCash}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
