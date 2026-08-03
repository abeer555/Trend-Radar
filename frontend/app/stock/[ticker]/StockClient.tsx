"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { fetchStock, fetchChartData } from "@/lib/api";
import type { StockDetail, ChartData } from "@/lib/types";
import { fmtINR, fmtNum, fmtPct } from "@/lib/format";
import StockChart        from "@/components/StockChart";
import SetupPanel        from "@/components/SetupPanel";
import Scorecard         from "@/components/Scorecard";
import FundamentalsPanel from "@/components/FundamentalsPanel";
import RiskPanel         from "@/components/RiskPanel";
import CompositeScore    from "@/components/CompositeScore";
import Disclaimer        from "@/components/Disclaimer";
import ScoreBar          from "@/components/ScoreBar";
import clsx              from "clsx";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border px-5 py-4 md:border-l md:first:border-l-0">
      <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; stock: StockDetail; chart: ChartData | null }
  | { kind: "missing" };

export default function StockClient({ ticker }: { ticker: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    (async () => {
      // Chart failures must not sink an otherwise valid stock page.
      const stockRes = await fetchStock(ticker).then(
        (s) => ({ ok: true as const, value: s }),
        ()  => ({ ok: false as const }),
      );
      if (cancelled) return;
      if (!stockRes.ok) {
        setState({ kind: "missing" });
        return;
      }
      const chart = await fetchChartData(ticker, 365).catch(() => null);
      if (cancelled) return;
      setState({ kind: "ok", stock: stockRes.value, chart });
    })();
    return () => { cancelled = true; };
  }, [ticker]);

  if (state.kind === "loading") return <StockSkeleton ticker={ticker} />;
  if (state.kind === "missing") return <StockMissing ticker={ticker} />;

  const { stock, chart: chartData } = state;
  const pct  = stock.pct_change_1d ?? 0;
  const isUp = pct >= 0;
  const score = stock.composite_score ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <a href="/" className="transition-colors hover:text-text">Leaderboard</a>
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono text-text-dim">{ticker}</span>
      </nav>
      {/* Hero stat strip */}
      <div className="fade-up overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:gap-3">
          <h1 className="font-mono text-xl font-semibold tracking-tight text-text">{ticker}</h1>
          <span className="w-fit rounded-full border border-border px-2 py-0.5 text-xs text-text-dim">
            {stock.sector ?? "—"}
          </span>
          <span className="text-sm text-muted sm:ml-1">{stock.name ?? ticker}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4">
          <Stat label="Last Price">
            <div className="text-2xl font-semibold tabular-nums">₹{fmtINR(stock.last_price)}</div>
            <div className={clsx("mt-0.5 text-sm font-medium tabular-nums", isUp ? "text-bull" : "text-bear")}>
              {fmtPct(stock.pct_change_1d)} today
            </div>
          </Stat>

          <Stat label="52-Week Range">
            <div className="text-sm tabular-nums">
              <span className="text-text-dim">₹{fmtINR(stock.week52_low)}</span>
              <span className="mx-1.5 text-muted">–</span>
              <span className="text-text">₹{fmtINR(stock.week52_high)}</span>
            </div>
            {stock.high_proximity != null && (
              <div className="mt-2 max-w-[160px]">
                <div className="score-bar-track">
                  <div
                    className="score-bar-fill bg-accent"
                    style={{ width: `${stock.high_proximity * 100}%` }}
                  />
                </div>
                <span className="mt-1 block text-xs tabular-nums text-muted">
                  {(stock.high_proximity * 100).toFixed(0)}% of range
                </span>
              </div>
            )}
          </Stat>

          <Stat label="RS Rank">
            <div className={clsx(
              "text-2xl font-semibold tabular-nums",
              (stock.rs_rank ?? 0) >= 80 ? "text-bull"
              : (stock.rs_rank ?? 0) >= 60 ? "text-accent"
              : "text-warn"
            )}>
              {stock.rs_rank?.toFixed(0) ?? "—"}
              <span className="ml-1 text-sm font-normal text-muted">/ 99</span>
            </div>
            <div className="mt-0.5 text-xs text-muted">relative strength percentile</div>
          </Stat>

          <Stat label="Composite Score">
            <div className={clsx(
              "text-2xl font-semibold tabular-nums",
              score >= 75 ? "text-bull" : score >= 50 ? "text-accent" : score >= 25 ? "text-warn" : "text-bear"
            )}>
              {fmtNum(stock.composite_score, 1)}
            </div>
            <div className="mt-2 max-w-[160px]">
              <ScoreBar score={stock.composite_score} size="sm" showNumber={false} />
            </div>
          </Stat>
        </div>
      </div>

      <Disclaimer />

      {/* Chart — degrade gracefully when chart data is unavailable */}
      <div className="fade-up fade-up-1 rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">Price Chart</h2>
        {chartData ? (
          <StockChart chartData={chartData} ticker={ticker} />
        ) : (
          <div className="flex h-[420px] flex-col items-center justify-center gap-2 text-center text-sm text-muted">
            <p>Chart data unavailable for {ticker}.</p>
            <p className="text-xs">The stock data above is fresh — only the price history failed to load.</p>
          </div>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left column — setup & signals */}
        <div className="flex flex-col gap-6 xl:col-span-2">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Setup & Signals
            </h2>
            <SetupPanel stock={stock} />
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Technical Scorecard
            </h2>
            <Scorecard stock={stock} />
          </section>
        </div>

        {/* Right column — scores & fundamentals */}
        <div className="flex flex-col gap-4">
          <CompositeScore stock={stock} />
          <FundamentalsPanel stock={stock} />
          <RiskPanel stock={stock} />
        </div>
      </div>

      {/* Signal weights breakdown — uses the real per-signal 0-100 scores from the scan */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">
          All Signal Scores
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SignalCard label="Relative Strength"     score={stock.rs_score}            note={`RS rank ${stock.rs_rank?.toFixed(0) ?? "—"}/99 (IBD-style percentile)`} />
          <SignalCard label="12-1 Momentum"         score={stock.momentum_12_1_score} note={`${stock.momentum_12_1 != null ? fmtPct(stock.momentum_12_1, 1) : "—"} raw 12-1 return`} />
          <SignalCard label="Trend Template"        score={stock.trend_template_score} note={stock.trend_template_pass ? "All 8 Minervini criteria pass" : "Some criteria fail"} />
          <SignalCard label="VCP Pattern"           score={stock.vcp_score}           note={stock.vcp_detected ? `${stock.vcp_contractions} successive contractions` : "Not detected"} />
          <SignalCard label="Mansfield Stage"       score={stock.mansfield_score}     note={`Stage ${stock.mansfield_stage2 ? "2 (Advancing)" : "1/3/4"}`} />
          <SignalCard label="52-wk High Proximity"  score={stock.high_proximity_score} note={`${stock.high_proximity != null ? (stock.high_proximity * 100).toFixed(0) : "—"}% of 52-wk range`} />
          <SignalCard label="Frog-in-Pan (FIP)"     score={stock.frog_in_pan_score}   note={`ID metric: ${fmtNum(stock.frog_in_pan, 3)}`} />
          <SignalCard label="Risk-Adj Momentum"     score={stock.risk_adj_score}      note={`Sharpe-like: ${fmtNum(stock.risk_adj_momentum, 2)}`} />
          <SignalCard label="Volume / Pocket Pivot" score={stock.volume_score}        note={stock.pocket_pivot ? "Pocket pivot fired" : stock.volume_surge ? "Volume surge" : "No surge"} />
          <SignalCard label="ADX Trend Strength"    score={stock.adx_score}           note={`ADX ${fmtNum(stock.adx, 1)}`} />
        </div>
      </div>
    </div>
  );
}

