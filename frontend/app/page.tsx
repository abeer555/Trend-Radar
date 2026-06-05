import { fetchLeaderboard, fetchSectors, fetchScanStatus } from "@/lib/api";
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
      <span className="rounded border border-warn/30 bg-warn/5 px-2 py-1 text-xs text-warn">
        No scan run yet — trigger one via POST /api/scan
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
      <span className={s.startsWith("completed") ? "text-bull" : "text-warn"}>
        ● {s}
      </span>
      {n != null && <span>{n} tickers scanned</span>}
      {dt && <span>Last run: {new Date(dt as string).toLocaleString()}</span>}
    </div>
  );
}

export default async function LeaderboardPage() {
  const [rows, sectors, scanStatus] = await Promise.allSettled([
    fetchLeaderboard({ limit: 200 }),
    fetchSectors(),
    fetchScanStatus(),
  ]);

  const leaderboard = rows.status === "fulfilled"    ? rows.value    : [];
  const sectorList  = sectors.status === "fulfilled" ? sectors.value : [];
  const scan        = scanStatus.status === "fulfilled" ? scanStatus.value : {};

  const isEmpty = leaderboard.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Momentum Leaderboard</h1>
          <p className="text-sm text-muted">
            Rule-based composite momentum ranking of Nifty 500 stocks.
            Updated daily after market close.
          </p>
        </div>
        <ScanStatusBadge status={scan} />
      </div>

      <Disclaimer />

      {isEmpty ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface py-20 text-center">
          <span className="text-4xl">📊</span>
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
