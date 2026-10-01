import { useState, useMemo } from "react";
import { ArrowUpRight, ArrowDownRight, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, Plus } from "lucide-react";
import type { StockMover } from "../lib/types";
import { addToTradeList } from "../lib/tradeList";

type SortKey = keyof StockMover;
type SortDir = "asc" | "desc";

interface Props {
  rows: StockMover[];
  showDate?: boolean;
  compact?: boolean;
  onDeleted?: () => void;
}

async function deleteStock(id: string, onSuccess?: () => void) {
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
    onSuccess?.();
  } catch (e) {
    alert(e instanceof Error ? e.message : "Delete failed");
  }
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
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function StockTable({ rows, showDate = false, compact = false, onDeleted }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("pct_change");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const perPage = compact ? 10 : 20;

  const moverType = rows[0]?.mover_type ?? "gainer";
  const isGainer = moverType === "gainer";

  async function handleAddToTrade(s: StockMover) {
    const direction: "LONG" | "SHORT" = s.mover_type === "gainer" ? "LONG" : "SHORT";
    // Compute a stop from the day's range — use previous close as a reference
    const stop = s.prev_close > 0 ? s.prev_close : null;
    const result = await addToTradeList(s.symbol, direction, "movers", s.price, stop);
    setToast(result.success ? `Added ${s.symbol} to Trade Today` : (result.error ?? "Failed to add"));
    setTimeout(() => setToast(null), 2500);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(isGainer ? "desc" : "asc");
    }
    setPage(1);
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / perPage);
  const paged = sorted.slice((page - 1) * perPage, page * perPage);

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronsUpDown size={13} className="opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp size={13} className="text-emerald-400" />
      : <ChevronDown size={13} className="text-emerald-400" />;
  }

  function Th({ label, k, right }: { label: string; k: SortKey; right?: boolean }) {
    return (
      <th
        className={`px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap ${right ? "text-right" : "text-left"}`}
        onClick={() => handleSort(k)}
      >
        <span className="inline-flex items-center gap-1">
          {right && <SortIcon k={k} />}
          {label}
          {!right && <SortIcon k={k} />}
        </span>
      </th>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
          {isGainer
            ? <ArrowUpRight size={24} className="text-slate-600" />
            : <ArrowDownRight size={24} className="text-slate-600" />}
        </div>
        <p className="text-sm">No {isGainer ? "gainers" : "losers"} found for this selection.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {showDate && <Th label="Date" k="date" />}
              <Th label="Stock Name" k="company_name" />
              <Th label="Price" k="price" right />
              <Th label="Prev Close" k="prev_close" right />
              <Th label="Change %" k="pct_change" right />
              <Th label="Volume" k="volume" right />
              <th className="px-3 py-2.5 w-10"></th>
              <th className="px-3 py-2.5 w-16 text-xs font-semibold text-slate-400 uppercase tracking-wide">Trade</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((s, i) => (
              <tr
                key={s.id}
                className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? "" : "bg-slate-800/10"}`}
              >
                {showDate && (
                  <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap text-xs">{fmtDate(s.date)}</td>
                )}
                <td className="px-3 py-2.5 text-white font-medium max-w-[220px] truncate" title={s.company_name}>
                  {s.company_name}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-white whitespace-nowrap">
                  ₹{fmt(s.price)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-400 whitespace-nowrap">
                  ₹{fmt(s.prev_close)}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-0.5 font-semibold font-mono ${
                      s.pct_change >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {s.pct_change >= 0
                      ? <ArrowUpRight size={14} strokeWidth={2.5} />
                      : <ArrowDownRight size={14} strokeWidth={2.5} />}
                    {Math.abs(s.pct_change).toFixed(2)}%
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-400 whitespace-nowrap text-xs">
                  {fmtVol(s.volume)}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => deleteStock(s.id, onDeleted)}
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    title="Delete this record"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => handleAddToTrade(s)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-900/40 border border-emerald-700 text-emerald-300 text-[10px] font-medium hover:bg-emerald-800/50 transition-colors whitespace-nowrap"
                  >
                    <Plus size={10} /> Trade
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-3 border-t border-slate-800">
          <span className="text-xs text-slate-500">
            Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-7 h-7 text-xs rounded transition-colors ${
                    pg === page
                      ? "bg-emerald-600 text-white font-semibold"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
