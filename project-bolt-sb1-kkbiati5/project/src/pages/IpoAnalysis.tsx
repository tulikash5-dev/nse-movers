import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Sparkles, Search, ArrowUpDown, ArrowUp, ArrowDown, X,
  TrendingUp, RefreshCw, Building2, Users,
  PieChart, DollarSign, Calendar, Info, AlertCircle,
  Target, Award, Zap, Flame, BarChart3,
  CheckCircle2, XCircle, MinusCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";

interface IPO {
  id: string;
  symbol: string;
  company_name: string;
  sector: string | null;
  industry: string | null;
  open_date: string | null;
  close_date: string | null;
  listing_date: string | null;
  issue_price: number | null;
  listing_price: number | null;
  current_price: number | null;
  lot_size: number | null;
  issue_size_cr: number | null;
  qib_subscription: number | null;
  nii_subscription: number | null;
  rii_subscription: number | null;
  total_subscription: number | null;
  listing_gains_pct: number | null;
  current_gains_pct: number | null;
  face_value: number | null;
  exchange: string | null;
  is_new: boolean;
  notes: string | null;
}

interface QuarterlyResult {
  id: string;
  quarter: string;
  quarter_label: string | null;
  revenue_cr: number | null;
  profit_cr: number | null;
  pat_margin: number | null;
  eps: number | null;
  revenue_growth_pct: number | null;
  profit_growth_pct: number | null;
}

interface PromoterHolding {
  id: string;
  quarter: string;
  quarter_label: string | null;
  promoter_holding_pct: number | null;
  change_pct: number | null;
}

type SortDir = "asc" | "desc" | null;

interface ColumnDef {
  key: keyof IPO;
  label: string;
  type: "text" | "number" | "date" | "percentage";
  width?: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "company_name", label: "Company", type: "text" },
  { key: "listing_date", label: "Listed On", type: "date" },
  { key: "issue_price", label: "Issue Price", type: "number" },
  { key: "listing_price", label: "Listing Price", type: "number" },
  { key: "listing_gains_pct", label: "Listing Gains", type: "percentage" },
  { key: "current_price", label: "Current Price", type: "number" },
  { key: "current_gains_pct", label: "Current Gains", type: "percentage" },
  { key: "lot_size", label: "Lot Size", type: "number" },
  { key: "issue_size_cr", label: "Issue Size (Cr)", type: "number" },
  { key: "qib_subscription", label: "QIB", type: "number" },
  { key: "nii_subscription", label: "NII", type: "number" },
  { key: "rii_subscription", label: "RII", type: "number" },
  { key: "total_subscription", label: "Total Sub", type: "number" },
  { key: "sector", label: "Sector", type: "text" },
];

// ── Analyst scoring system ──────────────────────────────────────────
// Scores an IPO on a 0-100 scale using subscription demand, listing
// performance, current price momentum, and issue size as proxies.
function scoreIpo(ipo: IPO): number {
  let score = 0;

  // Subscription strength (0-30 pts)
  const totalSub = ipo.total_subscription ?? 0;
  if (totalSub >= 20) score += 30;
  else if (totalSub >= 10) score += 25;
  else if (totalSub >= 5) score += 20;
  else if (totalSub >= 3) score += 15;
  else if (totalSub >= 1) score += 8;
  else score += 0;

  // QIB demand (0-20 pts) — institutional conviction
  const qib = ipo.qib_subscription ?? 0;
  if (qib >= 15) score += 20;
  else if (qib >= 10) score += 16;
  else if (qib >= 5) score += 12;
  else if (qib >= 2) score += 8;
  else if (qib >= 1) score += 4;

  // Listing gains (0-20 pts)
  const listingGains = ipo.listing_gains_pct ?? 0;
  if (listingGains >= 30) score += 20;
  else if (listingGains >= 15) score += 16;
  else if (listingGains >= 5) score += 12;
  else if (listingGains >= 0) score += 6;
  else score += 0;

  // Current price momentum (0-20 pts)
  const currentGains = ipo.current_gains_pct ?? 0;
  if (currentGains >= 30) score += 20;
  else if (currentGains >= 15) score += 16;
  else if (currentGains >= 5) score += 12;
  else if (currentGains >= 0) score += 6;
  else score += 0;

  // Issue size — larger issues tend to have more institutional support (0-10 pts)
  const issueSize = ipo.issue_size_cr ?? 0;
  if (issueSize >= 2000) score += 10;
  else if (issueSize >= 1000) score += 8;
  else if (issueSize >= 500) score += 6;
  else if (issueSize >= 200) score += 4;
  else score += 2;

  return Math.min(score, 100);
}

