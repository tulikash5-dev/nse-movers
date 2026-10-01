import { useEffect, useState, useMemo, useCallback } from "react";
import {
  TrendingUp, TrendingDown, RefreshCw, Settings, AlertTriangle,
  CheckCircle, XCircle, AlertCircle, Zap, Target, Shield,
  ChevronDown, ChevronRight, Filter, Download, Clock,
  Flame, Star, Info, Trash2, X, AlertTriangle as AlertWarning,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import type { StockMover } from "../lib/types";
import {
  scoreStock,
  filterAndSortResults,
  detectGapStocks,
  defaultScreenerSettings,
  type ScreenerSettings,
  type ScreenerResult,
} from "../lib/intradayScreener";

async function deleteStock(id: string, onSuccess: () => void) {
  if (!confirm("Delete this stock record?")) return;
  try {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-stock-mover`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      }
    );
    const data = await resp.json();
    if (!resp.ok || !data.success) throw new Error(data.error ?? `HTTP ${resp.status}`);
    onSuccess();
  } catch (e) {
    alert(e instanceof Error ? e.message : "Delete failed");
  }
}

function getISTTime() {
  return new Date().toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function getISTDate() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    .toISOString()
    .split("T")[0];
}

function fmt(n: number | null | undefined, dec = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtVol(n: number | null | undefined) {
  if (n == null || n === 0) return "—";
  if (n >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(2)} L`;
  return n.toLocaleString("en-IN");
}

function CriterionBadge({ criterion }: { criterion: ScreenerResult["criteria"][0] }) {
  const statusConfig = {
    pass: { icon: <CheckCircle size={14} />, cls: "text-emerald-400", bg: "bg-emerald-900/30" },
    partial: { icon: <AlertCircle size={14} />, cls: "text-amber-400", bg: "bg-amber-900/30" },
    fail: { icon: <XCircle size={14} />, cls: "text-red-400", bg: "bg-red-900/30" },
    none: { icon: <AlertCircle size={14} />, cls: "text-slate-500", bg: "bg-slate-800/30" },
  };

  const config = statusConfig[criterion.status];

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${config.bg}`}>
      <span className={config.cls}>{config.icon}</span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white">{criterion.name}</span>
          {criterion.isMustPass && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-red-900/50 text-red-300 border border-red-800">MUST</span>
          )}
        </div>
        <p className="text-xs text-slate-400">{criterion.value}</p>
      </div>
      <div className="text-right">
        <span className={`text-sm font-bold ${criterion.points > 0 ? "text-emerald-400" : "text-slate-500"}`}>
          {criterion.points}
        </span>
        <span className="text-xs text-slate-600">/{criterion.maxPoints}</span>
      </div>
    </div>
  );
}

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = (score / maxScore) * 100;
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StockCard({
  result,
  expanded,
  onToggle,
  onDeleted,
}: {
  result: ScreenerResult;
  expanded: boolean;
  onToggle: () => void;
  onDeleted: () => void;
}) {
  const isYes = result.recommendation === "YES";
  const scorePct = (result.score / result.maxScore) * 100;

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all ${
        isYes
          ? "border-emerald-800/60 bg-gradient-to-br from-emerald-950/30 to-slate-900"
          : "border-red-800/60 bg-gradient-to-br from-red-950/20 to-slate-900"
      }`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
      >
        {/* Recommendation Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm ${
            isYes
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {isYes ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {result.recommendation}
        </div>

        {/* Stock info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white font-semibold truncate">{result.stock.company_name}</p>
            <span className="text-xs text-slate-500">{result.stock.symbol}</span>
            {(result.stock.symbol.includes("NIFTY") || result.category === "Bank Nifty") && (
              <Star size={12} className="text-amber-400 fill-amber-400" />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-white font-mono">₹{fmt(result.stock.price)}</span>
            <span className={`text-sm font-mono font-semibold ${result.stock.pct_change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {result.stock.pct_change >= 0 ? "+" : ""}{result.stock.pct_change.toFixed(2)}%
            </span>
            <span className="text-xs text-slate-500">{result.category}</span>
          </div>
        </div>

        {/* Score */}
        <div className="text-right">
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${isYes ? "text-emerald-400" : "text-red-400"}`}>
              {result.score}
            </span>
            <span className="text-slate-500 text-sm">/{result.maxScore}</span>
          </div>
          <div className="w-24">
            <ScoreBar score={result.score} maxScore={result.maxScore} />
          </div>
        </div>

        {/* Expand icon */}
        {expanded ? (
          <ChevronDown size={18} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-slate-400 shrink-0" />
        )}

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteStock(result.stock.id, onDeleted);
          }}
          className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800/60">
          {/* Criteria breakdown */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {result.criteria.map((c, i) => (
              <CriterionBadge key={i} criterion={c} />
            ))}
          </div>

          {/* Red Flags */}
          {result.redFlags.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-red-900/20 border border-red-900/40">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-red-400" />
                <span className="text-xs font-semibold text-red-300">Red Flags</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.redFlags.map((flag, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded bg-red-900/40 text-red-300">
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Entry Zone */}
          {result.entryZone && isYes && (
            <div className="mt-3 p-3 rounded-lg bg-emerald-900/20 border border-emerald-900/40">
              <div className="flex items-center gap-2 mb-2">
                <Target size={14} className="text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300">Entry Zone</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Entry</span>
                  <p className="text-white font-mono">₹{fmt(result.entryZone.min)} - ₹{fmt(result.entryZone.max)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Stop Loss</span>
                  <p className="text-red-400 font-mono">₹{fmt(result.entryZone.stopLoss)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Target</span>
                  <p className="text-emerald-400 font-mono">₹{fmt(result.entryZone.target)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Risk:Reward</span>
                  <p className="text-white font-mono">1:1.5</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FilterParams {
  priceMin: number;
  priceMax: number;
  pctMin: number;
  volumeMin: number;
  market: "ALL" | "NSE" | "BSE";
  sector: string;
}

function PreMarketPanel({
  stocks,
  filters,
  onStockClick
}: {
  stocks: StockMover[];
  filters: FilterParams;
  onStockClick: (s: StockMover) => void;
}) {
  const [open, setOpen] = useState(true);

  // Apply filters before detecting gaps
  const filteredStocks = useMemo(() => {
    return stocks.filter(s => {
      if (s.price < filters.priceMin || s.price > filters.priceMax) return false;
      if (Math.abs(s.pct_change) < filters.pctMin) return false;
      if ((s.volume || 0) < filters.volumeMin) return false;
      if (filters.market !== "ALL" && s.exchange !== filters.market) return false;
      if (filters.sector && s.sector !== filters.sector) return false;
      return true;
    });
  }, [stocks, filters]);

  const gaps = useMemo(() => detectGapStocks(filteredStocks), [filteredStocks]);

  return (
    <div className="mb-5 rounded-xl border border-amber-800/60 bg-gradient-to-br from-amber-950/30 to-slate-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-900/70 flex items-center justify-center">
            <Zap size={15} className="text-amber-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">Pre-Market Scan</p>
            <p className="text-xs text-amber-300/70">Gap-ups, gap-downs & fresh breakouts</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {gaps.gainers.length} up · {gaps.losers.length} down · {gaps.breakouts.length} breakouts
          </span>
          {open ? (
            <ChevronDown size={16} className="text-slate-400" />
          ) : (
            <ChevronRight size={16} className="text-slate-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-amber-900/40 px-4 py-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Gap-ups */}
            <div>
              <h4 className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1">
                <TrendingUp size={12} /> Gap-Ups ({gaps.gainers.length})
              </h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {gaps.gainers.slice(0, 10).map(s => (
                  <button
                    key={s.id}
                    onClick={() => onStockClick(s)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800/40 transition-colors"
                  >
                    <p className="text-xs text-white truncate">{s.company_name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-emerald-400 font-mono">+{s.pct_change.toFixed(2)}%</p>
                      <p className="text-xs text-slate-500">₹{fmt(s.price, 0)}</p>
                    </div>
                  </button>
                ))}
                {gaps.gainers.length === 0 && (
                  <p className="text-xs text-slate-500 italic">No gap-ups detected</p>
                )}
              </div>
            </div>

            {/* Gap-downs */}
            <div>
              <h4 className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1">
                <TrendingDown size={12} /> Gap-Downs ({gaps.losers.length})
              </h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {gaps.losers.slice(0, 10).map(s => (
                  <button
                    key={s.id}
                    onClick={() => onStockClick(s)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800/40 transition-colors"
                  >
                    <p className="text-xs text-white truncate">{s.company_name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-red-400 font-mono">{s.pct_change.toFixed(2)}%</p>
                      <p className="text-xs text-slate-500">₹{fmt(s.price, 0)}</p>
                    </div>
                  </button>
                ))}
                {gaps.losers.length === 0 && (
                  <p className="text-xs text-slate-500 italic">No gap-downs detected</p>
                )}
              </div>
            </div>

            {/* Breakouts */}
            <div>
              <h4 className="text-xs font-semibold text-purple-400 mb-2 flex items-center gap-1">
                <Flame size={12} /> Breakouts ({gaps.breakouts.length})
              </h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {gaps.breakouts.slice(0, 10).map(s => (
                  <button
                    key={s.id}
                    onClick={() => onStockClick(s)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800/40 transition-colors"
                  >
                    <p className="text-xs text-white truncate">{s.company_name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-purple-400 font-mono">
                        {s.pct_change >= 0 ? "+" : ""}{s.pct_change.toFixed(2)}%
                      </p>
                      <p className="text-xs text-slate-500">₹{fmt(s.price, 0)}</p>
                      <p className="text-xs text-slate-600">{fmtVol(s.volume)}</p>
                    </div>
                  </button>
                ))}
                {gaps.breakouts.length === 0 && (
                  <p className="text-xs text-slate-500 italic">No breakouts detected</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntradayScreener() {
  const [stocks, setStocks] = useState<StockMover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ScreenerSettings>(defaultScreenerSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [istTime, setISTTime] = useState(getISTTime());
  const [sectors, setSectors] = useState<string[]>([]);
  const [filterRec, setFilterRec] = useState<"all" | "yes" | "no">("all");
  const [filterMarket, setFilterMarket] = useState<"ALL" | "NSE" | "BSE">("ALL");
  const [filterSector, setFilterSector] = useState("");
  const [filterPriceMin, setFilterPriceMin] = useState(200);
  const [filterPriceMax, setFilterPriceMax] = useState(300);
  const [filterPctMin, setFilterPctMin] = useState(0);
  const [filterVolumeMin, setFilterVolumeMin] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setISTTime(getISTTime()), 1000);
    return () => clearInterval(t);
  }, []);

  const [dataDate, setDataDate] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = getISTDate();
      let effectiveDate = today;

      // Try today first
      let { data, error: fetchErr } = await supabase
        .from("stock_movers")
        .select("*")
        .eq("date", today)
        .order("pct_change", { ascending: false })
        .limit(500);

      if (fetchErr) throw fetchErr;

      // If no data for today, get the most recent date's data
      if (!data || data.length === 0) {
        const { data: latestDateRow } = await supabase
          .from("stock_movers")
          .select("date")
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestDateRow?.date) {
          effectiveDate = latestDateRow.date;
          const { data: fallbackData, error: fallbackErr } = await supabase
            .from("stock_movers")
            .select("*")
            .eq("date", effectiveDate)
            .order("pct_change", { ascending: false })
            .limit(500);

          if (fallbackErr) throw fallbackErr;
          data = fallbackData;
        }
      }

      setStocks(data ?? []);
      setDataDate(effectiveDate);

      const uniqueSectors = [...new Set((data ?? []).map(s => s.sector).filter((s): s is string => !!s))].sort();
      setSectors(uniqueSectors);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const today = getISTDate();
  const isStaleData = dataDate && dataDate !== today;

  // Score all stocks
  const scoredResults = useMemo(() => {
    return stocks.map(s => scoreStock(s, settings));
  }, [stocks, settings]);

  // Filter and sort
  const filteredResults = useMemo(() => {
    return scoredResults
      .filter(r => {
        if (filterRec === "yes" && r.recommendation !== "YES") return false;
        if (filterRec === "no" && r.recommendation !== "NO") return false;
        if (filterMarket !== "ALL" && r.stock.exchange !== filterMarket) return false;
        if (filterSector && r.stock.sector !== filterSector) return false;
        if (r.stock.price < filterPriceMin || r.stock.price > filterPriceMax) return false;
        if (Math.abs(r.stock.pct_change) < filterPctMin) return false;
        if ((r.stock.volume || 0) < filterVolumeMin) return false;
        if (r.stock.price < settings.minPrice) return false;
        if (r.score < settings.minScore && filterRec === "yes") return false;
        return true;
      })
      .sort((a, b) => {
        if (a.recommendation !== b.recommendation) {
          return a.recommendation === "YES" ? -1 : 1;
        }
        return b.score - a.score;
      });
  }, [scoredResults, filterRec, filterMarket, filterSector, filterPriceMin, filterPriceMax, filterPctMin, filterVolumeMin, settings]);

  const yesCount = filteredResults.filter(r => r.recommendation === "YES").length;
  const noCount = filteredResults.filter(r => r.recommendation === "NO").length;

  const handleStockClick = (s: StockMover) => {
    const result = scoredResults.find(r => r.stock.id === s.id);
    if (result) {
      setExpandedId(result.stock.id);
    }
  };

  const exportCSV = () => {
    const headers = ["Stock", "Symbol", "Price", "Change%", "Score", "Recommendation", "Category", "Volume"];
    const rows = filteredResults.map(r => [
      r.stock.company_name,
      r.stock.symbol,
      r.stock.price,
      r.stock.pct_change.toFixed(2),
      r.score,
      r.recommendation,
      r.category,
      r.stock.volume,
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intraday-screener-${getISTDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters = filterPriceMin !== 200 || filterPriceMax !== 300 || filterPctMin > 0 || filterVolumeMin > 0 || filterMarket !== "ALL" || filterSector;

  const resetFilters = () => {
    setFilterMarket("ALL");
    setFilterSector("");
    setFilterPriceMin(200);
    setFilterPriceMax(300);
    setFilterPctMin(0);
    setFilterVolumeMin(0);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap size={24} className="text-amber-400" />
            Intraday Stock Screener
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            6-point scoring system for intraday stock selection
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock size={11} /> IST: {istTime}
            </span>
            <span className="text-slate-700">|</span>
            <span>
              Scored: <span className="text-slate-300">{filteredResults.length}</span> stocks
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-emerald-400">{yesCount} YES</span>
            <span className="text-red-400">{noCount} NO</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            disabled={filteredResults.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm transition-colors disabled:opacity-30"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              showSettings ? "bg-purple-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Settings size={14} />
            Settings
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Settings size={14} />
            Screener Settings
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Min Volume (M)</label>
              <input
                type="number"
                value={settings.minVolume / 1000000}
                onChange={e => setSettings(s => ({ ...s, minVolume: parseFloat(e.target.value) * 1000000 }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Min ATR %</label>
              <input
                type="number"
                step="0.1"
                value={settings.minATR}
                onChange={e => setSettings(s => ({ ...s, minATR: parseFloat(e.target.value) || 1.5 }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Min Price (₹)</label>
              <input
                type="number"
                value={settings.minPrice}
                onChange={e => setSettings(s => ({ ...s, minPrice: parseInt(e.target.value) || 50 }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Min Score</label>
              <input
                type="number"
                value={settings.minScore}
                onChange={e => setSettings(s => ({ ...s, minScore: parseInt(e.target.value) || 70 }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Timeframe</label>
              <select
                value={settings.timeframe}
                onChange={e => setSettings(s => ({ ...s, timeframe: e.target.value as "5min" | "15min" | "1hour" }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
              >
                <option value="5min">5 min</option>
                <option value="15min">15 min</option>
                <option value="1hour">1 hour</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
            <Info size={12} />
            Changes affect scoring algorithm for all stocks
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Stale data warning */}
      {isStaleData && (
        <div className="mb-4 flex items-start gap-2 bg-amber-900/30 border border-amber-700 rounded-lg px-4 py-3 text-amber-300 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Showing data from <strong>{new Date(dataDate!).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</strong>.
            Today's data not yet available. Data is auto-fetched at 5 PM IST on trading days.
          </span>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setShowFilters(s => !s)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            showFilters || hasActiveFilters
              ? "bg-emerald-700 text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Filter size={14} />
          Filters
          {hasActiveFilters && (
            <span className="w-4 h-4 rounded-full bg-white text-emerald-800 text-xs flex items-center justify-center font-bold">!</span>
          )}
        </button>

        {(filterPriceMin !== 200 || filterPriceMax !== 300) && (
          <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-2 rounded-lg">
            Price: ₹{filterPriceMin}–₹{filterPriceMax}
          </span>
        )}

        {filterPctMin > 0 && (
          <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-2 rounded-lg">
            Change: ≥{filterPctMin}%
          </span>
        )}

        {filterVolumeMin > 0 && (
          <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-2 rounded-lg">
            Volume: ≥{(filterVolumeMin / 1000000).toFixed(1)}M
          </span>
        )}

        {filterMarket !== "ALL" && (
          <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-2 rounded-lg">
            Market: {filterMarket}
          </span>
        )}

        {filterSector && (
          <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-2 rounded-lg">
            Sector: {filterSector}
          </span>
        )}

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={12} /> Reset
          </button>
        )}

        <div className="flex-1" />

        {/* Recommendation tabs */}
        {(["all", "yes", "no"] as const).map(rec => (
          <button
            key={rec}
            onClick={() => setFilterRec(rec)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterRec === rec
                ? rec === "yes" ? "bg-emerald-600 text-white" : rec === "no" ? "bg-red-600 text-white" : "bg-slate-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            {rec === "all" ? "All" : rec === "yes" ? "YES" : "NO"}
            {rec === "yes" && ` (${yesCount})`}
            {rec === "no" && ` (${noCount})`}
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">Filter Options</h3>
          <div className="flex flex-col gap-4">
            {/* % Change filter */}
            <div>
              <label className="block text-xs text-slate-500 mb-2">Min % Change (absolute)</label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={filterPctMin}
                  onChange={e => setFilterPctMin(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-600"
                />
                <div className="flex gap-1 flex-wrap">
                  {[1, 2, 3, 5, 8, 10].map(p => (
                    <button
                      key={p}
                      onClick={() => setFilterPctMin(p)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${
                        filterPctMin === p ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {p}%+
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Price range */}
            <div className="pt-3 border-t border-slate-800">
              <label className="block text-xs text-slate-500 mb-2">Price Range (₹)</label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Min</label>
                  <input
                    type="number"
                    value={filterPriceMin}
                    onChange={e => setFilterPriceMin(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Max</label>
                  <input
                    type="number"
                    value={filterPriceMax}
                    onChange={e => setFilterPriceMax(Math.max(filterPriceMin, parseInt(e.target.value) || 10000))}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {[100, 200, 300, 500, 1000, 5000].map(preset => (
                    <button
                      key={preset}
                      onClick={() => { setFilterPriceMin(preset); setFilterPriceMax(preset + 100); }}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        filterPriceMin === preset && filterPriceMax === preset + 100
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      ₹{preset}–{preset + 100}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Volume filter */}
            <div className="pt-3 border-t border-slate-800">
              <label className="block text-xs text-slate-500 mb-2">Min Volume</label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number"
                  min={0}
                  step={100000}
                  value={filterVolumeMin}
                  onChange={e => setFilterVolumeMin(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-600"
                />
                <div className="flex gap-1 flex-wrap">
                  {[500000, 1000000, 2000000, 5000000, 10000000].map(v => (
                    <button
                      key={v}
                      onClick={() => setFilterVolumeMin(v)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${
                        filterVolumeMin === v ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}K`}+
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Market & Sector */}
            <div className="pt-3 border-t border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-2">Market</label>
                  <div className="flex gap-1 flex-wrap">
                    {(["ALL", "NSE", "BSE"] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setFilterMarket(m)}
                        className={`px-3 py-1.5 text-xs rounded transition-colors ${
                          filterMarket === m ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        {m === "ALL" ? "All Markets" : m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-2">Sector</label>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => setFilterSector("")}
                      className={`px-3 py-1.5 text-xs rounded transition-colors ${
                        filterSector === "" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      All Sectors
                    </button>
                    {sectors.slice(0, 8).map(s => (
                      <button
                        key={s}
                        onClick={() => setFilterSector(s)}
                        className={`px-3 py-1.5 text-xs rounded transition-colors ${
                          filterSector === s ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                    {sectors.length > 8 && (
                      <select
                        value={filterSector}
                        onChange={e => setFilterSector(e.target.value)}
                        className="px-3 py-1.5 text-xs rounded bg-slate-800 text-slate-400 border-none focus:outline-none"
                      >
                        <option value="">More sectors...</option>
                        {sectors.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Showing {filteredResults.length} stocks ({yesCount} recommended for intraday)
          </p>
        </div>
      )}

      {/* Pre-Market Scan */}
      {!loading && stocks.length > 0 && (
        <PreMarketPanel
          stocks={stocks}
          filters={{
            priceMin: filterPriceMin,
            priceMax: filterPriceMax,
            pctMin: filterPctMin,
            volumeMin: filterVolumeMin,
            market: filterMarket,
            sector: filterSector,
          }}
          onStockClick={handleStockClick}
        />
      )}

      {/* Results */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-slate-600" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredResults.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
              <Shield size={32} className="text-slate-700" />
              <p className="text-sm">No stocks match the current filters.</p>
            </div>
          ) : (
            filteredResults.map(result => (
              <StockCard
                key={result.stock.id}
                result={result}
                expanded={expandedId === result.stock.id}
                onToggle={() => setExpandedId(expandedId === result.stock.id ? null : result.stock.id)}
                onDeleted={loadData}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
