"use client";

import { Star } from "lucide-react";
import clsx from "clsx";
import { useWatchlist } from "@/lib/watchlist";

interface Props {
  ticker:   string;
  size?:    "sm" | "md";
  /** Keeps the row-click handler from firing (don't navigate when starring). */
  stopPropagation?: boolean;
}

export default function WatchlistButton({ ticker, size = "sm", stopPropagation = true }: Props) {
  const { toggle, has } = useWatchlist();
  const isOn = has(ticker);

  const sizeCls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        toggle(ticker);
      }}
      aria-pressed={isOn}
      aria-label={isOn ? `Remove ${ticker} from watchlist` : `Add ${ticker} to watchlist`}
      title={isOn ? "Remove from watchlist" : "Add to watchlist"}
      className={clsx(
        "inline-flex items-center justify-center rounded p-1 transition-colors",
        "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        isOn ? "text-gold opacity-100" : "text-muted hover:text-text",
      )}
    >
      <Star className={clsx(sizeCls, isOn && "fill-gold")} />
    </button>
  );
}
