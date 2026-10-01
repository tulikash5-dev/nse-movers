import { useState, useMemo, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import {
  BarChart3, Play, Settings as SettingsIcon, RefreshCw,
  ArrowUpRight, ArrowDownRight, Minus, Search,
  TrendingUp, TrendingDown, Volume2,
  Target, Shield, AlertTriangle, Info, CheckCircle2, XCircle,
  Clock, Gauge, X, ChevronUp, ChevronDown, ChevronLeft, History, Plus,
} from "lucide-react";
import type { VolumeAlert, VolumeScannerSettings, ActionType, FlagType } from "../lib/volumeScanner/types";
import { DEFAULT_VOLUME_SETTINGS, WATCHLIST } from "../lib/volumeScanner/types";
import { fetchCandlesForWatchlist } from "../lib/volumeScanner/marketData";
import { evaluateWatchlist } from "../lib/volumeScanner/alertEngine";
import { supabase } from "../lib/supabase";
import { addToTradeList } from "../lib/tradeList";

type SortKey = "action" | "ticker" | "date" | "close" | "change_pct" | "rsi" | "volume_ratio" | "avg_daily_volume_20d" | "suggested_stop";
type SortDir = "asc" | "desc";

interface RecommendationRow {
  id: string;
  scan_date: string;
  ticker: string;
  action: string;
  signal_type: string;
  entry_price: number;
  suggested_stop: number | null;
  volume_ratio: number | null;
  rsi: number | null;
  change_pct: number | null;
  status: string;
  verification_date: string | null;
  verification_price: number | null;
  pnl_pct: number | null;
}

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtVolume(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  return n.toLocaleString("en-US");
}

function fmtDate(d: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getActionColor(action: ActionType): string {
  switch (action) {
    case "LONG": return "text-emerald-400";
    case "SHORT": return "text-red-400";
    default: return "text-slate-400";
  }
}

function getActionBg(action: ActionType): string {
  switch (action) {
    case "LONG": return "bg-emerald-900/40 border-emerald-700";
    case "SHORT": return "bg-red-900/40 border-red-700";
    default: return "bg-slate-800/40 border-slate-700";
  }
}

function getActionIcon(action: ActionType) {
  switch (action) {
    case "LONG": return <ArrowUpRight size={14} className="text-emerald-400" />;
    case "SHORT": return <ArrowDownRight size={14} className="text-red-400" />;
    default: return <Minus size={14} className="text-slate-400" />;
  }
}

function getFlagColor(flag: FlagType): string {
  switch (flag) {
    case "overbought": return "bg-red-900/40 text-red-300 border-red-800";
    case "oversold": return "bg-emerald-900/40 text-emerald-300 border-emerald-800";
    case "low_liquidity": return "bg-amber-900/40 text-amber-300 border-amber-800";
    case "volume_fading": return "bg-orange-900/40 text-orange-300 border-orange-800";
    case "overextended": return "bg-purple-900/40 text-purple-300 border-purple-800";
    default: return "bg-slate-800 text-slate-300 border-slate-700";
  }
}

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "action", label: "Action" },
  { key: "ticker", label: "Ticker" },
  { key: "close", label: "Close" },
  { key: "change_pct", label: "Chg %" },
  { key: "rsi", label: "RSI" },
  { key: "volume_ratio", label: "Vol Ratio" },
  { key: "avg_daily_volume_20d", label: "Avg Vol 20D" },
  { key: "suggested_stop", label: "Stop" },
  { key: "suggested_target", label: "Target" },
];

