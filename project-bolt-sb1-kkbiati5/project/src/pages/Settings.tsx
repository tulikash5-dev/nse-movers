import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon, RefreshCw, CheckCircle2, AlertCircle,
  Clock, Calendar, TrendingUp, TrendingDown, Activity, PlayCircle,
  Zap, Key, Globe, Info, Database
} from "lucide-react";
import { supabase } from "../lib/supabase";
import type { SchedulerRun } from "../lib/types";
import { getProviderConfig, setProviderConfig, type DataProvider } from "../lib/liveMarketProvider";

const THRESHOLD_OPTIONS = [1, 2, 3, 5, 8, 10];

function fmtRunTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function StatusPill({ status }: { status: SchedulerRun["status"] }) {
  const cfg = {
    success: { cls: "bg-emerald-900/50 text-emerald-300 border-emerald-800", icon: <CheckCircle2 size={12} />, label: "Success" },
    partial: { cls: "bg-amber-900/50 text-amber-300 border-amber-800", icon: <AlertCircle size={12} />, label: "Partial" },
    failed: { cls: "bg-red-900/50 text-red-300 border-red-800", icon: <AlertCircle size={12} />, label: "Failed" },
    running: { cls: "bg-blue-900/50 text-blue-300 border-blue-800", icon: <RefreshCw size={12} className="animate-spin" />, label: "Running" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

export default function Settings() {
  const [runs, setRuns] = useState<SchedulerRun[]>([]);
  const [threshold, setThreshold] = useState(3);
  const [schedulerEnabled, setSchedulerEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live Data API Configuration
  const [dataProvider, setDataProvider] = useState<DataProvider>("simulated");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [runsRes, thresholdRes, enabledRes] = await Promise.all([
        supabase.from("scheduler_runs").select("*").order("run_at", { ascending: false }).limit(20),
        supabase.from("app_settings").select("value").eq("key", "threshold_pct").maybeSingle(),
        supabase.from("app_settings").select("value").eq("key", "scheduler_enabled").maybeSingle(),
      ]);
      if (runsRes.error) throw runsRes.error;
      setRuns(runsRes.data ?? []);
      setThreshold(parseFloat(thresholdRes.data?.value ?? "3"));
      setSchedulerEnabled((enabledRes.data?.value ?? "true") === "true");

      // Load live data API settings
      const providerRes = await supabase.from("app_settings").select("value").eq("key", "live_data_provider").maybeSingle();
      if (providerRes.data?.value) {
        const config = JSON.parse(providerRes.data.value);
        setDataProvider(config.provider || "simulated");
        setApiKey(config.apiKey || "");
        setApiSecret(config.apiSecret || "");
        setAccessToken(config.accessToken || "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { error: e1 } = await supabase.from("app_settings").upsert({ key: "threshold_pct", value: String(threshold) });
      const { error: e2 } = await supabase.from("app_settings").upsert({ key: "scheduler_enabled", value: String(schedulerEnabled) });

      // Save live data API configuration
      const apiConfig = JSON.stringify({
        provider: dataProvider,
        apiKey,
        apiSecret,
        accessToken,
      });
      const { error: e3 } = await supabase.from("app_settings").upsert({ key: "live_data_provider", value: apiConfig });

      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;

      // Update provider config
      setProviderConfig({
        provider: dataProvider,
        apiKey: apiKey || undefined,
        apiSecret: apiSecret || undefined,
        accessToken: accessToken || undefined,
      });

      setSuccessMsg("Settings saved successfully.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function runFetchNow() {
    setFetching(true);
    setError(null);
    setSuccessMsg(null);
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
      setSuccessMsg(`Fetch complete: ${data.gainers_count} gainers, ${data.losers_count} losers from ${data.stocks_fetched} stocks.`);
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
    setSuccessMsg(null);
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
      setSuccessMsg(`Backfill complete: ${data.dates_succeeded} dates fetched, ${data.gainers_count} gainers, ${data.losers_count} losers.${data.failed_dates?.length > 0 ? ` Failed: ${data.failed_dates.join(", ")}` : ""}`);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const lastRun = runs[0] ?? null;
  const nextRunIST = "10:30 AM UTC (4:00 PM IST) — weekdays";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
          <SettingsIcon size={20} className="text-slate-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 text-sm">Configure threshold, scheduler, and data refresh</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-300 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 flex items-start gap-2 bg-emerald-900/30 border border-emerald-800 rounded-lg px-4 py-3 text-emerald-300 text-sm">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Threshold Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400" /> % Change Threshold
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Stocks moving beyond this % will be tracked as gainers or losers.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {THRESHOLD_OPTIONS.map(t => (
              <button
                key={t}
                onClick={() => setThreshold(t)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                  threshold === t
                    ? "bg-emerald-600 text-white border-emerald-500"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:border-emerald-700 hover:text-white"
                }`}
              >
                ±{t}%
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-500">Custom:</label>
            <input
              type="number"
              min={0.1}
              max={50}
              step={0.5}
              value={threshold}
              onChange={e => setThreshold(parseFloat(e.target.value) || 3)}
              className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-600"
            />
            <span className="text-sm text-slate-400">%</span>
          </div>
        </div>

        {/* Scheduler Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
            <Activity size={16} className="text-blue-400" /> Scheduler Status
          </h2>
          <p className="text-xs text-slate-500 mb-4">Auto-runs daily after market close (4:00 PM IST, weekdays)</p>

          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-slate-800/60 rounded-lg px-3 py-2.5">
              <Clock size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Last Run</p>
                {lastRun ? (
                  <>
                    <p className="text-sm text-white">{fmtRunTime(lastRun.run_at)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusPill status={lastRun.status} />
                      <span className="text-xs text-slate-500">{lastRun.triggered_by}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No runs yet</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 bg-slate-800/60 rounded-lg px-3 py-2.5">
              <Calendar size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Next Scheduled Run</p>
                <p className="text-sm text-white">{nextRunIST}</p>
              </div>
            </div>

            {lastRun && (
              <div className="flex items-start gap-3 bg-slate-800/60 rounded-lg px-3 py-2.5">
                <TrendingDown size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Last Result</p>
                  <p className="text-sm text-white">
                    <span className="text-emerald-400">{lastRun.gainers_count} gainers</span>
                    {" · "}
                    <span className="text-red-400">{lastRun.losers_count} losers</span>
                    {" · "}
                    <span className="text-slate-400">{lastRun.stocks_fetched} stocks scanned</span>
                  </p>
                  {lastRun.message && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{lastRun.message}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${schedulerEnabled ? "bg-emerald-400" : "bg-slate-600"}`} />
                <span className="text-sm text-slate-300">Auto-scheduler</span>
              </div>
              <button
                onClick={() => setSchedulerEnabled(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${schedulerEnabled ? "bg-emerald-600" : "bg-slate-700"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${schedulerEnabled ? "left-5.5 translate-x-0.5" : "left-0.5"}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Data API Configuration */}
      <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <Zap size={16} className="text-cyan-400" /> Live Market Data API
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Configure a real-time data provider for CHOCH detection. Currently using simulated data.
          For live market, you need a broker API (Zerodha, Angel One, Upstox) or Yahoo Finance.
        </p>

        <div className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">Data Provider</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "simulated", label: "Simulated", icon: "🎲", desc: "Test mode" },
                { value: "yahoo", label: "Yahoo Finance", icon: "🌐", desc: "Free, delayed" },
                { value: "zerodha", label: "Zerodha", icon: "🪁", desc: "Real-time" },
                { value: "angelone", label: "Angel One", icon: "👼", desc: "Real-time" },
                { value: "upstox", label: "Upstox", icon: "📊", desc: "Real-time" },
              ].map(p => (
                <button
                  key={p.value}
                  onClick={() => setDataProvider(p.value as DataProvider)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    dataProvider === p.value
                      ? "bg-cyan-600 text-white border-cyan-500"
                      : "bg-slate-800 text-slate-300 border-slate-700 hover:border-cyan-700"
                  }`}
                >
                  <span className="mr-1">{p.icon}</span>
                  {p.label}
                  <span className="ml-1 text-xs opacity-60">({p.desc})</span>
                </button>
              ))}
            </div>
          </div>

          {/* API Credentials for broker APIs */}
          {(dataProvider === "zerodha" || dataProvider === "angelone" || dataProvider === "upstox") && (
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/20 rounded-lg px-3 py-2">
                <Info size={14} />
                <span>API credentials required for {dataProvider === "zerodha" ? "Zerodha Kite Connect" : dataProvider === "angelone" ? "Angel One SmartAPI" : "Upstox API"}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">API Key</label>
                  <input
                    type="password"
                    placeholder="Enter API key"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">API Secret</label>
                  <input
                    type="password"
                    placeholder="Enter API secret"
                    value={apiSecret}
                    onChange={e => setApiSecret(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Access Token</label>
                <input
                  type="password"
                  placeholder="Enter access token (generate from broker dashboard)"
                  value={accessToken}
                  onChange={e => setAccessToken(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-600"
                />
              </div>

              <p className="text-xs text-slate-500">
                {dataProvider === "zerodha" && (
                  <a href="https://kite.trade/'" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                    Get Zerodha API credentials →
                  </a>
                )}
                {dataProvider === "angelone" && (
                  <a href="https://smartapi.angelone.in/'" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                    Get Angel One API credentials →
                  </a>
                )}
                {dataProvider === "upstox" && (
                  <a href="https://upstox.com/developer/api-documentation/'" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                    Get Upstox API credentials →
                  </a>
                )}
              </p>
            </div>
          )}

          {/* Yahoo Finance Info */}
          {dataProvider === "yahoo" && (
            <div className="pt-3 border-t border-slate-800">
              <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2">
                <Globe size={14} className="mt-0.5 shrink-0 text-blue-400" />
                <span>
                  Yahoo Finance provides free but <strong className="text-amber-400">delayed data (15-20 min)</strong>.
                  For Indian stocks, symbols are auto-formatted as SYMBOL.NS (NSE) or SYMBOL.BO (BSE).
                  Real-time CHOCH detection requires a broker API.
                </span>
              </div>
            </div>
          )}

          {/* Simulated Info */}
          {dataProvider === "simulated" && (
            <div className="pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2">
                <Activity size={14} className="text-emerald-400" />
                <span>
                  Using random walk simulation to generate price data. Good for testing CHOCH algorithm,
                  but <strong className="text-amber-400">not real market data</strong>.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual trigger + Backfill */}
      <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <PlayCircle size={16} className="text-amber-400" /> Manual Data Fetch
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Trigger an immediate data fetch from the NSE Bhav Copy. This uses the currently saved threshold.
          The fetch scans ~2400 NSE EQ stocks and stores gainers/losers above the threshold.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={runFetchNow}
            disabled={fetching || loading || backfilling}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition-colors disabled:opacity-50"
          >
            {fetching
              ? <><RefreshCw size={15} className="animate-spin" /> Fetching data…</>
              : <><PlayCircle size={15} /> Fetch Latest</>}
          </button>

          <button
            onClick={runBackfill}
            disabled={fetching || loading || backfilling}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-colors disabled:opacity-50"
          >
            {backfilling
              ? <><RefreshCw size={15} className="animate-spin" /> Backfilling…</>
              : <><Database size={15} /> Backfill Missing Days</>}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          <strong className="text-slate-400">Backfill</strong> automatically detects dates with no data and fetches them from the NSE Bhav Copy archive. This may take a few minutes depending on how many days are missing.
        </p>
      </div>

      {/* Save + run history */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors disabled:opacity-50"
        >
          {saving ? <><RefreshCw size={15} className="animate-spin" /> Saving…</> : "Save Settings"}
        </button>
      </div>

      {/* Run History */}
      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Scheduler Run History</h2>
          <button
            onClick={loadData}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={20} className="animate-spin text-slate-600" />
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600">
            <Activity size={24} className="mb-2" />
            <p className="text-sm">No scheduler runs yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {runs.map(run => (
              <div key={run.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-slate-800/20 transition-colors">
                <div className="flex items-center gap-3">
                  <StatusPill status={run.status} />
                  <div>
                    <p className="text-sm text-white font-medium">{fmtRunTime(run.run_at)}</p>
                    {run.message && (
                      <p className="text-xs text-slate-500 max-w-sm truncate" title={run.message}>{run.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="text-emerald-400 font-medium">{run.gainers_count}↑</span>
                  <span className="text-red-400 font-medium">{run.losers_count}↓</span>
                  <span>{run.stocks_fetched} scanned</span>
                  <span>±{run.threshold_used}%</span>
                  <span className="text-slate-600">{run.triggered_by}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
