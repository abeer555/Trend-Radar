import type { LeaderboardRow, StockDetail, ChartData, SortField } from "./types";
import { snapshot, snapshotAvailable, sanitizeTicker } from "./snapshot";
import { reportDataSource } from "./offline";

// On the server (RSC/SSR) relative URLs have no base, so we must hit the
// backend directly. In the browser we use the relative path which Next.js
// rewrites (see next.config.js) proxy to the backend, avoiding CORS.
const BASE =
  typeof window === "undefined"
    ? `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"}/api`
    : "/api";

/** How long the browser waits for the live API before falling back. */
const LIVE_TIMEOUT_MS = 4000;

/** localStorage write-through cache (browser only). */
const LS_KEY = "trendradar.cache.v1";
/** Skip the localStorage tier when entries grow past this — avoid quota storms. */
const LS_MAX_ENTRY_BYTES = 2_000_000;

interface LsEntry<T> { t: number; v: T }

function lsRead<T>(key: string): LsEntry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${LS_KEY}.${key}`);
    return raw ? (JSON.parse(raw) as LsEntry<T>) : null;
  } catch {
    return null;
  }
}

function lsWrite(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify({ t: Date.now(), v: value });
    if (raw.length > LS_MAX_ENTRY_BYTES) return; // chart-scale payloads stay snapshot-only
    window.localStorage.setItem(`${LS_KEY}.${key}`, raw);
  } catch {
    /* quota / private mode — cache is best-effort */
  }
}

// Some hostings answer an unreachable rewrite target with a fast 5xx; a hung
// connection instead of a refusal switches the live path from a promise
// rejection to a timeout — both end up in the same catch.
async function live<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...(typeof window !== "undefined"
      ? { signal: AbortSignal.timeout(LIVE_TIMEOUT_MS) }
      : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface LeaderboardParams {
  sector?:         string;
  min_price?:      number;
  min_rs?:         number;
  trend_template?: boolean;
  vcp?:            boolean;
  sort_by?:        SortField;
  order?:          "asc" | "desc";
  limit?:          number;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

function leaderboardQuery(params: LeaderboardParams): string {
  const q = new URLSearchParams();
  if (params.sector)                    q.set("sector", params.sector);
  if (params.min_price != null)         q.set("min_price", String(params.min_price));
  if (params.min_rs != null)            q.set("min_rs", String(params.min_rs));
  if (params.trend_template != null)    q.set("trend_template", String(params.trend_template));
  if (params.vcp != null)               q.set("vcp", String(params.vcp));
  if (params.sort_by)                   q.set("sort_by", params.sort_by);
  if (params.order)                     q.set("order", params.order);
  if (params.limit != null)             q.set("limit", String(params.limit));
  return q.toString();
}

/** Re-apply the backend's filter/sort/limit semantics against a stored full list. */
function applyLeaderboardParams(rows: LeaderboardRow[], params: LeaderboardParams): LeaderboardRow[] {
  let out = rows;
  if (params.sector)              out = out.filter((r) => r.sector === params.sector);
  if (params.min_price != null)   out = out.filter((r) => (r.last_price ?? -Infinity) >= (params.min_price as number));
  if (params.min_rs != null)      out = out.filter((r) => (r.rs_rank ?? -Infinity) >= (params.min_rs as number));
  if (params.trend_template === true)  out = out.filter((r) => !!r.trend_template_pass);
  if (params.trend_template === false) out = out.filter((r) => !r.trend_template_pass);
  if (params.vcp === true)        out = out.filter((r) => !!r.vcp_detected);
  if (params.vcp === false)       out = out.filter((r) => !r.vcp_detected);

  const sortBy = params.sort_by;
  if (sortBy) {
    const dir = params.order === "asc" ? 1 : -1;
    // SortField includes fields exported by the backend but absent from the
    // slim LeaderboardRow type (e.g. trend_template_score) — index loosely.
    const val = (r: LeaderboardRow) => (r as unknown as Record<string, unknown>)[sortBy];
    out = [...out].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;  // nulls last, regardless of direction
      if (bv == null) return -1;
      return (Number(av) - Number(bv)) * dir;
    });
  }

  const limit = params.limit ?? 100;
  return out.slice(0, limit);
}

export async function fetchLeaderboard(params: LeaderboardParams = {}): Promise<LeaderboardRow[]> {
  // Server (RSC) with the backend down: serve the committed snapshot straight
  // from the frontend's own filesystem so the leaderboard/sectors/home page
  // renders real data on Vercel without any backend at all.
  if (typeof window === "undefined") {
    try {
      return await live<LeaderboardRow[]>(`${BASE}/leaderboard?${leaderboardQuery(params)}`);
    } catch {
      const rows = await snapshot.leaderboard();
      if (rows) return applyLeaderboardParams(rows, params);
      throw new Error("backend unreachable and no static snapshot");
    }
  }

  try {
    const rows = await live<LeaderboardRow[]>(`${BASE}/leaderboard?${leaderboardQuery(params)}`);
    // Cache the unfiltered superset so offline filtering works for any params.
    if (!params.sector && params.min_price == null && params.min_rs == null &&
        params.trend_template == null && params.vcp == null) {
      lsWrite("leaderboard", rows);
    }
    return rows;
  } catch (liveErr) {
    const entry = lsRead<LeaderboardRow[]>("leaderboard");
    if (entry) {
      reportDataSource("cache", new Date(entry.t).toISOString());
      return applyLeaderboardParams(entry.v, params);
    }
    const rows = await snapshot.leaderboard();
    if (rows) {
      reportDataSource("snapshot", null);
      return applyLeaderboardParams(rows, params);
    }
    throw liveErr;
  }
}

// ---------------------------------------------------------------------------
// Stock detail — snapshot ships {stock, chart} together, so whichever one is
// fetched first also warms the session cache for the other.
// ---------------------------------------------------------------------------

const SS_PREFIX = `${LS_KEY}.pair`;

interface StockChartPair { stock: StockDetail | null; chart: ChartData | null }

function pairRead(ticker: string): StockChartPair | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${SS_PREFIX}.${sanitizeTicker(ticker)}`);
    return raw ? (JSON.parse(raw) as StockChartPair) : null;
  } catch {
    return null;
  }
}

