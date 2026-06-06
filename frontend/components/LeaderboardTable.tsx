"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import clsx from "clsx";
import type { LeaderboardRow, SortField } from "@/lib/types";
import { fmtINR } from "@/lib/format";
import FilterBar, { EMPTY_FILTERS, type Filters } from "./FilterBar";
import Sparkline from "./Sparkline";
import ScoreBar from "./ScoreBar";

interface Props {
  rows:    LeaderboardRow[];
  sectors: string[];
}

type SortDir = "asc" | "desc";

function PctChange({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted">—</span>;
  const pct = v * 100;
  return (
    <span className={clsx("text-sm font-medium tabular-nums", pct >= 0 ? "text-bull" : "text-bear")}>
      {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
    </span>
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

export default function LeaderboardTable({ rows, sectors }: Props) {
  const router = useRouter();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sortField, setSortField] = useState<SortField>("composite_score");
  const [sortDir, setSortDir]     = useState<SortDir>("desc");

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
    if (filters.sector)   r = r.filter(x => x.sector === filters.sector);
    if (filters.minPrice) r = r.filter(x => (x.last_price ?? 0) >= Number(filters.minPrice));
    if (filters.minRS)    r = r.filter(x => (x.rs_rank ?? 0)    >= Number(filters.minRS));
    return r;
  }, [rows, filters.query, filters.sector, filters.minPrice, filters.minRS]);

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

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        sectors={sectors}
        shown={filtered.length}
        total={rows.length}
        ttCount={ttCount}
        vcpCount={vcpCount}
      />

      <div className="max-h-[75vh] overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={clsx(TH_BASE, "w-10 text-left")}>#</th>
              <th className={clsx(TH_BASE, "text-left")}>Ticker / Name</th>
              <th className={clsx(TH_BASE, "hidden text-left lg:table-cell")}>Sector</th>
              <Th field="last_price"      sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="right">Price</Th>
              <Th field="pct_change_1d"   sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="right">1D %</Th>
              <Th field="composite_score" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="w-36">Score</Th>
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
            {filtered.map((row, i) => (
              <tr
                key={row.ticker}
                className="group cursor-pointer transition-colors hover:bg-surface-2/60"
                onClick={() => router.push(`/stock/${row.ticker}`)}
              >
                <td className="px-3 py-2.5 text-xs tabular-nums text-muted">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="font-mono text-[13px] font-semibold text-text">{row.ticker}</div>
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
                <td className="w-36 px-3 py-2.5">
                  <ScoreBar score={row.composite_score} size="sm" />
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
                  {row.trend_template_pass == null
                    ? <span className="text-muted">—</span>
                    : row.trend_template_pass
                      ? <span className="badge badge-bull">Pass</span>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
