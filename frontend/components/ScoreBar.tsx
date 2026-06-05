import clsx from "clsx";

interface ScoreBarProps {
  score: number | null;  // 0-100
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
  label?: string;
}

function scoreColor(s: number): string {
  if (s >= 75) return "bg-bull";
  if (s >= 50) return "bg-accent";
  if (s >= 25) return "bg-warn";
  return "bg-bear";
}

export default function ScoreBar({ score, size = "md", showNumber = true, label }: ScoreBarProps) {
  const s = score ?? 0;
  return (
    <div className="flex w-full flex-col gap-0.5">
      {label && <span className="text-xs text-muted">{label}</span>}
      <div className="flex items-center gap-2">
        {showNumber && (
          <span
            className={clsx(
              "font-mono font-semibold",
              size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm"
            )}
          >
            {s.toFixed(0)}
          </span>
        )}
        <div className="score-bar-track flex-1">
          <div
            className={clsx("score-bar-fill", scoreColor(s))}
            style={{ width: `${s}%` }}
          />
        </div>
      </div>
    </div>
  );
}
