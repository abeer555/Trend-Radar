/** Indian-locale number formatting helpers. */

/** 9717.5 → "9,717.50" (Indian digit grouping) */
export function fmtINR(v: number | null, decimals = 2): string {
  if (v == null) return "—";
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** 9717.5 → "₹9,717.50" */
export function fmtPrice(v: number | null, decimals = 2): string {
  if (v == null) return "—";
  return `₹${fmtINR(v, decimals)}`;
}

/** Fraction → percent. 0.0123 → "+1.23%" */
export function fmtPct(v: number | null, decimals = 2, signed = true): string {
  if (v == null) return "—";
  const pct = v * 100;
  const sign = signed && pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(decimals)}%`;
}

/** Market cap in Indian convention: 3.023e11 → "₹30,230 Cr" */
export function fmtMarketCap(v: number | null): string {
  if (v == null) return "—";
  const cr = v / 1e7;
  if (cr >= 1e5) return `₹${(cr / 1e5).toFixed(2)} L Cr`;
  return `₹${cr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
}

export function fmtNum(v: number | null, decimals = 2): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}
