import type { ChartData, LeaderboardRow, StockDetail } from "./types";

/**
 * Static snapshot loader.
 *
 * The backend exports its full dataset to `public/data/*.json` after every
 * completed scan (see backend/app/exporter.py).  Those files are served
 * same-origin, so they are reachable even when the FastAPI backend is down.
 *
 * Resolution order inside load():
 *   browser → HTTP fetch of /data/...   (same-origin, works on Vercel)
 *   server  → read from public/data on disk (no self-HTTP needed; relative
 *             fetches are illegal in RSC/server code)
 *
 * Everything here always fails soft (null) because these loaders are the
 * *last* fallback in lib/api.ts after the localStorage cache.
 */

const mem = new Map<string, Promise<unknown>>();

// In the browser snapshot fetches go through the network; on the server they
// read straight from the filesystem (works at build time, in dev, and inside
// Vercel serverless functions where public/ is bundled).
//
// The `require` path is hidden behind a Function constructor so webpack never
// sees a static dependency on Node builtins and excludes it from the client
// bundle.  This branch only ever executes server-side (window check above).
async function serverRead<T>(relative: string): Promise<T | null> {
  if (typeof window !== "undefined") return fetchRead<T>(relative);
  try {
    // eslint-disable-next-line no-new-func -- intentional: hide fs from webpack
    const req = new Function("m", "return require(m)") as (m: string) => any;
    const fs   = req("fs/promises");
    const path = req("path");
    const file = path.join(process.cwd(), "public", "data", relative);
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function fetchRead<T>(relative: string): Promise<T | null> {
  try {
    const r = await fetch(`/data/${relative}`, { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Fetch a /data JSON file once per session/process; null when absent. */
function load<T>(relative: string): Promise<T | null> {
  let p = mem.get(relative) as Promise<T | null> | undefined;
  if (!p) {
    p = serverRead<T>(relative);
    mem.set(relative, p as Promise<unknown>);
  }
  return p;
}

/** Mirror of backend exporter.sanitize_ticker — keep the two in sync. */
export function sanitizeTicker(ticker: string): string {
  return ticker.replace(/[./^]/g, "_");
}

export interface SnapshotStock {
  stock: StockDetail | null;
  chart: ChartData | null;
}

export interface SnapshotStatus extends Record<string, unknown> {
  status?: string;
  is_running?: boolean;
  has_data?: boolean;
  is_stale?: boolean;
  data_age_hours?: number | null;
  last_completed_at?: string | null;
  stale_threshold_hours?: number;
  exported_at?: string;
  finished_at?: string | null;
  tickers_scanned?: number | null;
}

export const snapshot = {
  leaderboard: () => load<LeaderboardRow[]>("leaderboard.json"),
  sectors:     () => load<string[]>("sectors.json"),
  status:      () => load<SnapshotStatus>("status.json"),
  stocksIndex: () => load<string[]>("stocks/index.json"),
  stock:       (ticker: string) =>
    load<SnapshotStock>(`stocks/${sanitizeTicker(ticker)}.json`),
};

/**
 * True when a committed static snapshot exists (used to decide whether an
 * unknown ticker is a real 404 or just "not in the snapshot").
 */
export async function snapshotAvailable(): Promise<boolean> {
  return (await snapshot.status()) != null || (await snapshot.leaderboard()) != null;
}

/** Session/process-local invalidation (e.g. after a fresh scan completes). */
export function clearSnapshotCache(): void {
  mem.clear();
}