function getScoreBand(score: number): { label: string; color: string; bg: string; icon: typeof Award } {
  if (score >= 75) return { label: "High Potential", color: "text-emerald-400", bg: "bg-emerald-900/40 border-emerald-700", icon: Flame };
  if (score >= 55) return { label: "Moderate", color: "text-amber-400", bg: "bg-amber-900/30 border-amber-700", icon: Target };
  if (score >= 35) return { label: "Watch", color: "text-slate-300", bg: "bg-slate-800/40 border-slate-700", icon: MinusCircle };
  return { label: "High Risk", color: "text-red-400", bg: "bg-red-900/30 border-red-700", icon: XCircle };
}

function getScoreBarColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 55) return "bg-amber-500";
  if (score >= 35) return "bg-slate-500";
  return "bg-red-500";
}

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getGainsColor(pct: number | null): string {
  if (pct == null) return "text-slate-400";
  if (pct > 0) return "text-emerald-400";
  if (pct < 0) return "text-red-400";
  return "text-slate-400";
}

function getSubColor(n: number | null): string {
  if (n == null) return "text-slate-400";
  if (n >= 10) return "text-emerald-400 font-semibold";
  if (n >= 3) return "text-amber-400";
  if (n >= 1) return "text-slate-300";
  return "text-red-400";
}

