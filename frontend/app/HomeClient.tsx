"use client";

import { useEffect, useState } from "react";
import { BarChart3, Layers, ListChecks, Target, Flame, Terminal, AlertTriangle } from "lucide-react";
import { fetchLeaderboard, fetchSectors, fetchScanStatus } from "@/lib/api";
import type { LeaderboardRow } from "@/lib/types";
import LeaderboardTable from "@/components/LeaderboardTable";
import Disclaimer from "@/components/Disclaimer";
import MarketBreadth from "@/components/MarketBreadth";

function ScanStatusBadge({ status }: { status: Record<string, unknown> | null }) {
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
      <StatCard icon={Layers}     value={rows.length} label="Stocks ranked"       tint="bg-accent/10 text-accent" />
      <StatCard icon={ListChecks} value={tt}          label="Pass Trend Template" tint="bg-bull/10 text-bull" />
      <StatCard icon={Target}     value={vcp}         label="VCP setups detected" tint="bg-accent-2/10 text-accent-2" />
      <StatCard icon={Flame}      value={hotSector}   label="Hot sector (top 50)" tint="bg-warn/10 text-warn" />
    </div>
  );
}

export default function HomeClient() {
  const [rows,    setRows]    = useState<LeaderboardRow[] | null>(null);
  const [sectors, setSectors] = useState<string[]>([]);
  const [status,  setStatus]  = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [rowsRes, sectorsRes, scanRes] = await Promise.allSettled([
        fetchLeaderboard({ limit: 500 }),
        fetchSectors(),
        fetchScanStatus(),
      ]);
      if (cancelled) return;
      setRows(rowsRes.status === "fulfilled"       ? rowsRes.value    : []);
      setSectors(sectorsRes.status === "fulfilled" ? sectorsRes.value : []);
      setStatus(scanRes.status === "fulfilled"     ? scanRes.value    : {});
    })();
    return () => { cancelled = true; };
  }, []);

  const loading = rows === null;
  const leaderboard = rows ?? [];
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
        {status !== null && <ScanStatusBadge status={status} />}
      </div>

      <div className="fade-up">
        <Disclaimer />
      </div>

      {loading ? (
        <LeaderboardSkeleton />
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <div className="fade-up fade-up-1">
            <MarketBreadth rows={leaderboard} />
          </div>
          <div className="flex flex-col gap-5">
            <StatsStrip rows={leaderboard} />
            <LeaderboardTable rows={leaderboard} sectors={sectors} />
          </div>
        </>
      )}
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[60px] rounded-lg border border-border bg-surface" />
        ))}
      </div>
      <div className="h-[460px] rounded-xl border border-border bg-surface" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-5 rounded-xl border border-border bg-surface px-6 py-16 text-center shadow-card">
      <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-surface-2 text-accent">
        <BarChart3 className="h-6 w-6" />
      </span>
      <div>
        <p className="text-lg font-semibold text-text">No data yet</p>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
          This dashboard reads scan results from the backend database.  Start your
          local backend once and it will scan automatically; the results are then
          exported as a static snapshot this site keeps serving even after you
          close the backend.
        </p>
      </div>

      <div className="flex w-full max-w-lg flex-col gap-2 rounded-lg border border-border bg-bg p-4 text-left">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
          <Terminal className="h-3.5 w-3.5" /> Run once on your laptop
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-text-dim">
          <li><code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-accent">cd backend && uvicorn app.main:app --port 8000</code></li>
          <li>Watch <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-accent">localhost:8000/api/scan/status</code> until <em className="text-text-dim">is_running</em> flips false</li>
          <li>Close the terminal — results are exported to <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-accent">frontend/public/data</code>. This page then works offline forever.</li>
        </ol>
      </div>

      <p className="flex max-w-md items-start gap-1.5 text-left text-xs text-muted">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        This site is currently offline-only until a scan has completed at least once.
      </p>
    </div>
  );
}
