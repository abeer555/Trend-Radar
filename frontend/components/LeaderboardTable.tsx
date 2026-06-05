"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { LeaderboardRow, SortField } from "@/lib/types";
import Sparkline from "./Sparkline";
import ScoreBar from "./ScoreBar";

interface Props {
  rows:    LeaderboardRow[];
  sectors: string[];
}

type SortDir = "asc" | "desc";

const SORT_OPTS: { value: SortField; label: string }[] = [
  { value: "composite_score", label: "Composite Score" },
  { value: "rs_rank",         label: "RS Rank" },
  { value: "last_price",      label: "Price" },
  { value: "pct_change_1d",   label: "1-day %" },
  { value: "adx",             label: "ADX" },
  { value: "high_proximity",  label: "52-wk High Proximity" },
  { value: "trend_template_score", label: "Trend Template" },
];

function fmt(v: number | null, decimals = 2): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
}

function PctBadge({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted">—</span>;
  const pct = v * 100;
  return (
    <span className={clsx("font-mono text-sm font-medium", pct >= 0 ? "text-bull" : "text-bear")}>
      {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
    </span>
  );
}

function BoolBadge({ v, trueLabel = "✓", falseLabel = "✗" }: { v: boolean | null; trueLabel?: string; falseLabel?: string }) {
  if (v == null) return <span className="text-muted">—</span>;
  return (
    <span className={clsx("badge", v ? "badge-bull" : "badge-muted")}>
      {v ? trueLabel : falseLabel}
    </span>
  );
}

function SortIcon({ field, active, dir }: { field: string; active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-border">⇅</span>;
  return <span className="ml-1 text-accent">{dir === "desc" ? "↓" : "↑"}</span>;
}

function Th({
  children, field, sortField, sortDir, onSort,
}: {
  children: React.ReactNode;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  return (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted transition-colors hover:text-text"
      onClick={() => onSort(field)}
    >
      {children}
      <SortIcon field={field} active={sortField === field} dir={sortDir} />
    </th>
  );
}

export default function LeaderboardTable({ rows, sectors }: Props) {
  const router = useRouter();

  // Filters
  const [sector,    setSector]    = useState("");
  const [minPrice,  setMinPrice]  = useState("");
  const [minRS,     setMinRS]     = useState("");
  const [filterTT,  setFilterTT]  = useState(false);
  const [filterVCP, setFilterVCP] = useState(false);

  // Sort
  const [sortField, setSortField] = useState<SortField>("composite_score");
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }, [sortField]);

  const filtered = useMemo(() => {
    let r = [...rows];
    if (sector)    r = r.filter(x => x.sector === sector);
    if (minPrice)  r = r.filter(x => (x.last_price ?? 0) >= parseFloat(minPrice));
    if (minRS)     r = r.filter(x => (x.rs_rank ?? 0)    >= parseFloat(minRS));
    if (filterTT)  r = r.filter(x => x.trend_template_pass === true);
    if (filterVCP) r = r.filter(x => x.vcp_detected === true);

    r.sort((a, b) => {
      const av = ((a as unknown as Record<string, number | null>)[sortField]) ?? 0;
      const bv = ((b as unknown as Record<string, number | null>)[sortField]) ?? 0;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return r;
  }, [rows, sector, minPrice, minRS, filterTT, filterVCP, sortField, sortDir]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
        {/* Sector */}
        <select
          className="rounded border border-border bg-surface-2 px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
          value={sector}
          onChange={e => setSector(e.target.value)}
        >
          <option value="">All sectors</option>
          {sectors.map(s => <option key={s}>{s}</option>)}
        </select>

        {/* Min price */}
        <input
          type="number"
          placeholder="Min price"
          className="w-28 rounded border border-border bg-surface-2 px-2 py-1.5 text-sm text-text placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent"
          value={minPrice}
          onChange={e => setMinPrice(e.target.value)}
        />

        {/* Min RS */}
        <input
          type="number"
          placeholder="Min RS (1-99)"
          min={1} max={99}
          className="w-32 rounded border border-border bg-surface-2 px-2 py-1.5 text-sm text-text placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent"
          value={minRS}
          onChange={e => setMinRS(e.target.value)}
        />

        {/* Trend Template toggle */}
        <button
          onClick={() => setFilterTT(v => !v)}
          className={clsx(
            "rounded border px-3 py-1.5 text-xs font-medium transition-colors",
            filterTT
              ? "border-bull bg-bull/10 text-bull"
              : "border-border bg-surface-2 text-muted hover:text-text"
          )}
        >
          Trend Template
        </button>

        {/* VCP toggle */}
        <button
          onClick={() => setFilterVCP(v => !v)}
          className={clsx(
            "rounded border px-3 py-1.5 text-xs font-medium transition-colors",
            filterVCP
              ? "border-accent bg-accent/10 text-accent"
              : "border-border bg-surface-2 text-muted hover:text-text"
          )}
        >
          VCP Setup
        </button>

        <span className="ml-auto text-xs text-muted">{filtered.length} stocks</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted">#</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted">Ticker / Name</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted">Sector</th>
              <Th field="last_price"       sortField={sortField} sortDir={sortDir} onSort={toggleSort}>Price</Th>
              <Th field="pct_change_1d"    sortField={sortField} sortDir={sortDir} onSort={toggleSort}>1D %</Th>
              <Th field="composite_score"  sortField={sortField} sortDir={sortDir} onSort={toggleSort}>Score</Th>
              <Th field="rs_rank"          sortField={sortField} sortDir={sortDir} onSort={toggleSort}>RS Rank</Th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted">TT</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted">VCP</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted">Sparkline (30d)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-bg">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-16 text-center text-muted">
                  No stocks match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((row, i) => (
              <tr
                key={row.ticker}
                className="leaderboard-row"
                onClick={() => router.push(`/stock/${row.ticker}`)}
              >
                <td className="px-3 py-2.5 font-mono text-xs text-muted">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="font-mono font-semibold text-text">{row.ticker}</div>
                  <div className="max-w-[160px] truncate text-xs text-muted">{row.name ?? "—"}</div>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted">{row.sector ?? "—"}</td>
                <td className="px-3 py-2.5 font-mono text-sm">
                  ₹{fmt(row.last_price)}
                </td>
                <td className="px-3 py-2.5">
                  <PctBadge v={row.pct_change_1d} />
                </td>
                <td className="px-3 py-2.5 w-36">
                  <ScoreBar score={row.composite_score} size="sm" />
                </td>
                <td className="px-3 py-2.5 font-mono text-sm">
                  {row.rs_rank != null ? (
                    <span className={clsx(
                      "font-semibold",
                      row.rs_rank >= 80 ? "text-bull"
                      : row.rs_rank >= 60 ? "text-accent"
                      : "text-muted"
                    )}>
                      {row.rs_rank.toFixed(0)}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <BoolBadge v={row.trend_template_pass} trueLabel="Pass" falseLabel="Fail" />
                </td>
                <td className="px-3 py-2.5">
                  <BoolBadge v={row.vcp_detected} trueLabel="VCP" falseLabel="—" />
                </td>
                <td className="px-3 py-2.5">
                  <Sparkline data={row.sparkline ?? []} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
