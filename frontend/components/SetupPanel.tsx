import { Check, X, Minus, CircleHelp } from "lucide-react";
import clsx from "clsx";
import type { StockDetail } from "@/lib/types";
import { fmtINR, fmtPct } from "@/lib/format";

interface Props { stock: StockDetail; }

function CheckIcon({ pass }: { pass: boolean | null }) {
  if (pass === null) return <CircleHelp className="h-3.5 w-3.5 text-muted" />;
  return pass
    ? <Check className="h-3.5 w-3.5 text-bull" strokeWidth={2.5} />
    : <X className="h-3.5 w-3.5 text-bear" strokeWidth={2.5} />;
}

function SignalBadge({ label }: { label: string }) {
  const colors: Record<string, string> = {
    "Breakout":      "border-bull/50 text-bull bg-bull/10",
    "Extended":      "border-warn/50 text-warn bg-warn/10",
    "Setup forming": "border-accent/50 text-accent bg-accent/10",
    "Watch":         "border-warn/50 text-warn bg-warn/10",
    "No setup":      "border-border text-muted bg-white/5",
  };
  return (
    <span className={clsx("rounded-md border px-2 py-0.5 text-xs font-semibold", colors[label] ?? colors["No setup"])}>
      {label}
    </span>
  );
}

export default function SetupPanel({ stock }: Props) {
  const tt  = stock.trend_template_criteria ?? {};
  const sig = stock.entry_signal;

  const pivotCleared =
    stock.vcp_pivot != null &&
    stock.last_price != null &&
    stock.last_price > stock.vcp_pivot;

  const pivotDistance =
    pivotCleared && stock.vcp_pivot
      ? stock.last_price! / stock.vcp_pivot - 1
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Entry signal */}
      {sig && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Signal</span>
            <SignalBadge label={sig.label} />
          </div>
          <p className="mb-1 text-sm text-text">{sig.reason}</p>
          <p className="text-xs text-text-dim">{sig.entry}</p>
          <p className="mt-2 text-xs text-warn/80">{sig.disclaimer}</p>
        </div>
      )}

      {/* Trend Template checklist */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Minervini Trend Template
        </h3>
        <ul className="space-y-2">
          {Object.entries(tt).map(([criterion, pass]) => (
            <li key={criterion} className="flex items-center gap-2.5 text-sm">
              <CheckIcon pass={pass as boolean | null} />
              <span className={pass === true ? "text-text" : "text-muted"}>
                {criterion}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-2.5 border-t border-border pt-3">
          <CheckIcon pass={stock.trend_template_pass} />
          <span className="text-sm font-medium">
            {stock.trend_template_pass ? "All criteria met" : "Some criteria not met"}
          </span>
        </div>
      </div>

      {/* VCP */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          Volatility Contraction Pattern (VCP)
        </h3>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted">Detected:</span>
            <CheckIcon pass={stock.vcp_detected ?? false} />
            <span>{stock.vcp_detected ? "Yes" : "No"}</span>
          </div>
          {stock.vcp_contractions != null && (
            <div>
              <span className="text-muted">Contractions: </span>
              <span className="font-mono font-semibold tabular-nums">{stock.vcp_contractions}</span>
            </div>
          )}
          {stock.vcp_pivot != null && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted">Pivot level: </span>
              <span className={clsx(
                "font-mono font-semibold tabular-nums",
                pivotCleared ? "text-text" : "text-bull"
              )}>
                ₹{fmtINR(stock.vcp_pivot)}
              </span>
              {pivotCleared ? (
                <span className="badge badge-warn">
                  Cleared — {fmtPct(pivotDistance, 0, false)} above entry
                </span>
              ) : (
                <span className="text-xs text-muted">
                  (potential entry above this level on volume)
                </span>
              )}
            </div>
          )}
        </div>
        {pivotCleared && (
          <p className="mt-2 text-xs text-warn/80">
            Price has already cleared the pivot — the stock is extended above the
            reference entry. Chasing extended moves carries higher risk.
          </p>
        )}
      </div>

      {/* Other setups */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SetupCard
          title="Pocket Pivot"
          active={stock.pocket_pivot ?? false}
          desc="Up-day volume exceeds highest down-day vol in prior 10 sessions."
        />
        <SetupCard
          title="Volume Surge"
          active={stock.volume_surge ?? false}
          desc="Today's volume ≥ 1.5× the 20-day average."
        />
        <SetupCard
          title="Mansfield Stage 2"
          active={stock.mansfield_stage2 ?? false}
          desc={`Advancing above rising 30-week MA. Mansfield RS: ${stock.mansfield_rs?.toFixed(2) ?? "—"}`}
        />
      </div>
    </div>
  );
}

function SetupCard({ title, active, desc }: { title: string; active: boolean; desc: string }) {
  return (
    <div className={clsx(
      "rounded-lg border p-3",
      active ? "border-bull/30 bg-bull/5" : "border-border bg-surface"
    )}>
      <div className="mb-1 flex items-center gap-1.5">
        {active
          ? <Check className="h-3.5 w-3.5 text-bull" strokeWidth={2.5} />
          : <Minus className="h-3.5 w-3.5 text-muted" />}
        <span className={clsx("text-sm font-medium", active ? "text-text" : "text-text-dim")}>
          {title}
        </span>
        {!active && (
          <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-muted">
            Not present
          </span>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted">{desc}</p>
    </div>
  );
}
