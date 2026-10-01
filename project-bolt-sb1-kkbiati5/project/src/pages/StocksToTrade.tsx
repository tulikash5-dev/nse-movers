import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowUpRight, ArrowDownRight, X, Search, RefreshCw,
  TrendingUp, TrendingDown, Trash2, Target, Shield, Info,
  ChevronUp, ChevronDown, Plus, Clock, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { fetchTradeList, removeFromTradeList, updateTradeListNotes, type TradeListItem } from "../lib/tradeList";
import { WATCHLIST } from "../lib/volumeScanner/types";

type SortKey = "ticker" | "entry_price" | "created_at";
type SortDir = "asc" | "desc";

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtDate(d: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(d: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function TargetStatusBadge({ status }: { status: string | null }) {
  if (!status || status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/40 text-slate-400 whitespace-nowrap">
        <Clock size={10} /> Pending
      </span>
    );
  }
  if (status === "TARGET_HIT") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-emerald-700 bg-emerald-900/40 text-emerald-300 whitespace-nowrap">
        <CheckCircle2 size={10} /> Target Hit
      </span>
    );
  }
  if (status === "STOP_HIT") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-red-700 bg-red-900/40 text-red-300 whitespace-nowrap">
        <XCircle size={10} /> Stop Hit
      </span>
    );
  }
  if (status === "EXPIRED") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-amber-700 bg-amber-900/40 text-amber-300 whitespace-nowrap">
        <AlertCircle size={10} /> Expired
      </span>
    );
  }
  return <span className="text-slate-600 text-xs">—</span>;
}

const tickerToSector = new Map<string, string>();
WATCHLIST.forEach((w) => tickerToSector.set(w.symbol, w.sector));
const tickerToName = new Map<string, string>();
WATCHLIST.forEach((w) => tickerToName.set(w.symbol, w.name));

