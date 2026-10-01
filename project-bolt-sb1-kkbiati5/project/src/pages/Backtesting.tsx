import { useState, useMemo } from "react";
import { Play, RefreshCw, BarChart3, TrendingUp, TrendingDown, Target, AlertTriangle } from "lucide-react";
import type { Timeframe, ScannerSettings } from "../lib/scanner/types";
import { TIMEFRAME_ORDER, TIMEFRAME_LABELS, DEFAULT_SETTINGS } from "../lib/scanner/types";
import { detectRoundingBottom } from "../lib/scanner/detector";
import { generateDemoCandles, DEMO_INSTRUMENTS } from "../lib/scanner/demoData";

function fmt(n: number, dec = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

interface BacktestSignal {
  symbol: string;
  timeframe: Timeframe;
  signalIndex: number;
  signalDate: string;
  status: string;
  confidence: number;
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
  outcome: "target_hit" | "stop_hit" | "still_open" | "timeout";
  maxFavorable: number;
  maxAdverse: number;
  barsToOutcome: number;
}

export default function Backtesting() {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(DEMO_INSTRUMENTS.slice(0, 5).map(i => i.symbol));
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("daily");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [minConfidence, setMinConfidence] = useState(50);
  const [running, setRunning] = useState(false);
  const [signals, setSignals] = useState<BacktestSignal[]>([]);
  const [hasRun, setHasRun] = useState(false);

  const runBacktest = async () => {
    setRunning(true);
    setSignals([]);
    await new Promise(r => setTimeout(r, 100));

    const results: BacktestSignal[] = [];

    for (const symbol of selectedSymbols) {
      const inst = DEMO_INSTRUMENTS.find(i => i.symbol === symbol);
      if (!inst) continue;

      const candles = generateDemoCandles(symbol, selectedTimeframe);
      const settings: ScannerSettings = { ...DEFAULT_SETTINGS, minConfidence: 0 };

      // Walk forward: detect patterns at various points in history
      for (let splitIdx = Math.floor(candles.length * 0.5); splitIdx < candles.length - 50; splitIdx += Math.floor(candles.length / 20)) {
        const slice = candles.slice(0, splitIdx + 1);
        // Mark last candle as complete for backtest purposes
        const closedSlice = slice.map((c, i) => ({ ...c, complete: i < splitIdx }));
        const detection = detectRoundingBottom(closedSlice, selectedTimeframe, symbol, inst.name, inst.market, settings);
        if (!detection || detection.status === "insufficient_data" || detection.confidence < minConfidence) continue;

        // Only look at breakout-confirmed or near-breakout signals
        if (detection.status !== "breakout_confirmed" && detection.status !== "near_breakout" && detection.status !== "breakout_retest") continue;

        const entryPrice = detection.currentPrice;
        const targetPrice = detection.potentialTarget;
        const stopPrice = detection.invalidationLevel;
        const signalIndex = splitIdx;

        // Forward-test: see if target or stop is hit first
        let maxFavorable = 0;
        let maxAdverse = 0;
        let outcome: "target_hit" | "stop_hit" | "still_open" | "timeout" = "timeout";
        let barsToOutcome = 0;

        for (let j = splitIdx + 1; j < candles.length; j++) {
          const c = candles[j];
          const favorable = ((c.high - entryPrice) / entryPrice) * 100;
          const adverse = ((entryPrice - c.low) / entryPrice) * 100;
          if (favorable > maxFavorable) maxFavorable = favorable;
          if (adverse > maxAdverse) maxAdverse = adverse;

          if (c.high >= targetPrice) {
            outcome = "target_hit";
            barsToOutcome = j - splitIdx;
            break;
          }
          if (c.low <= stopPrice) {
            outcome = "stop_hit";
            barsToOutcome = j - splitIdx;
            break;
          }
          if (j === candles.length - 1) {
            outcome = "still_open";
            barsToOutcome = j - splitIdx;
          }
        }

        results.push({
          symbol,
          timeframe: selectedTimeframe,
          signalIndex,
          signalDate: new Date(candles[signalIndex].timestamp).toISOString().split("T")[0],
          status: detection.status,
          confidence: detection.confidence,
          entryPrice,
          targetPrice,
          stopPrice,
          outcome,
          maxFavorable,
          maxAdverse,
          barsToOutcome,
        });

        // Skip ahead to avoid overlapping signals
        splitIdx += Math.floor(candles.length / 10);
      }
    }

    setSignals(results);
    setHasRun(true);
    setRunning(false);
  };

  const stats = useMemo(() => {
    if (signals.length === 0) return null;
    const targetHits = signals.filter(s => s.outcome === "target_hit").length;
    const stopHits = signals.filter(s => s.outcome === "stop_hit").length;
    const stillOpen = signals.filter(s => s.outcome === "still_open").length;
    const timeouts = signals.filter(s => s.outcome === "timeout").length;
    const breakoutSuccessRate = signals.length > 0 ? (targetHits / signals.length) * 100 : 0;
    const falseBreakoutRate = signals.length > 0 ? (stopHits / signals.length) * 100 : 0;
    const avgMaxFav = signals.reduce((s, r) => s + r.maxFavorable, 0) / signals.length;
    const avgMaxAdv = signals.reduce((s, r) => s + r.maxAdverse, 0) / signals.length;
    const avgBars = signals.filter(s => s.outcome !== "still_open" && s.outcome !== "timeout").reduce((s, r) => s + r.barsToOutcome, 0) / Math.max(1, signals.filter(s => s.outcome !== "still_open" && s.outcome !== "timeout").length);

    // By confidence range
    const ranges = [
      { label: "80-100", min: 80, max: 100 },
      { label: "65-79", min: 65, max: 79 },
      { label: "50-64", min: 50, max: 64 },
      { label: "35-49", min: 35, max: 49 },
    ];
    const byRange = ranges.map(r => {
      const subset = signals.filter(s => s.confidence >= r.min && s.confidence <= r.max);
      const hits = subset.filter(s => s.outcome === "target_hit").length;
      return { label: r.label, total: subset.length, hits, rate: subset.length > 0 ? (hits / subset.length) * 100 : 0 };
    });

    return { total: signals.length, targetHits, stopHits, stillOpen, timeouts, breakoutSuccessRate, falseBreakoutRate, avgMaxFav, avgMaxAdv, avgBars, byRange };
  }, [signals]);

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols(prev => prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-cyan-600 flex items-center justify-center">
            <BarChart3 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Backtesting</h1>
            <p className="text-slate-400 text-sm">Test rounding-bottom detection on historical closed candles</p>
          </div>
        </div>
      </div>

      {/* Config */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white mb-2">Symbols</h3>
          <div className="flex flex-wrap gap-2">
            {DEMO_INSTRUMENTS.map(inst => (
              <button
                key={inst.symbol}
                onClick={() => toggleSymbol(inst.symbol)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${selectedSymbols.includes(inst.symbol) ? "bg-cyan-700 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
              >
                {inst.symbol}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Timeframe</label>
            <select
              value={selectedTimeframe}
              onChange={e => setSelectedTimeframe(e.target.value as Timeframe)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              {TIMEFRAME_ORDER.map(tf => <option key={tf} value={tf}>{TIMEFRAME_LABELS[tf]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">From Date</label>
            <input type="date" value={dateRange.from} onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To Date</label>
            <input type="date" value={dateRange.to} onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Min Confidence</label>
            <input type="number" value={minConfidence} step={5} onChange={e => setMinConfidence(parseInt(e.target.value) || 0)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500" />
          </div>
        </div>

        <button
          onClick={runBacktest}
          disabled={running || selectedSymbols.length === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {running ? <><RefreshCw size={14} className="animate-spin" /> Running…</> : <><Play size={14} /> Run Backtest</>}
        </button>
      </div>

      {/* Results */}
      {running ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={32} className="animate-spin text-cyan-500" />
            <p className="text-slate-400 text-sm">Running backtest on {selectedSymbols.length} symbols…</p>
          </div>
        </div>
      ) : hasRun && signals.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
          <BarChart3 size={32} className="text-slate-700" />
          <p className="text-sm">No signals detected in the backtest period. Try lowering the minimum confidence.</p>
        </div>
      ) : stats ? (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
            <StatCard label="Total Signals" value={String(stats.total)} color="text-white" />
            <StatCard label="Breakout Success" value={`${fmt(stats.breakoutSuccessRate, 1)}%`} color="text-emerald-400" icon={<TrendingUp size={14} />} />
            <StatCard label="False Breakout" value={`${fmt(stats.falseBreakoutRate, 1)}%`} color="text-red-400" icon={<TrendingDown size={14} />} />
            <StatCard label="Avg Max Favorable" value={`${fmt(stats.avgMaxFav, 1)}%`} color="text-emerald-400" icon={<Target size={14} />} />
            <StatCard label="Avg Max Adverse" value={`${fmt(stats.avgMaxAdv, 1)}%`} color="text-red-400" />
            <StatCard label="Avg Bars to Outcome" value={fmt(stats.avgBars, 0)} color="text-slate-300" />
          </div>

          {/* By confidence range */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-white mb-3">Results by Confidence Score Range</h3>
            <div className="space-y-2">
              {stats.byRange.map(r => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-16">{r.label}</span>
                  <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-cyan-500" style={{ width: `${r.total > 0 ? (r.hits / r.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-mono text-slate-300 w-24 text-right">{r.hits}/{r.total} ({fmt(r.rate, 0)}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Signal table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <span className="text-sm font-semibold text-white">Detected Signals</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["Symbol", "Signal Date", "Status", "Confidence", "Entry", "Target", "Stop", "Outcome", "Max Fav", "Max Adv", "Bars"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {signals.map((s, i) => (
                    <tr key={i} className={`border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? "" : "bg-slate-800/10"}`}>
                      <td className="px-3 py-2.5 text-white font-medium">{s.symbol}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">{s.signalDate}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-300">{s.status}</td>
                      <td className="px-3 py-2.5 font-mono text-white">{s.confidence}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300 whitespace-nowrap">${fmt(s.entryPrice)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-400 whitespace-nowrap">${fmt(s.targetPrice)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-400 whitespace-nowrap">${fmt(s.stopPrice)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${s.outcome === "target_hit" ? "bg-emerald-900/50 text-emerald-400" : s.outcome === "stop_hit" ? "bg-red-900/50 text-red-400" : "bg-slate-800 text-slate-400"}`}>
                          {s.outcome.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-400 text-xs">+{fmt(s.maxFavorable, 1)}%</td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-400 text-xs">-{fmt(s.maxAdverse, 1)}%</td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-400">{s.barsToOutcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-600 italic flex items-center gap-1">
            <AlertTriangle size={11} /> Backtest uses walk-forward analysis on closed candles only. Results are in-sample and do not guarantee future performance.
          </div>
        </>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
          <BarChart3 size={32} className="text-slate-700" />
          <p className="text-sm">Configure parameters and click "Run Backtest" to test the scanner on historical data.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${color} flex items-center gap-1`}>{icon}{value}</p>
    </div>
  );
}
