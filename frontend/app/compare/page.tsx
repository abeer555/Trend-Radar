"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import clsx from "clsx";
import { fetchStock, fetchChartData, fetchLeaderboard } from "@/lib/api";
import type { StockDetail, ChartData, LeaderboardRow } from "@/lib/types";
import { fmtINR, fmtPct, fmtNum, fmtMarketCap } from "@/lib/format";
import ScoreBar from "@/components/ScoreBar";
import WatchlistButton from "@/components/WatchlistButton";

interface PickerOpt { ticker: string; name: string | null; }

function StockPicker({
  value, onChange, other, label,
}: {
  value: string;
  onChange: (t: string) => void;
  other?: string;
  label: string;
}) {
  const listId = `picker-${label}`;
  const [options, setOptions] = useState<PickerOpt[]>([]);
  useEffect(() => {
    fetchLeaderboard({ limit: 500 })
      .then((rows: LeaderboardRow[]) => setOptions(
        rows.map(r => ({ ticker: r.ticker, name: r.name }))
      ))
      .catch(() => setOptions([]));
  }, []);

  const filtered = useMemo(() => {
    if (!value) return options.slice(0, 60);
    const q = value.toLowerCase();
    return options
      .filter(o => o.ticker !== other)
      .filter(o => o.ticker.toLowerCase().includes(q) || (o.name ?? "").toLowerCase().includes(q))
      .slice(0, 60);
  }, [options, value, other]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          list={listId}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={`Type a ticker (e.g. RELIANCE.NS)`}
          className="h-10 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 font-mono text-sm text-text placeholder-muted transition-colors focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
      </div>
      <datalist id={listId}>
        {filtered.map(o => (
          <option key={o.ticker} value={o.ticker}>
            {o.name ?? o.ticker}
          </option>
        ))}
      </datalist>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  a: React.ReactNode;
  b: React.ReactNode;
  winner?: "a" | "b" | "tie" | null;
}

function MetricRow({ label, a, b, winner }: MetricRowProps) {
  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted">{label}</td>
      <td className={clsx("px-4 py-2.5 text-right tabular-nums text-sm",
        winner === "a" && "bg-bull/5 font-semibold text-bull")}>{a}</td>
      <td className={clsx("px-4 py-2.5 text-right tabular-nums text-sm",
        winner === "b" && "bg-bull/5 font-semibold text-bull")}>{b}</td>
    </tr>
  );
}

function compareNum(a: number | null | undefined, b: number | null | undefined, higherBetter = true): "a" | "b" | "tie" | null {
  if (a == null || b == null) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === b) return "tie";
  if (higherBetter) return a > b ? "a" : "b";
  return a < b ? "a" : "b";
}

/** Normalize each candle close array to 100 at the slice start. */
function normalizeArr(values: number[], n: number): number[] {
  const slice = values.slice(-n);
  if (slice.length === 0 || slice[0] === 0) return [];
  return slice.map(v => (v / slice[0]) * 100);
}

