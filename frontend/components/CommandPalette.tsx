"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import clsx from "clsx";
import type { LeaderboardRow } from "@/lib/types";
import { fetchLeaderboard } from "@/lib/api";
import { fmtINR } from "@/lib/format";

const MAX_RESULTS = 8;

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows]   = useState<LeaderboardRow[] | null>(null);
  const [hi, setHi]       = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);

  // Global ⌘K / Ctrl+K hotkey
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lazy-load the universe on first open; reset state each open
  useEffect(() => {
    if (!open) return;
    if (rows === null) {
      fetchLeaderboard({ limit: 500 }).then(setRows).catch(() => setRows([]));
    }
    setQuery("");
    setHi(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, rows]);

  const results = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows.slice(0, MAX_RESULTS);
    return rows
      .filter(r =>
        r.ticker.toLowerCase().includes(q) || (r.name ?? "").toLowerCase().includes(q)
      )
      .slice(0, MAX_RESULTS);
  }, [rows, query]);

  useEffect(() => { setHi(0); }, [query]);

  // Keep the highlighted row in view
  useEffect(() => {
    listRef.current?.children[hi]?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  const go = useCallback((ticker: string) => {
    setOpen(false);
    router.push(`/stock/${ticker}`);
  }, [router]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi(h => Math.min(results.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi(h => Math.max(0, h - 1));
    } else if (e.key === "Enter" && results[hi]) {
      go(results[hi].ticker);
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-text"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden md:block">Search stocks</span>
        <kbd className="hidden rounded border border-border bg-bg px-1.5 py-px font-mono text-[10px] md:block">
          ⌘K
        </kbd>
      </button>

      {/* Palette */}
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="pop-in mx-auto mt-[14vh] w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/60">
            {/* Input */}
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="h-4 w-4 flex-shrink-0 text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Jump to ticker or company…"
                className="h-12 w-full bg-transparent text-sm text-text placeholder-muted focus:outline-none"
              />
              <kbd className="flex-shrink-0 rounded border border-border bg-bg px-1.5 py-px font-mono text-[10px] text-muted">
                esc
              </kbd>
            </div>

            {/* Results */}
            <ul ref={listRef} className="max-h-80 overflow-auto py-1.5">
              {rows === null && (
                <li className="px-4 py-6 text-center text-sm text-muted">Loading…</li>
              )}
              {rows !== null && results.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted">
                  No matches for “{query}”
                </li>
              )}
              {results.map((r, i) => {
                const pct = r.pct_change_1d != null ? r.pct_change_1d * 100 : null;
                return (
                  <li
                    key={r.ticker}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => go(r.ticker)}
                    className={clsx(
                      "flex cursor-pointer items-center gap-3 px-4 py-2.5",
                      i === hi ? "bg-accent/10" : ""
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[13px] font-semibold text-text">
                        {r.ticker}
                      </div>
                      <div className="truncate text-xs text-muted">{r.name ?? "—"}</div>
                    </div>
                    {r.rs_rank != null && (
                      <span className="flex-shrink-0 text-xs tabular-nums text-muted">
                        RS {r.rs_rank.toFixed(0)}
                      </span>
                    )}
                    <span className="flex-shrink-0 text-sm tabular-nums text-text-dim">
                      ₹{fmtINR(r.last_price)}
                    </span>
                    {pct != null && (
                      <span className={clsx(
                        "w-16 flex-shrink-0 text-right text-xs font-semibold tabular-nums",
                        pct >= 0 ? "text-bull" : "text-bear"
                      )}>
                        {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                      </span>
                    )}
                    {i === hi && (
                      <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Footer hints */}
            <div className="flex items-center gap-3 border-t border-border bg-bg/40 px-4 py-2 text-[11px] text-muted">
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono">↵</kbd> open</span>
              <span><kbd className="font-mono">esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