function pairWrite(ticker: string, part: "stock" | "chart", value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    const key  = `${SS_PREFIX}.${sanitizeTicker(ticker)}`;
    const prev: StockChartPair = pairRead(ticker) ?? { stock: null, chart: null };
    const next: StockChartPair = part === "stock"
      ? { ...prev, stock: value as StockDetail }
      : { ...prev, chart: value as ChartData };
    window.sessionStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* sessionStorage full / unavailable — fallback works without it */
  }
}

function chartCovers(chart: ChartData, days: number): boolean {
  const first = chart.candles[0]?.time;
  if (!first) return false;
  const spanDays = (Date.now() - Date.parse(first)) / 86_400_000;
  return spanDays + 5 >= days; // small slack for weekends/holidays
}

/** Reduce a wider chart series to the requested window (by calendar age). */
function filterChartDays(chart: ChartData, days: number): ChartData {
  if (days === Number.POSITIVE_INFINITY) return chart;
  const cutoff = Date.now() - days * 86_400_000;
  const keep = (time: string) => Date.parse(time) >= cutoff;
  return {
    candles:  chart.candles.filter((c) => keep(c.time)),
    ma50:     chart.ma50.filter((p) => keep(p.time)),
    ma150:    chart.ma150.filter((p) => keep(p.time)),
    ma200:    chart.ma200.filter((p) => keep(p.time)),
    bb_upper: chart.bb_upper.filter((p) => keep(p.time)),
    bb_lower: chart.bb_lower.filter((p) => keep(p.time)),
    bb_mid:   chart.bb_mid.filter((p) => keep(p.time)),
  };
}

export async function fetchStock(ticker: string): Promise<StockDetail> {
  if (typeof window === "undefined") {
    try {
      return await live<StockDetail>(`${BASE}/stock/${encodeURIComponent(ticker)}`);
    } catch {
      const snap = await snapshot.stock(ticker);
      if (snap?.stock) return snap.stock;
      throw new Error(`no data for ${ticker}`);
    }
  }

  try {
    const stock = await live<StockDetail>(`${BASE}/stock/${encodeURIComponent(ticker)}`);
    pairWrite(ticker, "stock", stock);
    return stock;
  } catch (liveErr) {
    const cached = pairRead(ticker);
    if (cached?.stock) {
      reportDataSource("cache", null);
      return cached.stock;
    }
    const snap = await snapshot.stock(ticker);
    if (snap?.stock) {
      pairWrite(ticker, "stock", snap.stock);
      if (snap.chart) pairWrite(ticker, "chart", snap.chart);
      reportDataSource("snapshot", null);
      return snap.stock;
    }
    // No payload anywhere: if a snapshot exists this ticker genuinely isn't in
    // the dataset (same as a live 404); otherwise the error stays opaque.
    await snapshotAvailable();
    throw liveErr;
  }
}

