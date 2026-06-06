import type { StockDetail } from "@/lib/types";
import { fmtMarketCap, fmtNum } from "@/lib/format";

interface Props { stock: StockDetail; }

function fmt(v: number | null, decimals = 2, suffix = ""): string {
  if (v == null) return "—";
  return `${v.toFixed(decimals)}${suffix}`;
}

function fmtPctPlain(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <div className="text-right">
        <span className="font-mono text-sm font-medium tabular-nums">{value}</span>
        {note && <span className="ml-2 text-xs text-muted">{note}</span>}
      </div>
    </div>
  );
}

export default function FundamentalsPanel({ stock }: Props) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Fundamentals</h3>
      <div>
        <Row label="Market Cap"      value={fmtMarketCap(stock.market_cap)} />
        <Row label="P/E (trailing)"  value={fmt(stock.pe_ratio, 1, "×")} />
        <Row label="P/B"             value={fmt(stock.pb_ratio, 2, "×")} />
        <Row label="EV/EBITDA"       value={fmt(stock.ev_ebitda, 1, "×")} />
        <Row label="Revenue Growth"  value={fmtPctPlain(stock.revenue_growth)} />
        <Row label="Earnings Growth" value={fmtPctPlain(stock.earnings_growth)} />
        <Row label="Debt/Equity"     value={fmtNum(stock.debt_equity, 2)} />
        <Row label="ROE"             value={fmtPctPlain(stock.roe)} />
        <Row label="Gross Margin"    value={fmtPctPlain(stock.gross_margin)} />
      </div>
    </div>
  );
}
