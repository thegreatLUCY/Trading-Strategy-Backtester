import type { ParamSpec } from '../engine/strategy-runner';

type Props = {
  params: ParamSpec[];
  overrides: Record<string, number>;
  onChange: (name: string, value: number) => void;
};

export function ParamsPanel({ params, overrides, onChange }: Props) {
  if (params.length === 0) return null;
  return (
    <div className="params">
      <h2>Parameters</h2>
      {params.map((p) => {
        const v = overrides[p.name] ?? p.value;
        return (
          <div className="param-row" key={p.name}>
            <div className="param-label">
              <span>{p.name}</span>
              <span className="param-value">{v}</span>
            </div>
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={v}
              onChange={(e) => onChange(p.name, Number(e.target.value))}
            />
          </div>
        );
      })}
    </div>
  );
}