export default function ComparePage() {
  const searchParams = useSearchParams();
  const [aTicker, setATicker] = useState(searchParams.get("a") ?? "RELIANCE.NS");
  const [bTicker, setBTicker] = useState(searchParams.get("b") ?? "TCS.NS");
  const [aStock, setAStock] = useState<StockDetail | null>(null);
  const [bStock, setBStock] = useState<StockDetail | null>(null);
  const [aChart, setAChart] = useState<ChartData | null>(null);
  const [bChart, setBChart] = useState<ChartData | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams();
    if (aTicker) p.set("a", aTicker);
    if (bTicker) p.set("b", bTicker);
    window.history.replaceState(null, "", `?${p}`);
  }, [aTicker, bTicker]);

  useEffect(() => {
    if (!aTicker) { setAStock(null); setAChart(null); return; }
    setLoadingA(true);
    Promise.allSettled([fetchStock(aTicker), fetchChartData(aTicker, 365)]).then(([s, c]) => {
      setAStock(s.status === "fulfilled" ? s.value : null);
      setAChart(c.status === "fulfilled" ? c.value : null);
      setLoadingA(false);
    });
  }, [aTicker]);

  useEffect(() => {
    if (!bTicker) { setBStock(null); setBChart(null); return; }
    setLoadingB(true);
    Promise.allSettled([fetchStock(bTicker), fetchChartData(bTicker, 365)]).then(([s, c]) => {
      setBStock(s.status === "fulfilled" ? s.value : null);
      setBChart(c.status === "fulfilled" ? c.value : null);
      setLoadingB(false);
    });
  }, [bTicker]);

  const normalizeWindow = 120;
  const aNorm = useMemo(
    () => (aChart ? normalizeArr(aChart.candles.map(c => c.close), normalizeWindow) : []),
    [aChart],
  );
  const bNorm = useMemo(
    () => (bChart ? normalizeArr(bChart.candles.map(c => c.close), normalizeWindow) : []),
    [bChart],
  );

  const metrics: MetricRowProps[] = useMemo(() => {
    const a = aStock, b = bStock;
    const W = (w: "a" | "b" | "tie" | null) => (aStock && bStock ? w : null);
    return [
      { label: "Last price",     a: a ? `₹${fmtINR(a.last_price)}` : "—",                       b: b ? `₹${fmtINR(b.last_price)}` : "—",                        winner: null },
      { label: "1-day change",   a: a ? fmtPct(a.pct_change_1d) : "—",                           b: b ? fmtPct(b.pct_change_1d) : "—",
        winner: W(compareNum(a?.pct_change_1d, b?.pct_change_1d)) },
      { label: "Composite",      a: a ? <ScoreBar score={a.composite_score} size="sm" /> : "—", b: b ? <ScoreBar score={b.composite_score} size="sm" /> : "—",
        winner: W(compareNum(a?.composite_score, b?.composite_score)) },
      { label: "RS Rank",        a: a?.rs_rank?.toFixed(0) ?? "—",                              b: b?.rs_rank?.toFixed(0) ?? "—",
        winner: W(compareNum(a?.rs_rank, b?.rs_rank)) },
      { label: "Trend Template", a: a?.trend_template_score?.toFixed(0) ?? "—",                  b: b?.trend_template_score?.toFixed(0) ?? "—",
        winner: W(compareNum(a?.trend_template_score, b?.trend_template_score)) },
      { label: "ADX",            a: fmtNum(a?.adx ?? null, 1),                                   b: fmtNum(b?.adx ?? null, 1),
        winner: W(compareNum(a?.adx, b?.adx)) },
      { label: "Market Cap",     a: a ? fmtMarketCap(a.market_cap) : "—",                        b: b ? fmtMarketCap(b.market_cap) : "—",
        winner: W(compareNum(a?.market_cap, b?.market_cap)) },
      { label: "P/E",            a: fmtNum(a?.pe_ratio ?? null, 1),                              b: fmtNum(b?.pe_ratio ?? null, 1),
        winner: W(compareNum(a?.pe_ratio, b?.pe_ratio, /* higherBetter= */ false)) },
      { label: "ROE",            a: a ? fmtPct(a.roe, 1, false) : "—",                           b: b ? fmtPct(b.roe, 1, false) : "—",
        winner: W(compareNum(a?.roe, b?.roe)) },
      { label: "Volatility",     a: a ? fmtPct(a.volatility, 1, false) : "—",                    b: b ? fmtPct(b.volatility, 1, false) : "—",
        winner: W(compareNum(a?.volatility, b?.volatility, /* higherBetter= */ false)) },
      { label: "Sharpe-like",    a: fmtNum(a?.risk_adj_momentum ?? null, 2),                     b: fmtNum(b?.risk_adj_momentum ?? null, 2),
        winner: W(compareNum(a?.risk_adj_momentum, b?.risk_adj_momentum)) },
      { label: "Max Drawdown",   a: a ? fmtPct(a.max_drawdown, 1, false) : "—",                  b: b ? fmtPct(b.max_drawdown, 1, false) : "—",
        winner: W(compareNum(a?.max_drawdown, b?.max_drawdown)) },
    ];
  }, [aStock, bStock]);

  const hasBoth = !!(aStock && bStock);
  const anyLoading = loadingA || loadingB;

  return (
    <div className="fade-up flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tightest text-text">
          <ArrowLeftRight className="h-6 w-6 text-accent" />
          Compare
        </h1>
        <p className="mt-1 text-sm text-muted">
          Side-by-side metrics + indexed price charts for any two stocks.
        </p>
      </div>

      {/* Pickers */}
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr,auto,1fr]">
        <StockPicker value={aTicker} onChange={setATicker} other={bTicker} label="a" />
        <button
          type="button"
          onClick={() => { const t = aTicker; setATicker(bTicker); setBTicker(t); }}
          className="hidden h-10 w-10 items-center justify-center justify-self-center rounded-md border border-border bg-surface-2 text-muted transition-colors hover:border-accent/50 hover:text-accent sm:inline-flex"
          title="Swap stocks"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <StockPicker value={bTicker} onChange={setBTicker} other={aTicker} label="b" />
      </div>

      {/* Hero cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[
          { t: aTicker, s: aStock, side: "a" as const, accentText: "text-accent",  stroke: "#4f8eff" },
          { t: bTicker, s: bStock, side: "b" as const, accentText: "text-accent-2", stroke: "#7c6cff" },
        ].map(({ t, s, side, accentText }) => (
          <div key={side} className="rounded-xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={clsx("font-mono text-sm font-semibold", accentText)}>
                    {(s?.ticker ?? t) || "—"}
                  </span>
                  {s && <WatchlistButton ticker={s.ticker} size="md" stopPropagation={false} />}
                  {(side === "a" ? loadingA : loadingB) && (
                    <span className="h-2 w-2 rounded-full bg-accent pulse-glow" />
                  )}
                </div>
                <p className="mt-0.5 max-w-[220px] truncate text-xs text-muted">
                  {s?.name ?? "No data"}
                </p>
              </div>
              {s?.pct_change_1d != null && (
                <span className={clsx("badge", s.pct_change_1d >= 0 ? "badge-bull" : "badge-bear")}>
                  {s.pct_change_1d >= 0
                    ? <TrendingUp className="h-3 w-3" />
                    : <TrendingDown className="h-3 w-3" />}
                  {fmtPct(s.pct_change_1d)}
                </span>
              )}
            </div>

            {s && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Price</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-text">
                    ₹{fmtINR(s.last_price)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Composite</p>
                  <p className={clsx(
                    "mt-1 text-xl font-semibold tabular-nums",
                    (s.composite_score ?? 0) >= 75 ? "text-bull"
                    : (s.composite_score ?? 0) >= 50 ? "text-accent"
                    : (s.composite_score ?? 0) >= 25 ? "text-warn" : "text-bear"
                  )}>
                    {fmtNum(s.composite_score, 1)}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Indexed overlay chart — only when both charts are present */}
      {aNorm.length > 1 && bNorm.length > 1 && (
        <OverlayChart
          aTicker={aStock?.ticker ?? aTicker}
          bTicker={bStock?.ticker ?? bTicker}
          aNorm={aNorm}
          bNorm={bNorm}
        />
      )}

      {/* Metrics table */}
      {hasBoth ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-surface-2/50 text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3">Metric</th>
                <th className="px-4 py-3 text-right font-mono text-accent">
                  {aStock?.ticker?.replace(/\.NS$/, "")}
                </th>
                <th className="px-4 py-3 text-right font-mono text-accent-2">
                  {bStock?.ticker?.replace(/\.NS$/, "")}
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => <MetricRow key={m.label} {...m} />)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-surface/50">
          <p className="flex items-center gap-2 text-sm text-muted">
            {anyLoading
              ? <>Loading comparison…</>
              : <><Minus className="h-4 w-4" /> Pick two tickers above to compare them side-by-side.</>}
          </p>
        </div>
      )}
    </div>
  );
}

