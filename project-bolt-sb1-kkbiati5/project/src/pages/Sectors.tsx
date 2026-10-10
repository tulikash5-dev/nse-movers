import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Factory, Zap, Building2, RefreshCw, TrendingUp, TrendingDown,
  Search, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Minus,
  Plus, Clock,
} from "lucide-react";
import { WATCHLIST } from "../lib/volumeScanner/types";
import type { Instrument } from "../lib/volumeScanner/types";
import { fetchRealCandles } from "../lib/volumeScanner/marketData";
import type { Candle } from "../lib/volumeScanner/types";
import { addToTradeList } from "../lib/tradeList";

type SectorGroup = "power" | "infra" | "manufacturing";

interface StockData {
  instrument: Instrument;
  candles: Candle[];
  loading: boolean;
  error: string | null;
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

const SECTOR_MAP: Record<SectorGroup, { label: string; icon: typeof Zap; color: string; sectors: string[] }> = {
  power: {
    label: "Power & Energy",
    icon: Zap,
    color: "amber",
    sectors: ["Power", "Energy"],
  },
  infra: {
    label: "Infrastructure",
    icon: Building2,
    color: "cyan",
    sectors: ["Construction", "Cement", "Realty"],
  },
  manufacturing: {
    label: "Manufacturing & Industrial",
    icon: Factory,
    color: "orange",
    sectors: ["Metal", "Equipment", "Defense", "Auto", "Auto Ancillary", "Paints", "Chemicals"],
  },
};

function getStocksForSectorGroup(group: SectorGroup): Instrument[] {
  const sectorSet = new Set(SECTOR_MAP[group].sectors);
  return WATCHLIST.filter((w) => sectorSet.has(w.sector));
}

function MiniLineChart({ candles, height = 120 }: { candles: Candle[]; height?: number }) {
  const width = 320;
  const padding = { top: 8, right: 50, bottom: 18, left: 4 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recent = candles.filter((c) => new Date(c.date) >= sixMonthsAgo);

  if (recent.length < 2) {
    return (
      <div className="flex items-center justify-center text-slate-600 text-xs" style={{ height }}>
        Not enough data
      </div>
    );
  }

  const closes = recent.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const pad = range * 0.08;

  const yScale = (p: number) => padding.top + chartH - ((p - (min - pad)) / (range + 2 * pad)) * chartH;
  const xScale = (i: number) => padding.left + (i / (recent.length - 1)) * chartW;

  const isUp = closes[closes.length - 1] >= closes[0];
  const lineColor = isUp ? "#10b981" : "#ef4444";
  const fillColor = isUp ? "#10b98115" : "#ef444415";

  const linePath = closes.map((c, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(c).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${xScale(closes.length - 1).toFixed(1)} ${padding.top + chartH} L ${xScale(0).toFixed(1)} ${padding.top + chartH} Z`;

  const firstPrice = closes[0];
  const lastPrice = closes[closes.length - 1];
  const changePct = ((lastPrice - firstPrice) / firstPrice) * 100;

  return (
    <svg width={width} height={height} className="w-full">
      <defs>
        <linearGradient id={`grad-${isUp ? "up" : "down"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Grid */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={padding.left} y1={padding.top + chartH * f} x2={padding.left + chartW} y2={padding.top + chartH * f} stroke="#1e293b" strokeWidth={0.5} />
      ))}
      {/* Area */}
      <path d={areaPath} fill={`url(#grad-${isUp ? "up" : "down"})`} />
      {/* Line */}
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth={1.5} />
      {/* Last price dot */}
      <circle cx={xScale(closes.length - 1)} cy={yScale(lastPrice)} r={3} fill={lineColor} />
      {/* Price label */}
      <text x={padding.left + chartW + 4} y={yScale(lastPrice) + 3} fill={isUp ? "#10b981" : "#ef4444"} fontSize={9} fontWeight="bold">
        ₹{lastPrice >= 1000 ? lastPrice.toFixed(0) : lastPrice.toFixed(2)}
      </text>
      {/* Change badge */}
      <text x={padding.left + chartW + 4} y={padding.top + 10} fill={isUp ? "#10b981" : "#ef4444"} fontSize={8} fontWeight="bold">
        {isUp ? "+" : ""}{changePct.toFixed(1)}%
      </text>
      {/* X-axis dates */}
      {[0, Math.floor(recent.length / 2), recent.length - 1].map((i) => {
        if (i >= recent.length) return null;
        const d = new Date(recent[i].date);
        return (
          <text key={i} x={xScale(i)} y={height - 4} fill="#475569" fontSize={8} textAnchor="middle">
            {d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
          </text>
        );
      })}
    </svg>
  );
}

function StockCard({ data, onAddToTrade }: { data: StockData; onAddToTrade: (d: StockData) => void }) {
  const { instrument, candles, loading, error } = data;

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-3" />
        <div className="h-3 bg-slate-800 rounded w-1/2 mb-4" />
        <div className="h-28 bg-slate-800/50 rounded" />
      </div>
    );
  }