export default function VolumeFinder() {
  const [settings, setSettings] = useState<VolumeScannerSettings>(DEFAULT_VOLUME_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [alerts, setAlerts] = useState<VolumeAlert[]>([]);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionType | "ALL">("ALL");
  const [selectedAlert, setSelectedAlert] = useState<VolumeAlert | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("volume_ratio");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [minVolRatio, setMinVolRatio] = useState(0);
  const [sectorFilter, setSectorFilter] = useState<string>("ALL");
  const [showHistory, setShowHistory] = useState(false);
  const [tradeToast, setTradeToast] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    WATCHLIST.forEach((w) => s.add(w.sector));
    return ["ALL", ...Array.from(s).sort()];
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    setAlerts([]);
    setScanProgress({ done: 0, total: WATCHLIST.length });
    try {
      const symbols = WATCHLIST.map((w) => w.symbol);
      const candlesByTicker = await fetchCandlesForWatchlist(symbols, (done, total) => {
        setScanProgress({ done, total });
      });
      const results = evaluateWatchlist(candlesByTicker, settings);
      setAlerts(results);
      setLastScanTime(new Date().toISOString());

      // Save LONG/SHORT recommendations to DB
      const tradeable = results.filter((a) => a.action === "LONG" || a.action === "SHORT");
      if (tradeable.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const rows = tradeable.map((a) => ({
          scan_date: today,
          ticker: a.ticker,
          action: a.action,
          signal_type: a.signal_type,
          entry_price: a.close,
          suggested_stop: a.suggested_stop,
          volume_ratio: a.volume_ratio,
          rsi: a.rsi,
          change_pct: a.change_pct,
          message: a.message,
          status: "PENDING",
        }));
        try {
          await supabase.from("volume_recommendations").insert(rows);
        } catch {
          // Silently ignore — UI still works
        }
      }
    } catch (e) {
      console.error("Scan failed:", e);
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  }, [settings]);

  useEffect(() => {
    runScan();
  }, [runScan]);

  const tickerToSector = useMemo(() => {
    const m = new Map<string, string>();
    WATCHLIST.forEach((w) => m.set(w.symbol, w.sector));
    return m;
  }, []);

  const filteredAlerts = useMemo(() => {
    let result = alerts;
    if (actionFilter !== "ALL") {
      result = result.filter((a) => a.action === actionFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => a.ticker.toLowerCase().includes(q));
    }
    if (minVolRatio > 0) {
      result = result.filter((a) => (a.volume_ratio ?? 0) >= minVolRatio);
    }
    if (sectorFilter !== "ALL") {
      result = result.filter((a) => tickerToSector.get(a.ticker) === sectorFilter);
    }

    // Sort
    const sorted = [...result].sort((a, b) => {
      let av: number | string | null = a[sortKey];
      let bv: number | string | null = b[sortKey];
      if (av == null) av = sortDir === "asc" ? Infinity : -Infinity;
      if (bv == null) bv = sortDir === "asc" ? Infinity : -Infinity;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return sorted;
  }, [alerts, actionFilter, searchQuery, minVolRatio, sectorFilter, sortKey, sortDir, tickerToSector]);

  const stats = useMemo(() => {
    if (alerts.length === 0) return null;
    const longs = alerts.filter((a) => a.action === "LONG").length;
    const shorts = alerts.filter((a) => a.action === "SHORT").length;
    const noTrades = alerts.filter((a) => a.action === "NO_TRADE").length;
    const lowLiquidity = alerts.filter((a) => a.flags.includes("low_liquidity")).length;
    const avgVolRatio = alerts.reduce((sum, a) => sum + (a.volume_ratio ?? 0), 0) / alerts.length;
    return { total: alerts.length, longs, shorts, noTrades, lowLiquidity, avgVolRatio };
  }, [alerts]);

  async function handleAddToTrade(a: VolumeAlert) {
    if (a.action !== "LONG" && a.action !== "SHORT") return;
    const result = await addToTradeList(a.ticker, a.action, "volume-finder", a.close, a.suggested_stop, a.suggested_target);
    setTradeToast(result.success ? `Added ${a.ticker} to Trade Today` : (result.error ?? "Failed to add"));
    setTimeout(() => setTradeToast(null), 2500);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Volume2 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Volume Trade Finder</h1>
              <p className="text-slate-400 text-sm">Volume-confirmed momentum signals with risk management</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {lastScanTime && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock size={12} /> {new Date(lastScanTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={() => setShowHistory((s) => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${showHistory ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            <History size={14} /> Track Record
          </button>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${showSettings ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            <SettingsIcon size={14} /> Settings
          </button>
          <button
            onClick={runScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {scanning ? <><RefreshCw size={14} className="animate-spin" /> Scanning…</> : <><Play size={14} /> Scan Now</>}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard label="Total Scanned" value={String(stats.total)} icon={<BarChart3 size={16} />} color="text-white" />
          <StatCard label="LONG Signals" value={String(stats.longs)} icon={<TrendingUp size={16} />} color="text-emerald-400" />
          <StatCard label="SHORT Signals" value={String(stats.shorts)} icon={<TrendingDown size={16} />} color="text-red-400" />
          <StatCard label="NO TRADE" value={String(stats.noTrades)} icon={<Minus size={16} />} color="text-slate-400" />
          <StatCard label="Low Liquidity" value={String(stats.lowLiquidity)} icon={<AlertTriangle size={16} />} color="text-amber-400" />
          <StatCard label="Avg Vol Ratio" value={`${stats.avgVolRatio.toFixed(2)}×`} icon={<Volume2 size={16} />} color="text-blue-400" />
        </div>
      )}

      {/* Track Record Panel */}
      {showHistory && (
        <TrackRecordPanel />
      )}

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel settings={settings} onChange={setSettings} />
      )}

      {/* Filters Bar */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ticker…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
        >
          {sectors.map((s) => (
            <option key={s} value={s}>{s === "ALL" ? "All Sectors" : s}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">Min Vol Ratio</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={minVolRatio}
            onChange={(e) => setMinVolRatio(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-20 bg-slate-900 border border-slate-800 rounded-lg px-2 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["ALL", "LONG", "SHORT", "NO_TRADE"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActionFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                actionFilter === f
                  ? f === "LONG" ? "bg-emerald-900/40 border-emerald-600 text-emerald-300"
                  : f === "SHORT" ? "bg-red-900/40 border-red-600 text-red-300"
                  : f === "NO_TRADE" ? "bg-slate-800 border-slate-600 text-slate-300"
                  : "bg-blue-900/40 border-blue-600 text-blue-300"
                  : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700"
              }`}
            >
              {f === "NO_TRADE" ? "NO TRADE" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {scanning ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={32} className="animate-spin text-blue-500" />
            <p className="text-slate-400 text-sm">Scanning {WATCHLIST.length} instruments…</p>
            {scanProgress && (
              <div className="w-64">
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${(scanProgress.done / scanProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 text-center mt-1.5">
                  {scanProgress.done} / {scanProgress.total} fetched
                </p>
              </div>
            )}
          </div>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
          <Search size={32} className="text-slate-700" />
          <p className="text-sm">No alerts match your filters.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{filteredAlerts.length} alerts</span>
            <span className="text-xs text-slate-500">Click any row for detailed analysis · Click column headers to sort</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {SORT_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-slate-300 select-none"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key && (
                          sortDir === "asc" ? <ChevronUp size={12} className="text-blue-400" /> : <ChevronDown size={12} className="text-blue-400" />
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">Fast MA</th>
                  <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">Slow MA</th>
                  <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">Position Size</th>
                  <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">Flags</th>
                  <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">Trade</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((a, i) => (
                  <tr
                    key={a.ticker}
                    onClick={() => setSelectedAlert(a)}
                    className={`border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors cursor-pointer ${i % 2 === 0 ? "" : "bg-slate-800/10"}`}
                  >
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold ${getActionColor(a.action)}`}>
                        {getActionIcon(a.action)}
                        {a.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-white font-medium text-xs">{a.ticker}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-white whitespace-nowrap">₹{fmt(a.close)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap ${(a.change_pct ?? 0) > 0 ? "text-emerald-400" : (a.change_pct ?? 0) < 0 ? "text-red-400" : "text-slate-400"}`}>
                      {a.change_pct != null ? `${a.change_pct > 0 ? "+" : ""}${fmt(a.change_pct)}%` : "—"}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap ${
                      a.rsi != null && a.rsi > 70 ? "text-red-400" : a.rsi != null && a.rsi < 30 ? "text-emerald-400" : "text-slate-400"
                    }`}>{fmt(a.rsi)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap ${
                      (a.volume_ratio ?? 0) >= 1.5 ? "text-emerald-400 font-semibold" : (a.volume_ratio ?? 0) >= 1 ? "text-amber-400" : "text-slate-500"
                    }`}>{a.volume_ratio != null ? `${a.volume_ratio.toFixed(2)}×` : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400 text-xs whitespace-nowrap">{fmtVolume(a.avg_daily_volume_20d)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-400 text-xs whitespace-nowrap">{a.suggested_stop != null ? `₹${fmt(a.suggested_stop)}` : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-400 text-xs whitespace-nowrap">{a.suggested_target != null ? `₹${fmt(a.suggested_target)}` : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-300 text-xs whitespace-nowrap">₹{fmt(a.fast_ma)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-300 text-xs whitespace-nowrap">₹{fmt(a.slow_ma)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-300 text-xs whitespace-nowrap">{a.suggested_position_size != null ? fmt(a.suggested_position_size, 0) : "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {a.flags.length === 0 ? (
                          <span className="text-slate-600 text-xs">—</span>
                        ) : (
                          a.flags.map((f) => (
                            <span key={f} className={`text-[10px] px-1.5 py-0.5 rounded border ${getFlagColor(f)}`}>
                              {f.replace(/_/g, " ")}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {(a.action === "LONG" || a.action === "SHORT") && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAddToTrade(a); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-900/40 border border-emerald-700 text-emerald-300 text-[10px] font-medium hover:bg-emerald-800/50 transition-colors whitespace-nowrap"
                        >
                          <Plus size={10} /> Trade
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast */}
      {tradeToast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white shadow-lg animate-in fade-in">
          {tradeToast}
        </div>
      )}

      {/* Detail Drawer */}
      {selectedAlert && (
        <DetailDrawer alert={selectedAlert} onClose={() => setSelectedAlert(null)} onAddToTrade={handleAddToTrade} />
      )}
    </div>
  );
}

function TrackRecordPanel() {
  const [recs, setRecs] = useState<RecommendationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const loadRecs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("volume_recommendations")
        .select("*")
        .order("scan_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      setRecs((data ?? []) as RecommendationRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load track record");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecs();
  }, [loadRecs]);

  async function verifyNow() {
    setVerifying(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-recommendations`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      await loadRecs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  const accuracyStats = useMemo(() => {
    const verified = recs.filter((r) => r.status === "CORRECT" || r.status === "WRONG" || r.status === "STOPPED");
    const correct = recs.filter((r) => r.status === "CORRECT").length;
    const wrong = recs.filter((r) => r.status === "WRONG").length;
    const stopped = recs.filter((r) => r.status === "STOPPED").length;
    const pending = recs.filter((r) => r.status === "PENDING").length;
    const total = verified.length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    return { correct, wrong, stopped, pending, total, accuracy };
  }, [recs]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <History size={18} className="text-blue-400" />
        <h3 className="text-sm font-semibold text-white">Recommendation Track Record</h3>
        <button
          onClick={verifyNow}
          disabled={verifying || loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {verifying ? <><RefreshCw size={12} className="animate-spin" /> Verifying…</> : <><RefreshCw size={12} /> Verify Now</>}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <RefreshCw size={24} className="animate-spin text-slate-600" />
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm">{error}</div>
      ) : recs.length === 0 ? (
        <p className="text-slate-500 text-sm py-6 text-center">No recommendations saved yet. Run a scan to start tracking.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            <div className="bg-slate-800/40 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-500">Accuracy</p>
              <p className={`text-lg font-bold ${accuracyStats.accuracy >= 60 ? "text-emerald-400" : accuracyStats.accuracy >= 40 ? "text-amber-400" : "text-red-400"}`}>
                {accuracyStats.total > 0 ? `${accuracyStats.accuracy.toFixed(1)}%` : "—"}
              </p>
            </div>
            <div className="bg-slate-800/40 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-500">Correct</p>
              <p className="text-lg font-bold text-emerald-400">{accuracyStats.correct}</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-500">Wrong</p>
              <p className="text-lg font-bold text-red-400">{accuracyStats.wrong}</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-500">Stop Hit</p>
              <p className="text-lg font-bold text-orange-400">{accuracyStats.stopped}</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-500">Pending</p>
              <p className="text-lg font-bold text-slate-400">{accuracyStats.pending}</p>
            </div>
          </div>

          {/* History table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Scan Date", "Ticker", "Action", "Entry", "Stop", "Status", "Verified On", "Verify Price", "PnL %"].map((h) => (
                    <th key={h} className="px-3 py-2 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recs.slice(0, 50).map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/40">
                    <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">{fmtDate(r.scan_date)}</td>
                    <td className="px-3 py-2 text-xs text-white font-medium">{r.ticker}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-bold ${r.action === "LONG" ? "text-emerald-400" : "text-red-400"}`}>
                        {r.action === "LONG" ? <ArrowUpRight size={12} className="inline" /> : <ArrowDownRight size={12} className="inline" />} {r.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-300 whitespace-nowrap">₹{fmt(r.entry_price)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-red-400 whitespace-nowrap">{r.suggested_stop != null ? `₹${fmt(r.suggested_stop)}` : "—"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">{r.verification_date ? fmtDate(r.verification_date) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-300 whitespace-nowrap">{r.verification_price != null ? `₹${fmt(r.verification_price)}` : "—"}</td>
                    <td className={`px-3 py-2 text-right font-mono text-xs whitespace-nowrap ${
                      r.pnl_pct == null ? "text-slate-500" : r.pnl_pct > 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {r.pnl_pct != null ? `${r.pnl_pct > 0 ? "+" : ""}${fmt(r.pnl_pct)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "CORRECT":
      return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400"><CheckCircle2 size={12} /> Correct</span>;
    case "WRONG":
      return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400"><XCircle size={12} /> Wrong</span>;
    case "STOPPED":
      return <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-400"><AlertTriangle size={12} /> Stop Hit</span>;
    default:
      return <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400"><Clock size={12} /> Pending</span>;
  }
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: ReactNode; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-slate-500">{icon}</span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function SettingsPanel({ settings, onChange }: { settings: VolumeScannerSettings; onChange: (s: VolumeScannerSettings) => void }) {
  const update = (key: keyof VolumeScannerSettings, value: number | boolean) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Indicator Parameters</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <NumField label="Fast MA Period" value={settings.fastMaPeriod} onChange={(v) => update("fastMaPeriod", v)} step={1} />
          <NumField label="Slow MA Period" value={settings.slowMaPeriod} onChange={(v) => update("slowMaPeriod", v)} step={1} />
          <NumField label="Long MA Period" value={settings.longSlowMaPeriod} onChange={(v) => update("longSlowMaPeriod", v)} step={1} />
          <NumField label="RSI Period" value={settings.rsiPeriod} onChange={(v) => update("rsiPeriod", v)} step={1} />
          <NumField label="Volume MA Period" value={settings.volumeMaPeriod} onChange={(v) => update("volumeMaPeriod", v)} step={1} />
          <NumField label="ATR Period" value={settings.atrPeriod} onChange={(v) => update("atrPeriod", v)} step={1} />
          <NumField label="Bollinger Period" value={settings.bollingerPeriod} onChange={(v) => update("bollingerPeriod", v)} step={1} />
          <NumField label="Bollinger Std Dev" value={settings.bollingerStdDev} onChange={(v) => update("bollingerStdDev", v)} step={0.1} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Screening Thresholds</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumField label="Min Avg Daily Vol" value={settings.minAvgDailyVolume} onChange={(v) => update("minAvgDailyVolume", v)} step={500000} />
          <NumField label="Vol Ratio Threshold" value={settings.volumeRatioThreshold} onChange={(v) => update("volumeRatioThreshold", v)} step={0.1} />
          <NumField label="RSI Overbought" value={settings.rsiOverbought} onChange={(v) => update("rsiOverbought", v)} step={1} />
          <NumField label="RSI Oversold" value={settings.rsiOversold} onChange={(v) => update("rsiOversold", v)} step={1} />
          <NumField label="MA Tolerance %" value={settings.maTolerancePct} onChange={(v) => update("maTolerancePct", v)} step={0.1} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Risk Management</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumField label="Risk Per Trade %" value={settings.riskPerTradePct} onChange={(v) => update("riskPerTradePct", v)} step={0.5} />
          <NumField label="Daily Loss Cap %" value={settings.dailyLossCapPct} onChange={(v) => update("dailyLossCapPct", v)} step={0.5} />
          <NumField label="Weekly Loss Cap %" value={settings.weeklyLossCapPct} onChange={(v) => update("weeklyLossCapPct", v)} step={0.5} />
          <NumField label="ATR Multiplier" value={settings.atrMultiplierForStop} onChange={(v) => update("atrMultiplierForStop", v)} step={0.5} />
          <NumField label="Max Holding Days" value={settings.maxHoldingDays} onChange={(v) => update("maxHoldingDays", v)} step={1} />
          <NumField label="Account Equity (₹)" value={settings.accountEquity} onChange={(v) => update("accountEquity", v)} step={50000} />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <Toggle label="Allow longs in overbought" checked={settings.allowOverboughtLongs} onChange={(v) => update("allowOverboughtLongs", v)} />
        <Toggle label="Allow shorts in oversold" checked={settings.allowOversoldShorts} onChange={(v) => update("allowOversoldShorts", v)} />
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2 text-xs">
      <div className={`w-9 h-5 rounded-full transition-colors relative ${checked ? "bg-blue-600" : "bg-slate-700"}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className={checked ? "text-white" : "text-slate-500"}>{label}</span>
    </button>
  );
}

function DetailDrawer({ alert, onClose, onAddToTrade }: { alert: VolumeAlert; onClose: () => void; onAddToTrade: (a: VolumeAlert) => void }) {
  const riskPerShare = alert.suggested_stop != null
    ? alert.action === "LONG"
      ? alert.close - alert.suggested_stop
      : alert.suggested_stop - alert.close
    : null;
  const riskAmount = alert.suggested_position_size != null && riskPerShare != null
    ? alert.suggested_position_size * riskPerShare
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-slate-900 border-l border-slate-800 overflow-y-auto h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${getActionBg(alert.action)}`}>
              {getActionIcon(alert.action)}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{alert.ticker}</h2>
              <p className="text-xs text-slate-400">{fmtDate(alert.date)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Action Card */}
          <div className={`rounded-xl border p-4 ${getActionBg(alert.action)}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getActionIcon(alert.action)}
                <h3 className={`text-lg font-bold ${getActionColor(alert.action)}`}>{alert.action}</h3>
              </div>
              <span className="text-xs text-slate-500 capitalize">{alert.signal_type.replace(/_/g, " ")}</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{alert.message}</p>
          </div>

          {/* Flags */}
          {alert.flags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-400" /> Flags
              </h3>
              <div className="flex flex-wrap gap-2">
                {alert.flags.map((f) => (
                  <span key={f} className={`text-xs px-2 py-1 rounded border ${getFlagColor(f)}`}>
                    {f.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Indicator Values */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
              <Gauge size={14} className="text-blue-400" /> Indicator Snapshot
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <InfoBox label="Close" value={`₹${fmt(alert.close)}`} />
              <InfoBox label="Fast MA" value={`₹${fmt(alert.fast_ma)}`} />
              <InfoBox label="Slow MA" value={`₹${fmt(alert.slow_ma)}`} />
              <InfoBox label="RSI" value={fmt(alert.rsi)} />
              <InfoBox label="Volume Ratio" value={alert.volume_ratio != null ? `${alert.volume_ratio.toFixed(2)}×` : "—"} />
              <InfoBox label="Avg Vol 20D" value={fmtVolume(alert.avg_daily_volume_20d)} />
              <InfoBox label="ATR" value={`₹${fmt(alert.atr)}`} />
              <InfoBox label="Change %" value={alert.change_pct != null ? `${alert.change_pct > 0 ? "+" : ""}${fmt(alert.change_pct)}%` : "—"} />
            </div>
          </div>

          {/* Risk Management */}
          {alert.action !== "NO_TRADE" && alert.suggested_stop != null && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
                <Shield size={14} className="text-blue-400" /> Risk Management
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InfoBox label="Suggested Stop" value={`₹${fmt(alert.suggested_stop)}`} />
              <InfoBox label="Suggested Target" value={alert.suggested_target != null ? `₹${fmt(alert.suggested_target)}` : "—"} />
                <InfoBox label="Position Size" value={alert.suggested_position_size != null ? `${fmt(alert.suggested_position_size, 0)} shares` : "—"} />
                <InfoBox label="Risk per Share" value={riskPerShare != null ? `₹${fmt(riskPerShare)}` : "—"} />
                <InfoBox label="Total Risk" value={riskAmount != null ? `₹${fmt(riskAmount, 0)}` : "—"} />
              </div>
              {alert.risk_reward_ratio != null && (
                <div className="mt-3 bg-slate-800/40 rounded-lg p-3 flex items-center gap-3">
                  <Target size={16} className="text-blue-400" />
                  <span className="text-xs text-slate-400">Assumed Risk:Reward target</span>
                  <span className="text-sm font-bold text-blue-400">1:{alert.risk_reward_ratio.toFixed(1)}</span>
                </div>
              )}
            </div>
          )}

          {/* Risk Check Status */}
          <div className={`rounded-lg p-3 flex items-center gap-2 ${alert.risk_checks_passed ? "bg-emerald-900/20 border border-emerald-800/40" : "bg-red-900/20 border border-red-800/40"}`}>
            {alert.risk_checks_passed ? <CheckCircle2 size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-red-400" />}
            <span className="text-xs text-slate-300">
              {alert.risk_checks_passed ? "All risk parameter checks passed." : "Risk parameter checks failed — review settings."}
            </span>
          </div>

          {/* Add to Trade Today */}
          {alert.action !== "NO_TRADE" && (
            <button
              onClick={() => onAddToTrade(alert)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Add to Trade Today
            </button>
          )}

          {/* Disclaimer */}
          <div className="bg-amber-900/10 border border-amber-800/30 rounded-lg p-3">
            <p className="text-xs text-amber-300/80 flex items-start gap-2">
              <Info size={14} className="shrink-0 mt-0.5" />
              {alert.disclaimer}
            </p>
          </div>
        </div>
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
