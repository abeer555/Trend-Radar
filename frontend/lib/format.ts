/**
 * Indian-locale number formatting helpers.
 *
 * Every formatter treats `NaN` and `±Infinity` identically to `null` —
 * rendering the em-dash placeholder `—` instead of leaking "NaN%" or
 * "Infinity" into the UI.
 */

function isFinitish(v: number | null | undefined): v is number {
  return v != null && typeof v === "number" && Number.isFinite(v);
}

/** 9717.5 → "9,717.50" (Indian digit grouping) */
export function fmtINR(v: number | null, decimals = 2): string {
  if (!isFinitish(v)) return "—";
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** 9717.5 → "₹9,717.50" — bare em-dash for missing values, not "₹—" */
export function fmtPrice(v: number | null, decimals = 2): string {
  if (!isFinitish(v)) return "—";
  return `₹${fmtINR(v, decimals)}`;
}

/** Fraction → percent. 0.0123 → "+1.23%" */
export function fmtPct(v: number | null, decimals = 2, signed = true): string {
  if (!isFinitish(v)) return "—";
  const pct = v * 100;
  const sign = signed && pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(decimals)}%`;
}

/** Number already in percent units (0-100) — used for ADX, RS rank display. */
export function fmtPctRaw(v: number | null, decimals = 0, signed = false): string {
  if (!isFinitish(v)) return "—";
  const sign = signed && v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}%`;
}

/** Market cap in Indian convention: 3.023e11 → "₹30,230 Cr" */
export function fmtMarketCap(v: number | null): string {
  if (!isFinitish(v)) return "—";
  const cr = v / 1e7;
  if (cr >= 1e5) return `₹${(cr / 1e5).toFixed(2)} L Cr`;
  return `₹${cr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
}

export function fmtNum(v: number | null, decimals = 2): string {
  if (!isFinitish(v)) return "—";
  return v.toFixed(decimals);
}

/** Grouped shorthand for large numbers: 1_234_000 → "₹12.34L" / "₹1.23Cr" */
export function fmtCompactINR(v: number | null): string {
  if (!isFinitish(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}
