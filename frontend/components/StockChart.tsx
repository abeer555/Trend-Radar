"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { ChartData } from "@/lib/types";

interface Props {
  chartData: ChartData;
  ticker: string;
}

type Period = "3M" | "6M" | "1Y";
type SeriesKey = "ma50" | "ma150" | "ma200" | "bb";

const PERIOD_DAYS: Record<Period, number> = { "3M": 63, "6M": 126, "1Y": 252 };

function filterLast(arr: { time: string; value: number | null }[], n: number) {
  return arr.slice(-n);
}
function filterCandlesLast(arr: { time: string; open: number; high: number; low: number; close: number; volume: number }[], n: number) {
  return arr.slice(-n);
}

type ToggleSeries = ReturnType<ReturnType<typeof import("lightweight-charts")["createChart"]>["addLineSeries"]>;

export default function StockChart({ chartData, ticker }: Props) {
  const chartRef  = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<Partial<Record<SeriesKey, ToggleSeries[]>>>({});
  const [period, setPeriod] = useState<Period>("1Y");
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    ma50: true, ma150: true, ma200: true, bb: true,
  });

  const days = PERIOD_DAYS[period];

  const visibleRef = useRef(visible);
  useEffect(() => { visibleRef.current = visible; }, [visible]);

  function toggle(key: SeriesKey) {
    const next = !visibleRef.current[key];
    // Mutating chart series inside a setState updater is an anti-pattern —
    // updaters must be pure (React may invoke them twice under StrictMode).
    // Do the mutation here, then update state separately.
    for (const s of seriesRef.current[key] ?? []) {
      try { s.applyOptions({ visible: next }); } catch {}
    }
    setVisible(v => ({ ...v, [key]: next }));
  }

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
          layout: { background: { color: "#11141c" }, textColor: "#7e8899" },
          grid: {
            vertLines: { color: "#1a1f2b" },
            horzLines: { color: "#1a1f2b" },
          },
          crosshair:  { mode: CrosshairMode.Normal },
          rightPriceScale: { borderColor: "#232936" },
          timeScale: { borderColor: "#232936", timeVisible: true },
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

        const vis = visibleRef.current;
        const refs: Partial<Record<SeriesKey, ToggleSeries[]>> = {};

        // MA lines
        const maColors: Record<SeriesKey, string> = {
          ma50: "#f59e0b", ma150: "#3b82f6", ma200: "#8b5cf6", bb: "",
        };
        for (const key of ["ma50", "ma150", "ma200"] as SeriesKey[]) {
          const lineSeries = chart.addLineSeries({ color: maColors[key], lineWidth: 1, priceLineVisible: false, visible: vis[key] });
          const data = filterLast((chartData as unknown as Record<string, {time:string; value:number|null}[]>)[key] ?? [], days);
          lineSeries.setData(data.filter(p => p.value != null) as Parameters<typeof lineSeries.setData>[0]);
          refs[key] = [lineSeries];
        }

        // Bollinger Bands
        const bbUpper = chart.addLineSeries({ color: "#6366f180", lineWidth: 1, lineStyle: 2, priceLineVisible: false, visible: vis.bb });
        const bbLower = chart.addLineSeries({ color: "#6366f180", lineWidth: 1, lineStyle: 2, priceLineVisible: false, visible: vis.bb });
        bbUpper.setData(filterLast(chartData.bb_upper, days).filter(p => p.value != null) as Parameters<typeof bbUpper.setData>[0]);
        bbLower.setData(filterLast(chartData.bb_lower, days).filter(p => p.value != null) as Parameters<typeof bbLower.setData>[0]);
        refs.bb = [bbUpper, bbLower];

        seriesRef.current = refs;

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
      seriesRef.current = {};
      chart?.remove();
      chart = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, period]);

  return (
    <div className="flex flex-col gap-2">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-md border border-border bg-surface-2 p-0.5">
          {(["3M", "6M", "1Y"] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-[5px] px-3 py-1 text-xs font-medium transition-colors ${
                period === p
                  ? "bg-accent text-white"
                  : "text-muted hover:text-text"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted">
          {([
            { key: "ma50",  label: "MA50",   swatch: "bg-warn"        },
            { key: "ma150", label: "MA150",  swatch: "bg-accent"      },
            { key: "ma200", label: "MA200",  swatch: "bg-accent-2"    },
            { key: "bb",    label: "BBands", swatch: "bg-accent-2/50" },
          ] as { key: SeriesKey; label: string; swatch: string }[]).map(({ key, label, swatch }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              title={`Toggle ${label}`}
              className={clsx(
                "inline-flex items-center transition-opacity hover:opacity-100",
                visible[key] ? "opacity-100" : "opacity-40",
              )}
            >
              <span className={clsx("inline-block h-0.5 w-4 rounded align-middle", swatch)} /> {label}
            </button>
          ))}
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
