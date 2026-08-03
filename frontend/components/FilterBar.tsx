"use client";

import { useEffect, useRef } from "react";
import { Search, X, Check, TrendingUp, Sparkles, Gauge, Volume2, Layers } from "lucide-react";
import clsx from "clsx";
import Select from "./ui/Select";

export interface Filters {
  query:    string;
  sector:   string;
  minRS:    string;  // "" | "50" | "70" | "80" | "90"
  minPrice: string;  // "" | "50" | "100" | "500" | "1000"
  tt:       boolean;
  vcp:      boolean;
  volumeSurge:    boolean;
  minProximity: string; // "" | "0.85"  (fraction of 52-wk range)
}

export const EMPTY_FILTERS: Filters = {
  query: "", sector: "", minRS: "", minPrice: "", tt: false, vcp: false,
  volumeSurge: false, minProximity: "",
};

/** Screener presets — pre-filled filter combos shareable via the URL. */
export const PRESETS: Array<{ key: string; label: string; icon: React.ReactNode; apply: Partial<Filters> }> = [
  {
    key:   "all",
    label: "All stocks",
    icon:  <Layers className="h-3.5 w-3.5" />,
    apply: EMPTY_FILTERS,
  },
  {
    key:   "breakouts",
    label: "Breakouts",
    icon:  <TrendingUp className="h-3.5 w-3.5" />,
    apply: { ...EMPTY_FILTERS, tt: true, minRS: "80" },
  },
  {
    key:   "vcp",
    label: "VCP setups",
    icon:  <Sparkles className="h-3.5 w-3.5" />,
    apply: { ...EMPTY_FILTERS, vcp: true },
  },
  {
    key:   "near-52w-high",
    label: "Near 52w High",
    icon:  <Gauge className="h-3.5 w-3.5" />,
    apply: { ...EMPTY_FILTERS, minProximity: "0.85" },
  },
  {
    key:   "volume-surges",
    label: "Volume surges",
    icon:  <Volume2 className="h-3.5 w-3.5" />,
    apply: { ...EMPTY_FILTERS, volumeSurge: true },
  },
  {
    key:   "highest-rs",
    label: "Highest RS",
    icon:  <TrendingUp className="h-3.5 w-3.5" />,
    apply: { ...EMPTY_FILTERS, minRS: "90" },
  },
];

const RS_OPTS = ["50", "70", "80", "90"].map(v => ({
  value: v, label: `RS ≥ ${v}`,
}));

const PRICE_OPTS = ["50", "100", "500", "1000"].map(v => ({
  value: v, label: `Price ≥ ₹${Number(v).toLocaleString("en-IN")}`,
}));

interface Props {
  filters:  Filters;
  onChange: (f: Filters) => void;
  sectors:  string[];
  shown:    number;
  total:    number;
  /** How many rows would match each toggle, given the other active filters. */
  ttCount:  number;
  vcpCount: number;
}

function TogglePill({
  active, onClick, count, children,
}: {
  active: boolean; onClick: () => void; count: number; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
        active
          ? "border-accent/50 bg-accent/10 text-accent"
          : "border-border bg-surface-2 text-text-dim hover:border-border-strong hover:text-text"
      )}
    >
      <span
        className={clsx(
          "flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition-colors",
          active ? "border-accent bg-accent text-bg" : "border-muted/40"
        )}
      >
        {active && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
      </span>
      {children}
      {count >= 0 && (
        <span className={clsx("text-xs tabular-nums", active ? "text-accent/70" : "text-muted")}>
          {count}
        </span>
      )}
    </button>
  );
}

