import clsx from "clsx";

interface ScoreBarProps {
  score: number | null;  // 0-100
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
  label?: string;
  /**
   * Override the fill width (0-100). Lets callers normalise the bar across a
   * dataset (relative ranking) while the number still shows the raw score.
   */
  fillPct?: number;
}

function scoreColor(s: number): string {
  if (s >= 85) return "bg-gradient-to-r from-bull/60 to-bull";
  if (s >= 65) return "bg-gradient-to-r from-accent/60 to-accent";
  if (s >= 40) return "bg-gradient-to-r from-warn/60 to-warn";
  return "bg-gradient-to-r from-bear/60 to-bear";
}

export default function ScoreBar({ score, size = "md", showNumber = true, label, fillPct }: ScoreBarProps) {
  const s = score ?? 0;
  const width = Math.max(0, Math.min(100, fillPct ?? s));
  return (
    <div className="flex w-full flex-col gap-0.5">
      {label && <span className="text-xs text-muted">{label}</span>}
      <div className="flex items-center gap-2">
        {showNumber && (
          <span
            className={clsx(
              "font-semibold tabular-nums",
              size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm"
            )}
          >
            {s.toFixed(0)}
          </span>
        )}
        <div className="score-bar-track flex-1">
          <div
            className={clsx("score-bar-fill", scoreColor(s))}
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    </div>
  );
}
