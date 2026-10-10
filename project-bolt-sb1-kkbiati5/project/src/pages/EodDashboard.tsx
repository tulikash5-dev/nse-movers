import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Rocket, TrendingUp, TrendingDown, RefreshCw, Download, Star,
  AlertCircle, CheckCircle2, Clock, Zap, Target, Layers,
  ArrowUpRight, ArrowDownRight, Plus, CheckSquare, Square,
  BarChart3, Building2, Shield, Globe, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { addToTradeList } from "../lib/tradeList";

interface EodCandidate {
  id: string;
  scan_date: string;
  symbol: string;
  company_name: string;
  sector: string | null;
  setup_type: "long" | "short" | "reversal";
  direction: "LONG" | "SHORT";
  close_price: number;
  pct_change: number;
  day_high: number;
  day_low: number;
  day_open: number;
  volume: number;
  avg_20d_volume: number;
  volume_ratio: number;
  near_52wk_high: boolean;
  near_52wk_low: boolean;
  pivot_pp: number;
  pivot_r1: number;
  pivot_r2: number;
  pivot_s1: number;
  pivot_s2: number;
  trigger_price: number;
  stop_loss: number;
  conviction_score: number;
  conviction_reasons: string[];
}

interface EodScanRun {
  id: string;
  scan_date: string;
  run_at: string;
  status: string;
  message: string | null;
  total_stocks_scanned: number;
  long_count: number;
  short_count: number;
  reversal_count: number;
  triggered_by: string;
  data_source: string | null;
}

interface DerivEntry {
  id: string;
  category: "long_buildup" | "short_buildup" | "long_unwinding" | "short_covering";
  symbol: string;
  pct_change: number;
  oi_change_pct: number | null;
  volume: number;
}

interface BulkDeal {
  id: string;
  symbol: string;
  company_name: string;
  deal_type: "bulk" | "block";
  buy_qty: number;
  sell_qty: number;
  trade_price: number;
  net_qty: number;
}

interface ChecklistItem {
  id: string;
  item_text: string;
  item_category: "global" | "derivatives" | "stock_specific" | "risk";
  is_checked: boolean;
  sort_order: number;
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

const SETUP_CONFIG = {
  long: { label: "LONG", color: "emerald", icon: TrendingUp, bg: "bg-emerald-900/30", border: "border-emerald-700", text: "text-emerald-400" },
  short: { color: "red", icon: TrendingDown, bg: "bg-red-900/30", border: "border-red-700", text: "text-red-400" },
  reversal: { color: "amber", icon: Zap, bg: "bg-amber-900/30", border: "border-amber-700", text: "text-amber-400" },
};

const DERIV_CONFIG: Record<string, { label: string; color: string }> = {
  long_buildup: { label: "Long Buildup", color: "emerald" },
  short_buildup: { label: "Short Buildup", color: "red" },
  long_unwinding: { label: "Long Unwinding", color: "amber" },
  short_covering: { label: "Short Covering", color: "blue" },
};

const CHECKLIST_ICONS: Record<string, typeof Globe> = {
  global: Globe,
  derivatives: BarChart3,
  stock_specific: Target,
  risk: Shield,
};

function Stars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={12}
          className={i <= score ? "text-amber-400 fill-amber-400" : "text-slate-700"}
        />
      ))}
    </div>
  );
}

