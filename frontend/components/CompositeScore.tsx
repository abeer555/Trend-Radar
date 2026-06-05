import clsx from "clsx";
import type { StockDetail, TopFactor } from "@/lib/types";
import ScoreBar from "./ScoreBar";

interface Props { stock: StockDetail; }

function scoreColor(s: number) {
  if (s >= 75) return "text-bull";
  if (s >= 50) return "text-accent";
  if (s >= 25) return "text-warn";
  return "text-bear";
}

function FactorBar({ factor }: { factor: TopFactor }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{factor.factor}</span>
        <span className="font-mono text-text-dim">
          {factor.raw_score.toFixed(0)}/100 × {(factor.weight * 100).toFixed(0)}% = {(factor.contribution).toFixed(1)}pts
        </span>
      </div>
      <ScoreBar score={factor.raw_score} size="sm" showNumber={false} />
    </div>
  );
}

export default function CompositeScore({ stock }: Props) {
  const score = stock.composite_score ?? 0;
  const tops  = stock.top_factors ?? [];

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Composite Score</h3>
        <span className={clsx("text-4xl font-bold tabular-nums", scoreColor(score))}>
          {score.toFixed(1)}
        </span>
      </div>

      <ScoreBar score={score} size="lg" showNumber={false} />

      {tops.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Top 3 Contributing Factors
          </p>
          <div className="flex flex-col gap-3">
            {tops.map(f => <FactorBar key={f.key} factor={f} />)}
          </div>
        </div>
      )}

      <div className="mt-4 rounded border border-border/50 bg-bg p-2.5 text-xs text-muted">
        Score = weighted sum of 10 rule-based signals (0-100 each). Weights are
        configured in <code className="font-mono text-accent">config.py</code>.
        Higher is more momentum-favourable by the formula — not a buy signal.
      </div>
    </div>
  );
}