function SignalCard({ label, score, note }: { label: string; score: number | null; note: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="mb-1.5 text-xs font-medium text-muted">{label}</div>
      {score != null && <ScoreBar score={score} size="sm" />}
      <div className="mt-1 text-xs text-text-dim">{note}</div>
    </div>
  );
}

function StockSkeleton({ ticker }: { ticker: string }) {
  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <span className="text-muted">Leaderboard</span>
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono text-text-dim">{ticker}</span>
      </nav>
      <div className="animate-pulse overflow-hidden rounded-xl border border-border bg-surface">
        <div className="h-[74px] border-b border-border px-5 py-4" />
        <div className="grid grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[96px] px-5 py-4 md:border-l md:first:border-l-0" />
          ))}
        </div>
      </div>
      <div className="animate-pulse h-[480px] rounded-xl border border-border bg-surface" />
    </div>
  );
}

function StockMissing({ ticker }: { ticker: string }) {
  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <a href="/" className="transition-colors hover:text-text">Leaderboard</a>
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono text-text-dim">{ticker}</span>
      </nav>
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface px-6 py-16 text-center shadow-card">
        <p className="text-lg font-semibold text-text font-mono">{ticker}</p>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          No scan data for this ticker — it is either outside the current
          universe or the snapshot your frontend is serving was generated
          before it was scanned.
        </p>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-text-dim transition-colors hover:text-text">
            ← Back to leaderboard
          </Link>
          <Link href="/compare" className="text-accent underline-offset-2 hover:underline">
            Compare with another stock
          </Link>
        </div>
      </div>
    </div>
  );
}
