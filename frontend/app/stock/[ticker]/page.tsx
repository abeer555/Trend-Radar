import { notFound }  from "next/navigation";
import { fetchStock, fetchChartData } from "@/lib/api";
import StockChart      from "@/components/StockChart";
import SetupPanel      from "@/components/SetupPanel";
import Scorecard       from "@/components/Scorecard";
import FundamentalsPanel from "@/components/FundamentalsPanel";
import RiskPanel       from "@/components/RiskPanel";
import CompositeScore  from "@/components/CompositeScore";
import Disclaimer      from "@/components/Disclaimer";
import ScoreBar        from "@/components/ScoreBar";
import clsx            from "clsx";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmt(v: number | null, d = 2) { return v != null ? v.toFixed(d) : "—"; }
function fmtPct(v: number | null) {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
}

interface PageProps { params: { ticker: string } }

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

  const pct = stock.pct_change_1d ?? 0;
  const isUp = pct >= 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-muted">
        <a href="/" className="hover:text-text">Leaderboard</a>
        <span className="mx-2 text-border">›</span>
        <span className="text-text">{ticker}</span>
      </nav>

      {/* Hero header */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-text">{ticker}</h1>
              <span className="rounded border border-border px-2 py-0.5 text-xs text-muted">
                {stock.sector ?? "—"}
              </span>
            </div>
            <p className="text-sm text-muted">{stock.name ?? ticker}</p>
          </div>

          <div className="flex flex-wrap items-end gap-6">
            {/* Price */}
            <div>
              <div className="text-xs text-muted mb-0.5">Last Price</div>
              <div className="text-2xl font-mono font-bold">₹{fmt(stock.last_price)}</div>
              <div className={clsx("text-sm font-medium font-mono", isUp ? "text-bull" : "text-bear")}>
                {fmtPct(stock.pct_change_1d)} today
              </div>
            </div>

            {/* 52-week range */}
            <div>
              <div className="text-xs text-muted mb-0.5">52-week Range</div>
              <div className="font-mono text-sm">
                <span className="text-bear">₹{fmt(stock.week52_low)}</span>
                <span className="text-muted mx-2">–</span>
                <span className="text-bull">₹{fmt(stock.week52_high)}</span>
              </div>
              {stock.high_proximity != null && (
                <div className="mt-1 w-32">
                  <div className="score-bar-track">
                    <div
                      className="score-bar-fill bg-accent"
                      style={{ width: `${stock.high_proximity * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted">
                    {(stock.high_proximity * 100).toFixed(0)}% of range
                  </span>
                </div>
              )}
            </div>

            {/* RS Rank */}
            <div>
              <div className="text-xs text-muted mb-0.5">RS Rank</div>
              <div className={clsx(
                "text-2xl font-mono font-bold",
                (stock.rs_rank ?? 0) >= 80 ? "text-bull"
                : (stock.rs_rank ?? 0) >= 60 ? "text-accent"
                : "text-warn"
              )}>
                {stock.rs_rank?.toFixed(0) ?? "—"}
              </div>
              <div className="text-xs text-muted">out of 99</div>
            </div>
          </div>
        </div>
      </div>

      <Disclaimer />

      {/* Chart */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Price Chart</h2>
        <StockChart chartData={chartData} ticker={ticker} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left column — setup & signals */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Setup & Signals
            </h2>
            <SetupPanel stock={stock} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
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
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          All Signal Scores
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ScoreCard label="Relative Strength"      score={(stock.rs_rank ?? 0) / 99 * 100} note={`RS ${stock.rs_rank?.toFixed(0) ?? "—"}/99`} />
          <ScoreCard label="12-1 Momentum"          score={null} note={`${stock.momentum_12_1 != null ? ((stock.momentum_12_1 ?? 0) * 100).toFixed(1) + "%" : "—"} raw return`} />
          <ScoreCard label="Trend Template"         score={stock.trend_template_score} note={stock.trend_template_pass ? "All criteria pass" : "Some criteria fail"} />
          <ScoreCard label="VCP Pattern"            score={stock.vcp_detected ? 80 : 0} note={stock.vcp_detected ? `${stock.vcp_contractions} contractions` : "Not detected"} />
          <ScoreCard label="Mansfield Stage"        score={stock.mansfield_stage2 ? 85 : 30} note={`Stage ${stock.mansfield_stage2 ? "2 (Advancing)" : "1/3/4"}`} />
          <ScoreCard label="52-wk High Proximity"   score={(stock.high_proximity ?? 0) * 100} note={`${fmt(stock.high_proximity != null ? stock.high_proximity * 100 : null, 0)}% of 52-wk range`} />
          <ScoreCard label="Frog-in-Pan (FIP)"      score={null} note={`ID metric: ${fmt(stock.frog_in_pan, 3)}`} />
          <ScoreCard label="Risk-Adj Momentum"      score={null} note={`Sharpe-like: ${fmt(stock.risk_adj_momentum, 2)}`} />
          <ScoreCard label="Volume / Pocket Pivot"  score={stock.pocket_pivot ? 100 : stock.volume_surge ? 70 : 20} note={stock.pocket_pivot ? "Pocket pivot fired" : stock.volume_surge ? "Volume surge" : "No surge"} />
          <ScoreCard label="ADX Trend Strength"     score={Math.min(100, (stock.adx ?? 0) / 50 * 100)} note={`ADX ${fmt(stock.adx, 1)}`} />
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ label, score, note }: { label: string; score: number | null; note: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="mb-1.5 text-xs font-medium text-muted">{label}</div>
      {score != null && <ScoreBar score={score} size="sm" />}
      <div className="mt-1 text-xs text-text-dim">{note}</div>
    </div>
  );
}
