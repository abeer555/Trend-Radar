"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, Inbox } from "lucide-react";
import { fetchLeaderboard } from "@/lib/api";
import type { LeaderboardRow } from "@/lib/types";
import LeaderboardTable from "@/components/LeaderboardTable";
import { useWatchlist } from "@/lib/watchlist";
import { useOfflineStatus } from "@/lib/offline";

export default function WatchlistPage() {
  const { watchlist } = useWatchlist();
  const { offline }   = useOfflineStatus();
  const [rows, setRows]         = useState<LeaderboardRow[] | null>(null);
  const [sectors, setSectors]   = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLeaderboard({ limit: 500 });
        if (cancelled) return;
        setRows(data);
        setSectors([...new Set(data.map((r) => r.sector).filter(Boolean) as string[])].sort());
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => watchlist.has(r.ticker));
  }, [rows, watchlist]);

  return (
    <div className="fade-up flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tightest text-text">
            <Star className="h-6 w-6 text-gold" />
            Watchlist
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Stocks you've starred. Saved in your browser — not tied to any account.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface">
          <p className="text-sm text-muted">Loading…</p>
        </div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface text-center">
          <p className="font-medium text-text">Couldn&apos;t load leaderboard</p>
          <p className="max-w-sm text-sm text-muted">
            {offline
              ? "Backend is offline and no cached or snapshot data is available yet — run the backend once to create a snapshot."
              : "Check that the backend server is running and reachable."}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface/50 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-muted">
            <Inbox className="h-5 w-5" />
          </span>
          <div>
            <p className="font-medium text-text">Nothing on your watchlist yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Star stocks on the leaderboard or any stock detail page — they'll show up here.
            </p>
          </div>
        </div>
      ) : (
        <LeaderboardTable rows={filtered} sectors={sectors} />
      )}
    </div>
  );
}
