import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { fetchStock, fetchChartData } from "@/lib/api";
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

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps { params: { ticker: string } }

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border px-5 py-4 md:border-l md:first:border-l-0">
      <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export default async function StockDetailPage({ params }: PageProps) {
  const ticker = decodeURIComponent(params.ticker).toUpperCase();

  let stock, chartData;
  try {
    [stock, chartData] = await Promise.all([
      fetchStock(ticker),
      fetchChartData(ticker, 365),
    ]);
  } catch {
    notFound();
  }

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
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
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

      {/* Chart */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">Price Chart</h2>
        <StockChart chartData={chartData} ticker={ticker} />
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

      {/* Signal weights breakdown */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">
          All Signal Scores
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SignalCard label="Relative Strength"     score={(stock.rs_rank ?? 0) / 99 * 100} note={`RS ${stock.rs_rank?.toFixed(0) ?? "—"}/99`} />
          <SignalCard label="12-1 Momentum"         score={null} note={`${stock.momentum_12_1 != null ? fmtPct(stock.momentum_12_1, 1) : "—"} raw return`} />
          <SignalCard label="Trend Template"        score={stock.trend_template_score} note={stock.trend_template_pass ? "All criteria pass" : "Some criteria fail"} />
          <SignalCard label="VCP Pattern"           score={stock.vcp_detected ? 80 : 0} note={stock.vcp_detected ? `${stock.vcp_contractions} contractions` : "Not detected"} />
          <SignalCard label="Mansfield Stage"       score={stock.mansfield_stage2 ? 85 : 30} note={`Stage ${stock.mansfield_stage2 ? "2 (Advancing)" : "1/3/4"}`} />
          <SignalCard label="52-wk High Proximity"  score={(stock.high_proximity ?? 0) * 100} note={`${stock.high_proximity != null ? (stock.high_proximity * 100).toFixed(0) : "—"}% of 52-wk range`} />
          <SignalCard label="Frog-in-Pan (FIP)"     score={null} note={`ID metric: ${fmtNum(stock.frog_in_pan, 3)}`} />
          <SignalCard label="Risk-Adj Momentum"     score={null} note={`Sharpe-like: ${fmtNum(stock.risk_adj_momentum, 2)}`} />
          <SignalCard label="Volume / Pocket Pivot" score={stock.pocket_pivot ? 100 : stock.volume_surge ? 70 : 20} note={stock.pocket_pivot ? "Pocket pivot fired" : stock.volume_surge ? "Volume surge" : "No surge"} />
          <SignalCard label="ADX Trend Strength"    score={Math.min(100, (stock.adx ?? 0) / 50 * 100)} note={`ADX ${fmtNum(stock.adx, 1)}`} />
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