export default function IpoAnalysis() {
  const [ipos, setIpos] = useState<IPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof IPO | "score" | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIpo, setSelectedIpo] = useState<IPO | null>(null);
  const [quarterlyResults, setQuarterlyResults] = useState<QuarterlyResult[]>([]);
  const [promoterHoldings, setPromoterHoldings] = useState<PromoterHolding[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [showHighPotentialOnly, setShowHighPotentialOnly] = useState(false);

  const loadIpos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("ipo_listings")
        .select("*")
        .eq("is_active", true)
        .order("listing_date", { ascending: false });

      if (error) throw error;
      setIpos((data ?? []) as unknown as IPO[]);
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      console.error("Failed to load IPOs:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadIpos();
  }, [loadIpos]);

  const triggerFetch = useCallback(async () => {
    setRefreshing(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-ipo-data`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ triggered_by: "manual" }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await loadIpos();
    } catch (e) {
      console.error("Failed to trigger IPO fetch:", e);
      setRefreshing(false);
    }
  }, [loadIpos]);

  const loadDetail = useCallback(async (ipo: IPO) => {
    setSelectedIpo(ipo);
    setLoadingDetail(true);
    try {
      const [qrRes, phRes] = await Promise.all([
        supabase
          .from("ipo_quarterly_results")
          .select("*")
          .eq("symbol", ipo.symbol)
          .order("quarter", { ascending: true }),
        supabase
          .from("ipo_promoter_holdings")
          .select("*")
          .eq("symbol", ipo.symbol)
          .order("quarter", { ascending: true }),
      ]);
      setQuarterlyResults((qrRes.data ?? []) as unknown as QuarterlyResult[]);
      setPromoterHoldings((phRes.data ?? []) as unknown as PromoterHolding[]);
    } catch (e) {
      console.error("Failed to load detail:", e);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleSort = (key: keyof IPO | "score") => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") { setSortDir(null); setSortKey(null); }
      else setSortDir("asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const getSortIcon = (key: keyof IPO | "score") => {
    if (sortKey !== key) return <ArrowUpDown size={11} className="text-slate-600" />;
    if (sortDir === "asc") return <ArrowUp size={11} className="text-amber-400" />;
    if (sortDir === "desc") return <ArrowDown size={11} className="text-amber-400" />;
    return <ArrowUpDown size={11} className="text-slate-600" />;
  };

  // Compute scores for all IPOs
  const ipoScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const ipo of ipos) {
      map.set(ipo.id, scoreIpo(ipo));
    }
    return map;
  }, [ipos]);

  const filteredAndSorted = useMemo(() => {
    let result = [...ipos];

    // High-potential filter
    if (showHighPotentialOnly) {
      result = result.filter(ipo => (ipoScores.get(ipo.id) ?? 0) >= 55);
    }

    // Global search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(ipo =>
        ipo.company_name.toLowerCase().includes(q) ||
        (ipo.sector ?? "").toLowerCase().includes(q)
      );
    }

    // Column filters
    for (const [key, value] of Object.entries(columnFilters)) {
      if (!value) continue;
      const col = COLUMNS.find(c => c.key === key as keyof IPO);
      if (!col) continue;
      const filterVal = value.toLowerCase();
      result = result.filter(ipo => {
        const cellVal = ipo[key as keyof IPO];
        if (cellVal == null) return false;
        return String(cellVal).toLowerCase().includes(filterVal);
      });
    }

    // Sort
    if (sortKey && sortDir) {
      const col = COLUMNS.find(c => c.key === sortKey);
      result.sort((a, b) => {
        if (sortKey === "score") {
          const aScore = ipoScores.get(a.id) ?? 0;
          const bScore = ipoScores.get(b.id) ?? 0;
          return sortDir === "asc" ? aScore - bScore : bScore - aScore;
        }
        const aVal = a[sortKey as keyof IPO];
        const bVal = b[sortKey as keyof IPO];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDir === "asc" ? 1 : -1;
        if (bVal == null) return sortDir === "asc" ? -1 : 1;
        if (col?.type === "number") {
          return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
        }
        if (col?.type === "date") {
          const aTime = new Date(aVal as string).getTime();
          const bTime = new Date(bVal as string).getTime();
          return sortDir === "asc" ? aTime - bTime : bTime - aTime;
        }
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [ipos, ipoScores, searchQuery, columnFilters, sortKey, sortDir, showHighPotentialOnly]);

  // Summary stats
  const stats = useMemo(() => {
    if (ipos.length === 0) return null;
    const avgListingGains = ipos.reduce((sum, i) => sum + (i.listing_gains_pct ?? 0), 0) / ipos.length;
    const avgCurrentGains = ipos.reduce((sum, i) => sum + (i.current_gains_pct ?? 0), 0) / ipos.length;
    const positiveListing = ipos.filter(i => (i.listing_gains_pct ?? 0) > 0).length;
    const positiveCurrent = ipos.filter(i => (i.current_gains_pct ?? 0) > 0).length;
    const avgSubscription = ipos.reduce((sum, i) => sum + (i.total_subscription ?? 0), 0) / ipos.length;
    const highPotentialCount = ipos.filter(i => (ipoScores.get(i.id) ?? 0) >= 55).length;
    return {
      total: ipos.length,
      avgListingGains: Math.round(avgListingGains * 100) / 100,
      avgCurrentGains: Math.round(avgCurrentGains * 100) / 100,
      positiveRate: Math.round((positiveListing / ipos.length) * 100),
      positiveCurrentRate: Math.round((positiveCurrent / ipos.length) * 100),
      avgSubscription: Math.round(avgSubscription * 100) / 100,
      highPotential: highPotentialCount,
    };
  }, [ipos, ipoScores]);

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-amber-600 flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Expert IPO Analysis</h1>
              <p className="text-slate-400 text-sm">Recent Indian IPO listings with subscription data, performance tracking & analyst scoring</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {lastUpdated && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Calendar size={12} /> Updated: {new Date(lastUpdated).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={() => setShowFilters(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${showFilters ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            <Search size={14} /> Filters
          </button>
          <button
            onClick={triggerFetch}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {refreshing ? <><RefreshCw size={14} className="animate-spin" /> Updating…</> : <><RefreshCw size={14} /> Fetch Latest</>}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard label="Total IPOs" value={String(stats.total)} icon={<Building2 size={16} />} color="text-white" />
          <StatCard label="Avg Listing Gains" value={`${stats.avgListingGains > 0 ? "+" : ""}${stats.avgListingGains}%`} icon={<TrendingUp size={16} />} color={stats.avgListingGains >= 0 ? "text-emerald-400" : "text-red-400"} />
          <StatCard label="Avg Current Gains" value={`${stats.avgCurrentGains > 0 ? "+" : ""}${stats.avgCurrentGains}%`} icon={<BarChart3 size={16} />} color={stats.avgCurrentGains >= 0 ? "text-emerald-400" : "text-red-400"} />
          <StatCard label="Positive Listing" value={`${stats.positiveRate}%`} icon={<PieChart size={16} />} color={stats.positiveRate >= 50 ? "text-emerald-400" : "text-amber-400"} />
          <StatCard label="Avg Subscription" value={`${stats.avgSubscription}x`} icon={<Users size={16} />} color="text-amber-400" />
          <StatCard label="High Potential" value={String(stats.highPotential)} icon={<Flame size={16} />} color="text-emerald-400" />
        </div>
      )}

      {/* High Potential Filter Toggle */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => setShowHighPotentialOnly(s => !s)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
            showHighPotentialOnly
              ? "bg-emerald-900/40 border-emerald-600 text-emerald-300"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
          }`}
        >
          <Flame size={15} />
          {showHighPotentialOnly ? "Showing High Potential IPOs Only" : "Show High Potential IPOs Only"}
        </button>
        {showHighPotentialOnly && (
          <span className="text-xs text-slate-500">
            Scored 55+ on subscription demand, listing performance, and price momentum
          </span>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by company or sector…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Column Filters */}
      {showFilters && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {COLUMNS.map(col => (
              <div key={String(col.key)}>
                <label className="block text-xs text-slate-500 mb-1">{col.label}</label>
                <input
                  type="text"
                  placeholder="Filter…"
                  value={columnFilters[String(col.key)] ?? ""}
                  onChange={e => setColumnFilters(prev => ({ ...prev, [String(col.key)]: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => setColumnFilters({})}
            className="mt-3 text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            <X size={12} /> Clear all filters
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center py-20">
          <RefreshCw size={32} className="animate-spin text-amber-500" />
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 text-slate-500 gap-2">
          <Search size={32} className="text-slate-700" />
          <p className="text-sm">No IPOs match your filters.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{filteredAndSorted.length} IPOs</span>
            <span className="text-xs text-slate-500">Click any row for detailed analyst report</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th
                    onClick={() => handleSort("score")}
                    className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-slate-300 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <Award size={11} /> Score
                      {getSortIcon("score")}
                    </div>
                  </th>
                  {COLUMNS.map(col => (
                    <th
                      key={String(col.key)}
                      onClick={() => handleSort(col.key)}
                      className="px-3 py-2.5 text-xs text-slate-500 font-semibold text-left uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-slate-300 select-none"
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {getSortIcon(col.key)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((ipo, i) => {
                  const score = ipoScores.get(ipo.id) ?? 0;
                  const band = getScoreBand(score);
                  return (
                    <tr
                      key={ipo.id}
                      onClick={() => loadDetail(ipo)}
                      className={`border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors cursor-pointer ${i % 2 === 0 ? "" : "bg-slate-800/10"}`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${getScoreBarColor(score)}`} style={{ width: `${score}%` }} />
                          </div>
                          <span className={`text-xs font-mono font-semibold ${band.color}`}>{score}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-white font-medium text-xs truncate max-w-[200px]">{ipo.company_name}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">{fmtDate(ipo.listing_date)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300 whitespace-nowrap">₹{fmt(ipo.issue_price)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300 whitespace-nowrap">₹{fmt(ipo.listing_price)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${getGainsColor(ipo.listing_gains_pct)}`}>
                        {ipo.listing_gains_pct != null ? `${ipo.listing_gains_pct > 0 ? "+" : ""}${fmt(ipo.listing_gains_pct)}%` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-white whitespace-nowrap">₹{fmt(ipo.current_price)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${getGainsColor(ipo.current_gains_pct)}`}>
                        {ipo.current_gains_pct != null ? `${ipo.current_gains_pct > 0 ? "+" : ""}${fmt(ipo.current_gains_pct)}%` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400 whitespace-nowrap">{ipo.lot_size ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400 whitespace-nowrap">{fmt(ipo.issue_size_cr, 1)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap ${getSubColor(ipo.qib_subscription)}`}>{fmt(ipo.qib_subscription, 1)}x</td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap ${getSubColor(ipo.nii_subscription)}`}>{fmt(ipo.nii_subscription, 1)}x</td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap ${getSubColor(ipo.rii_subscription)}`}>{fmt(ipo.rii_subscription, 1)}x</td>
                      <td className={`px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap ${getSubColor(ipo.total_subscription)}`}>{fmt(ipo.total_subscription, 1)}x</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">{ipo.sector ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedIpo && (
        <DetailDrawer
          ipo={selectedIpo}
          score={ipoScores.get(selectedIpo.id) ?? 0}
          quarterlyResults={quarterlyResults}
          promoterHoldings={promoterHoldings}
          loading={loadingDetail}
          onClose={() => setSelectedIpo(null)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
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

function DetailDrawer({
  ipo,
  score,
  quarterlyResults,
  promoterHoldings,
  loading,
  onClose,
}: {
  ipo: IPO;
  score: number;
  quarterlyResults: QuarterlyResult[];
  promoterHoldings: PromoterHolding[];
  loading: boolean;
  onClose: () => void;
}) {
  const listingGainsAmt = ipo.listing_price && ipo.issue_price ? ipo.listing_price - ipo.issue_price : null;
  const currentGainsAmt = ipo.current_price && ipo.issue_price ? ipo.current_price - ipo.issue_price : null;
  const band = getScoreBand(score);
  const BandIcon = band.icon;

  // Score breakdown
  const scoreBreakdown = useMemo(() => {
    const totalSub = ipo.total_subscription ?? 0;
    const qib = ipo.qib_subscription ?? 0;
    const listingGains = ipo.listing_gains_pct ?? 0;
    const currentGains = ipo.current_gains_pct ?? 0;
    const issueSize = ipo.issue_size_cr ?? 0;

    let subPts = 0, qibPts = 0, listPts = 0, currPts = 0, sizePts = 0;

    if (totalSub >= 20) subPts = 30; else if (totalSub >= 10) subPts = 25; else if (totalSub >= 5) subPts = 20; else if (totalSub >= 3) subPts = 15; else if (totalSub >= 1) subPts = 8;
    if (qib >= 15) qibPts = 20; else if (qib >= 10) qibPts = 16; else if (qib >= 5) qibPts = 12; else if (qib >= 2) qibPts = 8; else if (qib >= 1) qibPts = 4;
    if (listingGains >= 30) listPts = 20; else if (listingGains >= 15) listPts = 16; else if (listingGains >= 5) listPts = 12; else if (listingGains >= 0) listPts = 6;
    if (currentGains >= 30) currPts = 20; else if (currentGains >= 15) currPts = 16; else if (currentGains >= 5) currPts = 12; else if (currentGains >= 0) currPts = 6;
    if (issueSize >= 2000) sizePts = 10; else if (issueSize >= 1000) sizePts = 8; else if (issueSize >= 500) sizePts = 6; else if (issueSize >= 200) sizePts = 4; else sizePts = 2;

    return [
      { label: "Subscription Demand", pts: subPts, max: 30, detail: `${fmt(totalSub, 1)}x total` },
      { label: "QIB Conviction", pts: qibPts, max: 20, detail: `${fmt(qib, 1)}x QIB` },
      { label: "Listing Performance", pts: listPts, max: 20, detail: `${listingGains > 0 ? "+" : ""}${fmt(listingGains)}%` },
      { label: "Price Momentum", pts: currPts, max: 20, detail: `${currentGains > 0 ? "+" : ""}${fmt(currentGains)}%` },
      { label: "Issue Size Support", pts: sizePts, max: 10, detail: `₹${fmt(issueSize, 0)} Cr` },
    ];
  }, [ipo]);

  // Analyst signals
  const signals = useMemo(() => {
    const totalSub = ipo.total_subscription ?? 0;
    const qib = ipo.qib_subscription ?? 0;
    const rii = ipo.rii_subscription ?? 0;
    const listingGains = ipo.listing_gains_pct ?? 0;
    const currentGains = ipo.current_gains_pct ?? 0;

    const positives: string[] = [];
    const negatives: string[] = [];

    if (totalSub >= 5) positives.push("Strong overall subscription indicates high market demand");
    if (qib >= 5) positives.push("High QIB subscription signals institutional conviction");
    if (listingGains > 15) positives.push("Premium listing suggests strong post-issue appetite");
    if (currentGains > 10) positives.push("Sustained price momentum above issue price");
    if (ipo.issue_size_cr && ipo.issue_size_cr >= 1000) positives.push("Large issue size provides liquidity and institutional support");

    if (totalSub > 0 && totalSub < 1) negatives.push("Undersubscribed issue indicates weak demand");
    if (listingGains < 0) negatives.push("Discounted listing reflects weak market reception");
    if (currentGains < -10) negatives.push("Significant erosion from issue price");
    if (qib > 0 && qib < 1) negatives.push("Low QIB participation may indicate quality concerns");
    if (rii > 0 && rii < 1) negatives.push("Low retail interest suggests limited market enthusiasm");

    return { positives, negatives };
  }, [ipo]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-slate-900 border-l border-slate-800 overflow-y-auto h-full"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-600 flex items-center justify-center">
              <Building2 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{ipo.company_name}</h2>
              <p className="text-xs text-slate-400">{ipo.sector ?? "—"}{ipo.industry ? ` · ${ipo.industry}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Analyst Score Card */}
          <div className={`rounded-xl border p-4 ${band.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BandIcon size={18} className={band.color} />
                <h3 className="text-sm font-semibold text-white">Analyst Score</h3>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${band.color}`}>{score}</span>
                <span className="text-xs text-slate-500">/ 100</span>
              </div>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full ${getScoreBarColor(score)} transition-all`} style={{ width: `${score}%` }} />
            </div>
            <span className={`text-xs font-medium ${band.color}`}>{band.label}</span>

            {/* Score Breakdown */}
            <div className="mt-4 space-y-2">
              {scoreBreakdown.map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-32 shrink-0">{item.label}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${(item.pts / item.max) >= 0.7 ? "bg-emerald-500" : (item.pts / item.max) >= 0.4 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${(item.pts / item.max) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-400 w-20 text-right shrink-0">{item.pts}/{item.max} · {item.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Company Description */}
          {ipo.notes && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
                <Info size={14} className="text-amber-400" /> Company Description
              </h3>
              <div className="bg-slate-800/40 rounded-lg p-4">
                <p className="text-sm text-slate-300 leading-relaxed">{ipo.notes}</p>
              </div>
            </div>
          )}

          {/* Company Info */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
              <Building2 size={14} className="text-amber-400" /> Company Overview
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <InfoBox label="Sector" value={ipo.sector ?? "—"} />
              <InfoBox label="Industry" value={ipo.industry ?? "—"} />
              <InfoBox label="Exchange" value={ipo.exchange ?? "NSE"} />
              <InfoBox label="Face Value" value={`₹${fmt(ipo.face_value)}`} />
              <InfoBox label="Lot Size" value={String(ipo.lot_size ?? "—")} />
              <InfoBox label="Issue Size" value={`₹${fmt(ipo.issue_size_cr, 1)} Cr`} />
            </div>
          </div>

          {/* IPO Dates */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
              <Calendar size={14} className="text-amber-400" /> Important Dates
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <InfoBox label="Open Date" value={fmtDate(ipo.open_date)} />
              <InfoBox label="Close Date" value={fmtDate(ipo.close_date)} />
              <InfoBox label="Listing Date" value={fmtDate(ipo.listing_date)} />
            </div>
          </div>

          {/* Price Performance */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
              <DollarSign size={14} className="text-amber-400" /> Price Performance
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <InfoBox label="Issue Price" value={`₹${fmt(ipo.issue_price)}`} />
              <InfoBox label="Listing Price" value={`₹${fmt(ipo.listing_price)}`} />
              <InfoBox label="Current Price" value={`₹${fmt(ipo.current_price)}`} />
              <InfoBox label="Face Value" value={`₹${fmt(ipo.face_value)}`} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Listing Gains</p>
                <p className={`text-lg font-bold ${getGainsColor(ipo.listing_gains_pct)}`}>
                  {ipo.listing_gains_pct != null ? `${ipo.listing_gains_pct > 0 ? "+" : ""}${fmt(ipo.listing_gains_pct)}%` : "—"}
                </p>
                {listingGainsAmt != null && (
                  <p className={`text-xs ${getGainsColor(ipo.listing_gains_pct)}`}>
                    {listingGainsAmt > 0 ? "+" : ""}₹{fmt(listingGainsAmt)}
                  </p>
                )}
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Current Gains (vs Issue)</p>
                <p className={`text-lg font-bold ${getGainsColor(ipo.current_gains_pct)}`}>
                  {ipo.current_gains_pct != null ? `${ipo.current_gains_pct > 0 ? "+" : ""}${fmt(ipo.current_gains_pct)}%` : "—"}
                </p>
                {currentGainsAmt != null && (
                  <p className={`text-xs ${getGainsColor(ipo.current_gains_pct)}`}>
                    {currentGainsAmt > 0 ? "+" : ""}₹{fmt(currentGainsAmt)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Subscription Details */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
              <Users size={14} className="text-amber-400" /> Subscription Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">QIB</p>
                <p className={`text-base font-bold ${getSubColor(ipo.qib_subscription)}`}>{fmt(ipo.qib_subscription, 1)}x</p>
                <p className="text-[10px] text-slate-600">Qualified Institutional</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">NII</p>
                <p className={`text-base font-bold ${getSubColor(ipo.nii_subscription)}`}>{fmt(ipo.nii_subscription, 1)}x</p>
                <p className="text-[10px] text-slate-600">Non-Institutional</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">RII</p>
                <p className={`text-base font-bold ${getSubColor(ipo.rii_subscription)}`}>{fmt(ipo.rii_subscription, 1)}x</p>
                <p className="text-[10px] text-slate-600">Retail Individual</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Total</p>
                <p className={`text-base font-bold ${getSubColor(ipo.total_subscription)}`}>{fmt(ipo.total_subscription, 1)}x</p>
                <p className="text-[10px] text-slate-600">Overall</p>
              </div>
            </div>
          </div>

          {/* Analyst Signals */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
              <Zap size={14} className="text-amber-400" /> Analyst Signals
            </h3>
            <div className="space-y-2">
              {signals.positives.map((s, idx) => (
                <div key={`pos-${idx}`} className="flex items-start gap-2 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2">
                  <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-300">{s}</p>
                </div>
              ))}
              {signals.negatives.map((s, idx) => (
                <div key={`neg-${idx}`} className="flex items-start gap-2 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                  <XCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-300">{s}</p>
                </div>
              ))}
              {signals.positives.length === 0 && signals.negatives.length === 0 && (
                <div className="bg-slate-800/40 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">No significant signals detected.</p>
                </div>
              )}
            </div>
          </div>

          {/* Quarterly Results */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-amber-400" /> Quarterly Results
            </h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw size={20} className="animate-spin text-slate-600" />
              </div>
            ) : quarterlyResults.length === 0 ? (
              <div className="bg-slate-800/40 rounded-lg p-4 text-center">
                <p className="text-xs text-slate-500">No quarterly results available yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-2 py-2 text-xs text-slate-500 text-left">Quarter</th>
                      <th className="px-2 py-2 text-xs text-slate-500 text-right">Revenue (Cr)</th>
                      <th className="px-2 py-2 text-xs text-slate-500 text-right">Profit (Cr)</th>
                      <th className="px-2 py-2 text-xs text-slate-500 text-right">PAT Margin</th>
                      <th className="px-2 py-2 text-xs text-slate-500 text-right">EPS</th>
                      <th className="px-2 py-2 text-xs text-slate-500 text-right">Rev Growth</th>
                      <th className="px-2 py-2 text-xs text-slate-500 text-right">Profit Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quarterlyResults.map(qr => (
                      <tr key={qr.id} className="border-b border-slate-800/40">
                        <td className="px-2 py-2 text-xs text-white font-medium">{qr.quarter_label ?? qr.quarter}</td>
                        <td className="px-2 py-2 text-right font-mono text-xs text-slate-300">{fmt(qr.revenue_cr, 1)}</td>
                        <td className={`px-2 py-2 text-right font-mono text-xs ${qr.profit_cr != null && qr.profit_cr < 0 ? "text-red-400" : "text-emerald-400"}`}>{fmt(qr.profit_cr, 1)}</td>
                        <td className="px-2 py-2 text-right font-mono text-xs text-slate-400">{qr.pat_margin != null ? `${fmt(qr.pat_margin, 1)}%` : "—"}</td>
                        <td className="px-2 py-2 text-right font-mono text-xs text-slate-400">{fmt(qr.eps)}</td>
                        <td className={`px-2 py-2 text-right font-mono text-xs ${getGainsColor(qr.revenue_growth_pct)}`}>{qr.revenue_growth_pct != null ? `${qr.revenue_growth_pct > 0 ? "+" : ""}${fmt(qr.revenue_growth_pct, 1)}%` : "—"}</td>
                        <td className={`px-2 py-2 text-right font-mono text-xs ${getGainsColor(qr.profit_growth_pct)}`}>{qr.profit_growth_pct != null ? `${qr.profit_growth_pct > 0 ? "+" : ""}${fmt(qr.profit_growth_pct, 1)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Promoter Holdings */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
              <PieChart size={14} className="text-amber-400" /> Promoter Holding History
            </h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw size={20} className="animate-spin text-slate-600" />
              </div>
            ) : promoterHoldings.length === 0 ? (
              <div className="bg-slate-800/40 rounded-lg p-4 text-center">
                <p className="text-xs text-slate-500">No promoter holding data available yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {promoterHoldings.map(ph => (
                  <div key={ph.id} className="flex items-center gap-3 bg-slate-800/40 rounded-lg px-3 py-2.5">
                    <span className="text-xs text-slate-400 w-20">{ph.quarter_label ?? ph.quarter}</span>
                    <div className="flex-1 h-6 bg-slate-800 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full ${(ph.promoter_holding_pct ?? 0) >= 50 ? "bg-emerald-500" : (ph.promoter_holding_pct ?? 0) >= 25 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(ph.promoter_holding_pct ?? 0, 100)}%` }}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono text-white">
                        {fmt(ph.promoter_holding_pct, 1)}%
                      </span>
                    </div>
                    {ph.change_pct != null && ph.change_pct !== 0 && (
                      <span className={`text-xs font-mono w-16 text-right ${ph.change_pct < 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {ph.change_pct > 0 ? "+" : ""}{fmt(ph.change_pct, 1)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trading Insights */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
              <AlertCircle size={14} className="text-amber-400" /> Trading Insights
            </h3>
            <div className="space-y-1.5">
              <InsightRow
                label="Subscription Strength"
                value={getSubscriptionStrength(ipo.total_subscription)}
                color={getSubColor(ipo.total_subscription)}
              />
              <InsightRow
                label="Listing Performance"
                value={getPerformanceLabel(ipo.listing_gains_pct)}
                color={getGainsColor(ipo.listing_gains_pct)}
              />
              <InsightRow
                label="Current Performance"
                value={getPerformanceLabel(ipo.current_gains_pct)}
                color={getGainsColor(ipo.current_gains_pct)}
              />
              <InsightRow
                label="QIB Interest"
                value={ipo.qib_subscription != null ? `${fmt(ipo.qib_subscription, 1)}x subscribed` : "—"}
                color={getSubColor(ipo.qib_subscription)}
              />
              <InsightRow
                label="Retail Interest"
                value={ipo.rii_subscription != null ? `${fmt(ipo.rii_subscription, 1)}x subscribed` : "—"}
                color={getSubColor(ipo.rii_subscription)}
              />
              <InsightRow
                label="Analyst Rating"
                value={band.label}
                color={band.color}
              />
            </div>
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

function InsightRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs font-medium ${color}`}>{value}</span>
    </div>
  );
}

function getSubscriptionStrength(sub: number | null): string {
  if (sub == null) return "—";
  if (sub >= 10) return "Very Strong";
  if (sub >= 3) return "Strong";
  if (sub >= 1) return "Moderate";
  return "Weak";
}

function getPerformanceLabel(pct: number | null): string {
  if (pct == null) return "—";
  if (pct >= 50) return "Excellent";
  if (pct >= 20) return "Good";
  if (pct >= 0) return "Positive";
  if (pct >= -10) return "Slightly Negative";
  return "Poor";
}
