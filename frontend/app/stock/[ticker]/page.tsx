import type { Metadata } from "next";
import StockClient from "./StockClient";

interface PageProps { params: { ticker: string } }

// The page body is rendered client-side so the offline fallbacks
// (browser cache → committed static snapshot) apply — stock pages keep
// working on Vercel even while the backend laptop is off.
export function generateMetadata({ params }: PageProps): Metadata {
  const ticker = decodeURIComponent(params.ticker).toUpperCase();
  return { title: `${ticker} — TrendRadar` };
}

export default function Page({ params }: PageProps) {
  const ticker = decodeURIComponent(params.ticker).toUpperCase();
  return <StockClient ticker={ticker} />;
}
