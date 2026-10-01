import { useState, useMemo, useCallback, Fragment, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Radar, Play, Settings as SettingsIcon, ChevronDown, ChevronRight,
  BarChart3, Clock, Activity, Bell, Zap, Calendar,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Plus,
} from "lucide-react";
import type { PatternDetection, ScannerSettings, Timeframe } from "../lib/scanner/types";
import { TIMEFRAME_ORDER, TIMEFRAME_LABELS, DEFAULT_SETTINGS, STATUS_LABELS } from "../lib/scanner/types";
import { detectRoundingBottom, getConfidenceLabel, getStatusColor } from "../lib/scanner/detector";
import { generateDemoCandles, DEMO_INSTRUMENTS, isDemoMode } from "../lib/scanner/demoData";
import { supabase } from "../lib/supabase";
import { addToTradeList } from "../lib/tradeList";

function fmt(n: number | null | undefined, dec = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface PublishedDetection {
  id: string;
  symbol: string;
  name: string;
  market: string;
  timeframe: string;
  status: string;
  confidence: number;
  current_price: number;
  left_resistance: number;
  breakout_percentage: number;
  volume_ratio: number;
  rsi: number;
  trend: string;
  higher_tf_confirmed: boolean;
  pattern_duration: number;
  potential_target: number;
  invalidation_level: number;
  signal_timestamp: string;
  created_at: string;
}

interface ScanJob {
  id: string;
  status: string;
  symbols_scanned: number;
  patterns_found: number;
  triggered_by: string;
  message: string | null;
  completed_at: string | null;
  created_at: string;
}

export default function Scanner() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ScannerSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<PatternDetection[]>([]);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(DEMO_INSTRUMENTS.map(i => i.symbol));
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [publishedResults, setPublishedResults] = useState<PublishedDetection[]>([]);
  const [lastScanJob, setLastScanJob] = useState<ScanJob | null>(null);
  const [triggeringAutoScan, setTriggeringAutoScan] = useState(false);
  const [autoScanDate, setAutoScanDate] = useState<string | null>(null);
  const [tradeToast, setTradeToast] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    setScanning(true);
    setResults([]);
    await new Promise(r => setTimeout(r, 100));

    const detections: PatternDetection[] = [];
    const timeframesToScan = settings.scanOrder.filter(tf => settings.enabledTimeframes.includes(tf));

    for (const symbol of selectedSymbols) {
      const instrument = DEMO_INSTRUMENTS.find(i => i.symbol === symbol);
      if (!instrument) continue;

      for (const tf of timeframesToScan) {
        const candles = generateDemoCandles(symbol, tf);
        const detection = detectRoundingBottom(candles, tf, symbol, instrument.name, instrument.market, settings);
        if (detection) detections.push(detection);
      }
    }

    // Merge overlapping detections for same symbol, keep highest confidence
    const bySymbol: Record<string, PatternDetection> = {};
    for (const d of detections) {
      if (d.status === "insufficient_data") continue;
      if (!bySymbol[d.symbol] || d.confidence > bySymbol[d.symbol].confidence) {
        bySymbol[d.symbol] = d;
      }
    }

    const merged = Object.values(bySymbol).sort((a, b) => b.confidence - a.confidence);
    setResults(merged);
    setLastScanTime(new Date().toISOString());
    setScanning(false);
  }, [settings, selectedSymbols]);

  const demoMode = isDemoMode();

  // Load published results from the latest auto-scan
  const loadPublishedResults = useCallback(async () => {
    try {
      // Get the latest successful scan job
      const { data: latestJob } = await supabase
        .from("scanner_scan_jobs")
        .select("*")
        .eq("status", "success")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestJob) {
        setLastScanJob(latestJob as unknown as ScanJob);
        setAutoScanDate(latestJob.created_at);

        // Get detections from that scan job
        const { data: detections } = await supabase
          .from("scanner_pattern_detections")
          .select("*")
          .eq("scan_job_id", latestJob.id)
          .order("confidence", { ascending: false })
          .limit(50);

        if (detections && detections.length > 0) {
          setPublishedResults(detections as unknown as PublishedDetection[]);
        }
      }

      // Also check last auto scan date from settings
      const { data: lastScanSetting } = await supabase
        .from("scanner_settings")
        .select("*")
        .eq("key", "last_auto_scan_date")
        .maybeSingle();
      if (lastScanSetting?.value) {
        setAutoScanDate(lastScanSetting.value);
      }
    } catch (e) {
      console.log("Failed to load published results:", e);
    }
  }, []);

  useEffect(() => {
    loadPublishedResults();
  }, [loadPublishedResults]);

  const triggerAutoScan = useCallback(async () => {
    setTriggeringAutoScan(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-scanner-scan`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ triggered_by: "manual" }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.success) {
        await loadPublishedResults();
      } else {
        console.error("Auto-scan failed:", data.error);
      }
    } catch (e) {
      console.error("Failed to trigger auto-scan:", e);
    } finally {
      setTriggeringAutoScan(false);
    }
  }, [loadPublishedResults]);

  async function handleAddToTrade(symbol: string, price: number | null, stop: number | null, target: number | null) {
    if (price == null) return;
    const direction: "LONG" | "SHORT" = "LONG";
    const result = await addToTradeList(symbol, direction, "scanner", price, stop, target);
    setTradeToast(result.success ? `Added ${symbol} to Trade Today` : (result.error ?? "Failed to add"));
    setTimeout(() => setTradeToast(null), 2500);
  }

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols(prev => prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]);
  };

  const toggleTimeframe = (tf: Timeframe) => {
    setSettings(prev => ({
      ...prev,
      enabledTimeframes: prev.enabledTimeframes.includes(tf)
        ? prev.enabledTimeframes.filter(t => t !== tf)
        : [...prev.enabledTimeframes, tf],
    }));
  };

  const moveTimeframe = (tf: Timeframe, dir: -1 | 1) => {
    setSettings(prev => {
      const order = [...prev.scanOrder];
      const idx = order.indexOf(tf);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= order.length) return prev;
      [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
      return { ...prev, scanOrder: order };
    });
  };

  const filteredResults = useMemo(() => results.filter(r => r.confidence >= settings.minConfidence), [results, settings.minConfidence]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center">
              <Radar size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Rounding Bottom Scanner</h1>
              <p className="text-slate-400 text-sm">Multi-timeframe saucer-bottom pattern detection</p>
            </div>
          </div>
          {demoMode && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-900/40 border border-amber-700 text-amber-300 text-xs font-medium">
              <Activity size={12} /> Demo Mode — using sample OHLCV data
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {lastScanTime && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock size={12} /> Last scan: {new Date(lastScanTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${showSettings ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            <SettingsIcon size={14} /> Settings
          </button>
          <button
            onClick={runScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {scanning ? <><RefreshCw size={14} className="animate-spin" /> Scanning…</> : <><Play size={14} /> Scan Now</>}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4 space-y-5">
          {/* Timeframes */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Timeframes & Scan Order</h3>
            <p className="text-xs text-slate-500 mb-3">Enable timeframes and reorder by priority. Higher timeframes carry more weight.</p>
            <div className="flex flex-wrap gap-2">
              {settings.scanOrder.map((tf, idx) => (
                <div key={tf} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border ${settings.enabledTimeframes.includes(tf) ? "bg-violet-900/40 border-violet-700" : "bg-slate-800 border-slate-700"}`}>
                  <button onClick={() => toggleTimeframe(tf)} className="text-xs font-medium">
                    <span className={settings.enabledTimeframes.includes(tf) ? "text-white" : "text-slate-500"}>{TIMEFRAME_LABELS[tf]}</span>
                  </button>
                  {settings.enabledTimeframes.includes(tf) && (
                    <div className="flex flex-col ml-1">
                      <button onClick={() => moveTimeframe(tf, -1)} disabled={idx === 0} className="text-slate-500 hover:text-white disabled:opacity-30 leading-none">▲</button>
                      <button onClick={() => moveTimeframe(tf, 1)} disabled={idx === settings.scanOrder.length - 1} className="text-slate-500 hover:text-white disabled:opacity-30 leading-none">▼</button>
                    </div>
                  )}
                  {settings.primaryTimeframe === tf && <span className="text-[10px] text-violet-400 font-bold ml-1">PRIMARY</span>}
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <label className="text-xs text-slate-400">Primary timeframe:</label>
              <select
                value={settings.primaryTimeframe}
                onChange={e => setSettings(s => ({ ...s, primaryTimeframe: e.target.value as Timeframe }))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-500"
              >
                {TIMEFRAME_ORDER.map(tf => <option key={tf} value={tf}>{TIMEFRAME_LABELS[tf]}</option>)}
              </select>
            </div>
          </div>

          {/* Instrument Universe */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Instrument Universe</h3>
            <div className="flex flex-wrap gap-2">
              {DEMO_INSTRUMENTS.map(inst => (
                <button
                  key={inst.symbol}
                  onClick={() => toggleSymbol(inst.symbol)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${selectedSymbols.includes(inst.symbol) ? "bg-emerald-700 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
                >
                  {inst.symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Numeric settings */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SettingField label="Min Confidence" value={settings.minConfidence} onChange={v => setSettings(s => ({ ...s, minConfidence: v }))} step={5} />
            <SettingField label="Min Pattern Duration" value={settings.minPatternDuration} onChange={v => setSettings(s => ({ ...s, minPatternDuration: v }))} step={5} />
            <SettingField label="Max Pattern Duration" value={settings.maxPatternDuration} onChange={v => setSettings(s => ({ ...s, maxPatternDuration: v }))} step={10} />
            <SettingField label="Min Avg Volume" value={settings.minAvgVolume} onChange={v => setSettings(s => ({ ...s, minAvgVolume: v }))} step={50000} />
            <SettingField label="Min Breakout Vol ×" value={settings.minBreakoutVolumeMultiplier} onChange={v => setSettings(s => ({ ...s, minBreakoutVolumeMultiplier: v }))} step={0.1} />
            <SettingField label="Min Breakout %" value={settings.minBreakoutPct} onChange={v => setSettings(s => ({ ...s, minBreakoutPct: v }))} step={0.5} />
            <SettingField label="Min Prior Decline %" value={settings.minPriorDeclinePct} onChange={v => setSettings(s => ({ ...s, minPriorDeclinePct: v }))} step={5} />
            <SettingField label="Near Breakout Dist %" value={settings.nearBreakoutDistance} onChange={v => setSettings(s => ({ ...s, nearBreakoutDistance: v }))} step={0.5} />
            <SettingField label="Breakout Buffer %" value={settings.breakoutBuffer} onChange={v => setSettings(s => ({ ...s, breakoutBuffer: v }))} step={0.5} />
            <SettingField label="Max Shape Error" value={settings.maxShapeError} onChange={v => setSettings(s => ({ ...s, maxShapeError: v }))} step={0.01} />
            <SettingField label="Resistance Zone Width %" value={settings.resistanceZoneWidth} onChange={v => setSettings(s => ({ ...s, resistanceZoneWidth: v }))} step={0.5} />
            <SettingField label="Min Prior Downtrend Len" value={settings.minPriorDowntrendLength} onChange={v => setSettings(s => ({ ...s, minPriorDowntrendLength: v }))} step={5} />
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-4">
            <Toggle label="Volume mandatory" checked={settings.volumeMandatory} onChange={v => setSettings(s => ({ ...s, volumeMandatory: v }))} />
            <Toggle label="Higher TF mandatory" checked={settings.higherTFMandatory} onChange={v => setSettings(s => ({ ...s, higherTFMandatory: v }))} />
            <Toggle label="Include forming" checked={settings.includeForming} onChange={v => setSettings(s => ({ ...s, includeForming: v }))} />
            <Toggle label="Only confirmed breakouts" checked={settings.onlyConfirmed} onChange={v => setSettings(s => ({ ...s, onlyConfirmed: v }))} />
            <Toggle label="Require lower TF confirmation" checked={settings.requireLowerTFConfirmation} onChange={v => setSettings(s => ({ ...s, requireLowerTFConfirmation: v }))} />
            <Toggle label="Auto-scan" checked={settings.autoScan} onChange={v => setSettings(s => ({ ...s, autoScan: v }))} />
          </div>
        </div>
      )}

      {/* Results Table */}
      {scanning ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={32} className="animate-spin text-violet-500" />
            <p className="text-slate-400 text-sm">Scanning {selectedSymbols.length} instruments across {settings.enabledTimeframes.length} timeframes…</p>
          </div>
        </div>
      ) : results.length === 0 && lastScanTime ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
          <Radar size={32} className="text-slate-700" />
          <p className="text-sm">No patterns detected matching current criteria.</p>
          <p className="text-xs text-slate-600">Try lowering the minimum confidence score or adjusting filters.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
          <Radar size={32} className="text-slate-700" />
          <p className="text-sm">No scan run yet. Click "Scan Now" to detect rounding-bottom patterns.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{filteredResults.length} patterns detected</span>
            <span className="text-xs text-slate-500">Sorted by confidence</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Symbol", "TF", "Status", "Confidence", "Price", "Resistance", "Breakout %", "Vol Ratio", "RSI", "Trend", "HTF", "Duration", "Target", "Stop", "Signal Time"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r, i) => {
                  const isOpen = expandedRow === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => setExpandedRow(isOpen ? null : r.id)}
                        className={`border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors cursor-pointer ${i % 2 === 0 ? "" : "bg-slate-800/10"}`}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            {isOpen ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
                            <div>
                              <p className="text-white font-medium">{r.symbol}</p>
                              <p className="text-slate-500 text-xs truncate max-w-[120px]">{r.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-300">{TIMEFRAME_LABELS[r.timeframe]}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded border ${getStatusColor(r.status)}`}>{STATUS_LABELS[r.status]}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${r.confidence >= 65 ? "bg-emerald-500" : r.confidence >= 50 ? "bg-amber-500" : "bg-slate-500"}`} style={{ width: `${r.confidence}%` }} />
                            </div>
                            <span className="font-mono text-xs text-white">{r.confidence}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-white whitespace-nowrap">${fmt(r.currentPrice)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-amber-400 whitespace-nowrap">${fmt(r.leftResistance)}</td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                          <span className={r.breakoutPercentage > 0 ? "text-emerald-400" : "text-slate-400"}>{r.breakoutPercentage > 0 ? "+" : ""}{fmt(r.breakoutPercentage)}%</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-400 text-xs whitespace-nowrap">{fmt(r.volumeRatio)}×</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-400 text-xs whitespace-nowrap">{fmt(r.rsi)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`flex items-center gap-0.5 text-xs ${r.trend === "uptrend" ? "text-emerald-400" : r.trend === "downtrend" ? "text-red-400" : "text-slate-400"}`}>
                            {r.trend === "uptrend" ? <ArrowUpRight size={12} /> : r.trend === "downtrend" ? <ArrowDownRight size={12} /> : <Minus size={12} />}
                            {r.trend}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {r.higherTimeframeConfirmed ? <span className="text-emerald-400">✓</span> : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">{r.patternDuration} candles</td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-400 text-xs whitespace-nowrap">${fmt(r.potentialTarget)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-red-400 text-xs whitespace-nowrap">${fmt(r.invalidationLevel)}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{new Date(r.signalTimestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      </tr>
                      {isOpen && (
                        <tr key={`${r.id}-detail`}>                          <td colSpan={15} className="px-4 py-4 bg-slate-950/60 border-b border-slate-800">
                            <ExpandedDetail detection={r} onViewDetails={() => navigate(`/scanner/${r.id}`, { state: { detection: r } })} onAddToTrade={() => handleAddToTrade(r.symbol, r.currentPrice, r.invalidationLevel, r.potentialTarget)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tradeToast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white shadow-lg">
          {tradeToast}
        </div>
      )}
    </div>
  );
}

function SettingField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500"
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2 text-xs">
      <div className={`w-9 h-5 rounded-full transition-colors relative ${checked ? "bg-violet-600" : "bg-slate-700"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className={checked ? "text-white" : "text-slate-500"}>{label}</span>
    </button>
  );
}

function ExpandedDetail({ detection, onViewDetails, onAddToTrade }: { detection: PatternDetection; onViewDetails: () => void; onAddToTrade: () => void }) {
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoBox label="Pattern Start" value={fmtDate(detection.patternStartDate)} />
        <InfoBox label="Pattern Low" value={fmtDate(detection.patternLowDate)} />
        <InfoBox label="Pattern End" value={fmtDate(detection.patternEndDate)} />
        <InfoBox label="Confidence Label" value={getConfidenceLabel(detection.confidence)} />
      </div>

      {/* Score breakdown */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Confidence Score Breakdown</h4>
        <div className="space-y-1.5">
          {scoreItems.map(([label, val, max]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-36">{label}</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${val / max > 0.6 ? "bg-emerald-500" : val / max > 0.3 ? "bg-amber-500" : "bg-slate-600"}`} style={{ width: `${(val / max) * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-slate-300 w-12 text-right">{val.toFixed(1)}/{max}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {detection.warnings.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-400 mb-1">Warnings</p>
          {detection.warnings.map((w, i) => <p key={i} className="text-xs text-amber-300/70">{w}</p>)}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onViewDetails}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-white text-sm font-medium transition-colors"
        >
          <BarChart3 size={14} /> View Full Chart & Analysis
        </button>
        <button
          onClick={onAddToTrade}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={14} /> Add to Trade Today
        </button>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/40 rounded-lg px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-white font-medium">{value}</p>
    </div>
  );
}