function CandidateCard({ c, onAddToTrade }: { c: EodCandidate; onAddToTrade: (c: EodCandidate) => void }) {
  const cfg = SETUP_CONFIG[c.setup_type];
  const Icon = cfg.icon;
  const isLong = c.direction === "LONG";
  const risk = Math.abs(c.trigger_price - c.stop_loss);
  const reward = c.setup_type === "long"
    ? Math.abs(c.pivot_r2 - c.trigger_price)
    : Math.abs(c.trigger_price - c.pivot_s2);
  const rr = risk > 0 ? (reward / risk).toFixed(2) : "—";

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 hover:scale-[1.01] transition-transform`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Icon size={16} className={cfg.text} />
            <span className="text-white font-bold text-sm">{c.symbol}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cfg.border} ${cfg.text} font-medium`}>
              {c.setup_type === "reversal" ? "REVERSAL" : c.direction}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{c.company_name}</p>
          {c.sector && <span className="text-[10px] text-slate-600 mt-0.5 inline-block">{c.sector}</span>}
        </div>
        <div className="text-right">
          <p className="text-white font-mono text-sm font-bold">₹{fmt(c.close_price)}</p>
          <p className={`text-xs font-mono ${c.pct_change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {c.pct_change >= 0 ? "+" : ""}{fmt(c.pct_change)}%
          </p>
        </div>
      </div>

      {/* Conviction */}
      <div className="flex items-center justify-between mb-3">
        <Stars score={c.conviction_score} />
        <span className="text-[10px] text-slate-500">{c.conviction_score}/5 conviction</span>
      </div>

      {/* Trade Plan */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
          <p className="text-[10px] text-slate-500">Trigger</p>
          <p className={`text-xs font-mono font-bold ${isLong ? "text-emerald-400" : "text-red-400"}`}>
            ₹{fmt(c.trigger_price)}
          </p>
          <p className="text-[9px] text-slate-600">{isLong ? "Above day high" : "Below day low"}</p>
        </div>
        <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
          <p className="text-[10px] text-slate-500">Stop Loss</p>
          <p className="text-xs font-mono font-bold text-red-400">₹{fmt(c.stop_loss)}</p>
          <p className="text-[9px] text-slate-600">R:R = 1:{rr}</p>
        </div>
        <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
          <p className="text-[10px] text-slate-500">R1 / S1</p>
          <p className="text-xs font-mono text-slate-300">
            {isLong ? `₹${fmt(c.pivot_r1)}` : `₹${fmt(c.pivot_s1)}`}
          </p>
        </div>
        <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
          <p className="text-[10px] text-slate-500">R2 / S2</p>
          <p className="text-xs font-mono text-slate-300">
            {isLong ? `₹${fmt(c.pivot_r2)}` : `₹${fmt(c.pivot_s2)}`}
          </p>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 mb-3 text-[10px]">
        <span className="text-slate-500">Vol:</span>
        <span className="text-slate-300 font-mono">{fmtVol(c.volume)}</span>
        <span className="text-slate-600">({c.volume_ratio}x avg)</span>
        {c.near_52wk_high && <span className="px-1 py-0.5 rounded bg-emerald-900/40 text-emerald-400 text-[9px]">52W High</span>}
        {c.near_52wk_low && <span className="px-1 py-0.5 rounded bg-red-900/40 text-red-400 text-[9px]">52W Low</span>}
      </div>

      {/* Reasons */}
      {c.conviction_reasons.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-slate-500 mb-1">Why:</p>
          <ul className="space-y-0.5">
            {c.conviction_reasons.map((r, i) => (
              <li key={i} className="text-[10px] text-slate-400 flex items-start gap-1">
                <span className="text-slate-600 mt-0.5">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add to trade */}
      <button
        onClick={() => onAddToTrade(c)}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/40 border border-emerald-800 text-emerald-400 text-xs font-medium hover:bg-emerald-800/50 transition-colors"
      >
        <Plus size={12} /> Add to Trade Today
      </button>
    </div>
  );
}

type TabType = "all" | "long" | "short" | "reversal";

export default function EodDashboard() {
  const [scanRun, setScanRun] = useState<EodScanRun | null>(null);
  const [candidates, setCandidates] = useState<EodCandidate[]>([]);
  const [derivEntries, setDerivEntries] = useState<DerivEntry[]>([]);
  const [bulkDeals, setBulkDeals] = useState<BulkDeal[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [toast, setToast] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"watchlist" | "derivatives" | "bulk" | "checklist">("watchlist");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get latest scan run
      const { data: run, error: runErr } = await supabase
        .from("eod_scan_runs")
        .select("*")
        .order("run_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (runErr) throw runErr;

      if (!run) {
        setScanRun(null);
        setCandidates([]);
        setDerivEntries([]);
        setBulkDeals([]);
        setChecklist([]);
        return;
      }

      setScanRun(run as EodScanRun);
      const scanDate = (run as EodScanRun).scan_date;

      const [candRes, derivRes, bulkRes, checkRes] = await Promise.all([
        supabase.from("eod_candidates").select("*").eq("scan_date", scanDate).order("conviction_score", { ascending: false }),
        supabase.from("eod_derivative_summary").select("*").eq("scan_date", scanDate).order("volume", { ascending: false }),
        supabase.from("eod_bulk_deals").select("*").eq("scan_date", scanDate).order("net_qty", { ascending: false }),
        supabase.from("eod_checklist").select("*").eq("scan_date", scanDate).order("sort_order", { ascending: true }),
      ]);

      if (candRes.error) throw candRes.error;

      setCandidates((candRes.data ?? []) as EodCandidate[]);
      setDerivEntries((derivRes.data ?? []) as DerivEntry[]);
      setBulkDeals((bulkRes.data ?? []) as BulkDeal[]);
      setChecklist((checkRes.data ?? []) as ChecklistItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scan data");
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-eod-scan`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ triggered_by: "manual" }),
        },
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      setToast(`Scan complete: ${data.candidates} candidates found`);
      setTimeout(() => setToast(null), 3000);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function handleAddToTrade(c: EodCandidate) {
    const result = await addToTradeList(c.symbol, c.direction, "eod-scan", c.trigger_price, c.stop_loss);
    setToast(result.success ? `Added ${c.symbol} to Trade Today` : (result.error ?? "Failed to add"));
    setTimeout(() => setToast(null), 2500);
  }

  async function toggleChecklistItem(item: ChecklistItem) {
    const { error: updateErr } = await supabase
      .from("eod_checklist")
      .update({ is_checked: !item.is_checked })
      .eq("id", item.id);
    if (updateErr) return;
    setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i));
  }

  function exportData(format: "csv" | "json") {
    const rows = filteredCandidates.map(c => ({
      symbol: c.symbol,
      company: c.company_name,
      setup: c.setup_type,
      direction: c.direction,
      close: c.close_price,
      pct_change: c.pct_change,
      trigger: c.trigger_price,
      stop_loss: c.stop_loss,
      pivot_r1: c.pivot_r1,
      pivot_r2: c.pivot_r2,
      pivot_s1: c.pivot_s1,
      pivot_s2: c.pivot_s2,
      volume: c.volume,
      vol_ratio: c.volume_ratio,
      conviction: c.conviction_score,
      reasons: c.conviction_reasons.join("; "),
    }));

    let content: string;
    let mime: string;
    let ext: string;

    if (format === "json") {
      content = JSON.stringify(rows, null, 2);
      mime = "application/json";
      ext = "json";
    } else {
      const headers = Object.keys(rows[0] ?? { symbol: "" });
      const lines = [headers.join(",")];
      for (const r of rows) {
        lines.push(headers.map(h => {
          const val = (r as Record<string, unknown>)[h];
          const s = String(val ?? "");
          return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(","));
      }
      content = lines.join("\n");
      mime = "text/csv";
      ext = "csv";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eod-watchlist-${scanRun?.scan_date ?? "latest"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredCandidates = useMemo(() => {
    if (activeTab === "all") return candidates;
    return candidates.filter(c => c.setup_type === activeTab);
  }, [candidates, activeTab]);

  const derivByCategory = useMemo(() => {
    const cats: Record<string, DerivEntry[]> = { long_buildup: [], short_buildup: [], long_unwinding: [], short_covering: [] };
    for (const d of derivEntries) {
      if (cats[d.category]) cats[d.category].push(d);
    }
    return cats;
  }, [derivEntries]);

  const checklistByCategory = useMemo(() => {
    const cats: Record<string, ChecklistItem[]> = { global: [], derivatives: [], stock_specific: [], risk: [] };
    for (const item of checklist) {
      if (cats[item.item_category]) cats[item.item_category].push(item);
    }
    return cats;
  }, [checklist]);

  const checklistProgress = useMemo(() => {
    if (checklist.length === 0) return 0;
    return Math.round((checklist.filter(i => i.is_checked).length / checklist.length) * 100);
  }, [checklist]);

  const longCount = candidates.filter(c => c.setup_type === "long").length;
  const shortCount = candidates.filter(c => c.setup_type === "short").length;
  const reversalCount = candidates.filter(c => c.setup_type === "reversal").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={32} className="animate-spin text-blue-500" />
          <p className="text-slate-400 text-sm">Loading EOD scan results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <Rocket size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">EOD Screening Dashboard</h1>
            <p className="text-slate-400 text-sm">Automated next-day intraday trade candidates</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportData("csv")}
            disabled={candidates.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors disabled:opacity-50"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={() => exportData("json")}
            disabled={candidates.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors disabled:opacity-50"
          >
            <Download size={14} /> JSON
          </button>
          <button
            onClick={runScanNow}
            disabled={scanning}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {scanning ? <><RefreshCw size={14} className="animate-spin" /> Scanning...</> : <><Zap size={14} /> Run Scan Now</>}
          </button>
        </div>
      </div>

      {/* Scan status */}
      {scanRun && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-6">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-slate-500" />
              <span className="text-slate-400">Scan Date:</span>
              <span className="text-white font-medium">{scanRun.scan_date}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {scanRun.status === "success" ? <CheckCircle2 size={14} className="text-emerald-400" /> :
               scanRun.status === "failed" ? <AlertCircle size={14} className="text-red-400" /> :
               <RefreshCw size={14} className="text-blue-400 animate-spin" />}
              <span className={`font-medium ${scanRun.status === "success" ? "text-emerald-400" : scanRun.status === "failed" ? "text-red-400" : "text-blue-400"}`}>
                {scanRun.status.charAt(0).toUpperCase() + scanRun.status.slice(1)}
              </span>
            </div>
            <div className="text-slate-400">
              Scanned: <span className="text-slate-300 font-mono">{scanRun.total_stocks_scanned}</span>
            </div>
            <div className="text-slate-400">
              <span className="text-emerald-400 font-mono">{longCount}</span> Long
              <span className="text-slate-600 mx-1">|</span>
              <span className="text-red-400 font-mono">{shortCount}</span> Short
              <span className="text-slate-600 mx-1">|</span>
              <span className="text-amber-400 font-mono">{reversalCount}</span> Reversal
            </div>
            {scanRun.message && (
              <div className="text-slate-500 truncate max-w-md">{scanRun.message}</div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* No data state */}
      {!scanRun && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Rocket size={48} className="text-slate-700 mb-4" />
          <p className="text-sm mb-2">No EOD scan has been run yet.</p>
          <p className="text-xs text-slate-600 mb-4">Run the scan after market close (~4:30 PM IST) to generate tomorrow's watchlist.</p>
          <button
            onClick={runScanNow}
            disabled={scanning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50"
          >
            {scanning ? <><RefreshCw size={16} className="animate-spin" /> Running Scan...</> : <><Zap size={16} /> Run First Scan</>}
          </button>
        </div>
      )}

      {scanRun && (
        <>
          {/* Section Tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <SectionTab label="Tomorrow's Watchlist" icon={Target} active={activeSection === "watchlist"} onClick={() => setActiveSection("watchlist")} badge={candidates.length} />
            <SectionTab label="Derivative Analysis" icon={BarChart3} active={activeSection === "derivatives"} onClick={() => setActiveSection("derivatives")} badge={derivEntries.length} />
            <SectionTab label="Bulk Deals" icon={Building2} active={activeSection === "bulk"} onClick={() => setActiveSection("bulk")} badge={bulkDeals.length} />
            <SectionTab label="Morning Checklist" icon={CheckSquare} active={activeSection === "checklist"} onClick={() => setActiveSection("checklist")} badge={checklist.length} progress={checklistProgress} />
          </div>

          {/* ===== Section 1: Watchlist ===== */}
          {activeSection === "watchlist" && (
            <div>
              {/* Setup filter tabs */}
              <div className="flex gap-2 mb-4">
                <FilterTab label="All" count={candidates.length} active={activeTab === "all"} onClick={() => setActiveTab("all")} color="slate" />
                <FilterTab label="Long" count={longCount} active={activeTab === "long"} onClick={() => setActiveTab("long")} color="emerald" />
                <FilterTab label="Short" count={shortCount} active={activeTab === "short"} onClick={() => setActiveTab("short")} color="red" />
                <FilterTab label="Reversal" count={reversalCount} active={activeTab === "reversal"} onClick={() => setActiveTab("reversal")} color="amber" />
              </div>

              {filteredCandidates.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <p className="text-sm">No {activeTab !== "all" ? activeTab : ""} candidates found in the latest scan.</p>
                  <p className="text-xs mt-2">Run a new scan after market close to refresh results.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredCandidates.map(c => (
                    <CandidateCard key={c.id} c={c} onAddToTrade={handleAddToTrade} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== Section 2: Derivative Analysis ===== */}
          {activeSection === "derivatives" && (
            <div>
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2">
                <BarChart3 size={14} className="text-blue-400 shrink-0" />
                <span className="text-xs text-blue-300">Only F&O eligible stocks are shown here. Non-F&O stocks do not have derivatives data.</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.entries(derivByCategory).map(([cat, entries]) => {
                  const cfg = DERIV_CONFIG[cat];
                  if (!cfg) return null;
                  return (
                    <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                      <div className={`px-4 py-3 border-b border-slate-800 bg-${cfg.color}-900/20`}>
                        <h3 className={`text-sm font-bold text-${cfg.color}-400`}>{cfg.label}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{entries.length} F&O stocks</p>
                      </div>
                      <div className="overflow-x-auto max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-slate-900">
                            <tr className="border-b border-slate-800">
                              <th className="px-3 py-2 text-xs text-slate-500 font-semibold text-left">Symbol</th>
                              <th className="px-3 py-2 text-xs text-slate-500 font-semibold text-right">Chg%</th>
                              <th className="px-3 py-2 text-xs text-slate-500 font-semibold text-right">Volume</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.slice(0, 20).map(e => (
                              <tr key={e.id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                                <td className="px-3 py-2 text-white text-xs font-medium">{e.symbol}</td>
                                <td className={`px-3 py-2 text-right font-mono text-xs ${e.pct_change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {e.pct_change >= 0 ? "+" : ""}{fmt(e.pct_change)}%
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-slate-400">{fmtVol(e.volume)}</td>
                              </tr>
                            ))}
                            {entries.length === 0 && (
                              <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-600 text-xs">No entries</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== Section 3: Bulk Deals ===== */}
          {activeSection === "bulk" && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left">Symbol</th>
                      <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left">Company</th>
                      <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left">Type</th>
                      <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-right">Buy Qty</th>
                      <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-right">Sell Qty</th>
                      <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-right">Net Qty</th>
                      <th className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkDeals.map(d => (
                      <tr key={d.id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                        <td className="px-3 py-2.5 text-white text-xs font-medium">{d.symbol}</td>
                        <td className="px-3 py-2.5 text-slate-400 text-xs">{d.company_name}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${d.deal_type === "block" ? "bg-purple-900/30 border-purple-700 text-purple-400" : "bg-blue-900/30 border-blue-700 text-blue-400"}`}>
                            {d.deal_type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-emerald-400">{fmtVol(d.buy_qty)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-red-400">{fmtVol(d.sell_qty)}</td>
                        <td className={`px-3 py-2.5 text-right font-mono text-xs font-bold ${d.net_qty >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {d.net_qty >= 0 ? "+" : ""}{fmtVol(d.net_qty)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-300">₹{fmt(d.trade_price)}</td>
                      </tr>
                    ))}
                    {bulkDeals.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-12 text-center text-slate-600 text-sm">No bulk/block deals found for this scan date</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== Section 4: Morning Checklist ===== */}
          {activeSection === "checklist" && (
            <div>
              {/* Progress bar */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white font-medium">Pre-Open Readiness</span>
                  <span className="text-sm text-slate-400">{checklistProgress}% complete</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${checklistProgress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Object.entries(checklistByCategory).map(([cat, items]) => {
                  const Icon = CHECKLIST_ICONS[cat] ?? Square;
                  const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1).replace("_", " ");
                  return (
                    <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon size={16} className="text-blue-400" />
                        <h3 className="text-sm font-bold text-white">{catLabel}</h3>
                        <span className="text-xs text-slate-500">({items.filter(i => i.is_checked).length}/{items.length})</span>
                      </div>
                      <div className="space-y-2">
                        {items.map(item => (
                          <button
                            key={item.id}
                            onClick={() => toggleChecklistItem(item)}
                            className="w-full flex items-start gap-2 text-left group"
                          >
                            {item.is_checked ? (
                              <CheckSquare size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                            ) : (
                              <Square size={16} className="text-slate-600 mt-0.5 shrink-0 group-hover:text-slate-400" />
                            )}
                            <span className={`text-xs ${item.is_checked ? "text-slate-500 line-through" : "text-slate-300"}`}>
                              {item.item_text}
                            </span>
                          </button>
                        ))}
                        {items.length === 0 && (
                          <p className="text-xs text-slate-600">No items</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
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

function SectionTab({ label, icon: Icon, active, onClick, badge, progress }: {
  label: string; icon: typeof Target; active: boolean; onClick: () => void; badge?: number; progress?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
        active
          ? "bg-blue-900/40 border-blue-600 text-blue-300"
          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
      }`}
    >
      <Icon size={16} />
      {label}
      {badge != null && badge > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-blue-800 text-blue-200" : "bg-slate-800 text-slate-500"}`}>
          {badge}
        </span>
      )}
      {progress != null && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${progress === 100 ? "bg-emerald-800 text-emerald-200" : "bg-slate-800 text-slate-500"}`}>
          {progress}%
        </span>
      )}
    </button>
  );
}

function FilterTab({ label, count, active, onClick, color }: {
  label: string; count: number; active: boolean; onClick: () => void; color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? `bg-${color}-700 text-white`
          : `bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700`
      }`}
    >
      {label}
      <span className={`text-xs ${active ? "text-white/80" : "text-slate-600"}`}>({count})</span>
    </button>
  );
}
