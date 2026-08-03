"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, ArrowDown, ArrowUp, ChevronsUpDown, Check } from "lucide-react";
import clsx from "clsx";
import type { LeaderboardRow, SortField } from "@/lib/types";
import { fmtINR } from "@/lib/format";
import FilterBar, { EMPTY_FILTERS, type Filters } from "./FilterBar";
import Sparkline from "./Sparkline";
import ScoreBar from "./ScoreBar";
import WatchlistButton from "./WatchlistButton";

interface Props {
  rows:    LeaderboardRow[];
  sectors: string[];
}

type SortDir = "asc" | "desc";

function PctChange({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted">—</span>;
  const pct = v * 100;
  return (
    <span className={clsx(
      "inline-block rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
      pct >= 0 ? "bg-bull/10 text-bull" : "bg-bear/10 text-bear"
    )}>
      {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
    </span>
  );
}

/** Medal tints for the top 3 ranks. */
function rankClass(i: number): string {
  if (i === 0) return "font-semibold text-gold";
  if (i === 1) return "font-semibold text-[#b9c0cc]";
  if (i === 2) return "font-semibold text-[#d08a4e]";
  return "text-muted";
}

function Ticker({ t }: { t: string }) {
  const dot = t.indexOf(".");
  if (dot === -1) return <>{t}</>;
  return (
    <>
      {t.slice(0, dot)}
      <span className="font-normal text-muted">{t.slice(dot)}</span>
    </>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 text-muted/50" />;
  return dir === "desc"
    ? <ArrowDown className="h-3 w-3 text-accent" />
    : <ArrowUp className="h-3 w-3 text-accent" />;
}

const TH_BASE =
  "sticky top-0 z-10 whitespace-nowrap bg-surface px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-muted shadow-[inset_0_-1px_0_#232936]";

function Th({
  children, field, sortField, sortDir, onSort, align = "left", className,
}: {
  children:  React.ReactNode;
  field:     SortField;
  sortField: SortField;
  sortDir:   SortDir;
  onSort:    (f: SortField) => void;
  align?:    "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={clsx(TH_BASE, "cursor-pointer select-none transition-colors hover:text-text", className)}
      onClick={() => onSort(field)}
    >
      <span className={clsx("flex items-center gap-1", align === "right" && "justify-end")}>
        {children}
        <SortIcon active={sortField === field} dir={sortDir} />
      </span>
    </th>
  );
}

const VALID_SORT_FIELDS: SortField[] = [
  "composite_score", "rs_rank", "last_price", "pct_change_1d",
  "adx", "high_proximity", "trend_template_score",
];

export default function LeaderboardTable({ rows, sectors }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialise filters/sort from the URL so filtered views are shareable.
  const [filters, setFilters] = useState<Filters>(() => ({
    query:    searchParams.get("q")      ?? "",
    sector:   searchParams.get("sector") ?? "",
    minRS:    searchParams.get("rs")     ?? "",
    minPrice: searchParams.get("price")  ?? "",
    tt:       searchParams.get("tt")  === "1",
    vcp:      searchParams.get("vcp") === "1",
    volumeSurge:    searchParams.get("vol")  === "1",
    minProximity:   searchParams.get("prox") ?? "",
  }));
  const [sortField, setSortField] = useState<SortField>(() => {
    const s = searchParams.get("sort") as SortField | null;
    return s && VALID_SORT_FIELDS.includes(s) ? s : "composite_score";
  });
  const [sortDir, setSortDir] = useState<SortDir>(
    () => (searchParams.get("dir") === "asc" ? "asc" : "desc")
  );

  // Mirror state back into the URL (replaceState avoids a server round-trip).
  useEffect(() => {
    const p = new URLSearchParams();
    if (filters.query)        p.set("q", filters.query);
    if (filters.sector)       p.set("sector", filters.sector);
    if (filters.minRS)        p.set("rs", filters.minRS);
    if (filters.minPrice)     p.set("price", filters.minPrice);
    if (filters.tt)           p.set("tt", "1");
    if (filters.vcp)          p.set("vcp", "1");
    if (filters.volumeSurge)  p.set("vol", "1");
    if (filters.minProximity) p.set("prox", filters.minProximity);
    if (sortField !== "composite_score") p.set("sort", sortField);
    if (sortDir !== "desc")              p.set("dir", sortDir);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [filters, sortField, sortDir]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }, [sortField]);

  // Everything except the TT/VCP toggles — used to compute live toggle counts.
  const base = useMemo(() => {
    let r = rows;
    const q = filters.query.trim().toLowerCase();
    if (q) {
      r = r.filter(x =>
        x.ticker.toLowerCase().includes(q) || (x.name ?? "").toLowerCase().includes(q)
      );
    }
    if (filters.sector)       r = r.filter(x => x.sector === filters.sector);
    if (filters.minPrice)     r = r.filter(x => (x.last_price ?? 0)      >= Number(filters.minPrice));
    if (filters.minRS)        r = r.filter(x => (x.rs_rank ?? 0)         >= Number(filters.minRS));
    if (filters.minProximity) r = r.filter(x => (x.high_proximity ?? 0)  >= Number(filters.minProximity));
    if (filters.volumeSurge)  r = r.filter(x => !!x.volume_surge || !!x.pocket_pivot);
    return r;
  }, [rows, filters.query, filters.sector, filters.minPrice, filters.minRS, filters.minProximity, filters.volumeSurge]);

  // NB: the API serialises SQLite booleans as 0/1, so use truthy checks, not === true.
  const ttCount  = useMemo(() => base.filter(x => !!x.trend_template_pass).length, [base]);
  const vcpCount = useMemo(() => base.filter(x => !!x.vcp_detected).length, [base]);

  const filtered = useMemo(() => {
    let r = base;
    if (filters.tt)  r = r.filter(x => !!x.trend_template_pass);
    if (filters.vcp) r = r.filter(x => !!x.vcp_detected);

    return [...r].sort((a, b) => {
      const av = ((a as unknown as Record<string, number | null>)[sortField]) ?? 0;
      const bv = ((b as unknown as Record<string, number | null>)[sortField]) ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [base, filters.tt, filters.vcp, sortField, sortDir]);

  // Scores cluster in a narrow band (e.g. 78-93), so a 0-100 bar makes every
  // row look identical. Normalise the bar width to the visible range; the
  // number still shows the raw score.
  const [minScore, maxScore] = useMemo(() => {
    const vals = filtered
      .map(r => r.composite_score)
      .filter((v): v is number => v != null);
    if (vals.length === 0) return [0, 100];
    return [Math.min(...vals), Math.max(...vals)];
  }, [filtered]);

  const normFill = useCallback((s: number | null) => {
    if (s == null) return 0;
    if (maxScore === minScore) return 100;
    return 8 + 92 * ((s - minScore) / (maxScore - minScore));
  }, [minScore, maxScore]);

  // Incremental rendering: keep the DOM light with 500 rows — render in
  // pages of 100, loading more as the sentinel row scrolls into view.
  const PAGE = 100;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const sentinelRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => { setVisibleCount(PAGE); }, [filters, sortField, sortDir]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(c => Math.min(filtered.length, c + PAGE));
      }
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length, visibleCount]);

  const visibleRows = filtered.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-4">
      <div className="fade-up">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          sectors={sectors}
          shown={filtered.length}
          total={rows.length}
          ttCount={ttCount}
          vcpCount={vcpCount}
        />
      </div>

      <div className="fade-up fade-up-1 max-h-[75vh] overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={clsx(TH_BASE, "w-10 text-left")}>#</th>
              <th className={clsx(TH_BASE, "text-left")}>Ticker / Name</th>
              <th className={clsx(TH_BASE, "hidden text-left lg:table-cell")}>Sector</th>
              <Th field="last_price"      sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="right">Price</Th>
              <Th field="pct_change_1d"   sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="right">1D %</Th>
              <Th field="composite_score" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="w-24 sm:w-36">Score</Th>
              <Th field="rs_rank"         sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="right">RS</Th>
              <th className={clsx(TH_BASE, "hidden text-center md:table-cell")} title="Minervini Trend Template">
                Trend
              </th>
              <th className={clsx(TH_BASE, "hidden text-center md:table-cell")} title="Volatility Contraction Pattern">
                VCP
              </th>
              <th className={clsx(TH_BASE, "hidden text-left sm:table-cell")}>30D</th>
              <th className={clsx(TH_BASE, "w-8")} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-bg">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="py-16 text-center text-muted">
                  No stocks match the current filters.
                </td>
              </tr>
            )}
            {visibleRows.map((row, i) => (
              <tr
                key={row.ticker}
                className="group cursor-pointer transition-colors hover:bg-surface-2/60"
                onClick={() => router.push(`/stock/${encodeURIComponent(row.ticker)}`)}
              >
                <td className={clsx("px-3 py-2.5 text-xs tabular-nums", rankClass(i))}>{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="font-mono text-[13px] font-semibold text-text">
                      <Ticker t={row.ticker} />
                    </div>
                    <WatchlistButton ticker={row.ticker} />
                  </div>
                  <div className="max-w-[180px] truncate text-xs text-muted">{row.name ?? "—"}</div>
                </td>
                <td className="hidden px-3 py-2.5 lg:table-cell">
                  {row.sector ? (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setFilters(f => ({ ...f, sector: row.sector! }));
                      }}
                      className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-text-dim transition-colors hover:border-accent/40 hover:text-accent"
                      title={`Filter by ${row.sector}`}
                    >
                      {row.sector}
                    </button>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                  ₹{fmtINR(row.last_price)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <PctChange v={row.pct_change_1d} />
                </td>
                <td
                  className="w-24 px-3 py-2.5 sm:w-36"
                  title={row.composite_score != null
                    ? `Composite score ${row.composite_score.toFixed(1)} / 100 — bar scaled to the current list`
                    : undefined}
                >
                  <ScoreBar
                    score={row.composite_score}
                    size="sm"
                    fillPct={normFill(row.composite_score)}
                  />
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                  {row.rs_rank != null ? (
                    <span className={clsx(
                      "font-semibold",
                      row.rs_rank >= 80 ? "text-bull"
                      : row.rs_rank >= 60 ? "text-accent"
                      : "text-muted"
                    )}>
                      {row.rs_rank.toFixed(0)}
                    </span>
                  ) : <span className="text-muted">—</span>}
                </td>
                <td className="hidden px-3 py-2.5 text-center md:table-cell">
                  {row.trend_template_pass
                    ? <Check className="mx-auto h-4 w-4 text-bull" strokeWidth={2.5} aria-label="Passes Trend Template" />
                    : <span className="text-xs text-muted">—</span>}
                </td>
                <td className="hidden px-3 py-2.5 text-center md:table-cell">
                  {row.vcp_detected
                    ? <span className="badge badge-blue">VCP</span>
                    : <span className="text-xs text-muted">—</span>}
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  <Sparkline data={row.sparkline ?? []} />
                </td>
                <td className="px-2 py-2.5">
                  <ChevronRight className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                </td>
              </tr>
            ))}
            {visibleCount < filtered.length && (
              <tr ref={sentinelRef}>
                <td colSpan={11} className="py-4 text-center text-xs text-muted">
                  Loading more — {filtered.length - visibleCount} remaining…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
