import type { LeaderboardRow } from "@/lib/types";
import { TrendingUp, TrendingDown, Activity, LineChart } from "lucide-react";

/**
 * Compact "market breadth" stat strip — five at-a-glance gauges across the
 * whole universe.  Computed server-side from the leaderboard rows already
 * fetched for the table, so it costs no extra request.
 */

function pct(n: number, d: number): string {
  if (d === 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

export default function MarketBreadth({ rows }: { rows: LeaderboardRow[] }) {
  const total              = rows.length;
  const aboveMa50          = rows.filter((r) => {
    // Composite stands in — we don't carry ma50/price pair here; approximate
    // via trend_template_pass which includes the price-above-MA50 criterion.
    return !!r.trend_template_pass;
  }).length;
  const within25Of52High   = rows.filter((r) => (r.high_proximity ?? 0) >= 0.75).length;
  const advancers          = rows.filter((r) => (r.pct_change_1d ?? 0) > 0).length;
  const decliners          = rows.filter((r) => (r.pct_change_1d ?? 0) < 0).length;
  const vcpCount           = rows.filter((r) => !!r.vcp_detected).length;
  const avgScore           = total
    ? rows.reduce((s, r) => s + (r.composite_score ?? 0), 0) / total
    : 0;

  const stats = [
    {
      icon: LineChart,
      label: "Pass Trend Template",
      value: pct(aboveMa50, total),
      note: `${aboveMa50} of ${total}`,
      tint: "bg-bull/10 text-bull",
    },
    {
      icon: Activity,
      label: "Within 25% of 52w High",
      value: pct(within25Of52High, total),
      note: `${within25Of52High} stocks`,
      tint: "bg-accent/10 text-accent",
    },
    {
      icon: TrendingUp,
      label: "Advancers",
      value: pct(advancers, total),
      note: `${advancers} ↑ / ${decliners} ↓`,
      tint: advancers >= decliners ? "bg-bull/10 text-bull" : "bg-bear/10 text-bear",
      invertTo: decliners,
    },
    {
      icon: TrendingDown,
      label: "VCP setups",
      value: String(vcpCount),
      note: "active patterns",
      tint: "bg-accent-2/10 text-accent-2",
    },
    {
      icon: Activity,
      label: "Avg composite",
      value: avgScore.toFixed(1),
      note: "out of 100",
      tint: "bg-gold/10 text-gold",
    },
  ];

  return (
    <div className="fade-up fade-up-1 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3 shadow-card"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted">
            <s.icon className="h-3 w-3" />
            <span className="truncate">{s.label}</span>
          </div>
          <span className={`text-xl font-semibold tabular-nums leading-tight ${s.tint.split(" ")[1]}`}>
            {s.value}
          </span>
          <span className="truncate text-xs text-muted">{s.note}</span>
        </div>
      ))}
    </div>
  );
}