export async function fetchChartData(ticker: string, days = 365): Promise<ChartData> {
  if (typeof window === "undefined") {
    try {
      return await live<ChartData>(`${BASE}/stock/${encodeURIComponent(ticker)}/chart?days=${days}`);
    } catch {
      const snap = await snapshot.stock(ticker);
      if (snap?.chart && chartCovers(snap.chart, days)) return filterChartDays(snap.chart, days);
      throw new Error(`no chart for ${ticker}`);
    }
  }

  try {
    const chart = await live<ChartData>(`${BASE}/stock/${encodeURIComponent(ticker)}/chart?days=${days}`);
    // Only the full 365-day series is worth keeping as a fallback source.
    if (days >= 365) pairWrite(ticker, "chart", chart);
    return chart;
  } catch (liveErr) {
    const cached = pairRead(ticker);
    if (cached?.chart && chartCovers(cached.chart, days)) {
      reportDataSource("cache", null);
      return filterChartDays(cached.chart, days);
    }
    const snap = await snapshot.stock(ticker);
    if (snap?.chart && chartCovers(snap.chart, days)) {
      pairWrite(ticker, "chart", snap.chart);
      if (snap.stock && !cached?.stock) pairWrite(ticker, "stock", snap.stock);
      reportDataSource("snapshot", null);
      return filterChartDays(snap.chart, days);
    }
    throw liveErr;
  }
}

// ---------------------------------------------------------------------------
// Sectors — derivable from any stored leaderboard, so this never dies while
// *any* data is available.
// ---------------------------------------------------------------------------

export async function fetchSectors(): Promise<string[]> {
  if (typeof window === "undefined") {
    try {
      return await live<string[]>(`${BASE}/sectors`);
    } catch {
      // Derivable from the snapshot leaderboard — no dedicated file needed.
      const lb = await snapshot.leaderboard();
      if (lb) return [...new Set(lb.map((r) => r.sector).filter((s): s is string => !!s))].sort();
      const sectors = await snapshot.sectors();
      if (sectors) return sectors;
      throw new Error("backend unreachable and no static snapshot");
    }
  }

  try {
    const sectors = await live<string[]>(`${BASE}/sectors`);
    lsWrite("sectors", sectors);
    return sectors;
  } catch (liveErr) {
    const entry = lsRead<string[]>("sectors");
    if (entry) {
      reportDataSource("cache", new Date(entry.t).toISOString());
      return entry.v;
    }
    const lbEntry = lsRead<LeaderboardRow[]>("leaderboard");
    const lb = lbEntry?.v ?? (await snapshot.leaderboard());
    if (lb) {
      reportDataSource(lbEntry ? "cache" : "snapshot",
                       lbEntry ? new Date(lbEntry.t).toISOString() : null);
      return [...new Set(lb.map((r) => r.sector).filter((s): s is string => !!s))].sort();
    }
    const sectors = await snapshot.sectors();
    if (sectors) {
      reportDataSource("snapshot", null);
      return sectors;
    }
    throw liveErr;
  }
}

// ---------------------------------------------------------------------------
// Scan control / status
// ---------------------------------------------------------------------------

export async function triggerScan(forceRefresh = false): Promise<{ status: string; message: string }> {
  const res = await fetch(`${BASE}/scan?force_refresh=${forceRefresh}`, { method: "POST" });
  return res.json();
}

export async function fetchScanStatus(): Promise<Record<string, unknown>> {
  // Server (RSC) with the backend down: the static status file lives inside
  // the frontend deployment, so it works even when the API is unreachable.
  if (typeof window === "undefined") {
    try {
      return await live<Record<string, unknown>>(`${BASE}/scan/status`);
    } catch {
      const s = await snapshot.status();
      if (s) return ageAdjustedStatus(s);
      // Re-throw a synthetic error so callers hit their existing fallback.
      throw new Error("backend unreachable and no static snapshot");
    }
  }

  try {
    const status = await live<Record<string, unknown>>(`${BASE}/scan/status`);
    lsWrite("status", status);
    return status;
  } catch (liveErr) {
    const entry = lsRead<Record<string, unknown>>("status");
    const raw: Record<string, unknown> | null = entry?.v ?? (await snapshot.status());
    if (raw) {
      reportDataSource(entry ? "cache" : "snapshot",
                       entry ? new Date(entry.t).toISOString() : null);
      return ageAdjustedStatus(raw);
    }
    throw liveErr;
  }
}

// data_age_hours / is_stale are computed server-side against "now" — for
// stored/snapshot copies recompute them from last_completed_at at read time.
function ageAdjustedStatus(raw: Record<string, unknown>): Record<string, unknown> {
  const s = { ...raw };
  const finished = typeof s.last_completed_at === "string" ? s.last_completed_at : null;
  const threshold = typeof s.stale_threshold_hours === "number" ? s.stale_threshold_hours : 18;
  if (finished) {
    const age = Math.max(0, (Date.now() - Date.parse(finished)) / 3_600_000);
    s.data_age_hours = Math.round(age * 100) / 100;
    s.is_stale = age > threshold;
  } else {
    s.data_age_hours = null;
    s.is_stale = true;
  }
  s.is_running = false;
  return s;
}
