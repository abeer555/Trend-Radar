import type { StockDetail } from "@/lib/types";

interface Props { stock: StockDetail; }

function fmt(v: number | null, decimals = 2, suffix = ""): string {
  if (v == null) return "—";
  return `${v.toFixed(decimals)}${suffix}`;
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtMarketCap(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e12) return `₹${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `₹${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `₹${(v / 1e6).toFixed(2)}M`;
  return `₹${v.toFixed(0)}`;
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <div className="text-right">
        <span className="font-mono text-sm font-medium">{value}</span>
        {note && <span className="ml-2 text-xs text-muted">{note}</span>}
      </div>
    </div>
  );
}

export default function FundamentalsPanel({ stock }: Props) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Fundamentals</h3>
      <div className="divide-y divide-border/50">
        <Row label="Market Cap"      value={fmtMarketCap(stock.market_cap)} />
        <Row label="P/E (trailing)"  value={fmt(stock.pe_ratio, 1, "×")} />
        <Row label="P/B"             value={fmt(stock.pb_ratio, 2, "×")} />
        <Row label="EV/EBITDA"       value={fmt(stock.ev_ebitda, 1, "×")} />
        <Row label="Revenue Growth"  value={fmtPct(stock.revenue_growth)} />
        <Row label="Earnings Growth" value={fmtPct(stock.earnings_growth)} />
        <Row label="Debt/Equity"     value={fmt(stock.debt_equity, 2)} />
        <Row label="ROE"             value={fmtPct(stock.roe)} />
        <Row label="Gross Margin"    value={fmtPct(stock.gross_margin)} />
      </div>
    </div>
  );
}
