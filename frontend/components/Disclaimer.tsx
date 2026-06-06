import { AlertTriangle } from "lucide-react";

export default function Disclaimer() {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-warn/15 bg-warn/[0.04] px-3 py-2">
      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-warn/80" />
      <p className="text-xs leading-relaxed text-text-dim">
        <span className="font-medium text-warn/90">
          Educational tool — not investment advice.
        </span>{" "}
        Signals are rule-based and historical; past performance does not predict future
        results. Full disclaimer in the footer.
      </p>
    </div>
  );
}
