"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Tracks whether the frontend is currently serving live API data or a
 * fallback (localStorage cache / static snapshot).  `lib/api.ts` flips this
 * every time a request is served from a fallback, and RefreshControl renders
 * the "Offline — cached data" badge from it.
 */

export type DataSource = "live" | "cache" | "snapshot";

export interface OfflineState {
  /** True once any request had to fall back (or a probe showed the backend down). */
  offline: boolean;
  /** Most recent source that successfully served data. */
  source: DataSource | null;
  /** ISO timestamp of the fallback data that was last served (null for live). */
  asOf: string | null;
}

const DEFAULT_STATE: OfflineState = { offline: false, source: null, asOf: null };

const OfflineContext = createContext<OfflineState>(DEFAULT_STATE);

// Non-React bridge so lib/api.ts (plain TS, no hooks) can push updates.
let _push: ((s: OfflineState) => void) | null = null;

export function reportDataSource(source: DataSource, asOf: string | null = null): void {
  _push?.({ offline: source !== "live", source, asOf });
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OfflineState>(DEFAULT_STATE);

  useEffect(() => {
    _push = setState;

    // Going back online doesn't clear `offline` by itself — that happens the
    // next time a request succeeds live — but a hard disconnect is worth
    // surfacing immediately.
    const onOffline = () =>
      setState((s) =>
        s.offline ? s : { offline: true, source: s.source, asOf: s.asOf },
      );
    window.addEventListener("offline", onOffline);

    return () => {
      _push = null;
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return <OfflineContext.Provider value={state}>{children}</OfflineContext.Provider>;
}

export function useOfflineStatus(): OfflineState {
  return useContext(OfflineContext);
}
