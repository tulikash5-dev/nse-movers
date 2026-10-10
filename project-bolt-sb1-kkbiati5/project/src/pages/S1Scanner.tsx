import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import {
  RefreshCw, Search, TrendingDown, X, Activity, BarChart3, ArrowDown,
  CircleDot, AlertCircle,
} from "lucide-react";

interface S1Result {
  id: string;
  scan_run_id: string;
  scan_time: string;
  symbol: string;
  company_name: string;
  sector: string | null;
  is_fno: boolean;
  current_price: number;
  prev_high: number;
  prev_low: number;
  prev_close: number;
  pivot_level: number;
  s1_level: number;
  distance_to_s1_pct: number;
  volume: number;
  avg_volume: number;
  volume_ratio: number;
  signal_status: string;
  daily_high: number;
  daily_low: number;
  daily_open: number;
  crossed_s1_today: boolean;
  candles: string;
}

interface ScanRun {
  id: string;
  scan_time: string;
  stocks_scanned: number;
  matched_count: number;
  crossed_count: number;
  near_count: number;
  status: string;
  message: string | null;
}

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtVol(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  return n.toLocaleString("en-IN");
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isMarketOpen(): { open: boolean; label: string } {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istMs = now.getTime() + (5.5 * 60 * 60 * 1000);
  const istTime = new Date(istMs);
  const day = istTime.getUTCDay();
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;
  if (day === 0 || day === 6) return { open: false, label: "Closed (Weekend)" };
  // NSE: 9:15 AM to 3:30 PM IST
  if (totalMinutes >= 555 && totalMinutes <= 930) return { open: true, label: "Market Open" };
  return { open: false, label: "Market Closed" };
}

// ===== Mini Candlestick Chart (SVG) =====
function CandlestickChart({ candles, s1Level, symbol }: { candles: CandleData[]; s1Level: number; symbol: string }) {
  if (candles.length === 0) {
    return <div className="flex items-center justify-center py-20 text-slate-500 text-sm">No chart data available</div>;
  }

  const chartHeight = 320;
  const chartWidth = 700;
  const padding = { top: 20, right: 60, bottom: 30, left: 10 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const allValues = candles.flatMap(c => [c.high, c.low]);
  allValues.push(s1Level);
  const minVal = Math.min(...allValues) * 0.995;
  const maxVal = Math.max(...allValues) * 1.005;
  const range = maxVal - minVal || 1;

  const candleWidth = innerWidth / candles.length;
  const bodyWidth = Math.max(3, candleWidth * 0.6);

  const yScale = (val: number) => padding.top + innerHeight - ((val - minVal) / range) * innerHeight;
  const s1Y = yScale(s1Level);

  // Price axis labels (5 levels)
  const priceLabels: { y: number; val: number }[] = [];
  for (let i = 0; i <= 4; i++) {
    const val = minVal + (range * i) / 4;
    priceLabels.push({ y: yScale(val), val });
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg width={chartWidth} height={chartHeight} className="min-w-full">
        {/* Grid lines */}
        {priceLabels.map((pl, i) => (
          <g key={i}>
            <line x1={padding.left} y1={pl.y} x2={chartWidth - padding.right} y2={pl.y}
              stroke="#1e293b" strokeWidth={0.5} strokeDasharray="2 4" />
            <text x={chartWidth - padding.right + 5} y={pl.y + 4} fill="#64748b" fontSize={10} className="font-mono">
              {fmt(pl.val)}
            </text>
          </g>
        ))}

        {/* S1 Level Line */}
        <line x1={padding.left} y1={s1Y} x2={chartWidth - padding.right} y2={s1Y}
          stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" />
        <rect x={chartWidth - padding.right + 2} y={s1Y - 8} width={50} height={16} rx={3} fill="#f59e0b" />
        <text x={chartWidth - padding.right + 6} y={s1Y + 3} fill="#0f172a" fontSize={9} fontWeight="bold" className="font-mono">
          S1 {fmt(s1Level)}
        </text>

        {/* Candles */}
        {candles.map((c, i) => {
          const x = padding.left + i * candleWidth + candleWidth / 2;
          const isGreen = c.close >= c.open;
          const color = isGreen ? "#10b981" : "#ef4444";
          const wickTop = yScale(c.high);
          const wickBot = yScale(c.low);
          const bodyTop = yScale(Math.max(c.open, c.close));
          const bodyBot = yScale(Math.min(c.open, c.close));
          const bodyH = Math.max(1, bodyBot - bodyTop);

          return (
            <g key={i}>
              <line x1={x} y1={wickTop} x2={x} y2={wickBot} stroke={color} strokeWidth={1} />
              <rect
                x={x - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyH}
                fill={color}
                rx={0.5}
              />
            </g>
          );
        })}

        {/* Current price marker */}
        {candles.length > 0 && (() => {
          const lastClose = candles[candles.length - 1].close;
          const y = yScale(lastClose);
          return (
            <>
              <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y}
                stroke="#3b82f6" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.5} />
              <rect x={chartWidth - padding.right + 2} y={y - 8} width={50} height={16} rx={3} fill="#3b82f6" />
              <text x={chartWidth - padding.right + 6} y={y + 3} fill="white" fontSize={9} fontWeight="bold" className="font-mono">
                {fmt(lastClose)}
              </text>
            </>
          );
        })()}
      </svg>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 px-2">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" /> Bullish candle</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500" /> Bearish candle</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500" /> S1 Support Level</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500" /> Current Price</span>
      </div>
    </div>
  );
}

