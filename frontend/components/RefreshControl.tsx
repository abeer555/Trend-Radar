"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { triggerScan, fetchScanStatus } from "@/lib/api";
import { useOfflineStatus } from "@/lib/offline";

type Status = {
  status?: string;
  is_running?: boolean;
  has_data?: boolean;
  is_stale?: boolean;
  data_age_hours?: number | null;
  finished_at?: string | null;
  server_time?: string;
};

/** Humanise an age in hours → "12m", "3h", "2d 4h" ago. */
function fmtAge(hours: number | null | undefined): string {
  if (hours == null) return "never";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const d = Math.floor(hours / 24);
  const h = Math.round(hours % 24);
  return h ? `${d}d ${h}h` : `${d}d`;
}

/**
 * Refresh control — the piece that makes the laptop-run model usable:
 *   - Shows at a glance whether the numbers on screen are fresh, stale, or
 *     missing entirely.
 *   - One click POSTs /api/scan to trigger a background scan.
 *   - Polls /api/scan/status while running so you see `Running…` live.
 *
 * Implementation note: this uses a single self-arming `setTimeout` chain so the
 * polling cadence can change (3s while scanning, 60s idle) without re-running
 * effects when `status` changes — the naive `useEffect(..., [status])` pattern
 * created an update loop on first mount.
 */
export default function RefreshControl() {
  const [status, setStatus]   = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { offline, source }   = useOfflineStatus();

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const s = (await fetchScanStatus()) as Status;
      setStatus(s);
      setError(false);
      return Boolean(s.is_running);
    } catch {
      setError(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Self-arming polling loop — re-schedules itself with a cadence that
  // depends on whether a scan is running, without re-triggering React effects.
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const running = await refresh();
      if (cancelled) return;
      timerRef.current = setTimeout(tick, running ? 3000 : 60000);
    }

    tick();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [refresh]);

  async function handleRefresh() {
    if (status?.is_running || offline) return;
    try {
      await triggerScan();
      // Immediately show as running, then let the poll loop pick up completion.
      setStatus((s) => ({ ...s, is_running: true, status: "running" }));
    } catch {
      setError(true);
    }
  }

  const isRunning = Boolean(status?.is_running) || Boolean(status?.status === "running");
  const hasData   = Boolean(status?.has_data);
  const isStale   = Boolean(status?.is_stale);
  const ageHours  = status?.data_age_hours ?? null;

  let dotClass   = "bg-accent";
  let textClass  = "text-muted";
  let label      = "Scan status unknown";

  if (offline && (source === "cache" || source === "snapshot")) {
    // Backend is down but fallback data was served — distinguish from both a
    // hard failure and a healthy live connection.
    dotClass  = "bg-warn";
    textClass = "text-warn";
    label     = ageHours != null
      ? `Offline — cached data (${fmtAge(ageHours)} old)`
      : "Offline — cached data";
  } else if (error) {
    dotClass  = "bg-bear";
    textClass = "text-bear";
    label     = "Backend unreachable";
  } else if (loading) {
    label = "Checking…";
  } else if (isRunning) {
    dotClass  = "bg-accent pulse-glow";
    textClass = "text-accent";
    label     = "Scanning…";
  } else if (!hasData) {
    dotClass  = "bg-warn";
    textClass = "text-warn";
    label     = "No data yet";
  } else if (isStale) {
    dotClass  = "bg-warn";
    textClass = "text-warn";
    label     = `Data stale (${fmtAge(ageHours)} old)`;
  } else {
    dotClass  = "bg-bull";
    textClass = "text-bull";
    label     = `Fresh · ${fmtAge(ageHours)} ago`;
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isRunning || loading || offline}
      title={
        isRunning
          ? "A scan is already running on the backend"
          : offline
            ? "Backend is offline — start it to run a fresh scan"
            : "Trigger a fresh scan on the backend"
      }
      className={[
        "group inline-flex items-center gap-1.5 rounded-md border border-border",
        "bg-surface px-2.5 py-1 text-xs font-medium transition-all",
        "hover:border-border-strong hover:bg-surface-2/60",
        "disabled:cursor-wait disabled:opacity-70",
        textClass,
      ].join(" ")}
    >
      <RefreshCw
        className={`h-3.5 w-3.5 ${isRunning ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{isRunning ? "…" : isStale ? "Stale" : "Fresh"}</span>
    </button>
  );
}
