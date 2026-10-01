import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle, CheckCircle2, Clock, ArrowRight, Filter, X, Database, Info } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { StockMover, SchedulerRun } from "../lib/types";
import StockTable from "../components/StockTable";

function getISTDate() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    .toISOString()
    .split("T")[0];
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

export default function Home() {
  const [gainers, setGainers] = useState<StockMover[]>([]);
  const [losers, setLosers] = useState<StockMover[]>([]);
  const [lastRun, setLastRun] = useState<SchedulerRun | null>(null);
  const [threshold, setThreshold] = useState(3);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [istTime, setISTTime] = useState(getISTTime());
  const [activeTab, setActiveTab] = useState<"gainers" | "losers">("gainers");

  const [priceMin, setPriceMin] = useState(200);
  const [priceMax, setPriceMax] = useState(300);
  const [pctFilter, setPctFilter] = useState(5);
  const [showFilters, setShowFilters] = useState(false);

  const filteredGainers = useMemo(() =>
    gainers.filter(s => s.price >= priceMin && s.price <= priceMax && s.pct_change >= pctFilter),
    [gainers, priceMin, priceMax, pctFilter]
  );

  const filteredLosers = useMemo(() =>
    losers.filter(s => s.price >= priceMin && s.price <= priceMax && s.pct_change <= -pctFilter),
    [losers, priceMin, priceMax, pctFilter]
  );

  useEffect(() => {
    const t = setInterval(() => setISTTime(getISTTime()), 1000);
    return () => clearInterval(t);
  }, []);

  const [dataDate, setDataDate] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const today = getISTDate();

      // Try today first
      let [gainersRes, losersRes] = await Promise.all([
        supabase.from("stock_movers").select("*").eq("date", today).eq("mover_type", "gainer").order("pct_change", { ascending: false }),
        supabase.from("stock_movers").select("*").eq("date", today).eq("mover_type", "loser").order("pct_change", { ascending: true }),
      ]);

      // If no data for today, get the most recent date's data
      let effectiveDate = today;
      if ((gainersRes.data?.length ?? 0) === 0 && (losersRes.data?.length ?? 0) === 0) {
        // Get the latest available date
        const { data: latestDateRow } = await supabase
          .from("stock_movers")
          .select("date")
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestDateRow?.date) {
          effectiveDate = latestDateRow.date;
          [gainersRes, losersRes] = await Promise.all([
            supabase.from("stock_movers").select("*").eq("date", effectiveDate).eq("mover_type", "gainer").order("pct_change", { ascending: false }),
            supabase.from("stock_movers").select("*").eq("date", effectiveDate).eq("mover_type", "loser").order("pct_change", { ascending: true }),
          ]);
        }
      }

      const [runRes, settingRes] = await Promise.all([
        supabase.from("scheduler_runs").select("*").order("run_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "threshold_pct").maybeSingle(),
      ]);

      if (gainersRes.error) throw gainersRes.error;
      if (losersRes.error) throw losersRes.error;

      setGainers(gainersRes.data ?? []);
      setLosers(losersRes.data ?? []);
      setDataDate(effectiveDate);
      setLastRun(runRes.data ?? null);
      setThreshold(parseFloat(settingRes.data?.value ?? "3"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function runFetchNow() {
    setFetching(true);
    setError(null);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-stock-data`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ triggered_by: "manual" }),
        }
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setFetching(false);
    }
  }

  async function runBackfill() {
    setBackfilling(true);
    setError(null);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-stock-data`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ triggered_by: "manual", backfill: true }),
        }
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const today = getISTDate();
  const effectiveDate = dataDate || today;
  const isStaleData = dataDate && dataDate !== today;

  const formattedDate = new Date(effectiveDate).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  function StatusBadge({ run }: { run: SchedulerRun | null }) {
    if (!run) return <span className="inline-flex items-center gap-1 text-slate-500 text-xs">No runs yet</span>;
    const map = {
      success: { icon: <CheckCircle2 size={13} />, cls: "text-emerald-400" },
      partial: { icon: <AlertCircle size={13} />, cls: "text-amber-400" },
      failed: { icon: <AlertCircle size={13} />, cls: "text-red-400" },
      running: { icon: <RefreshCw size={13} className="animate-spin" />, cls: "text-blue-400" },
    };
    const { icon, cls } = map[run.status];
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${cls}`}>
        {icon}
        {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
      </span>
    );
  }

  const hasActiveFilters = priceMin !== 200 || priceMax !== 300 || pctFilter !== 5;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Today's Market Movers</h1>
          <p className="text-slate-400 text-sm mt-0.5">{formattedDate}</p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-900/30 border border-amber-800 text-amber-300 text-xs font-medium">
            <Info size={12} /> Educational screening aid — not investment advice
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Clock size={11} /> IST: {istTime}</span>
            <span className="text-slate-700">|</span>
            <span>NSE threshold: <span className="text-slate-300 font-semibold">±{threshold}%</span></span>
            {lastRun && (
              <>
                <span className="text-slate-700">|</span>
                <span>Last fetch: <span className="text-slate-300">{new Date(lastRun.run_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true })}</span></span>
                <StatusBadge run={lastRun} />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={runFetchNow}
            disabled={fetching || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {fetching
              ? <><RefreshCw size={14} className="animate-spin" /> Fetching…</>
              : <><TrendingUp size={14} /> Fetch Now</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stale data warning */}
      {isStaleData && (
        <div className="mb-4 flex items-start gap-2 bg-amber-900/30 border border-amber-700 rounded-lg px-4 py-3 text-amber-300 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <span>
              Showing data from <strong>{new Date(dataDate!).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</strong>.
              Data is missing for recent trading days. The auto-scheduler now runs at 5 PM IST on weekdays.
            </span>
            <button
              onClick={runBackfill}
              disabled={backfilling || fetching || loading}
              className="ml-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              {backfilling
                ? <><RefreshCw size={12} className="animate-spin" /> Backfilling…</>
                : <><Database size={12} /> Backfill Missing Days</>}
            </button>
          </div>
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
        <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-2 rounded-lg">
          Price: ₹{priceMin}–₹{priceMax}
        </span>
        <span className="text-xs text-slate-500 bg-slate-800 px-2.5 py-2 rounded-lg">
          Change: ±{pctFilter}%+
        </span>
        {hasActiveFilters && (
          <button
            onClick={() => { setPriceMin(200); setPriceMax(300); setPctFilter(5); }}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={12} /> Reset
          </button>
        )}
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
                  value={pctFilter}
                  onChange={e => setPctFilter(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-600"
                />
                <div className="flex gap-1 flex-wrap">
                  {[1, 2, 3, 5, 8, 10, 15].map(p => (
                    <button
                      key={p}
                      onClick={() => setPctFilter(p)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${
                        pctFilter === p ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
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
                    value={priceMin}
                    onChange={e => setPriceMin(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Max</label>
                  <input
                    type="number"
                    value={priceMax}
                    onChange={e => setPriceMax(Math.max(priceMin, parseInt(e.target.value) || 100000))}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {[100, 200, 300, 500, 1000, 5000].map(preset => (
                    <button
                      key={preset}
                      onClick={() => { setPriceMin(preset); setPriceMax(preset + 100); }}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        priceMin === preset && priceMax === preset + 100
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
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Showing: {filteredGainers.length} gainers, {filteredLosers.length} losers (price ₹{priceMin}–₹{priceMax}, change ≥{pctFilter}%)
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setActiveTab("gainers")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "gainers"
              ? "bg-emerald-600 text-white"
              : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
          }`}
        >
          <TrendingUp size={14} /> Gainers ({filteredGainers.length})
        </button>
        <button
          onClick={() => setActiveTab("losers")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "losers"
              ? "bg-red-600 text-white"
              : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
          }`}
        >
          <TrendingDown size={14} /> Losers ({filteredLosers.length})
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="animate-spin text-slate-600" />
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className={`px-4 py-3 border-b flex items-center justify-between ${activeTab === "gainers" ? "border-emerald-900/40 bg-emerald-900/10" : "border-red-900/40 bg-red-900/10"}`}>
            <div className="flex items-center gap-2">
              {activeTab === "gainers"
                ? <TrendingUp size={16} className="text-emerald-400" />
                : <TrendingDown size={16} className="text-red-400" />}
              <span className="text-sm font-semibold text-white">
                {activeTab === "gainers"
                  ? `Gainers (≥+${pctFilter}%, ₹${priceMin}–₹${priceMax})`
                  : `Losers (≤-${pctFilter}%, ₹${priceMin}–₹${priceMax})`}
              </span>
            </div>
            <Link
              to="/history"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            >
              View history <ArrowRight size={12} />
            </Link>
          </div>
          <StockTable rows={activeTab === "gainers" ? filteredGainers : filteredLosers} compact onDeleted={loadData} />
        </div>
      )}
    </div>
  );
}
