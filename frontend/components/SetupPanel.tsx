import clsx from "clsx";
import type { StockDetail } from "@/lib/types";

interface Props { stock: StockDetail; }

function Check({ pass }: { pass: boolean | null }) {
  if (pass === null) return <span className="text-muted">?</span>;
  return pass
    ? <span className="text-bull">✓</span>
    : <span className="text-bear">✗</span>;
}

function SignalBadge({ label }: { label: string }) {
  const colors: Record<string, string> = {
    "Breakout":      "border-bull text-bull bg-bull/10",
    "Setup forming": "border-accent text-accent bg-accent/10",
    "Watch":         "border-warn text-warn bg-warn/10",
    "No setup":      "border-border text-muted bg-white/5",
  };
  return (
    <span className={clsx("rounded border px-2 py-0.5 text-xs font-semibold", colors[label] ?? colors["No setup"])}>
      {label}
    </span>
  );
}

export default function SetupPanel({ stock }: Props) {
  const tt  = stock.trend_template_criteria ?? {};
  const sig = stock.entry_signal;

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
        <ul className="space-y-1.5">
          {Object.entries(tt).map(([criterion, pass]) => (
            <li key={criterion} className="flex items-center gap-2 text-sm">
              <Check pass={pass as boolean | null} />
              <span className={clsx(pass === true ? "text-text" : pass === false ? "text-muted" : "text-muted")}>
                {criterion}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
          <Check pass={stock.trend_template_pass} />
          <span className="text-sm font-medium">
            {stock.trend_template_pass ? "All criteria met" : "Some criteria not met"}
          </span>
        </div>
      </div>

      {/* VCP */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          Volatility Contraction Pattern (VCP)
        </h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-muted">Detected: </span>
            <Check pass={stock.vcp_detected ?? false} />
            <span className="ml-1">{stock.vcp_detected ? "Yes" : "No"}</span>
          </div>
          {stock.vcp_contractions != null && (
            <div>
              <span className="text-muted">Contractions: </span>
              <span className="font-mono font-semibold">{stock.vcp_contractions}</span>
            </div>
          )}
          {stock.vcp_pivot != null && (
            <div>
              <span className="text-muted">Pivot level: </span>
              <span className="font-mono font-semibold text-bull">₹{stock.vcp_pivot.toFixed(2)}</span>
              <span className="ml-1 text-xs text-muted">(potential entry above this level on volume)</span>
            </div>
          )}
        </div>
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
        <span className={active ? "text-bull" : "text-bear"}>{active ? "✓" : "✗"}</span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-xs text-muted">{desc}</p>
    </div>
  );
}
