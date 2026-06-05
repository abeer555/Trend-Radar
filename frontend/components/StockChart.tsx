"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartData } from "@/lib/types";

interface Props {
  chartData: ChartData;
  ticker: string;
}

type Period = "3M" | "6M" | "1Y";

const PERIOD_DAYS: Record<Period, number> = { "3M": 63, "6M": 126, "1Y": 252 };

function filterLast(arr: { time: string; value: number | null }[], n: number) {
  return arr.slice(-n);
}
function filterCandlesLast(arr: { time: string; open: number; high: number; low: number; close: number; volume: number }[], n: number) {
  return arr.slice(-n);
}

export default function StockChart({ chartData, ticker }: Props) {
  const chartRef  = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<Period>("1Y");
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const days = PERIOD_DAYS[period];

  useEffect(() => {
    if (!chartRef.current || !chartData?.candles?.length) return;

    let chart: ReturnType<typeof import("lightweight-charts")["createChart"]> | null = null;
    let ro: ResizeObserver | null = null;
    let disposed = false;

    (async () => {
      try {
        const { createChart, CrosshairMode } = await import("lightweight-charts");

        if (disposed) return;
        const el = chartRef.current!;
        chart = createChart(el, {
          width:  el.clientWidth,
          height: 420,
          layout: { background: { color: "#161a23" }, textColor: "#94a3b8" },
          grid: {
            vertLines: { color: "#2a3040" },
            horzLines: { color: "#2a3040" },
          },
          crosshair:  { mode: CrosshairMode.Normal },
          rightPriceScale: { borderColor: "#2a3040" },
          timeScale: { borderColor: "#2a3040", timeVisible: true },
        });

        // Candlestick series
        const candleSeries = chart.addCandlestickSeries({
          upColor:        "#22c55e",
          downColor:      "#ef4444",
          borderUpColor:  "#22c55e",
          borderDownColor:"#ef4444",
          wickUpColor:    "#22c55e",
          wickDownColor:  "#ef4444",
        });
        candleSeries.setData(filterCandlesLast(chartData.candles, days) as Parameters<typeof candleSeries.setData>[0]);

        // MA lines
        const maColors: Record<string, string> = {
          ma50: "#f59e0b", ma150: "#3b82f6", ma200: "#8b5cf6",
        };
        for (const [key, color] of Object.entries(maColors)) {
          const lineSeries = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false });
          const data = filterLast((chartData as unknown as Record<string, {time:string; value:number|null}[]>)[key] ?? [], days);
          lineSeries.setData(data.filter(p => p.value != null) as Parameters<typeof lineSeries.setData>[0]);
        }

        // Bollinger Bands
        const bbUpper = chart.addLineSeries({ color: "#6366f180", lineWidth: 1, lineStyle: 2, priceLineVisible: false });
        const bbLower = chart.addLineSeries({ color: "#6366f180", lineWidth: 1, lineStyle: 2, priceLineVisible: false });
        bbUpper.setData(filterLast(chartData.bb_upper, days).filter(p => p.value != null) as Parameters<typeof bbUpper.setData>[0]);
        bbLower.setData(filterLast(chartData.bb_lower, days).filter(p => p.value != null) as Parameters<typeof bbLower.setData>[0]);

        // Volume histogram
        const volSeries = chart.addHistogramSeries({
          color: "#3b82f640",
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
        });
        chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
        volSeries.setData(
          filterCandlesLast(chartData.candles, days).map(c => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? "#22c55e30" : "#ef444430",
          })) as Parameters<typeof volSeries.setData>[0]
        );

        chart.timeScale().fitContent();
        setLoaded(true);

        ro = new ResizeObserver(() => {
          if (!disposed && chart) chart.applyOptions({ width: el.clientWidth });
        });
        ro.observe(el);
      } catch (e) {
        setError("Chart failed to load.");
        console.error(e);
      }
    })();

    return () => {
      disposed = true;
      ro?.disconnect();
      chart?.remove();
      chart = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, period]);

  return (
    <div className="flex flex-col gap-2">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {(["3M", "6M", "1Y"] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              period === p
                ? "bg-accent text-white"
                : "bg-surface-2 text-muted hover:text-text"
            }`}
          >
            {p}
          </button>
        ))}
        <div className="ml-4 flex items-center gap-3 text-xs text-muted">
          <span><span className="inline-block h-2 w-4 rounded bg-warn align-middle"/> MA50</span>
          <span><span className="inline-block h-2 w-4 rounded bg-accent align-middle"/> MA150</span>
          <span><span className="inline-block h-2 w-4 rounded bg-accent-2 align-middle"/> MA200</span>
          <span><span className="inline-block h-2 w-4 rounded bg-accent-2/50 align-middle"/> BBands</span>
        </div>
      </div>

      {error && <p className="text-sm text-bear">{error}</p>}
      <div
        ref={chartRef}
        className="h-[420px] w-full overflow-hidden rounded-lg border border-border bg-surface"
      />
    </div>
  );
}
