import { useMemo } from "react";
import type { PatternDetection } from "../lib/scanner/types";

interface Props {
  detection: PatternDetection;
  height?: number;
}

export default function CandlestickChart({ detection, height = 400 }: Props) {
  const width = 1000;
  const padding = { top: 20, right: 80, bottom: 60, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const { candles, smoothedCurve, patternStartIndex, patternLowIndex, patternEndIndex,
    leftResistance, resistanceZoneLow, resistanceZoneHigh, potentialTarget, invalidationLevel } = detection;

  const viewStart = Math.max(0, patternStartIndex - 20);
  const viewEnd = Math.min(candles.length, patternEndIndex + 40);
  const viewCandles = candles.slice(viewStart, viewEnd);
  const viewSmoothed = smoothedCurve.slice(viewStart, viewEnd);

  const { minPrice, maxPrice } = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const c of viewCandles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    max = Math.max(max, potentialTarget, resistanceZoneHigh);
    min = Math.min(min, invalidationLevel);
    const pad = (max - min) * 0.1;
    return { minPrice: min - pad, maxPrice: max + pad };
  }, [viewCandles, potentialTarget, resistanceZoneHigh, invalidationLevel]);

  const candleWidth = Math.max(2, Math.floor(chartW / viewCandles.length * 0.7));
  const spacing = chartW / viewCandles.length;

  const yScale = (price: number) => padding.top + chartH - ((price - minPrice) / (maxPrice - minPrice)) * chartH;
  const xScale = (i: number) => padding.left + i * spacing + spacing / 2;

  const maxVolume = Math.max(...viewCandles.map(c => c.volume));
  const volH = 50;

  const fmtPrice = (p: number) => p >= 1000 ? p.toFixed(0) : p.toFixed(2);

  // Build SVG path for smoothed curve
  const smoothPath = useMemo(() => {
    const pts: string[] = [];
    viewSmoothed.forEach((v, i) => {
      if (isNaN(v)) return;
      pts.push(`${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(v)}`);
    });
    return pts.join(" ");
  }, [viewSmoothed, minPrice, maxPrice]);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        {/* Background */}
        <rect x={0} y={0} width={width} height={height} fill="#0f172a" />

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = padding.top + chartH * f;
          const price = maxPrice - (maxPrice - minPrice) * f;
          return (
            <g key={f}>
              <line x1={padding.left} y1={y} x2={padding.left + chartW} y2={y} stroke="#1e293b" strokeWidth={0.5} />
              <text x={padding.left + chartW + 5} y={y + 4} fill="#64748b" fontSize={10}>
                {fmtPrice(price)}
              </text>
            </g>
          );
        })}

        {/* Resistance zone */}
        <rect
          x={padding.left}
          y={yScale(resistanceZoneHigh)}
          width={chartW}
          height={yScale(resistanceZoneLow) - yScale(resistanceZoneHigh)}
          fill="#f59e0b"
          opacity={0.08}
        />
        <line x1={padding.left} y1={yScale(leftResistance)} x2={padding.left + chartW} y2={yScale(leftResistance)} stroke="#f59e0b" strokeWidth={1} strokeDasharray="6 3" />
        <text x={padding.left + chartW + 5} y={yScale(leftResistance) + 4} fill="#f59e0b" fontSize={10} fontWeight="bold">R: {fmtPrice(leftResistance)}</text>

        {/* Target line */}
        <line x1={padding.left} y1={yScale(potentialTarget)} x2={padding.left + chartW} y2={yScale(potentialTarget)} stroke="#10b981" strokeWidth={1} strokeDasharray="4 4" />
        <text x={padding.left + chartW + 5} y={yScale(potentialTarget) + 4} fill="#10b981" fontSize={10} fontWeight="bold">T: {fmtPrice(potentialTarget)}</text>

        {/* Invalidation line */}
        <line x1={padding.left} y1={yScale(invalidationLevel)} x2={padding.left + chartW} y2={yScale(invalidationLevel)} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" />
        <text x={padding.left + chartW + 5} y={yScale(invalidationLevel) + 4} fill="#ef4444" fontSize={10} fontWeight="bold">SL: {fmtPrice(invalidationLevel)}</text>

        {/* Pattern region highlight */}
        <rect
          x={xScale(patternStartIndex - viewStart)}
          y={padding.top}
          width={xScale(patternEndIndex - viewStart) - xScale(patternStartIndex - viewStart)}
          height={chartH}
          fill="#3b82f6"
          opacity={0.05}
        />

        {/* Volume bars */}
        {viewCandles.map((c, i) => {
          const vh = (c.volume / maxVolume) * volH;
          const vy = padding.top + chartH - vh;
          return (
            <rect
              key={`vol-${i}`}
              x={xScale(i) - candleWidth / 2}
              y={vy}
              width={candleWidth}
              height={vh}
              fill={c.close >= c.open ? "#10b98133" : "#ef444433"}
            />
          );
        })}

        {/* Candles */}
        {viewCandles.map((c, i) => {
          const x = xScale(i);
          const isUp = c.close >= c.open;
          const color = isUp ? "#10b981" : "#ef4444";
          const bodyTop = yScale(Math.max(c.open, c.close));
          const bodyBot = yScale(Math.min(c.open, c.close));
          const bodyH = Math.max(1, bodyBot - bodyTop);
          const absIdx = i + viewStart;
          const isPatternLow = absIdx === patternLowIndex;
          const isPatternStart = absIdx === patternStartIndex;
          const isPatternEnd = absIdx === patternEndIndex;
          return (
            <g key={i}>
              <line x1={x} y1={yScale(c.high)} x2={x} y2={yScale(c.low)} stroke={color} strokeWidth={0.5} />
              <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyH} fill={color} rx={0.5} />
              {isPatternStart && (
                <g>
                  <line x1={x} y1={padding.top} x2={x} y2={padding.top + chartH} stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" />
                  <text x={x} y={padding.top - 4} fill="#3b82f6" fontSize={9} textAnchor="middle">Start</text>
                </g>
              )}
              {isPatternLow && (
                <g>
                  <circle cx={x} cy={yScale(c.low)} r={4} fill="#06b6d4" stroke="#0f172a" strokeWidth={1.5} />
                  <text x={x} y={yScale(c.low) + 16} fill="#06b6d4" fontSize={9} textAnchor="middle" fontWeight="bold">Low</text>
                </g>
              )}
              {isPatternEnd && (
                <g>
                  <line x1={x} y1={padding.top} x2={x} y2={padding.top + chartH} stroke="#8b5cf6" strokeWidth={1} strokeDasharray="3 3" />
                  <text x={x} y={padding.top - 4} fill="#8b5cf6" fontSize={9} textAnchor="middle">End</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Smoothed curve */}
        <path d={smoothPath} fill="none" stroke="#fbbf24" strokeWidth={1.5} opacity={0.8} />

        {/* X-axis dates */}
        {[0, Math.floor(viewCandles.length / 4), Math.floor(viewCandles.length / 2), Math.floor(viewCandles.length * 3 / 4), viewCandles.length - 1].map(i => {
          if (i >= viewCandles.length) return null;
          const d = new Date(viewCandles[i].timestamp);
          return (
            <text key={i} x={xScale(i)} y={height - 8} fill="#64748b" fontSize={9} textAnchor="middle">
              {d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