// ===== Main Component =====
export default function S1Scanner() {
  const [scanRun, setScanRun] = useState<ScanRun | null>(null);
  const [results, setResults] = useState<S1Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "fno" | "nonfno">("all");
  const [search, setSearch] = useState("");
  const [bufferPct, setBufferPct] = useState(1.0);
  const [sortBy, setSortBy] = useState<"distance" | "volume" | "price">("distance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [volFilter, setVolFilter] = useState(true);
  const [selectedRow, setSelectedRow] = useState<S1Result | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const market = isMarketOpen();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: run, error: runErr } = await supabase
        .from("s1_scan_runs")
        .select("*")
        .order("scan_time", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (runErr) throw runErr;

      if (!run) {
        setScanRun(null);
        setResults([]);
        return;
      }

      setScanRun(run as ScanRun);
      const { data: res, error: resErr } = await supabase
        .from("s1_scan_results")
        .select("*")
        .eq("scan_run_id", (run as ScanRun).id)
        .order("distance_to_s1_pct", { ascending: true });
      if (resErr) throw resErr;

      setResults((res ?? []) as S1Result[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scanner data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function runScanNow() {
    setScanning(true);
    setError(null);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/s1-scanner`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ triggered_by: "manual", buffer_pct: bufferPct }),
        },
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      setToast(`Scan complete: ${data.matched} stocks near S1 from ${data.stocks_scanned} scanned`);
      setTimeout(() => setToast(null), 3500);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  // Apply buffer filter client-side
  const filteredResults = useMemo(() => {
    let r = results;

    // F&O filter
    if (filter === "fno") r = r.filter(s => s.is_fno);
    else if (filter === "nonfno") r = r.filter(s => !s.is_fno);

    // Search
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      r = r.filter(s => s.symbol.includes(q) || (s.company_name?.toUpperCase().includes(q) ?? false));
    }

    // Buffer filter: show stocks within ±buffer% of S1 OR crossed today
    r = r.filter(s => Math.abs(s.distance_to_s1_pct) <= bufferPct || s.crossed_s1_today);

    // Volume filter: only stocks with above-average volume (volume_ratio >= 1.0)
    if (volFilter) {
      r = r.filter(s => s.volume_ratio >= 1.0);
    }

    // Sort
    r = [...r];
    if (sortBy === "distance") {
      r.sort((a, b) => sortDir === "asc"
        ? Math.abs(a.distance_to_s1_pct) - Math.abs(b.distance_to_s1_pct)
        : Math.abs(b.distance_to_s1_pct) - Math.abs(a.distance_to_s1_pct));
    } else if (sortBy === "volume") {
      r.sort((a, b) => sortDir === "asc" ? a.volume - b.volume : b.volume - a.volume);
    } else {
      r.sort((a, b) => sortDir === "asc" ? a.current_price - b.current_price : b.current_price - a.current_price);
    }

    return r;
  }, [results, filter, search, bufferPct, volFilter, sortBy, sortDir]);

  const selectedCandles: CandleData[] = useMemo(() => {
    if (!selectedRow) return [];
    try {
      const parsed = typeof selectedRow.candles === "string"
        ? JSON.parse(selectedRow.candles)
        : selectedRow.candles;
      return (Array.isArray(parsed) ? parsed : []) as CandleData[];
    } catch {
      return [];
    }
  }, [selectedRow]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <TrendingDown size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base sm:text-lg tracking-tight">NSE Daily S1 Auto-Scanner</h1>
            <p className="text-[10px] text-slate-500">
              {scanRun ? `Last scan: ${timeAgo(scanRun.scan_time)} · ${scanRun.stocks_scanned} stocks scanned` : "No scan data yet"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium ${
            market.open ? "bg-emerald-900/40 text-emerald-400 border border-emerald-800" : "bg-slate-800 text-slate-400 border border-slate-700"
          }`}>
            <span className={`w-2 h-2 rounded-full ${market.open ? "bg-emerald-500 animate-pulse" : "bg-slate-600"}`} />
            {market.label}
          </div>
          <button
            onClick={runScanNow}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white text-xs font-medium transition-colors"
          >
            <RefreshCw size={13} className={scanning ? "animate-spin" : ""} />
            {scanning ? "Scanning..." : "Refresh Scanner"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      {/* Summary Stats */}
      {scanRun && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-600 flex items-center justify-center"><Activity size={14} className="text-white" /></div>
            <div><p className="text-[9px] text-slate-500 uppercase">Scanned</p><p className="text-white font-bold text-sm">{scanRun.stocks_scanned}</p></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center"><CircleDot size={14} className="text-white" /></div>
            <div><p className="text-[9px] text-slate-500 uppercase">Matched S1</p><p className="text-white font-bold text-sm">{scanRun.matched_count}</p></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center"><ArrowDown size={14} className="text-white" /></div>
            <div><p className="text-[9px] text-slate-500 uppercase">Crossed S1</p><p className="text-white font-bold text-sm">{scanRun.crossed_count}</p></div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center"><BarChart3 size={14} className="text-white" /></div>
            <div><p className="text-[9px] text-slate-500 uppercase">Near S1</p><p className="text-white font-bold text-sm">{scanRun.near_count}</p></div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Tab filters */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
            {([
              { key: "all", label: "All Stocks" },
              { key: "fno", label: "F&O Only" },
              { key: "nonfno", label: "Non-F&O" },
            ] as { key: typeof filter; label: string }[]).map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  filter === t.key ? "bg-slate-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search symbol..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
            />
          </div>

          {/* Buffer slider */}
          <div className="flex items-center gap-2 min-w-[180px]">
            <span className="text-[10px] text-slate-500 whitespace-nowrap">S1 Buffer: {bufferPct.toFixed(1)}%</span>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.1"
              value={bufferPct}
              onChange={e => setBufferPct(parseFloat(e.target.value))}
              className="flex-1 accent-amber-500"
            />
          </div>

          {/* Volume filter toggle */}
          <button
            onClick={() => setVolFilter(!volFilter)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors border ${
              volFilter
                ? "bg-amber-900/40 text-amber-400 border-amber-800"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
            title="Show only stocks with above-average volume"
          >
            <BarChart3 size={12} />
            Vol ≥ 1x
          </button>

          {/* Sort */}
          <div className="flex items-center gap-1">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as "distance" | "volume" | "price")}
              className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[11px] text-white focus:outline-none"
            >
              <option value="distance">Sort: Distance</option>
              <option value="volume">Sort: Volume</option>
              <option value="price">Sort: Price</option>
            </select>
            <button
              onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
              className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-[11px] text-slate-400 hover:text-white"
            >
              {sortDir === "asc" ? "↑" : "↓"}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="text-slate-600 animate-spin" />
          <span className="ml-2 text-sm text-slate-500">Loading scanner data...</span>
        </div>
      ) : !scanRun ? (
        <div className="text-center py-20">
          <TrendingDown size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm mb-1">No scan data yet</p>
          <p className="text-slate-600 text-xs mb-4">Click "Refresh Scanner" to run the first scan</p>
          <button
            onClick={runScanNow}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white text-sm font-medium"
          >
            <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
            Run First Scan
          </button>
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">No stocks matched the S1 criteria</p>
          <p className="text-slate-600 text-xs mt-1">Try increasing the buffer or running a new scan</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-3 py-2.5 text-[10px] text-slate-600 font-semibold text-left">Symbol</th>
                <th className="px-3 py-2.5 text-[10px] text-slate-600 font-semibold text-left">Sector</th>
                <th className="px-3 py-2.5 text-[10px] text-slate-600 font-semibold text-left">Type</th>
                <th className="px-3 py-2.5 text-[10px] text-slate-600 font-semibold text-right">Price (₹)</th>
                <th className="px-3 py-2.5 text-[10px] text-slate-600 font-semibold text-right">S1 Level (₹)</th>
                <th className="px-3 py-2.5 text-[10px] text-slate-600 font-semibold text-right">Dist to S1</th>
                <th className="px-3 py-2.5 text-[10px] text-slate-600 font-semibold text-right">Volume</th>
                <th className="px-3 py-2.5 text-[10px] text-slate-600 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map(r => {
                const isCrossed = r.signal_status === "Crossed S1";
                const isNear = r.signal_status === "Near S1";
                const isBelow = r.signal_status === "Below S1";
                const distColor = r.distance_to_s1_pct < 0 ? "text-red-400" : r.distance_to_s1_pct <= bufferPct ? "text-orange-400" : "text-slate-400";

                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRow(r)}
                    className="border-b border-slate-800/40 cursor-pointer hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <span className="text-white text-xs font-bold">{r.symbol}</span>
                      {r.company_name && <p className="text-[9px] text-slate-600 truncate max-w-[140px]">{r.company_name}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{r.sector ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${r.is_fno ? "bg-blue-900/40 text-blue-400" : "bg-slate-700 text-slate-400"}`}>
                        {r.is_fno ? "F&O" : "Non-F&O"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-mono text-white">{fmt(r.current_price)}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-mono text-amber-400">{fmt(r.s1_level)}</td>
                    <td className={`px-3 py-2.5 text-right text-xs font-mono ${distColor}`}>
                      {r.distance_to_s1_pct > 0 ? "+" : ""}{fmt(r.distance_to_s1_pct)}%
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-mono text-slate-400">
                      {fmtVol(r.volume)}
                      {r.volume_ratio > 1.5 && <span className="ml-1 text-[9px] text-amber-500">{r.volume_ratio}x</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${
                        isCrossed ? "bg-red-900/50 text-red-400 border border-red-800"
                        : isNear ? "bg-orange-900/50 text-orange-400 border border-orange-800"
                        : isBelow ? "bg-red-950/40 text-red-500"
                        : "bg-slate-800 text-slate-500"
                      }`}>
                        {r.signal_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Chart Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedRow(null)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div>
                <h2 className="text-white font-bold text-base">{selectedRow.symbol}</h2>
                <p className="text-[10px] text-slate-500">{selectedRow.company_name} · {selectedRow.sector}</p>
              </div>
              <button onClick={() => setSelectedRow(null)} className="text-slate-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              {/* Key levels */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                  <p className="text-[9px] text-slate-500">Current</p>
                  <p className="text-xs font-mono text-white">{fmt(selectedRow.current_price)}</p>
                </div>
                <div className="bg-amber-900/20 rounded-lg px-2.5 py-1.5 border border-amber-800/40">
                  <p className="text-[9px] text-amber-500">S1 Level</p>
                  <p className="text-xs font-mono text-amber-400 font-bold">{fmt(selectedRow.s1_level)}</p>
                </div>
                <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                  <p className="text-[9px] text-slate-500">Pivot</p>
                  <p className="text-xs font-mono text-slate-300">{fmt(selectedRow.pivot_level)}</p>
                </div>
                <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                  <p className="text-[9px] text-slate-500">Prev High</p>
                  <p className="text-xs font-mono text-slate-300">{fmt(selectedRow.prev_high)}</p>
                </div>
                <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                  <p className="text-[9px] text-slate-500">Prev Low</p>
                  <p className="text-xs font-mono text-slate-300">{fmt(selectedRow.prev_low)}</p>
                </div>
                <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                  <p className="text-[9px] text-slate-500">Prev Close</p>
                  <p className="text-xs font-mono text-slate-300">{fmt(selectedRow.prev_close)}</p>
                </div>
              </div>

              {/* Daily OHLC */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                  <p className="text-[9px] text-slate-500">Day Open</p>
                  <p className="text-xs font-mono text-slate-300">{fmt(selectedRow.daily_open)}</p>
                </div>
                <div className="bg-emerald-900/20 rounded-lg px-2.5 py-1.5">
                  <p className="text-[9px] text-emerald-500">Day High</p>
                  <p className="text-xs font-mono text-emerald-400">{fmt(selectedRow.daily_high)}</p>
                </div>
                <div className="bg-red-900/20 rounded-lg px-2.5 py-1.5">
                  <p className="text-[9px] text-red-500">Day Low</p>
                  <p className="text-xs font-mono text-red-400">{fmt(selectedRow.daily_low)}</p>
                </div>
                <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                  <p className="text-[9px] text-slate-500">Volume</p>
                  <p className="text-xs font-mono text-slate-300">{fmtVol(selectedRow.volume)}</p>
                </div>
              </div>

              {/* Signal status */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] px-2 py-1 rounded font-medium ${
                  selectedRow.signal_status === "Crossed S1" ? "bg-red-900/50 text-red-400 border border-red-800"
                  : selectedRow.signal_status === "Near S1" ? "bg-orange-900/50 text-orange-400 border border-orange-800"
                  : "bg-slate-800 text-slate-400"
                }`}>
                  {selectedRow.signal_status}
                </span>
                <span className="text-[10px] text-slate-500">
                  Distance: {selectedRow.distance_to_s1_pct > 0 ? "+" : ""}{fmt(selectedRow.distance_to_s1_pct)}%
                </span>
                {selectedRow.crossed_s1_today && (
                  <span className="text-[10px] text-red-400">Opened above S1, crossed below intraday</span>
                )}
              </div>

              {/* Chart */}
              <CandlestickChart candles={selectedCandles} s1Level={selectedRow.s1_level} symbol={selectedRow.symbol} />
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