/** Indexed line chart overlaying both stocks' closes (each series rebased to 100). */
function OverlayChart({
  aTicker, bTicker, aNorm, bNorm,
}: {
  aTicker: string; bTicker: string;
  aNorm: number[]; bNorm: number[];
}) {
  const W = 600, H = 220;
  const a = aNorm;
  const b = bNorm;
  const min = Math.min(...a, ...b);
  const max = Math.max(...a, ...b);
  const range = max - min || 1;

  const path = (pts: number[]) =>
    pts.map((v, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x},${y}`;
    }).join(" L ");

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Indexed price (rebased to 100)
        </h2>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-accent" /> {aTicker.replace(/\.NS$/, "")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-accent-2" /> {bTicker.replace(/\.NS$/, "")}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-56 w-full" preserveAspectRatio="none">
        {/* Zero-line at 100 (the rebase point) */}
        {(() => {
          const zeroY = H - ((100 - min) / range) * H;
          return <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="rgba(126,138,163,0.25)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />;
        })()}
        <path d={`M ${path(a)}`} fill="none" stroke="#4f8eff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={`M ${path(b)}`} fill="none" stroke="#7c6cff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="mt-2 text-[10px] text-muted">
        Both series rebased to 100 at the start of the window so relative momentum is visible.
      </p>
    </div>
  );
}
