import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import type { PatternDetection } from "../lib/scanner/types";
import { TIMEFRAME_LABELS, STATUS_LABELS, TIMEFRAME_ORDER } from "../lib/scanner/types";
import { getConfidenceLabel, getStatusColor } from "../lib/scanner/detector";
import CandlestickChart from "../components/CandlestickChart";
import { generateDemoCandles, DEMO_INSTRUMENTS } from "../lib/scanner/demoData";
import { detectRoundingBottom } from "../lib/scanner/detector";
import { DEFAULT_SETTINGS } from "../lib/scanner/types";

function fmt(n: number | null | undefined, dec = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function PatternDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const detection = location.state?.detection as PatternDetection | undefined;

  if (!detection) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <AlertTriangle size={32} className="text-slate-700" />
          <p className="text-sm">No pattern data found. Please run a scan first.</p>
          <button onClick={() => navigate("/scanner")} className="px-4 py-2 rounded-lg bg-violet-700 text-white text-sm">Back to Scanner</button>
        </div>
      </div>
    );
  }

  const sb = detection.scoreBreakdown;
  const scoreItems: [string, number, number][] = [
    ["Prior Downtrend", sb.priorDowntrend, 15],
    ["Smoothness", sb.smoothness, 15],
    ["Base Duration", sb.baseDuration, 10],
    ["Symmetry", sb.symmetry, 10],
    ["Resistance Clarity", sb.resistanceClarity, 10],
    ["Breakout Quality", sb.breakoutQuality, 15],
    ["Volume Confirmation", sb.volumeConfirmation, 10],
    ["Momentum", sb.momentum, 10],
    ["Retest Quality", sb.retestQuality, 5],
    ["Data Quality", sb.dataQuality, 5],
    ["Timeframe Weight", sb.timeframeWeight, 25],
  ];

  // Build timeframe matrix by re-running detection on all timeframes
  const tfMatrix = TIMEFRAME_ORDER.map(tf => {
    const inst = DEMO_INSTRUMENTS.find(i => i.symbol === detection.symbol);
    if (!inst) return { timeframe: tf, status: "none" as const, trend: "sideways" as const, breakout: false, volume: null, rsi: null, score: 0 };
    const candles = generateDemoCandles(detection.symbol, tf);
    const det = detectRoundingBottom(candles, tf, detection.symbol, inst.name, inst.market, DEFAULT_SETTINGS);
    if (!det) return { timeframe: tf, status: "none" as const, trend: "sideways" as const, breakout: false, volume: null, rsi: null, score: 0 };
    return {
      timeframe: tf,
      status: det.status,
      trend: det.trend,
      breakout: det.breakoutPrice != null,
      volume: det.volumeRatio,
      rsi: det.rsi,
      score: det.confidence,
    };
  });

  const ind = detection.indicators;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Back button */}
      <button onClick={() => navigate("/scanner")} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-4">
        <ArrowLeft size={16} /> Back to Scanner
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{detection.symbol}</h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${getStatusColor(detection.status)}`}>{STATUS_LABELS[detection.status]}</span>
          </div>
          <p className="text-slate-400 text-sm mt-0.5">{detection.name} · {detection.market} · {TIMEFRAME_LABELS[detection.timeframe]}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <div className="w-20 h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${detection.confidence >= 65 ? "bg-emerald-500" : detection.confidence >= 50 ? "bg-amber-500" : "bg-slate-500"}`} style={{ width: `${detection.confidence}%` }} />
            </div>
            <span className="text-2xl font-bold text-white">{detection.confidence}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{getConfidenceLabel(detection.confidence)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-white mb-3">Candlestick Chart with Pattern Annotations</h2>
        <CandlestickChart detection={detection} height={420} />
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-amber-500"></span> Resistance / Neckline</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-2 bg-amber-500 opacity-20"></span> Resistance Zone</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-emerald-500"></span> Target</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-500"></span> Invalidation / Stop</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-amber-300"></span> Smoothed Curve</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-cyan-400"></span> Pattern Low</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pattern metrics */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Pattern Metrics</h2>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Pattern Start" value={fmtDate(detection.patternStartDate)} />
            <Metric label="Pattern Low" value={fmtDate(detection.patternLowDate)} />
            <Metric label="Pattern End" value={fmtDate(detection.patternEndDate)} />
            <Metric label="Duration" value={`${detection.patternDuration} candles`} />
            <Metric label="Left Resistance" value={`$${fmt(detection.leftResistance)}`} />
            <Metric label="Resistance Zone" value={`$${fmt(detection.resistanceZoneLow)} – $${fmt(detection.resistanceZoneHigh)}`} />
            <Metric label="Current Price" value={`$${fmt(detection.currentPrice)}`} />
            <Metric label="Breakout Price" value={detection.breakoutPrice ? `$${fmt(detection.breakoutPrice)}` : "—"} />
            <Metric label="Breakout %" value={`${detection.breakoutPercentage > 0 ? "+" : ""}${fmt(detection.breakoutPercentage)}%`} />
            <Metric label="Volume Ratio" value={`${fmt(detection.volumeRatio)}×`} />
            <Metric label="Potential Target" value={`$${fmt(detection.potentialTarget)}`} />
            <Metric label="Invalidation" value={`$${fmt(detection.invalidationLevel)}`} />
          </div>
        </div>

        {/* Indicators */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Technical Indicators</h2>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="SMA 20" value={ind.sma20 ? `$${fmt(ind.sma20)}` : "—"} />
            <Metric label="SMA 50" value={ind.sma50 ? `$${fmt(ind.sma50)}` : "—"} />
            <Metric label="SMA 200" value={ind.sma200 ? `$${fmt(ind.sma200)}` : "—"} />
            <Metric label="EMA 20" value={ind.ema20 ? `$${fmt(ind.ema20)}` : "—"} />
            <Metric label="EMA 50" value={ind.ema50 ? `$${fmt(ind.ema50)}` : "—"} />
            <Metric label="RSI 14" value={ind.rsi14 ? fmt(ind.rsi14) : "—"} />
            <Metric label="MACD" value={ind.macd ? fmt(ind.macd) : "—"} />
            <Metric label="MACD Signal" value={ind.macdSignal ? fmt(ind.macdSignal) : "—"} />
            <Metric label="MACD Hist" value={ind.macdHist ? fmt(ind.macdHist) : "—"} />
            <Metric label="ATR 14" value={ind.atr14 ? fmt(ind.atr14) : "—"} />
            <Metric label="Avg Volume 20" value={ind.avgVolume20 ? ind.avgVolume20.toLocaleString("en-US", { notation: "compact" }) : "—"} />
            <Metric label="ADX 14" value={ind.adx14 ? fmt(ind.adx14) : "—"} />
          </div>
        </div>

        {/* Score breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Confidence Score Breakdown</h2>
          <div className="space-y-2">
            {scoreItems.map(([label, val, max]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-36">{label}</span>
                <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${val / max > 0.6 ? "bg-emerald-500" : val / max > 0.3 ? "bg-amber-500" : "bg-slate-600"}`} style={{ width: `${(val / max) * 100}%` }} />
                </div>
                <span className="text-xs font-mono text-slate-300 w-16 text-right">{val.toFixed(1)} / {max}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Total Confidence</span>
            <span className="text-lg font-bold text-violet-400">{detection.confidence} / 100</span>
          </div>
        </div>

        {/* Timeframe matrix */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Multi-Timeframe Confirmation Matrix</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 text-slate-500 font-semibold uppercase">Timeframe</th>
                <th className="text-left py-2 text-slate-500 font-semibold uppercase">Status</th>
                <th className="text-left py-2 text-slate-500 font-semibold uppercase">Trend</th>
                <th className="text-center py-2 text-slate-500 font-semibold uppercase">Breakout</th>
                <th className="text-right py-2 text-slate-500 font-semibold uppercase">Vol</th>
                <th className="text-right py-2 text-slate-500 font-semibold uppercase">RSI</th>
                <th className="text-right py-2 text-slate-500 font-semibold uppercase">Score</th>
              </tr>
            </thead>
            <tbody>
              {tfMatrix.map(row => (
                <tr key={row.timeframe} className="border-b border-slate-800/40">
                  <td className="py-2 text-slate-300">{TIMEFRAME_LABELS[row.timeframe]}</td>
                  <td className="py-2">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${row.status === "none" ? "text-slate-400 bg-slate-800/40 border border-slate-700" : getStatusColor(row.status)}`}>
                      {row.status === "none" ? "—" : STATUS_LABELS[row.status]}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className={`flex items-center gap-0.5 ${row.trend === "uptrend" ? "text-emerald-400" : row.trend === "downtrend" ? "text-red-400" : "text-slate-400"}`}>
                      {row.trend === "uptrend" ? <TrendingUp size={11} /> : row.trend === "downtrend" ? <TrendingDown size={11} /> : <Minus size={11} />}
                      {row.trend}
                    </span>
                  </td>
                  <td className="py-2 text-center">{row.breakout ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">—</span>}</td>
                  <td className="py-2 text-right font-mono text-slate-400">{row.volume ? `${fmt(row.volume)}×` : "—"}</td>
                  <td className="py-2 text-right font-mono text-slate-400">{row.rsi ? fmt(row.rsi) : "—"}</td>
                  <td className="py-2 text-right font-mono text-white">{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mt-4">
        <h2 className="text-sm font-semibold text-white mb-2">Pattern Explanation</h2>
        <div className="text-sm text-slate-400 space-y-2">
          <p>
            <strong className="text-slate-300">{detection.symbol}</strong> shows a rounding-bottom (saucer) pattern on the <strong className="text-slate-300">{TIMEFRAME_LABELS[detection.timeframe]}</strong> timeframe.
            The pattern spans <strong className="text-slate-300">{detection.patternDuration} candles</strong> from {fmtDate(detection.patternStartDate)} to {fmtDate(detection.patternEndDate)},
            with the pattern low on {fmtDate(detection.patternLowDate)}.
          </p>
          <p>
            The prior decline was approximately <strong className="text-slate-300">{fmt(detection.scoreBreakdown.priorDowntrend / 15 * 100, 0)}% quality</strong>,
            and the U-shape smoothness score is <strong className="text-slate-300">{fmt(detection.scoreBreakdown.smoothness / 15 * 100, 0)}%</strong>.
            The left-side resistance is at <strong className="text-amber-400">${fmt(detection.leftResistance)}</strong>,
            and the current price is <strong className="text-slate-300">${fmt(detection.currentPrice)}</strong>.
          </p>
          <p>
            Pattern status: <strong className="text-slate-300">{STATUS_LABELS[detection.status]}</strong>.
            {detection.breakoutPrice && <> Breakout at <strong className="text-emerald-400">${fmt(detection.breakoutPrice)}</strong> ({detection.breakoutPercentage > 0 ? "+" : ""}{fmt(detection.breakoutPercentage)}% above resistance).</>}
            {" "}Potential target: <strong className="text-emerald-400">${fmt(detection.potentialTarget)}</strong>.
            {" "}Suggested invalidation: <strong className="text-red-400">${fmt(detection.invalidationLevel)}</strong>.
          </p>
          {detection.warnings.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 mt-2">
              <p className="text-xs font-semibold text-amber-400 mb-1">Data Warnings</p>
              {detection.warnings.map((w, i) => <p key={i} className="text-xs text-amber-300/70">{w}</p>)}
            </div>
          )}
          <p className="text-xs text-slate-600 italic mt-2">
            <AlertTriangle size={11} className="inline mr-1" />
            This is an analytical reference, not personalized financial advice. Targets and invalidation levels are estimates based on pattern geometry and ATR.
          </p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/40 rounded-lg px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-white font-medium font-mono">{value}</p>
    </div>
  );
}
