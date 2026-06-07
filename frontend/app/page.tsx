import { BarChart3, Layers, ListChecks, Target, Flame } from "lucide-react";
import { fetchLeaderboard, fetchSectors, fetchScanStatus } from "@/lib/api";
import type { LeaderboardRow } from "@/lib/types";
import LeaderboardTable from "@/components/LeaderboardTable";
import Disclaimer from "@/components/Disclaimer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function ScanStatusBadge({ status }: { status: Record<string, unknown> }) {
  const s  = status?.status as string | undefined;
  const dt = status?.finished_at as string | undefined;
  const n  = status?.tickers_scanned as number | undefined;

  if (!s || s === "no_scan_run") {
    return (
      <span className="rounded-md border border-warn/30 bg-warn/5 px-2.5 py-1.5 text-xs text-warn">
        No scan run yet — trigger one via POST /api/scan
      </span>
    );
  }

  const ok = s.startsWith("completed");

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className={ok ? "h-1.5 w-1.5 rounded-full bg-bull" : "h-1.5 w-1.5 rounded-full bg-warn"} />
        <span className="font-medium capitalize text-text-dim">{s.replace(/_/g, " ")}</span>
      </span>
      {n != null && (
        <>
          <span className="h-3 w-px bg-border" />
          <span><span className="tabular-nums text-text-dim">{n}</span> tickers</span>
        </>
      )}
      {dt && (
        <>
          <span className="h-3 w-px bg-border" />
          <span>
            {new Date(dt).toLocaleString("en-IN", {
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </span>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon, value, label, tint,
}: {
  icon:  React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  label: string;
  tint:  string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md ${tint}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-lg font-semibold leading-tight tabular-nums text-text">
          {value}
        </div>
        <div className="truncate text-xs text-muted">{label}</div>
      </div>
    </div>
  );
}

function StatsStrip({ rows }: { rows: LeaderboardRow[] }) {
  const tt  = rows.filter(r => !!r.trend_template_pass).length;
  const vcp = rows.filter(r => !!r.vcp_detected).length;

  // Most common sector among the top 50 ranked stocks
  const counts = new Map<string, number>();
  for (const r of rows.slice(0, 50)) {
    if (r.sector) counts.set(r.sector, (counts.get(r.sector) ?? 0) + 1);
  }
  const hotSector = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard icon={Layers}     value={rows.length} label="Stocks ranked"          tint="bg-accent/10 text-accent" />
      <StatCard icon={ListChecks} value={tt}          label="Pass Trend Template"    tint="bg-bull/10 text-bull" />
      <StatCard icon={Target}     value={vcp}         label="VCP setups detected"    tint="bg-accent-2/10 text-accent-2" />
      <StatCard icon={Flame}      value={hotSector}   label="Hot sector (top 50)"    tint="bg-warn/10 text-warn" />
    </div>
  );
}

export default async function LeaderboardPage() {
  const [rows, sectors, scanStatus] = await Promise.allSettled([
    fetchLeaderboard({ limit: 500 }),
    fetchSectors(),
    fetchScanStatus(),
  ]);

  const leaderboard = rows.status === "fulfilled"       ? rows.value    : [];
  const sectorList  = sectors.status === "fulfilled"    ? sectors.value : [];
  const scan        = scanStatus.status === "fulfilled" ? scanStatus.value : {};

  const isEmpty = leaderboard.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="fade-up flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            Momentum Leaderboard
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Rule-based composite momentum ranking of Nifty 500 stocks.
            Updated daily after market close.
          </p>
        </div>
        <ScanStatusBadge status={scan} />
      </div>

      <div className="fade-up">
        <Disclaimer />
      </div>

      {!isEmpty && (
        <div className="fade-up fade-up-1">
          <StatsStrip rows={leaderboard} />
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface py-20 text-center">
          <BarChart3 className="h-10 w-10 text-muted" />
          <div>
            <p className="text-lg font-semibold">No data yet</p>
            <p className="mt-1 text-sm text-muted">
              Run the daily scan to populate the dashboard.
            </p>
          </div>
          <code className="rounded border border-border bg-bg px-3 py-1.5 font-mono text-xs text-accent">
            curl -X POST http://localhost:8000/api/scan
          </code>
          <p className="max-w-md text-xs text-muted">
            Or start the backend and wait for the scheduler to trigger after market close
            (10:15 UTC for NSE / Nifty 500).
          </p>
        </div>
      ) : (
        <LeaderboardTable rows={leaderboard} sectors={sectorList} />
      )}
    </div>
  );
}
