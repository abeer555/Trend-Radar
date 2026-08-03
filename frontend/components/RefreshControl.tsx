"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { triggerScan, fetchScanStatus } from "@/lib/api";

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
 */
export default function RefreshControl() {
  const [status, setStatus]     = useState<Status | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const pollRef                 = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await fetchScanStatus();
      setStatus(s as Status);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + poll while a scan is running (and slowly otherwise).
  useEffect(() => {
    refresh();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    // Poll every 3s while a scan is running, otherwise every 60s.
    const intervalMs = status?.is_running ? 3000 : 60000;
    pollRef.current = setInterval(refresh, intervalMs);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status?.is_running, refresh]);

  async function handleRefresh() {
    if (status?.is_running) return;
    try {
      await triggerScan();
      // Immediately show as running, then keep polling to pick up completion.
      setStatus((s) => ({ ...s, is_running: true, status: "running" }));
      refresh();
    } catch {
      setError(true);
    }
  }

  const isRunning = Boolean(status?.is_running);
  const hasData   = Boolean(status?.has_data);
  const isStale   = Boolean(status?.is_stale);
  const ageHours  = status?.data_age_hours ?? null;

  // Choose colour trio
  let dotClass   = "bg-accent";
  let textClass  = "text-muted";
  let label      = "Scan status unknown";

  if (error) {
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
      disabled={isRunning || loading}
      title={
        isRunning
          ? "A scan is already running on the backend"
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
