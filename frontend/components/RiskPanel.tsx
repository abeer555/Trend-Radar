import clsx from "clsx";
import type { StockDetail } from "@/lib/types";

interface Props { stock: StockDetail; }

function fmt(v: number | null, decimals = 2): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}
function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

const LABEL_COLORS: Record<string, string> = {
  Low:     "bg-bull/10 text-bull border border-bull/30",
  Medium:  "bg-warn/10 text-warn border border-warn/30",
  High:    "bg-bear/10 text-bear border border-bear/30",
  Unknown: "bg-white/5 text-muted border border-border",
};

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between border-b border-border py-2 last:border-0">
      <div>
        <div className="text-sm text-muted">{label}</div>
        {sub && <div className="text-xs text-muted/60">{sub}</div>}
      </div>
      <span className="font-mono text-sm font-medium">{value}</span>
    </div>
  );
}

export default function RiskPanel({ stock }: Props) {
  const label = stock.risk_label ?? "Unknown";

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Risk Metrics</h3>
        <span className={clsx("rounded px-2 py-0.5 text-xs font-semibold", LABEL_COLORS[label])}>
          {label} Risk
        </span>
      </div>
      <div className="divide-y divide-border/50">
        <Row
          label="Annualised Volatility"
          sub="Based on 252-day daily returns"
          value={fmtPct(stock.volatility)}
        />
        <Row
          label="Beta (vs benchmark)"
          sub="Lower = less market-correlated"
          value={fmt(stock.beta)}
        />
        <Row
          label="Max Drawdown (1yr)"
          sub="Worst peak-to-trough decline"
          value={fmtPct(stock.max_drawdown)}
        />
        <Row
          label="Sharpe Ratio (1yr)"
          sub="(Return − risk-free rate) / volatility"
          value={fmt(stock.sharpe)}
        />
        <Row
          label="ATR-Based Stop"
          sub={`Price − 2× ATR(14) = ₹${fmt(stock.suggested_stop)}`}
          value={stock.suggested_stop != null ? `₹${stock.suggested_stop.toFixed(2)}` : "—"}
        />
      </div>
      <p className="mt-3 text-xs text-muted/70">
        Suggested stop is an ATR-based reference level, not a guarantee.
        Adjust based on your personal risk tolerance and position size.
      </p>
    </div>
  );
}
