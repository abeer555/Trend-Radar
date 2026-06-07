"use client";

import { useId } from "react";

interface SparklineProps {
  data:   number[];
  width?: number;
  height?: number;
}

export default function Sparkline({ data, width = 80, height = 28 }: SparklineProps) {
  const gradId = useId();

  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="rounded bg-white/5" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Leave 1px headroom so the stroke isn't clipped at extremes
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = 1 + (height - 2) - ((v - min) / range) * (height - 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const isUp = data[data.length - 1] >= data[0];
  const color = isUp ? "#22c55e" : "#ef4444";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${pts.join(" ")} ${width},${height}`}
        fill={`url(#${gradId})`}
      />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