function Chip({ onClear, children }: { onClear: () => void; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-accent">
      {children}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 transition-colors hover:bg-accent/20"
        aria-label="Remove filter"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function FilterBar({
  filters, onChange, sectors, shown, total, ttCount, vcpCount,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  // "/" focuses search, terminal-style
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hasChips =
    !!filters.sector || !!filters.minRS || !!filters.minPrice || filters.tt || filters.vcp
    || filters.volumeSurge || !!filters.minProximity;
  const hasAny = hasChips || !!filters.query;

  /** Which preset (if any) exactly matches the current filters. */
  const activePreset = PRESETS.find(p => {
    const merged = { ...EMPTY_FILTERS, ...p.apply };
    return (
      merged.query       === filters.query &&
      merged.sector      === filters.sector &&
      merged.minRS       === filters.minRS &&
      merged.minPrice    === filters.minPrice &&
      merged.tt          === filters.tt &&
      merged.vcp         === filters.vcp &&
      merged.volumeSurge === filters.volumeSurge &&
      merged.minProximity === filters.minProximity
    );
  })?.key ?? null;

  return (
    <div className="flex flex-col gap-3">
      {/* Preset chips — shareable filter combos */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map(p => {
          const isActive = p.key === activePreset;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange({ ...filters, ...p.apply })}
              className={clsx(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                isActive
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : "border-border bg-surface-2 text-text-dim hover:border-border-strong hover:text-text",
              )}
            >
              {p.icon}
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            type="text"
            value={filters.query}
            onChange={e => set({ query: e.target.value })}
            placeholder="Search ticker or name"
            className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-9 text-sm text-text placeholder-muted transition-colors hover:border-border-strong focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
          {filters.query ? (
            <button
              type="button"
              onClick={() => { set({ query: "" }); searchRef.current?.focus(); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted transition-colors hover:text-text"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-bg px-1.5 py-px font-mono text-[10px] text-muted sm:block">
              /
            </kbd>
          )}
        </div>

        <Select
          value={filters.sector}
          onChange={v => set({ sector: v })}
          options={[{ value: "", label: "All sectors" }, ...sectors.map(s => ({ value: s, label: s }))]}
          label="All sectors"
          className="w-44"
        />
        <Select
          value={filters.minRS}
          onChange={v => set({ minRS: v })}
          options={[{ value: "", label: "Any RS" }, ...RS_OPTS]}
          label="RS Rank"
          className="w-28"
        />
        <Select
          value={filters.minPrice}
          onChange={v => set({ minPrice: v })}
          options={[{ value: "", label: "Any price" }, ...PRICE_OPTS]}
          label="Price"
          className="w-36"
        />

        <span className="hidden h-5 w-px bg-border md:block" />

        <TogglePill active={filters.tt} onClick={() => set({ tt: !filters.tt })} count={ttCount}>
          Trend Template
        </TogglePill>
        <TogglePill active={filters.vcp} onClick={() => set({ vcp: !filters.vcp })} count={vcpCount}>
          VCP Setup
        </TogglePill>
        <TogglePill active={filters.volumeSurge} onClick={() => set({ volumeSurge: !filters.volumeSurge })} count={-1}>
          Volume surge
        </TogglePill>

        <Select
          value={filters.minProximity}
          onChange={v => set({ minProximity: v })}
          options={[{ value: "", label: "Any range %"}, { value: "0.85", label: "≥ 85th percentile of 52w range" }, { value: "0.95", label: "≥ 95th percentile" }]}
          label="52w proximity"
          className="w-56"
        />

        <span className="ml-auto text-xs text-muted">
          <span className="font-medium tabular-nums text-text-dim">{shown}</span>
          {" of "}
          <span className="tabular-nums">{total}</span> stocks
        </span>
      </div>

      {/* Active filter chips */}
      {hasChips && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2.5">
          {filters.sector   && <Chip onClear={() => set({ sector: "" })}>{filters.sector}</Chip>}
          {filters.minRS    && <Chip onClear={() => set({ minRS: "" })}>RS ≥ {filters.minRS}</Chip>}
          {filters.minPrice && (
            <Chip onClear={() => set({ minPrice: "" })}>
              ₹{Number(filters.minPrice).toLocaleString("en-IN")}+
            </Chip>
          )}
          {filters.minProximity && (
            <Chip onClear={() => set({ minProximity: "" })}>
              ≥ {(Number(filters.minProximity) * 100).toFixed(0)}% of 52w range
            </Chip>
          )}
          {filters.tt  && <Chip onClear={() => set({ tt: false })}>Trend Template</Chip>}
          {filters.vcp && <Chip onClear={() => set({ vcp: false })}>VCP Setup</Chip>}
          {filters.volumeSurge && <Chip onClear={() => set({ volumeSurge: false })}>Volume surge</Chip>}
          {hasAny && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              className="ml-1 text-xs font-medium text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
