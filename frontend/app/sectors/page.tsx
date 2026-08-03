import { fetchLeaderboard } from "@/lib/api";
import type { LeaderboardRow } from "@/lib/types";
import { fmtNum } from "@/lib/format";
import { fmtINR } from "@/lib/format";
import Link from "next/link";
import clsx from "clsx";
import { TrendingUp, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SectorStats {
  sector:         string;
  count:          number;
  avgScore:       number;
  ttPasses:       number;
  vcpCount:       number;
  avgPrice:       number | null;
  topStock:       { ticker: string; name: string | null; composite_score: number | null } | null;
}

function aggregate(rows: LeaderboardRow[]): SectorStats[] {
  const map = new Map<string, LeaderboardRow[]>();
  for (const r of rows) {
    const s = r.sector ?? "Unknown";
    if (!map.has(s)) map.set(s, []);
    map.get(s)!.push(r);
  }

  return [...map.entries()]
    .map(([sector, list]) => {
      const tt  = list.filter((r) => !!r.trend_template_pass).length;
      const vcp = list.filter((r) => !!r.vcp_detected).length;
      const avg = list.reduce((s, r) => s + (r.composite_score ?? 0), 0) / list.length;
      const avgPrice =
        list.reduce((s, r) => s + (r.last_price ?? 0), 0) / list.length;
      const top = list.reduce<LeaderboardRow | null>(
        (best, r) => (best == null || (r.composite_score ?? 0) > (best.composite_score ?? 0) ? r : best),
        null,
      );
      return {
        sector, count: list.length, avgScore: avg, ttPasses: tt, vcpCount: vcp,
        avgPrice,
        topStock: top
          ? { ticker: top.ticker, name: top.name, composite_score: top.composite_score }
          : null,
      };
    })
    .sort((a, b) => b.avgScore - a.avgScore);
}

export default async function SectorsPage() {
  const rows = await fetchLeaderboard({ limit: 500 }).catch(() => [] as LeaderboardRow[]);
  const sectors = aggregate(rows);

  return (
    <div className="fade-up flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tightest text-text">Sectors</h1>
        <p className="mt-1 text-sm text-muted">
          Aggregated momentum metrics for every sector in the current scan.
        </p>
      </div>

      {sectors.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface">
          <p className="text-sm text-muted">No sector data yet — run a scan first.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3 text-right">Stocks</th>
                  <th className="px-4 py-3 text-right">Avg Score</th>
                  <th className="px-4 py-3 text-right">TT Pass</th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">VCP</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Top stock</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sectors.map((s) => (
                  <tr
                    key={s.sector}
                    className="border-b border-border/40 transition-colors last:border-0 hover:bg-surface-2/50"
                  >
                    <td className="px-4 py-3 font-medium text-text">{s.sector}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{s.count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={clsx(
                        "font-semibold",
                        s.avgScore >= 60 ? "text-bull" : s.avgScore >= 45 ? "text-accent" : "text-warn"
                      )}>
                        {fmtNum(s.avgScore, 1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={clsx(
                        "rounded px-1.5 py-0.5 text-xs font-medium",
                        s.ttPasses > 0 ? "bg-bull/10 text-bull" : "text-muted"
                      )}>
                        {s.ttPasses}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                      <span className={s.vcpCount > 0 ? "text-accent-2" : "text-muted"}>
                        {s.vcpCount}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {s.topStock ? (
                        <Link
                          href={`/stock/${encodeURIComponent(s.topStock.ticker)}`}
                          className="group/inline flex items-center gap-1.5 font-mono text-[13px] text-accent hover:underline"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          {s.topStock.ticker.replace(/\.NS$/, "")}
                          <span className="text-xs tabular-nums text-muted">
                            ({fmtNum(s.topStock.composite_score, 1)})
                          </span>
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/?sector=${encodeURIComponent(s.sector)}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-text-dim transition-colors hover:text-accent"
                      >
                        View stocks <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
