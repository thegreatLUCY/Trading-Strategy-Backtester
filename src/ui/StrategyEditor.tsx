import Editor from '@monaco-editor/react';

type Props = {
  code: string;
  onChange: (code: string) => void;
  error: string | null;
};

export function StrategyEditor({ code, onChange, error }: Props) {
  return (
    <div className="editor-wrap">
      <div className="editor-host">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          theme="vs-dark"
          value={code}
          onChange={(v) => onChange(v ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 12 },
          }}
        />
      </div>
      {error && <div className="editor-error">{error}</div>}
      <details className="editor-help">
        <summary>API reference</summary>
        <pre>{`ctx.bar          // current OHLCV bar
ctx.i            // bar index
ctx.position     // 0 (flat) or 1 (long)
ctx.sma(n)       // { now, prev, series }
ctx.rsi(n=14)    // { now, prev, series }
ctx.param(name, default, {min, max, step})
ctx.buy()        // signal a buy at this bar
ctx.sell()       // signal a sell at this bar`}</pre>
      </details>
    </div>
  );
}