  if (error || candles.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-white font-medium text-sm">{instrument.symbol}</p>
          <span className="text-xs text-slate-600">{instrument.name}</span>
        </div>
        <p className="text-red-400 text-xs">{error ?? "No data available"}</p>
      </div>
    );
  }

  const lastCandle = candles[candles.length - 1];
  const prevClose = candles.length > 1 ? candles[candles.length - 2].close : lastCandle.close;
  const dayChange = lastCandle.close - prevClose;
  const dayChangePct = prevClose ? (dayChange / prevClose) * 100 : 0;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMoCandles = candles.filter((c) => new Date(c.date) >= sixMonthsAgo);
  const sixMoStart = sixMoCandles.length > 0 ? sixMoCandles[0].close : lastCandle.close;
  const sixMoChangePct = ((lastCandle.close - sixMoStart) / sixMoStart) * 100;

  const avgVol20 = sixMoCandles.length >= 20
    ? sixMoCandles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20
    : candles.slice(-20).reduce((s, c) => s + c.volume, 0) / Math.min(20, candles.length);

  const high6m = Math.max(...sixMoCandles.map((c) => c.high));
  const low6m = Math.min(...sixMoCandles.map((c) => c.low));

  const isUp = dayChange >= 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-white font-bold text-sm">{instrument.symbol}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${instrument.sector === "Power" ? "bg-amber-900/30 border-amber-800 text-amber-400" : instrument.sector === "Energy" ? "bg-orange-900/30 border-orange-800 text-orange-400" : "bg-slate-800 border-slate-700 text-slate-400"}`}>
              {instrument.sector}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{instrument.name}</p>
        </div>
        <div className="text-right">
          <p className="text-white font-mono text-sm font-bold">₹{fmt(lastCandle.close)}</p>
          <p className={`text-xs font-mono ${isUp ? "text-emerald-400" : "text-red-400"}`}>
            {isUp ? "+" : ""}{fmt(dayChange)} ({isUp ? "+" : ""}{fmt(dayChangePct)}%)
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-3">
        <MiniLineChart candles={sixMoCandles.length > 0 ? sixMoCandles : candles} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="bg-slate-800/40 rounded-lg px-2 py-1.5">
          <p className="text-[10px] text-slate-500">6M High</p>
          <p className="text-xs text-white font-mono">₹{fmt(high6m)}</p>
        </div>
        <div className="bg-slate-800/40 rounded-lg px-2 py-1.5">
          <p className="text-[10px] text-slate-500">6M Low</p>
          <p className="text-xs text-white font-mono">₹{fmt(low6m)}</p>
        </div>
        <div className="bg-slate-800/40 rounded-lg px-2 py-1.5">
          <p className="text-[10px] text-slate-500">6M Chg</p>
          <p className={`text-xs font-mono font-medium ${sixMoChangePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {sixMoChangePct >= 0 ? "+" : ""}{fmt(sixMoChangePct)}%
          </p>
        </div>
        <div className="bg-slate-800/40 rounded-lg px-2 py-1.5">
          <p className="text-[10px] text-slate-500">Avg Vol</p>
          <p className="text-xs text-slate-300 font-mono">{fmtVolume(avgVol20)}</p>
        </div>
      </div>

      {/* Add to trade */}
      <button
        onClick={() => onAddToTrade(data)}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/40 border border-emerald-800 text-emerald-400 text-xs font-medium hover:bg-emerald-800/50 transition-colors"
      >
        <Plus size={12} /> Add to Trade Today
      </button>
    </div>
  );
}

type SortKey = "ticker" | "close" | "dayChangePct" | "sixMoChangePct" | "avgVol";
type SortDir = "asc" | "desc";

export default function Sectors() {
  const [activeGroup, setActiveGroup] = useState<SectorGroup>("power");
  const [stockData, setStockData] = useState<Map<string, StockData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sixMoChangePct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [toast, setToast] = useState<string | null>(null);
  const [expandedView, setExpandedView] = useState(false);

  const instruments = useMemo(() => getStocksForSectorGroup(activeGroup), [activeGroup]);

  const loadData = useCallback(async (group: SectorGroup) => {
    setLoading(true);
    const stocks = getStocksForSectorGroup(group);
    const initial = new Map<string, StockData>();
    for (const inst of stocks) {
      initial.set(inst.symbol, { instrument: inst, candles: [], loading: true, error: null });
    }
    setStockData(initial);

    const BATCH = 6;
    for (let i = 0; i < stocks.length; i += BATCH) {
      const batch = stocks.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map(async (inst) => {
          const candles = await fetchRealCandles(inst.symbol, "1y", "1d");
          return { symbol: inst.symbol, candles };
        }),
      );
      setStockData((prev) => {
        const next = new Map(prev);
        for (let j = 0; j < batch.length; j++) {
          const inst = batch[j];
          const r = settled[j];
          if (r && r.status === "fulfilled") {
            next.set(r.value.symbol, { instrument: inst, candles: r.value.candles, loading: false, error: null });
          } else {
            const errMsg = r && r.status === "rejected" && r.reason instanceof Error ? r.reason.message : "Failed to fetch";
            next.set(inst.symbol, { instrument: inst, candles: [], loading: false, error: errMsg });
          }
        }
        return next;
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(activeGroup);
  }, [activeGroup, loadData]);

  const filteredAndSorted = useMemo(() => {
    const stocks = Array.from(stockData.values()).filter((s) => {
      if (s.loading || s.candles.length === 0) return false;
      const avgVol = s.candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / Math.min(20, s.candles.length);
      return avgVol >= 10_000_000;
    });
    let result = stocks;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.instrument.symbol.toLowerCase().includes(q) || s.instrument.name.toLowerCase().includes(q));
    }

    const getVal = (s: StockData): number | string => {
      switch (sortKey) {
        case "ticker": return s.instrument.symbol;
        case "close": return s.candles[s.candles.length - 1].close;
        case "dayChangePct": {
          const last = s.candles[s.candles.length - 1];
          const prev = s.candles[s.candles.length - 2]?.close ?? last.close;
          return prev ? ((last.close - prev) / prev) * 100 : 0;
        }
        case "sixMoChangePct": {
          const last = s.candles[s.candles.length - 1].close;
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          const start = s.candles.find((c) => new Date(c.date) >= sixMonthsAgo)?.close ?? s.candles[0].close;
          return ((last - start) / start) * 100;
        }
        case "avgVol": {
          const recent = s.candles.slice(-20);
          return recent.reduce((sum, c) => sum + c.volume, 0) / recent.length;
        }
      }
    };

    return [...result].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [stockData, searchQuery, sortKey, sortDir]);

  const sectorStats = useMemo(() => {
    const stocks = Array.from(stockData.values()).filter((s) => {
      if (s.loading || s.candles.length === 0) return false;
      const avgVol = s.candles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / Math.min(20, s.candles.length);
      return avgVol >= 10_000_000;
    });
    if (stocks.length === 0) return null;
    const gains = stocks.filter((s) => {
      const last = s.candles[s.candles.length - 1].close;
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const start = s.candles.find((c) => new Date(c.date) >= sixMonthsAgo)?.close ?? s.candles[0].close;
      return last > start;
    }).length;
    const avgChange = stocks.reduce((sum, s) => {
      const last = s.candles[s.candles.length - 1].close;
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const start = s.candles.find((c) => new Date(c.date) >= sixMonthsAgo)?.close ?? s.candles[0].close;
      return sum + ((last - start) / start) * 100;
    }, 0) / stocks.length;
    return { total: stocks.length, gainers: gains, losers: stocks.length - gains, avgChange };
  }, [stockData]);

  async function handleAddToTrade(d: StockData) {
    const last = d.candles[d.candles.length - 1].close;
    const prev = d.candles[d.candles.length - 2]?.close ?? last;
    const direction: "LONG" | "SHORT" = last >= prev ? "LONG" : "SHORT";
    const result = await addToTradeList(d.instrument.symbol, direction, "sectors", last);
    setToast(result.success ? `Added ${d.instrument.symbol} to Trade Today` : (result.error ?? "Failed to add"));
    setTimeout(() => setToast(null), 2500);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const groupConfig = SECTOR_MAP[activeGroup];
  const GroupIcon = groupConfig.icon;

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-lg bg-${groupConfig.color}-600 flex items-center justify-center`}>
            <GroupIcon size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Sector Analysis</h1>
            <p className="text-slate-400 text-sm">Power, Infrastructure & Manufacturing stocks with 6-month charts</p>
          </div>
        </div>
        <button
          onClick={() => loadData(activeGroup)}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <><RefreshCw size={14} className="animate-spin" /> Loading…</> : <><RefreshCw size={14} /> Refresh Data</>}
        </button>
      </div>

      {/* Sector Group Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(Object.keys(SECTOR_MAP) as SectorGroup[]).map((key) => {
          const cfg = SECTOR_MAP[key];
          const Icon = cfg.icon;
          const count = getStocksForSectorGroup(key).length;
          return (
            <button
              key={key}
              onClick={() => setActiveGroup(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                activeGroup === key
                  ? `bg-${cfg.color}-900/40 border-${cfg.color}-600 text-${cfg.color}-300`
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
              }`}
            >
              <Icon size={16} />
              {cfg.label}
              <span className="text-xs text-slate-500 ml-1">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Sector Stats */}
      {sectorStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-slate-500"><Factory size={16} /></span>
              <span className="text-xs text-slate-500">Total Stocks</span>
            </div>
            <p className="text-lg font-bold text-white">{sectorStats.total}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-emerald-400" />
              <span className="text-xs text-slate-500">6M Gainers</span>
            </div>
            <p className="text-lg font-bold text-emerald-400">{sectorStats.gainers}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={16} className="text-red-400" />
              <span className="text-xs text-slate-500">6M Losers</span>
            </div>
            <p className="text-lg font-bold text-red-400">{sectorStats.losers}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-slate-500"><Clock size={16} /></span>
              <span className="text-xs text-slate-500">Avg 6M Return</span>
            </div>
            <p className={`text-lg font-bold ${sectorStats.avgChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {sectorStats.avgChange >= 0 ? "+" : ""}{sectorStats.avgChange.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ticker or name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Sort:</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="sixMoChangePct">6M Return</option>
            <option value="dayChangePct">Day Change</option>
            <option value="close">Price</option>
            <option value="avgVol">Avg Volume</option>
            <option value="ticker">Ticker A-Z</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="px-2 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            {sortDir === "desc" ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
        <button
          onClick={() => setExpandedView((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-sm"
        >
          {expandedView ? "Grid View" : "Table View"}
        </button>
      </div>

      {/* Content */}
      {loading && stockData.size === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={32} className="animate-spin text-blue-500" />
            <p className="text-slate-400 text-sm">Fetching real market data for {instruments.length} stocks…</p>
          </div>
        </div>
      ) : expandedView ? (
        /* Table View */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th onClick={() => handleSort("ticker")} className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide cursor-pointer hover:text-slate-300 whitespace-nowrap">Ticker</th>
                  <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">Sector</th>
                  <th onClick={() => handleSort("close")} className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-right uppercase tracking-wide cursor-pointer hover:text-slate-300 whitespace-nowrap">Price</th>
                  <th onClick={() => handleSort("dayChangePct")} className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-right uppercase tracking-wide cursor-pointer hover:text-slate-300 whitespace-nowrap">Day %</th>
                  <th onClick={() => handleSort("sixMoChangePct")} className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-right uppercase tracking-wide cursor-pointer hover:text-slate-300 whitespace-nowrap">6M %</th>
                  <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-right uppercase tracking-wide whitespace-nowrap">6M High</th>
                  <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-right uppercase tracking-wide whitespace-nowrap">6M Low</th>
                  <th onClick={() => handleSort("avgVol")} className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-right uppercase tracking-wide cursor-pointer hover:text-slate-300 whitespace-nowrap">Avg Vol</th>
                  <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-center uppercase tracking-wide whitespace-nowrap">6M Chart</th>
                  <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-center uppercase tracking-wide whitespace-nowrap">Trade</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((s, i) => {
                  const last = s.candles[s.candles.length - 1];
                  const prev = s.candles[s.candles.length - 2]?.close ?? last.close;
                  const dayPct = prev ? ((last.close - prev) / prev) * 100 : 0;
                  const sixMonthsAgo = new Date();
                  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                  const sixMoCandles = s.candles.filter((c) => new Date(c.date) >= sixMonthsAgo);
                  const start = sixMoCandles[0]?.close ?? last.close;
                  const sixMoPct = ((last.close - start) / start) * 100;
                  const high6m = Math.max(...sixMoCandles.map((c) => c.high));
                  const low6m = Math.min(...sixMoCandles.map((c) => c.low));
                  const avgVol = sixMoCandles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / Math.min(20, sixMoCandles.length);

                  return (
                    <tr key={s.instrument.symbol} className={`border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? "" : "bg-slate-800/10"}`}>
                      <td className="px-3 py-2.5">
                        <p className="text-white font-medium text-xs">{s.instrument.symbol}</p>
                        <p className="text-[10px] text-slate-500">{s.instrument.name}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-800 border-slate-700 text-slate-400">{s.instrument.sector}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-white text-xs whitespace-nowrap">₹{fmt(last.close)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap ${dayPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{dayPct >= 0 ? "+" : ""}{fmt(dayPct)}%</td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap font-medium ${sixMoPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{sixMoPct >= 0 ? "+" : ""}{fmt(sixMoPct)}%</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400 text-xs whitespace-nowrap">₹{fmt(high6m)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400 text-xs whitespace-nowrap">₹{fmt(low6m)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400 text-xs whitespace-nowrap">{fmtVolume(avgVol)}</td>
                      <td className="px-3 py-2.5">
                        <div className="w-48 mx-auto">
                          <MiniLineChart candles={sixMoCandles} height={60} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => handleAddToTrade(s)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-900/40 border border-emerald-700 text-emerald-300 text-[10px] font-medium hover:bg-emerald-800/50 transition-colors whitespace-nowrap"
                        >
                          <Plus size={10} /> Trade
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSorted.map((s) => (
            <StockCard key={s.instrument.symbol} data={s} onAddToTrade={handleAddToTrade} />
          ))}
          {/* Error cards */}
          {Array.from(stockData.values()).filter((s) => !s.loading && s.error).map((s) => (
            <StockCard key={s.instrument.symbol} data={s} onAddToTrade={handleAddToTrade} />
          ))}
          {/* Loading placeholders */}
          {loading && Array.from(stockData.values()).filter((s) => s.loading).map((s) => (
            <StockCard key={s.instrument.symbol} data={s} onAddToTrade={handleAddToTrade} />
          ))}
          {/* Empty state */}
          {!loading && filteredAndSorted.length === 0 && Array.from(stockData.values()).every((s) => !s.loading && s.error) && (
            <div className="col-span-full text-center py-10 text-slate-500">
              <p className="text-sm">Could not fetch market data. Yahoo Finance may be rate-limiting requests.</p>
              <button onClick={() => loadData(activeGroup)} className="mt-3 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">
                Retry
              </button>
            </div>
          )}
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