export default function StocksToTrade() {
  const [items, setItems] = useState<TradeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedItem, setSelectedItem] = useState<TradeListItem | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTradeList();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trade list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => {
      const sec = tickerToSector.get(i.ticker);
      if (sec) s.add(sec);
    });
    return ["ALL", ...Array.from(s).sort()];
  }, [items]);

  const longs = useMemo(() => items.filter((i) => i.direction === "LONG"), [items]);
  const shorts = useMemo(() => items.filter((i) => i.direction === "SHORT"), [items]);

  function applyFilters(list: TradeListItem[]): TradeListItem[] {
    let result = list;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((i) => i.ticker.toLowerCase().includes(q));
    }
    if (sectorFilter !== "ALL") {
      result = result.filter((i) => tickerToSector.get(i.ticker) === sectorFilter);
    }
    const sorted = [...result].sort((a, b) => {
      let av: number | string = a[sortKey];
      let bv: number | string = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return sorted;
  }

  const filteredLongs = useMemo(() => applyFilters(longs), [longs, searchQuery, sectorFilter, sortKey, sortDir]);
  const filteredShorts = useMemo(() => applyFilters(shorts), [shorts, searchQuery, sectorFilter, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  async function handleRemove(id: string) {
    await removeFromTradeList(id);
    if (selectedItem?.id === id) setSelectedItem(null);
    await load();
  }

  function handleSelect(item: TradeListItem) {
    setSelectedItem(item);
    setNotesDraft(item.notes ?? "");
  }

  async function handleSaveNotes() {
    if (!selectedItem) return;
    await updateTradeListNotes(selectedItem.id, notesDraft);
    await load();
    setSelectedItem({ ...selectedItem, notes: notesDraft });
  }

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    return (
      <th
        onClick={() => handleSort(k)}
        className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-slate-300 select-none"
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {sortKey === k && (
            sortDir === "asc" ? <ChevronUp size={12} className="text-blue-400" /> : <ChevronDown size={12} className="text-blue-400" />
          )}
        </span>
      </th>
    );
  }

  function TradeTable({ list, direction }: { list: TradeListItem[]; direction: "LONG" | "SHORT" }) {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
          <Plus size={28} className="text-slate-700" />
          <p className="text-sm">No {direction.toLowerCase()} stocks selected yet.</p>
          <p className="text-xs text-slate-600">Add stocks from the Volume, Scanner, or Home pages.</p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <SortHeader label="Ticker" k="ticker" />
              <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">Name</th>
              <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">Sector</th>
              <SortHeader label="Entry" k="entry_price" />
              <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">Stop</th>
              <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">Target</th>
              <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">Status</th>
              <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">Source</th>
              <SortHeader label="Added" k="created_at" />
              <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((item, i) => (
              <tr
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors cursor-pointer ${
                  i % 2 === 0 ? "" : "bg-slate-800/10"
                } ${selectedItem?.id === item.id ? "bg-slate-800/50" : ""}`}
              >
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                    direction === "LONG" ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {direction === "LONG" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {item.ticker}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-400">{tickerToName.get(item.ticker) ?? "—"}</td>
                <td className="px-3 py-2.5 text-xs text-slate-400">{tickerToSector.get(item.ticker) ?? "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-white whitespace-nowrap">
                  {item.entry_price != null ? `₹${fmt(item.entry_price)}` : "—"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-red-400 whitespace-nowrap">
                  {item.suggested_stop != null ? `₹${fmt(item.suggested_stop)}` : "—"}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-emerald-400 whitespace-nowrap">
                  {item.target_price != null ? `₹${fmt(item.target_price)}` : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <TargetStatusBadge status={item.target_status} />
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500 capitalize">
                  {(item.source ?? "—").replace(/-/g, " ")}
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                  {fmtDate(item.created_at)} <span className="text-slate-600">{fmtTime(item.created_at)}</span>
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                    className="p-1.5 rounded-lg hover:bg-red-900/30 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Target size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Stocks to Trade Today</h1>
              <p className="text-slate-400 text-sm">Your selected long and short picks for the day</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          <X size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-emerald-400" />
            <span className="text-xs text-slate-500">Long Picks</span>
          </div>
          <p className="text-lg font-bold text-emerald-400">{longs.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={16} className="text-red-400" />
            <span className="text-xs text-slate-500">Short Picks</span>
          </div>
          <p className="text-lg font-bold text-red-400">{shorts.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Target size={16} className="text-blue-400" />
            <span className="text-xs text-slate-500">Total</span>
          </div>
          <p className="text-lg font-bold text-white">{items.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-slate-400" />
            <span className="text-xs text-slate-500">Last Updated</span>
          </div>
          <p className="text-sm font-bold text-slate-300">{items.length > 0 ? fmtTime(items[0].created_at) : "—"}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ticker…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          {sectors.map((s) => (
            <option key={s} value={s}>{s === "ALL" ? "All Sectors" : s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-slate-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <Target size={40} className="text-slate-700" />
          <p className="text-sm">No stocks selected for trading today.</p>
          <p className="text-xs text-slate-600">
            Go to the Volume, Scanner, or Home page and click "Add to Trade" on any stock to build your list.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LONG list */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-emerald-900/40 bg-emerald-900/10 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" />
              <span className="text-sm font-semibold text-white">Long Picks ({filteredLongs.length})</span>
            </div>
            <TradeTable list={filteredLongs} direction="LONG" />
          </div>

          {/* SHORT list */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-red-900/40 bg-red-900/10 flex items-center gap-2">
              <TrendingDown size={16} className="text-red-400" />
              <span className="text-sm font-semibold text-white">Short Picks ({filteredShorts.length})</span>
            </div>
            <TradeTable list={filteredShorts} direction="SHORT" />
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedItem(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 overflow-y-auto h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                  selectedItem.direction === "LONG"
                    ? "bg-emerald-900/40 border-emerald-700"
                    : "bg-red-900/40 border-red-700"
                }`}>
                  {selectedItem.direction === "LONG"
                    ? <ArrowUpRight size={18} className="text-emerald-400" />
                    : <ArrowDownRight size={18} className="text-red-400" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedItem.ticker}</h2>
                  <p className="text-xs text-slate-400">{tickerToName.get(selectedItem.ticker) ?? "—"}</p>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Direction Card */}
              <div className={`rounded-xl border p-4 ${
                selectedItem.direction === "LONG"
                  ? "bg-emerald-900/40 border-emerald-700"
                  : "bg-red-900/40 border-red-700"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {selectedItem.direction === "LONG"
                    ? <ArrowUpRight size={16} className="text-emerald-400" />
                    : <ArrowDownRight size={16} className="text-red-400" />}
                  <h3 className={`text-lg font-bold ${
                    selectedItem.direction === "LONG" ? "text-emerald-400" : "text-red-400"
                  }`}>{selectedItem.direction}</h3>
                </div>
                <p className="text-sm text-slate-300">
                  {selectedItem.direction === "LONG"
                    ? "Bullish setup — consider buying with a stop-loss below the suggested level."
                    : "Bearish setup — consider shorting with a stop-loss above the suggested level."}
                </p>
              </div>

              {/* Details */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
                  <Shield size={14} className="text-blue-400" /> Trade Details
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500">Entry Price</p>
                    <p className="text-sm text-white font-medium">{selectedItem.entry_price != null ? `₹${fmt(selectedItem.entry_price)}` : "—"}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500">Suggested Stop</p>
                    <p className="text-sm text-red-400 font-medium">{selectedItem.suggested_stop != null ? `₹${fmt(selectedItem.suggested_stop)}` : "—"}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500">Target Price</p>
                    <p className="text-sm text-emerald-400 font-medium">{selectedItem.target_price != null ? `₹${fmt(selectedItem.target_price)}` : "—"}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500">Target Status</p>
                    <div className="mt-0.5"><TargetStatusBadge status={selectedItem.target_status} /></div>
                    {selectedItem.target_checked_at && (
                      <p className="text-[10px] text-slate-600 mt-1">Checked {fmtDate(selectedItem.target_checked_at)}</p>
                    )}
                  </div>
                  <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500">Sector</p>
                    <p className="text-sm text-white font-medium">{tickerToSector.get(selectedItem.ticker) ?? "—"}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500">Source</p>
                    <p className="text-sm text-white font-medium capitalize">{(selectedItem.source ?? "—").replace(/-/g, " ")}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500">Added On</p>
                    <p className="text-sm text-white font-medium">{fmtDate(selectedItem.created_at)}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500">Risk per Share</p>
                    <p className="text-sm text-white font-medium">
                      {selectedItem.entry_price != null && selectedItem.suggested_stop != null
                        ? `₹${fmt(Math.abs(selectedItem.entry_price - selectedItem.suggested_stop))}`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Notes</h3>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Add your trading notes here…"
                  rows={4}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                />
                <button
                  onClick={handleSaveNotes}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                >
                  Save Notes
                </button>
              </div>

              {/* Remove button */}
              <button
                onClick={() => handleRemove(selectedItem.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-900/30 border border-red-800 text-red-400 hover:bg-red-900/50 text-sm font-medium transition-colors"
              >
                <Trash2 size={14} /> Remove from Trade List
              </button>

              {/* Disclaimer */}
              <div className="bg-amber-900/10 border border-amber-800/30 rounded-lg p-3">
                <p className="text-xs text-amber-300/80 flex items-start gap-2">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  Educational screening aid — not investment advice
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
