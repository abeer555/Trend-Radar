"use client";

import { useSyncExternalStore } from "react";

const KEY = "trendradar.watchlist.v1";

/** Read the watchlist from localStorage.  Safe on SSR (returns empty set). */
function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : []);
  } catch {
    return new Set();
  }
}

function write(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* private mode or quota — fail silently, watchlist is best-effort */
  }
  // Notify every useWatchlist hook via a storage-like event
  window.dispatchEvent(new Event("trendradar:watchlist"));
}

/** Tiny pub/sub for cross-component updates without Context. */
const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  if (typeof window !== "undefined") {
    window.addEventListener("trendradar:watchlist", fn);
  }
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") {
      window.removeEventListener("trendradar:watchlist", fn);
    }
  };
}

function getSnapshot(): Set<string> {
  return read();
}

const SERVER_SNAPSHOT = new Set<string>();
function getServerSnapshot(): Set<string> {
  return SERVER_SNAPSHOT;
}

/**
 * Cross-component watchlist state.
 *
 * Each call returns the live Set of tickers + toggle helpers.  Rerenders when
 * the underlying localStorage value changes from any component on the page.
 */
export function useWatchlist() {
  const set = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle(ticker: string) {
    const next = new Set(read());
    if (next.has(ticker)) next.delete(ticker);
    else next.add(ticker);
    write(next);
  }

  function has(ticker: string) {
    return set.has(ticker);
  }

  return { watchlist: set, toggle, has, size: set.size };
}

/** Server-safe: fetch the current watchlist (client-only; empty during SSR). */
export function getWatchlistTickers(): string[] {
  return [...read()];
}
