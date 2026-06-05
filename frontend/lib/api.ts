import type { LeaderboardRow, StockDetail, ChartData, SortField } from "./types";

// On the server (RSC/SSR) relative URLs have no base, so we must hit the
// backend directly. In the browser we use the relative path which Next.js
// rewrites (see next.config.js) proxy to the backend, avoiding CORS.
const BASE =
  typeof window === "undefined"
    ? `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"}/api`
    : "/api";

async function _get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
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

export async function fetchLeaderboard(params: LeaderboardParams = {}): Promise<LeaderboardRow[]> {
  const q = new URLSearchParams();
  if (params.sector)                    q.set("sector", params.sector);
  if (params.min_price != null)         q.set("min_price", String(params.min_price));
  if (params.min_rs != null)            q.set("min_rs", String(params.min_rs));
  if (params.trend_template != null)    q.set("trend_template", String(params.trend_template));
  if (params.vcp != null)               q.set("vcp", String(params.vcp));
  if (params.sort_by)                   q.set("sort_by", params.sort_by);
  if (params.order)                     q.set("order", params.order);
  if (params.limit != null)             q.set("limit", String(params.limit));
  return _get<LeaderboardRow[]>(`${BASE}/leaderboard?${q}`);
}

export async function fetchStock(ticker: string): Promise<StockDetail> {
  return _get<StockDetail>(`${BASE}/stock/${encodeURIComponent(ticker)}`);
}

export async function fetchChartData(ticker: string, days = 365): Promise<ChartData> {
  return _get<ChartData>(`${BASE}/stock/${encodeURIComponent(ticker)}/chart?days=${days}`);
}

export async function fetchSectors(): Promise<string[]> {
  return _get<string[]>(`${BASE}/sectors`);
}

export async function triggerScan(forceRefresh = false): Promise<{ status: string; message: string }> {
  const res = await fetch(`${BASE}/scan?force_refresh=${forceRefresh}`, { method: "POST" });
  return res.json();
}

export async function fetchScanStatus(): Promise<Record<string, unknown>> {
  return _get(`${BASE}/scan/status`);
}
