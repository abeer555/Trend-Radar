import clsx from "clsx";
import type { StockDetail } from "@/lib/types";

interface Props { stock: StockDetail; }

function Row({ label, value, read, sentiment }: {
  label:      string;
  value:      string;
  read:       string;
  sentiment?: "bull" | "bear" | "neutral";
}) {
  const dotColor = {
    bull:    "bg-bull",
    bear:    "bg-bear",
    neutral: "bg-warn",
    undefined: "bg-muted",
  }[sentiment ?? "undefined"];

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-3 last:border-0">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={clsx("mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full", dotColor)} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-text">{label}</div>
          <div className="text-xs leading-relaxed text-muted">{read}</div>
        </div>
      </div>
      <span className="flex-shrink-0 font-mono text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function classify(v: number | null, bullAbove: number, bearBelow: number): "bull" | "bear" | "neutral" {
  if (v == null) return "neutral";
  if (v >= bullAbove) return "bull";
  if (v <= bearBelow) return "bear";
  return "neutral";
}

function macdSentiment(macd: number | null, signal: number | null): "bull" | "bear" | "neutral" {
  if (macd == null || signal == null) return "neutral";
  return macd > signal ? "bull" : "bear";
}

export default function Scorecard({ stock }: Props) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4">
      <Row
        label="RSI (14)"
        value={stock.rsi != null ? stock.rsi.toFixed(1) : "—"}
        read={stock.rsi_read}
        sentiment={classify(stock.rsi, 55, 45)}
      />
      <Row
        label="MACD"
        value={stock.macd != null ? stock.macd.toFixed(3) : "—"}
        read={stock.macd_read}
        sentiment={macdSentiment(stock.macd, stock.macd_signal)}
      />
      <Row
        label="ADX (14)"
        value={stock.adx != null ? stock.adx.toFixed(1) : "—"}
        read={stock.adx_read}
        sentiment={classify(stock.adx, 25, 18)}
      />
      <Row
        label="ATR (14)"
        value={stock.atr != null ? stock.atr.toFixed(2) : "—"}
        read={stock.atr_read}
        sentiment="neutral"
      />
      <Row
        label="Stochastic %K/%D"
        value={
          stock.stoch_k != null && stock.stoch_d != null
            ? `${stock.stoch_k.toFixed(1)} / ${stock.stoch_d.toFixed(1)}`
            : "—"
        }
        read={stock.stoch_read}
        sentiment={classify(stock.stoch_k, 55, 45)}
      />
    </div>
  );
}
