import { useEffect, useState, useCallback, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Filter, RefreshCw, X,
  AlertTriangle, ChevronDown, ChevronRight, Flame, ArrowUpRight, ArrowDownRight,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import type { StockMover } from "../lib/types";

interface Filters {
  dateFrom: string;
  dateTo: string;
  sector: string;
  moverType: "all" | "gainer" | "loser";
  threshold: number;
  priceMin: number;
  priceMax: number;
  pctFilter: number;
}

const defaultFilters: Filters = {
  dateFrom: "",
  dateTo: "",
  sector: "",
  moverType: "all",
  threshold: 0,
  priceMin: 200,
  priceMax: 300,
  pctFilter: 5,
};

interface StreakStock {
  symbol: string;
  company_name: string;
  sector: string | null;
  streakDays: number;
  dates: string[];
  priceStart: number;
  priceLast: number;
  totalGain: number;
  lastPctChange: number;
  volume: number;
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

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateShort(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// Compute consecutive gain streaks from all historical data
function computeStreaks(allRows: StockMover[]): StreakStock[] {
  // Group by symbol
  const bySymbol: Record<string, StockMover[]> = {};
  for (const r of allRows) {
    if (r.mover_type === "gainer") {
      if (!bySymbol[r.symbol]) bySymbol[r.symbol] = [];
      bySymbol[r.symbol].push(r);
    }
  }

  const results: StreakStock[] = [];

  for (const [, records] of Object.entries(bySymbol)) {
    // Sort ascending by date
    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

    // Find the current trailing streak (most recent consecutive gain days)
    // Walk backwards from the latest date
    const dates = sorted.map(r => r.date);
    const latestDate = dates[dates.length - 1];

    // Find streak ending at the latest date
    let streakEnd = sorted.length - 1;
    let streakStart = streakEnd;

    // All records here are gainers so we just count consecutive entries
    // But they might not be on consecutive calendar days — that's fine,
    // we check if each gap is trading-day consecutive (≤4 calendar days apart handles weekends/holidays)
    while (streakStart > 0) {
      const prev = new Date(sorted[streakStart - 1].date);
      const curr = new Date(sorted[streakStart].date);
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 4) {
        streakStart--;
      } else {
        break;
      }
    }

    const streakRecords = sorted.slice(streakStart, streakEnd + 1);
    const streakDays = streakRecords.length;
    if (streakDays < 2) continue;

    const first = streakRecords[0];
    const last = streakRecords[streakRecords.length - 1];
    const priceStart = first.prev_close ?? first.price;
    const priceLast = last.price;
    const totalGain = priceStart > 0 ? ((priceLast - priceStart) / priceStart) * 100 : 0;

    results.push({
      symbol: last.symbol,
      company_name: last.company_name,
      sector: last.sector,
      streakDays,
      dates: streakRecords.map(r => r.date),
      priceStart,
      priceLast,
      totalGain,
      lastPctChange: last.pct_change,
      volume: last.volume,
    });
  }

  // Sort by streak length desc, then totalGain desc
  return results.sort((a, b) => b.streakDays - a.streakDays || b.totalGain - a.totalGain);
}

function StreakBadge({ days }: { days: number }) {
  if (days >= 5) return <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 border border-red-700">🔥 {days}d</span>;
  if (days >= 3) return <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-orange-900/60 text-orange-300 border border-orange-700">⚡ {days}d</span>;
  return <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-300 border border-yellow-700">{days}d</span>;
}

type SortKey = "streakDays" | "priceLast" | "totalGain" | "lastPctChange" | "volume";

function ReversalPanel({ allRows, onDeleted }: { allRows: StockMover[]; onDeleted: () => void }) {
  const [open, setOpen] = useState(true);
  const [minStreak, setMinStreak] = useState(2);
  const [localPriceMin, setLocalPriceMin] = useState(0);
  const [localPriceMax, setLocalPriceMax] = useState(100000);
  const [sortKey, setSortKey] = useState<SortKey>("streakDays");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const streaks = useMemo(() => {
    const computed = computeStreaks(allRows);
    const filtered = computed
      .filter(s => s.streakDays >= minStreak)
      .filter(s => s.priceLast >= localPriceMin && s.priceLast <= localPriceMax);

    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allRows, localPriceMin, localPriceMax, minStreak, sortKey, sortDir]);

  function handleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  const hotCount = streaks.filter(s => s.streakDays >= 3).length;

  return (
    <div className="mb-5 rounded-xl border border-orange-800/60 bg-gradient-to-br from-orange-950/40 to-slate-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-900/70 flex items-center justify-center">
            <AlertTriangle size={15} className="text-orange-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">Reversal Watch</p>
            <p className="text-xs text-orange-300/70">Stocks on a consecutive-gain streak — reversal risk rising</p>
          </div>
          {hotCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-700 text-white text-xs font-bold">{hotCount} hot</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{streaks.length} stocks</span>
          {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-orange-900/40">
          {/* Controls */}
          <div className="px-4 py-2.5 flex items-center gap-3 border-b border-slate-800/60 flex-wrap">
            <span className="text-xs text-slate-400">Min streak:</span>
            {[2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setMinStreak(n)}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${minStreak === n ? "bg-orange-700 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
              >
                {n}+ days
              </button>
            ))}
            <div className="flex items-center gap-1 mx-4">
              <span className="text-xs text-slate-400">Price:</span>
              <input
                type="number"
                value={localPriceMin}
                onChange={e => setLocalPriceMin(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500"
              />
              <span className="text-slate-600">–</span>
              <input
                type="number"
                value={localPriceMax}
                onChange={e => setLocalPriceMax(Math.max(localPriceMin, parseInt(e.target.value) || 100000))}
                className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <span className="text-xs text-slate-600 ml-auto">{streaks.length} streaks</span>
          </div>

          {streaks.length === 0 ? (
            <div className="px-4 py-6 text-center text-slate-500 text-sm">No consecutive-gain streaks found for this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-3 py-2 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide">Stock</th>
                    <th onClick={() => handleSort("streakDays")} className="px-3 py-2 text-xs text-slate-500 font-semibold text-center uppercase tracking-wide cursor-pointer select-none hover:text-white transition-colors">
                      <span className="inline-flex items-center gap-1">Streak {sortKey === "streakDays" && (sortDir === "asc" ? "↑" : "↓")}</span>
                    </th>
                    <th onClick={() => handleSort("priceLast")} className="px-3 py-2 text-xs text-slate-500 font-semibold text-right uppercase tracking-wide cursor-pointer select-none hover:text-white transition-colors">
                      <span className="inline-flex items-center gap-1">{sortKey === "priceLast" && (sortDir === "asc" ? "↑" : "↓")} Current Price</span>
                    </th>
                    <th onClick={() => handleSort("totalGain")} className="px-3 py-2 text-xs text-slate-500 font-semibold text-right uppercase tracking-wide cursor-pointer select-none hover:text-white transition-colors">
                      <span className="inline-flex items-center gap-1">{sortKey === "totalGain" && (sortDir === "asc" ? "↑" : "↓")} Total Gain</span>
                    </th>
                    <th onClick={() => handleSort("lastPctChange")} className="px-3 py-2 text-xs text-slate-500 font-semibold text-right uppercase tracking-wide cursor-pointer select-none hover:text-white transition-colors">
                      <span className="inline-flex items-center gap-1">{sortKey === "lastPctChange" && (sortDir === "asc" ? "↑" : "↓")} Last Day %</span>
                    </th>
                    <th className="px-3 py-2 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide">Gain Days</th>
                    <th onClick={() => handleSort("volume")} className="px-3 py-2 text-xs text-slate-500 font-semibold text-right uppercase tracking-wide cursor-pointer select-none hover:text-white transition-colors">
                      <span className="inline-flex items-center gap-1">{sortKey === "volume" && (sortDir === "asc" ? "↑" : "↓")} Volume</span>
                    </th>
                    <th className="px-3 py-2 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide">Sector</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {streaks.map((s, i) => {
                    const riskLevel = s.streakDays >= 5 ? "critical" : s.streakDays >= 3 ? "high" : "moderate";
                    const lastRecord = allRows.find(r => r.symbol === s.symbol && r.date === s.dates[s.dates.length - 1]);
                    return (
                      <tr
                        key={s.symbol}
                        className={`border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? "" : "bg-slate-800/10"}`}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {riskLevel === "critical" && <Flame size={13} className="text-red-400 shrink-0" />}
                            <div>
                              <p className="text-white font-medium truncate max-w-[160px]" title={s.company_name}>{s.company_name}</p>
                              <p className="text-slate-500 text-xs">{s.symbol}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StreakBadge days={s.streakDays} />
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-white">₹{fmt(s.priceLast)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-mono font-semibold text-emerald-400 inline-flex items-center gap-0.5">
                            <ArrowUpRight size={13} strokeWidth={2.5} />
                            {fmt(s.totalGain)}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`font-mono font-semibold inline-flex items-center gap-0.5 ${s.lastPctChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {s.lastPctChange >= 0
                              ? <ArrowUpRight size={13} strokeWidth={2.5} />
                              : <ArrowDownRight size={13} strokeWidth={2.5} />}
                            {Math.abs(s.lastPctChange).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1 flex-wrap">
                            {s.dates.map(d => {
                              const rec = allRows.find(r => r.symbol === s.symbol && r.date === d);
                              const pct = rec ? Math.round(rec.pct_change) : 0;
                              return (
                                <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-900">
                                  {fmtDateShort(d)} {pct > 0 ? '+' : ''}{pct}%
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-400 text-xs">{fmtVol(s.volume)}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[120px] truncate">{s.sector ?? "—"}</td>
                        <td className="px-3 py-2.5">
                          {lastRecord && (
                            <button
                              onClick={() => deleteStock(lastRecord.id, onDeleted)}
                              className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                              title="Delete latest record for this stock"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="px-4 py-2.5 border-t border-slate-800/60 flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>2d streak = watch</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-orange-500"></span>3-4d streak = high reversal risk</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>5d+ streak = critical — reversal likely</span>
          </div>
        </div>
      )}
    </div>
  );
}

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
    if (!resp.ok || !data.success) {
      throw new Error(data.error ?? `HTTP ${resp.status}`);
    }
    onSuccess();
  } catch (e) {
    alert(e instanceof Error ? e.message : "Delete failed");
  }
}

interface LocalFilters {
  priceMin: number;
  priceMax: number;
  pctFilter: number;
}

const defaultLocalFilters: LocalFilters = {
  priceMin: 0,
  priceMax: 100000,
  pctFilter: 0,
};

function DateSection({
  date,
  rows,
  defaultOpen,
  onDeleted,
}: {
  date: string;
  rows: StockMover[];
  defaultOpen: boolean;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const gainers = rows.filter(r => r.mover_type === "gainer");
  const losers = rows.filter(r => r.mover_type === "loser");
  const [tab, setTab] = useState<"all" | "gainer" | "loser">("all");
  const [sortKey, setSortKey] = useState<keyof StockMover>("pct_change");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showLocalFilters, setShowLocalFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState<LocalFilters>(defaultLocalFilters);

  const filteredBase = useMemo(() => {
    const base = tab === "all" ? rows : tab === "gainer" ? gainers : losers;
    return base.filter(r => {
      if (r.price < localFilters.priceMin || r.price > localFilters.priceMax) return false;
      if (tab === "gainer" && localFilters.pctFilter > 0 && r.pct_change < localFilters.pctFilter) return false;
      if (tab === "loser" && localFilters.pctFilter > 0 && r.pct_change > -localFilters.pctFilter) return false;
      if (tab === "all" && localFilters.pctFilter > 0 && Math.abs(r.pct_change) < localFilters.pctFilter) return false;
      return true;
    });
  }, [rows, gainers, losers, tab, localFilters]);

  const displayed = useMemo(() => {
    return [...filteredBase].sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredBase, sortKey, sortDir]);

  function handleSort(k: keyof StockMover) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  const avgGain = gainers.length > 0
    ? gainers.reduce((s, r) => s + r.pct_change, 0) / gainers.length
    : 0;

  const hasLocalFilters = localFilters.priceMin > 0 || localFilters.priceMax < 100000 || localFilters.pctFilter > 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-4">
      {/* Date header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors text-left"
      >
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <span className="font-bold text-white">{fmtDate(date)}</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 border border-emerald-900 font-semibold">
              +{gainers.length} gainers
            </span>
            <span className="px-2 py-0.5 rounded-full bg-red-900/50 text-red-400 border border-red-900 font-semibold">
              -{losers.length} losers
            </span>
            {avgGain > 0 && (
              <span className="text-slate-500">avg gain: <span className="text-emerald-400 font-mono">+{avgGain.toFixed(2)}%</span></span>
            )}
          </div>
        </div>
        {open ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
      </button>

      {open && (
        <>
          {/* Sub tabs + filter button */}
          <div className="flex gap-1 px-4 py-2 border-b border-slate-800 items-center">
            {(["all", "gainer", "loser"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  tab === t
                    ? t === "loser" ? "bg-red-600 text-white" : t === "gainer" ? "bg-emerald-600 text-white" : "bg-slate-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {t === "all" ? `All (${rows.length})` : t === "gainer" ? `Gainers (${gainers.length})` : `Losers (${losers.length})`}
              </button>
            ))}
            <button
              onClick={() => setShowLocalFilters(s => !s)}
              className={`ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                showLocalFilters || hasLocalFilters
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <Filter size={12} /> Filter
            </button>
            {hasLocalFilters && (
              <button
                onClick={() => setLocalFilters(defaultLocalFilters)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Local filter panel */}
          {showLocalFilters && (
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-800/40">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">Price:</span>
                  <input
                    type="number"
                    value={localFilters.priceMin}
                    onChange={e => setLocalFilters(f => ({ ...f, priceMin: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-slate-600">–</span>
                  <input
                    type="number"
                    value={localFilters.priceMax}
                    onChange={e => setLocalFilters(f => ({ ...f, priceMax: Math.max(f.priceMin, parseInt(e.target.value) || 100000) }))}
                    className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">Min %:</span>
                  <input
                    type="number"
                    step={0.5}
                    value={localFilters.pctFilter}
                    onChange={e => setLocalFilters(f => ({ ...f, pctFilter: Math.max(0, parseFloat(e.target.value) || 0) }))}
                    className="w-14 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <span className="text-slate-500 ml-auto">
                  Showing {displayed.length} of {tab === "all" ? rows.length : tab === "gainer" ? gainers.length : losers.length}
                </span>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {(["company_name", "price", "prev_close", "pct_change", "volume"] as const).map(k => {
                    const labels: Record<string, string> = {
                      company_name: "Stock", price: "Price", prev_close: "Prev Close",
                      pct_change: "Change %", volume: "Volume",
                    };
                    const right = k !== "company_name";
                    return (
                      <th
                        key={k}
                        onClick={() => handleSort(k)}
                        className={`px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap ${right ? "text-right" : "text-left"}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {right && sortKey === k && (sortDir === "asc" ? "↑" : "↓")}
                          {labels[k]}
                          {!right && sortKey === k && (sortDir === "asc" ? " ↑" : " ↓")}
                        </span>
                      </th>
                    );
                  })}
                  <th className="px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide w-10"></th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? "" : "bg-slate-800/10"}`}
                  >
                    <td className="px-3 py-2.5">
                      <p className="text-white font-medium truncate max-w-[200px]" title={s.company_name}>{s.company_name}</p>
                      {s.sector && <p className="text-slate-500 text-xs">{s.sector}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-white whitespace-nowrap">₹{fmt(s.price)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400 whitespace-nowrap">₹{fmt(s.prev_close)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <span className={`inline-flex items-center gap-0.5 font-semibold font-mono ${s.pct_change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {s.pct_change >= 0
                          ? <ArrowUpRight size={14} strokeWidth={2.5} />
                          : <ArrowDownRight size={14} strokeWidth={2.5} />}
                        {Math.abs(s.pct_change).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-400 whitespace-nowrap text-xs">{fmtVol(s.volume)}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => deleteStock(s.id, onDeleted)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                        title="Delete this record"
                      >
                        <Trash2 size={14} />
                      </button>
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

export default function History() {
  const [rows, setRows] = useState<StockMover[]>([]);
  const [allRows, setAllRows] = useState<StockMover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sectors, setSectors] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "gainer" | "loser">("all");
  const [view, setView] = useState<"datewise" | "reversal">("datewise");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load filtered rows
      let q = supabase
        .from("stock_movers")
        .select("*")
        .order("date", { ascending: false })
        .order("pct_change", { ascending: false });

      if (filters.dateFrom) q = q.gte("date", filters.dateFrom);
      if (filters.dateTo) q = q.lte("date", filters.dateTo);
      if (filters.sector) q = q.eq("sector", filters.sector);
      if (filters.moverType !== "all") q = q.eq("mover_type", filters.moverType);
      if (activeTab !== "all") q = q.eq("mover_type", activeTab);
      if (filters.threshold > 0) {
        if (activeTab === "loser") q = q.lte("pct_change", -filters.threshold);
        else q = q.gte("pct_change", filters.threshold);
      }

      const { data, error: qErr } = await q.limit(5000);
      if (qErr) throw qErr;

      const fetched = data ?? [];

      // All rows for reversal detection (wider pull — no tab/threshold filter)
      let qAll = supabase
        .from("stock_movers")
        .select("*")
        .eq("mover_type", "gainer")
        .order("date", { ascending: false });
      if (filters.dateFrom) qAll = qAll.gte("date", filters.dateFrom);
      if (filters.dateTo) qAll = qAll.lte("date", filters.dateTo);
      const { data: allData } = await qAll.limit(10000);
      setAllRows(allData ?? []);

      setRows(fetched);
      const uniqueSectors = [...new Set(fetched.map(r => r.sector).filter((s): s is string => !!s))].sort();
      setSectors(uniqueSectors);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [filters, activeTab]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Apply price + pct filter
  const displayed = useMemo(() => {
    const base = activeTab === "all" ? rows : rows.filter(r => r.mover_type === activeTab);
    return base.filter(r => {
      if (r.price < filters.priceMin || r.price > filters.priceMax) return false;
      if (r.mover_type === "gainer" && r.pct_change < filters.pctFilter) return false;
      if (r.mover_type === "loser" && r.pct_change > -filters.pctFilter) return false;
      return true;
    });
  }, [rows, activeTab, filters.priceMin, filters.priceMax, filters.pctFilter]);

  // Group by date
  const dateGroups = useMemo(() => {
    const groups: Record<string, StockMover[]> = {};
    for (const r of displayed) {
      if (!groups[r.date]) groups[r.date] = [];
      groups[r.date].push(r);
    }
    return groups;
  }, [displayed]);

  const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));

  const gainers = rows.filter(r => r.mover_type === "gainer");
  const losers = rows.filter(r => r.mover_type === "loser");

  function resetFilters() { setFilters(defaultFilters); }

  const hasActiveFilters = !!(
    filters.dateFrom || filters.dateTo || filters.sector || filters.threshold > 0 ||
    filters.priceMin !== 200 || filters.priceMax !== 300 || filters.pctFilter !== 5
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Historical Movers</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {sortedDates.length} trading day{sortedDates.length !== 1 ? "s" : ""} · {rows.length} total records
          </p>
        </div>
        <div className="flex items-center gap-2">
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
              <span className="w-4 h-4 rounded-full bg-emerald-400 text-slate-900 text-xs flex items-center justify-center font-bold">!</span>
            )}
          </button>
          <button
            onClick={loadHistory}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Filter Options</h3>
            {hasActiveFilters && (
              <button onClick={resetFilters} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
                <X size={12} /> Reset all
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">From Date</label>
              <input
                type="date"
                value={filters.dateFrom}
                max={getISTDate()}
                onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">To Date</label>
              <input
                type="date"
                value={filters.dateTo}
                max={getISTDate()}
                onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Sector</label>
              <select
                value={filters.sector}
                onChange={e => setFilters(f => ({ ...f, sector: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
              >
                <option value="">All Sectors</option>
                {sectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Min % Change</label>
              <select
                value={filters.threshold}
                onChange={e => setFilters(f => ({ ...f, threshold: parseFloat(e.target.value) }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-600"
              >
                <option value={0}>Any</option>
                <option value={1}>±1%</option>
                <option value={2}>±2%</option>
                <option value={3}>±3%</option>
                <option value={5}>±5%</option>
                <option value={8}>±8%</option>
                <option value={10}>±10%</option>
              </select>
            </div>
          </div>
          {/* % Change filter */}
          <div className="mt-3 pt-3 border-t border-slate-700">
            <label className="block text-xs text-slate-500 mb-2">Min % Change (absolute)</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                min={0}
                step={0.5}
                value={filters.pctFilter}
                onChange={e => setFilters(f => ({ ...f, pctFilter: Math.max(0, parseFloat(e.target.value) || 0) }))}
                className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-600"
              />
              <div className="flex gap-1 flex-wrap">
                {[1, 2, 3, 5, 8, 10, 15].map(p => (
                  <button
                    key={p}
                    onClick={() => setFilters(f => ({ ...f, pctFilter: p }))}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      filters.pctFilter === p ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {p}%+
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Price range */}
          <div className="mt-3 pt-3 border-t border-slate-700">
            <label className="block text-xs text-slate-500 mb-2">Price Range (₹)</label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Min:</span>
                <input
                  type="number"
                  value={filters.priceMin}
                  onChange={e => setFilters(f => ({ ...f, priceMin: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Max:</span>
                <input
                  type="number"
                  value={filters.priceMax}
                  onChange={e => setFilters(f => ({ ...f, priceMax: Math.max(f.priceMin, parseInt(e.target.value) || 100000) }))}
                  className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {[100, 200, 300, 500, 1000].map(preset => (
                  <button
                    key={preset}
                    onClick={() => setFilters(f => ({ ...f, priceMin: preset, priceMax: preset + 100 }))}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      filters.priceMin === preset && filters.priceMax === preset + 100
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {preset}–{preset + 100}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
      )}

      {/* View toggle */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setView("datewise")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "datewise" ? "bg-slate-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"}`}
        >
          Date-wise View
        </button>
        <button
          onClick={() => setView("reversal")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "reversal" ? "bg-orange-700 text-white" : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"}`}
        >
          <AlertTriangle size={14} />
          Reversal Watch
        </button>
      </div>

      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-slate-600" />
        </div>
      ) : view === "reversal" ? (
        <ReversalPanel allRows={allRows} onDeleted={loadHistory} />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-4">
            {(["all", "gainer", "loser"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? tab === "loser" ? "bg-red-600 text-white" : tab === "gainer" ? "bg-emerald-600 text-white" : "bg-slate-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {tab === "gainer" && <TrendingUp size={14} />}
                {tab === "loser" && <TrendingDown size={14} />}
                {tab === "all" ? `All (${rows.length})` : tab === "gainer" ? `Gainers (${gainers.length})` : `Losers (${losers.length})`}
              </button>
            ))}
          </div>

          {/* Date-wise sections */}
          {sortedDates.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
              <TrendingUp size={32} className="text-slate-700" />
              <p className="text-sm">No records match the current filters.</p>
            </div>
          ) : (
            sortedDates.map((date, idx) => (
              <DateSection
                key={date}
                date={date}
                rows={dateGroups[date]}
                defaultOpen={idx === 0}
                onDeleted={loadHistory}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
