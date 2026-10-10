import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import {
  Activity, TrendingUp, TrendingDown, Zap, Target, BarChart3, Brain,
  RefreshCw, ArrowUp, ArrowDown, ChevronDown, ChevronUp, AlertTriangle,
  Flame, Gauge, Layers, Award, Eye, Clock, CheckCircle2, XCircle,
} from "lucide-react";

// ===== Types =====
interface ScanRun {
  id: string;
  scan_time: string;
  stocks_scanned: number;
  signals_count: number;
  bullish_count: number;
  bearish_count: number;
  long_buildup_count: number;
  short_buildup_count: number;
  short_covering_count: number;
  long_unwinding_count: number;
  market_sentiment: string;
  nifty_trend: string;
  banknifty_trend: string;
  status: string;
  message: string | null;
  triggered_by: string;
}

interface ScanSnapshot {
  id: string;
  scan_run_id: string;
  scan_time: string;
  symbol: string;
  company_name: string;
  sector: string | null;
  ltp: number;
  price_change_pct: number;
  volume: number;
  avg_20d_volume: number;
  volume_ratio: number;
  oi_change_pct: number;
  oi_velocity: string;
  vwap: number;
  atr: number;
  relative_strength: number;
  market_structure: string;
  choch: boolean;
  choch_type: string | null;
  bos: boolean;
  bos_type: string | null;
  classification: string;
  confidence_score: number;
  grade: string;
  signal: string | null;
  entry_price: number | null;
  stop_loss: number | null;
  target_1: number | null;
  target_2: number | null;
  target_3: number | null;
  target_4: number | null;
  risk_reward: number | null;
  rank: number;
}

interface OifSignal {
  id: string;
  signal_time: string;
  symbol: string;
  company_name: string;
  sector: string | null;
  signal_type: string;
  classification: string;
  confidence_score: number;
  grade: string;
  entry_price: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  target_3: number;
  target_4: number | null;
  risk_reward: number;
  oi_change_pct: number;
  volume_ratio: number;
  vwap: number;
  market_structure: string;
  choch_confirmed: boolean;
  bos_confirmed: boolean;
  relative_strength: number;
  status: string;
  exit_price: number | null;
  exit_time: string | null;
  pnl_pct: number | null;
  pnl_r: number | null;
  winning_trade: boolean | null;
}

interface LearningWeights {
  id: string;
  updated_at: string;
  oi_weight: number;
  oi_velocity_weight: number;
  volume_weight: number;
  structure_weight: number;
  choch_bos_weight: number;
  relative_strength_weight: number;
  option_chain_weight: number;
  total_signals: number;
  winning_trades: number;
  losing_trades: number;
  current_accuracy: number;
  best_oi_threshold: number;
  best_volume_threshold: number;
  notes: string | null;
}

type TabType = "scanner" | "signals" | "analytics" | "learning";

// ===== Helpers =====
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

const CLASSIFICATION_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  "Long Buildup": { bg: "bg-emerald-900/40", text: "text-emerald-400", border: "border-emerald-700" },
  "Short Buildup": { bg: "bg-red-900/40", text: "text-red-400", border: "border-red-700" },
  "Short Covering": { bg: "bg-teal-900/40", text: "text-teal-400", border: "border-teal-700" },
  "Long Unwinding": { bg: "bg-orange-900/40", text: "text-orange-400", border: "border-orange-700" },
  "Neutral": { bg: "bg-slate-800/40", text: "text-slate-400", border: "border-slate-700" },
};

const GRADE_CONFIG: Record<string, { bg: string; text: string }> = {
  "A+": { bg: "bg-emerald-600", text: "text-white" },
  "A": { bg: "bg-emerald-700", text: "text-white" },
  "A-": { bg: "bg-blue-700", text: "text-white" },
  "B": { bg: "bg-amber-700", text: "text-white" },
  "C": { bg: "bg-slate-600", text: "text-white" },
  "D": { bg: "bg-slate-700", text: "text-slate-400" },
};

const SIGNAL_STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  "Waiting": { bg: "bg-slate-800", text: "text-slate-400" },
  "Triggered": { bg: "bg-blue-900/40", text: "text-blue-400" },
  "Target 1 Hit": { bg: "bg-emerald-900/40", text: "text-emerald-400" },
  "Target 2 Hit": { bg: "bg-emerald-800/50", text: "text-emerald-300" },
  "Target 3 Hit": { bg: "bg-emerald-700/60", text: "text-emerald-200" },
  "SL Hit": { bg: "bg-red-900/40", text: "text-red-400" },
  "Closed": { bg: "bg-slate-700/40", text: "text-slate-300" },
};

// ===== Summary Card =====
function SummaryCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: typeof TrendingUp; color: string; sub?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shrink-0`}>
        <Icon size={16} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-white font-bold text-sm leading-tight">{value}</p>
        {sub && <p className="text-[9px] text-slate-600 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ===== Expandable Row =====
function ScannerRow({ s, expanded, onToggle }: {
  s: ScanSnapshot; expanded: boolean; onToggle: () => void;
}) {
  const cls = CLASSIFICATION_CONFIG[s.classification] ?? CLASSIFICATION_CONFIG["Neutral"];
  const gradeCfg = GRADE_CONFIG[s.grade] ?? GRADE_CONFIG["D"];
  const isBuy = s.signal === "BUY";
  const isSell = s.signal === "SELL";

  return (
    <>
      <tr
        onClick={onToggle}
        className={`border-b border-slate-800/40 cursor-pointer transition-colors hover:bg-slate-800/40 ${
          isBuy ? "bg-emerald-950/20" : isSell ? "bg-red-950/20" : ""
        }`}
      >
        <td className="px-2 py-2 text-xs text-slate-500 font-mono">{s.rank}</td>
        <td className="px-2 py-2">
          <span className="text-white text-xs font-bold">{s.symbol}</span>
          {s.signal && (
            <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded font-bold ${
              isBuy ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            }`}>
              {s.signal}
            </span>
          )}
        </td>
        <td className="px-2 py-2 text-right text-xs font-mono text-white">{fmt(s.ltp)}</td>
        <td className={`px-2 py-2 text-right text-xs font-mono ${s.price_change_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {s.price_change_pct >= 0 ? "+" : ""}{fmt(s.price_change_pct)}%
        </td>
        <td className="px-2 py-2 text-right text-xs font-mono text-slate-300">{s.volume_ratio}x</td>
        <td className="px-2 py-2 text-right text-xs font-mono text-slate-300">+{fmt(s.oi_change_pct)}%</td>
        <td className="px-2 py-2 text-center">
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${cls.bg} ${cls.text} ${cls.border} border font-medium`}>
            {s.classification}
          </span>
        </td>
        <td className="px-2 py-2 text-center text-xs text-slate-400">{s.market_structure}</td>
        <td className="px-2 py-2 text-center">
          {s.choch ? <span className="text-[9px] text-cyan-400 font-medium">CHOCH</span> : <span className="text-slate-700">—</span>}
        </td>
        <td className="px-2 py-2 text-center">
          {s.bos ? <span className="text-[9px] text-blue-400 font-medium">BOS</span> : <span className="text-slate-700">—</span>}
        </td>
        <td className="px-2 py-2 text-center text-xs font-mono text-slate-400">{s.ltp > s.vwap ? "Above" : "Below"}</td>
        <td className={`px-2 py-2 text-right text-xs font-mono ${s.relative_strength >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {s.relative_strength >= 0 ? "+" : ""}{fmt(s.relative_strength)}%
        </td>
        <td className="px-2 py-2 text-center">
          <span className={`text-xs font-bold ${s.confidence_score >= 80 ? "text-emerald-400" : s.confidence_score >= 70 ? "text-amber-400" : "text-slate-400"}`}>
            {s.confidence_score}
          </span>
        </td>
        <td className="px-2 py-2 text-center">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${gradeCfg.bg} ${gradeCfg.text}`}>
            {s.grade}
          </span>
        </td>
        <td className="px-2 py-2 text-center">
          {expanded ? <ChevronUp size={12} className="text-slate-500 mx-auto" /> : <ChevronDown size={12} className="text-slate-500 mx-auto" />}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-800">
          <td colSpan={15} className="px-4 py-3 bg-slate-900/60">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                <p className="text-[9px] text-slate-500">VWAP</p>
                <p className="text-slate-300 font-mono">{fmt(s.vwap)}</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                <p className="text-[9px] text-slate-500">ATR</p>
                <p className="text-slate-300 font-mono">{fmt(s.atr)}</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                <p className="text-[9px] text-slate-500">OI Velocity</p>
                <p className="text-slate-300 font-mono">{s.oi_velocity}</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                <p className="text-[9px] text-slate-500">Volume</p>
                <p className="text-slate-300 font-mono">{fmtVol(s.volume)}</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                <p className="text-[9px] text-slate-500">20D Avg Vol</p>
                <p className="text-slate-300 font-mono">{fmtVol(s.avg_20d_volume)}</p>
              </div>
              <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                <p className="text-[9px] text-slate-500">CHOCH Type</p>
                <p className="text-slate-300 font-mono">{s.choch_type ?? "—"}</p>
              </div>
              {s.entry_price != null && (
                <>
                  <div className="bg-emerald-900/20 rounded-lg px-2.5 py-1.5 border border-emerald-800/50">
                    <p className="text-[9px] text-emerald-500">Entry</p>
                    <p className="text-emerald-400 font-mono font-bold">{fmt(s.entry_price)}</p>
                  </div>
                  <div className="bg-red-900/20 rounded-lg px-2.5 py-1.5 border border-red-800/50">
                    <p className="text-[9px] text-red-500">Stop Loss</p>
                    <p className="text-red-400 font-mono font-bold">{fmt(s.stop_loss)}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                    <p className="text-[9px] text-slate-500">Target 1</p>
                    <p className="text-slate-300 font-mono">{fmt(s.target_1)}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                    <p className="text-[9px] text-slate-500">Target 2</p>
                    <p className="text-slate-300 font-mono">{fmt(s.target_2)}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                    <p className="text-[9px] text-slate-500">Target 3</p>
                    <p className="text-slate-300 font-mono">{fmt(s.target_3)}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                    <p className="text-[9px] text-slate-500">Target 4 (ATR)</p>
                    <p className="text-slate-300 font-mono">{fmt(s.target_4)}</p>
                  </div>
                  <div className="bg-slate-800/40 rounded-lg px-2.5 py-1.5">
                    <p className="text-[9px] text-slate-500">R:R</p>
                    <p className="text-slate-300 font-mono">1:{s.risk_reward}</p>
                  </div>
                </>
              )}
            </div>
            {s.company_name && (
              <p className="text-[10px] text-slate-500 mt-2">{s.company_name} {s.sector && `· ${s.sector}`}</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ===== Signal Alert Card =====
function SignalAlertCard({ sig }: { sig: OifSignal }) {
  const isBuy = sig.signal_type === "BUY";
  const statusCfg = SIGNAL_STATUS_CONFIG[sig.status] ?? SIGNAL_STATUS_CONFIG["Waiting"];

  return (
    <div className={`rounded-xl border p-3.5 ${
      isBuy ? "border-emerald-800 bg-emerald-950/30" : "border-red-800 bg-red-950/30"
    }`}>
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isBuy ? "bg-emerald-600" : "bg-red-600"}`}>
            {isBuy ? <TrendingUp size={14} className="text-white" /> : <TrendingDown size={14} className="text-white" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-bold text-sm">{sig.symbol}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${isBuy ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
                {sig.signal_type}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${GRADE_CONFIG[sig.grade]?.bg ?? "bg-slate-700"} ${GRADE_CONFIG[sig.grade]?.text ?? "text-slate-400"}`}>
                {sig.grade}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">{sig.classification} · Confidence {sig.confidence_score}</p>
          </div>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded ${statusCfg.bg} ${statusCfg.text} font-medium`}>
          {sig.status}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-2">
        <div className="bg-slate-800/40 rounded px-2 py-1">
          <p className="text-[8px] text-slate-500">Entry</p>
          <p className={`text-xs font-mono font-bold ${isBuy ? "text-emerald-400" : "text-red-400"}`}>{fmt(sig.entry_price)}</p>
        </div>
        <div className="bg-slate-800/40 rounded px-2 py-1">
          <p className="text-[8px] text-slate-500">SL</p>
          <p className="text-xs font-mono text-red-400">{fmt(sig.stop_loss)}</p>
        </div>
        <div className="bg-slate-800/40 rounded px-2 py-1">
          <p className="text-[8px] text-slate-500">T1</p>
          <p className="text-xs font-mono text-slate-300">{fmt(sig.target_1)}</p>
        </div>
        <div className="bg-slate-800/40 rounded px-2 py-1">
          <p className="text-[8px] text-slate-500">T2</p>
          <p className="text-xs font-mono text-slate-300">{fmt(sig.target_2)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[9px] text-slate-500">
        <span>OI +{fmt(sig.oi_change_pct)}%</span>
        <span>Vol {sig.volume_ratio}x</span>
        <span>{sig.choch_confirmed && "CHOCH"}</span>
        <span>{sig.bos_confirmed && "BOS"}</span>
        <span>RS {sig.relative_strength >= 0 ? "+" : ""}{fmt(sig.relative_strength)}%</span>
        <span className="ml-auto">{timeAgo(sig.signal_time)}</span>
      </div>

      {sig.pnl_pct != null && (
        <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">PnL</span>
          <span className={`text-xs font-bold font-mono ${sig.winning_trade ? "text-emerald-400" : "text-red-400"}`}>
            {sig.winning_trade ? "+" : ""}{fmt(sig.pnl_pct)}% ({sig.pnl_r?.toFixed(1)}R)
          </span>
        </div>
      )}
    </div>
  );
}

// ===== Main Component =====
export default function OiFlowIntelligence() {
  const [scanRun, setScanRun] = useState<ScanRun | null>(null);
  const [snapshots, setSnapshots] = useState<ScanSnapshot[]>([]);
  const [signals, setSignals] = useState<OifSignal[]>([]);
  const [allSignals, setAllSignals] = useState<OifSignal[]>([]);
  const [weights, setWeights] = useState<LearningWeights | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("scanner");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "buy" | "sell" | "long_buildup" | "short_buildup" | "short_covering" | "long_unwinding" | "a_plus">("all");
  const [toast, setToast] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: run, error: runErr } = await supabase
        .from("oif_scan_runs")
        .select("*")
        .order("scan_time", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (runErr) throw runErr;

      if (!run) {
        setScanRun(null);
        setSnapshots([]);
        setSignals([]);
        return;
      }

      setScanRun(run as ScanRun);
      const runId = (run as ScanRun).id;

      const [snapRes, sigRes, allSigRes, lwRes] = await Promise.all([
        supabase.from("oif_scan_snapshots").select("*").eq("scan_run_id", runId).order("rank", { ascending: true }),
        supabase.from("oif_signals").select("*").eq("scan_run_id", runId).order("confidence_score", { ascending: false }),
        supabase.from("oif_signals").select("*").order("signal_time", { ascending: false }).limit(100),
        supabase.from("oif_learning_weights").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (snapRes.error) throw snapRes.error;

      setSnapshots((snapRes.data ?? []) as ScanSnapshot[]);
      setSignals((sigRes.data ?? []) as OifSignal[]);
      setAllSignals((allSigRes.data ?? []) as OifSignal[]);
      setWeights((lwRes.data ?? null) as LearningWeights | null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scan data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => loadData(), 300000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function runScanNow() {
    setScanning(true);
    setError(null);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oi-flow-scan`,
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
      setToast(`Scan complete: ${data.signals} signals from ${data.stocks_scanned} stocks`);
      setTimeout(() => setToast(null), 3500);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  // ===== Derived data =====
  const filteredSnapshots = useMemo(() => {
    let result = snapshots;
    if (filter === "buy") result = result.filter(s => s.signal === "BUY");
    else if (filter === "sell") result = result.filter(s => s.signal === "SELL");
    else if (filter === "long_buildup") result = result.filter(s => s.classification === "Long Buildup");
    else if (filter === "short_buildup") result = result.filter(s => s.classification === "Short Buildup");
    else if (filter === "short_covering") result = result.filter(s => s.classification === "Short Covering");
    else if (filter === "long_unwinding") result = result.filter(s => s.classification === "Long Unwinding");
    else if (filter === "a_plus") result = result.filter(s => s.grade === "A+" || s.grade === "A");
    return result;
  }, [snapshots, filter]);

  // Top 10 buy and sell candidates
  const topBuys = useMemo(() =>
    snapshots.filter(s => s.signal === "BUY").sort((a, b) => b.confidence_score - a.confidence_score).slice(0, 10),
  [snapshots]);
  const topSells = useMemo(() =>
    snapshots.filter(s => s.signal === "SELL").sort((a, b) => b.confidence_score - a.confidence_score).slice(0, 10),
  [snapshots]);

  // Top by classification
  const topLongBuildup = useMemo(() =>
    snapshots.filter(s => s.classification === "Long Buildup").sort((a, b) => b.oi_change_pct - a.oi_change_pct).slice(0, 10),
  [snapshots]);
  const topShortBuildup = useMemo(() =>
    snapshots.filter(s => s.classification === "Short Buildup").sort((a, b) => b.oi_change_pct - a.oi_change_pct).slice(0, 10),
  [snapshots]);

  // Analytics from allSignals
  const analytics = useMemo(() => {
    const completed = allSignals.filter(s => s.status === "Closed" || s.status === "SL Hit" || s.status.includes("Target"));
    const wins = completed.filter(s => s.winning_trade === true);
    const losses = completed.filter(s => s.winning_trade === false);
    const winRate = completed.length > 0 ? (wins.length / completed.length) * 100 : 0;
    const longSignals = completed.filter(s => s.signal_type === "BUY");
    const shortSignals = completed.filter(s => s.signal_type === "SELL");
    const longWins = longSignals.filter(s => s.winning_trade === true);
    const shortWins = shortSignals.filter(s => s.winning_trade === true);
    const longAcc = longSignals.length > 0 ? (longWins.length / longSignals.length) * 100 : 0;
    const shortAcc = shortSignals.length > 0 ? (shortWins.length / shortSignals.length) * 100 : 0;
    const totalPnl = completed.reduce((sum, s) => sum + (s.pnl_pct ?? 0), 0);
    const avgRR = completed.length > 0
      ? completed.reduce((sum, s) => sum + (s.risk_reward ?? 0), 0) / completed.length
      : 0;

    // Sector performance
    const sectorMap = new Map<string, { wins: number; total: number }>();
    for (const s of completed) {
      const sec = s.sector ?? "Unknown";
      const entry = sectorMap.get(sec) ?? { wins: 0, total: 0 };
      entry.total++;
      if (s.winning_trade) entry.wins++;
      sectorMap.set(sec, entry);
    }
    const sectorPerf = Array.from(sectorMap.entries())
      .map(([name, v]) => ({ name, acc: v.total > 0 ? (v.wins / v.total) * 100 : 0, total: v.total }))
      .sort((a, b) => b.acc - a.acc);
    const bestSector = sectorPerf[0];
    const worstSector = sectorPerf[sectorPerf.length - 1];

    // Setup type performance
    const setupMap = new Map<string, { wins: number; total: number }>();
    for (const s of completed) {
      const cls = s.classification;
      const entry = setupMap.get(cls) ?? { wins: 0, total: 0 };
      entry.total++;
      if (s.winning_trade) entry.wins++;
      setupMap.set(cls, entry);
    }
    const setupPerf = Array.from(setupMap.entries())
      .map(([name, v]) => ({ name, acc: v.total > 0 ? (v.wins / v.total) * 100 : 0, total: v.total }))
      .sort((a, b) => b.acc - a.acc);

    return {
      total: allSignals.length, completed: completed.length, wins: wins.length, losses: losses.length,
      winRate, longAcc, shortAcc, totalPnl, avgRR,
      bestSector, worstSector, sectorPerf, setupPerf,
    };
  }, [allSignals]);

  // High confidence alerts (score > 90 and grade A+)
  const highAlerts = useMemo(() =>
    signals.filter(s => s.confidence_score > 90 && s.grade === "A+"),
  [signals]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Brain size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base sm:text-lg tracking-tight">Smart OI Flow Intelligence</h1>
            <p className="text-[10px] text-slate-500">
              {scanRun ? `Last scan: ${timeAgo(scanRun.scan_time)} · ${scanRun.stocks_scanned} stocks` : "No scan data yet"}
            </p>
          </div>
        </div>
        <button
          onClick={runScanNow}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-medium transition-colors"
        >
          <RefreshCw size={13} className={scanning ? "animate-spin" : ""} />
          {scanning ? "Scanning..." : "Scan Now"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      {/* High Priority Alerts */}
      {highAlerts.length > 0 && (
        <div className="mb-4 bg-gradient-to-r from-amber-900/30 to-orange-900/20 border border-amber-800 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Flame size={14} className="text-amber-400" />
            <span className="text-amber-400 font-bold text-xs uppercase tracking-wide">Elite Alerts</span>
            <span className="text-[10px] text-slate-500">Score &gt; 90 · Grade A+</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {highAlerts.map(sig => <SignalAlertCard key={sig.id} sig={sig} />)}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {scanRun && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
          <SummaryCard label="Stocks Scanned" value={scanRun.stocks_scanned} icon={Eye} color="bg-slate-600" />
          <SummaryCard label="Signals" value={scanRun.signals_count} icon={Zap} color="bg-amber-600" />
          <SummaryCard label="Bullish" value={scanRun.bullish_count} icon={TrendingUp} color="bg-emerald-600" />
          <SummaryCard label="Bearish" value={scanRun.bearish_count} icon={TrendingDown} color="bg-red-600" />
          <SummaryCard label="Sentiment" value={scanRun.market_sentiment} icon={Gauge}
            color={scanRun.market_sentiment === "Bullish" ? "bg-emerald-600" : scanRun.market_sentiment === "Bearish" ? "bg-red-600" : "bg-slate-600"} />
          <SummaryCard label="Long Buildup" value={scanRun.long_buildup_count} icon={ArrowUp} color="bg-emerald-700" />
          <SummaryCard label="Short Buildup" value={scanRun.short_buildup_count} icon={ArrowDown} color="bg-red-700" />
          <SummaryCard label="Short Covering" value={scanRun.short_covering_count} icon={ArrowUp} color="bg-teal-700" />
          <SummaryCard label="Long Unwinding" value={scanRun.long_unwinding_count} icon={ArrowDown} color="bg-orange-700" />
          <SummaryCard label="Nifty Trend" value={scanRun.nifty_trend} icon={BarChart3}
            color={scanRun.nifty_trend === "Bullish" ? "bg-emerald-600" : scanRun.nifty_trend === "Bearish" ? "bg-red-600" : "bg-slate-600"} />
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-800 overflow-x-auto">
        {([
          { key: "scanner", label: "Scanner", icon: Activity },
          { key: "signals", label: "Signals", icon: Zap, badge: signals.length },
          { key: "analytics", label: "Analytics", icon: BarChart3 },
          { key: "learning", label: "Learning", icon: Brain },
        ] as { key: TabType; label: string; icon: typeof Activity; badge?: number }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-800 text-amber-200">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="text-slate-600 animate-spin" />
          <span className="ml-2 text-sm text-slate-500">Loading scan data...</span>
        </div>
      ) : !scanRun ? (
        <div className="text-center py-20">
          <Brain size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm mb-1">No scan data yet</p>
          <p className="text-slate-600 text-xs mb-4">Click "Scan Now" to run the first scan</p>
          <button
            onClick={runScanNow}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
            Run First Scan
          </button>
        </div>
      ) : (
        <>
          {/* ===== Scanner Tab ===== */}
          {activeTab === "scanner" && (
            <div>
              {/* Filter Bar */}
              <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
                {([
                  { key: "all", label: "All" },
                  { key: "buy", label: "BUY Signals" },
                  { key: "sell", label: "SELL Signals" },
                  { key: "a_plus", label: "A+ & A Only" },
                  { key: "long_buildup", label: "Long Buildup" },
                  { key: "short_buildup", label: "Short Buildup" },
                  { key: "short_covering", label: "Short Covering" },
                  { key: "long_unwinding", label: "Long Unwinding" },
                ] as { key: typeof filter; label: string }[]).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                      filter === f.key ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Scanner Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-left">#</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-left">Symbol</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-right">LTP</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-right">Chg%</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-right">Vol</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-right">OI%</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-center">Class</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-center">Struct</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-center">CHOCH</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-center">BOS</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-center">VWAP</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-right">RS</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-center">Score</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-center">Grade</th>
                      <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSnapshots.slice(0, 80).map(s => (
                      <ScannerRow
                        key={s.id}
                        s={s}
                        expanded={expandedRow === s.id}
                        onToggle={() => setExpandedRow(expandedRow === s.id ? null : s.id)}
                      />
                    ))}
                    {filteredSnapshots.length === 0 && (
                      <tr>
                        <td colSpan={15} className="px-3 py-12 text-center text-slate-600 text-xs">
                          No stocks match this filter
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== Signals Tab ===== */}
          {activeTab === "signals" && (
            <div className="space-y-4">
              {/* Top Buy / Sell */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                    <TrendingUp size={13} /> Top 10 Buy Candidates
                  </h3>
                  <div className="space-y-2">
                    {topBuys.length > 0 ? topBuys.map(s => {
                      const sig = signals.find(sig => sig.symbol === s.symbol);
                      return sig ? <SignalAlertCard key={sig.id} sig={sig} /> : null;
                    }) : (
                      <p className="text-xs text-slate-600 py-4 text-center">No buy signals in this scan</p>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-red-400 mb-2 flex items-center gap-1.5">
                    <TrendingDown size={13} /> Top 10 Sell Candidates
                  </h3>
                  <div className="space-y-2">
                    {topSells.length > 0 ? topSells.map(s => {
                      const sig = signals.find(sig => sig.symbol === s.symbol);
                      return sig ? <SignalAlertCard key={sig.id} sig={sig} /> : null;
                    }) : (
                      <p className="text-xs text-slate-600 py-4 text-center">No sell signals in this scan</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Classification Rankings */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                  <h3 className="text-xs font-bold text-emerald-400 mb-2">Top Long Buildup</h3>
                  <div className="space-y-1">
                    {topLongBuildup.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/40">
                        <span className="text-white font-medium">{s.symbol}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-mono">+{fmt(s.oi_change_pct)}%</span>
                          <span className="text-slate-500 font-mono">{fmt(s.ltp)}</span>
                        </div>
                      </div>
                    ))}
                    {topLongBuildup.length === 0 && <p className="text-xs text-slate-600 py-2">None detected</p>}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                  <h3 className="text-xs font-bold text-red-400 mb-2">Top Short Buildup</h3>
                  <div className="space-y-1">
                    {topShortBuildup.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/40">
                        <span className="text-white font-medium">{s.symbol}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 font-mono">+{fmt(s.oi_change_pct)}%</span>
                          <span className="text-slate-500 font-mono">{fmt(s.ltp)}</span>
                        </div>
                      </div>
                    ))}
                    {topShortBuildup.length === 0 && <p className="text-xs text-slate-600 py-2">None detected</p>}
                  </div>
                </div>
              </div>

              {/* All Signals History */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                  <Clock size={13} /> Signal History (Last 100)
                </h3>
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-left">Time</th>
                        <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-left">Symbol</th>
                        <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-center">Type</th>
                        <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-center">Score</th>
                        <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-center">Grade</th>
                        <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-right">Entry</th>
                        <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-right">SL</th>
                        <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-center">Status</th>
                        <th className="px-2 py-2 text-[10px] text-slate-600 font-semibold text-right">PnL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSignals.slice(0, 50).map(sig => {
                        const statusCfg = SIGNAL_STATUS_CONFIG[sig.status] ?? SIGNAL_STATUS_CONFIG["Waiting"];
                        return (
                          <tr key={sig.id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                            <td className="px-2 py-1.5 text-[10px] text-slate-500">{timeAgo(sig.signal_time)}</td>
                            <td className="px-2 py-1.5 text-xs text-white font-medium">{sig.symbol}</td>
                            <td className="px-2 py-1.5 text-center">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${sig.signal_type === "BUY" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
                                {sig.signal_type}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-center text-xs font-mono text-slate-300">{sig.confidence_score}</td>
                            <td className="px-2 py-1.5 text-center">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${GRADE_CONFIG[sig.grade]?.bg ?? "bg-slate-700"} ${GRADE_CONFIG[sig.grade]?.text ?? "text-slate-400"}`}>
                                {sig.grade}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right text-xs font-mono text-slate-400">{fmt(sig.entry_price)}</td>
                            <td className="px-2 py-1.5 text-right text-xs font-mono text-red-400">{fmt(sig.stop_loss)}</td>
                            <td className="px-2 py-1.5 text-center">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded ${statusCfg.bg} ${statusCfg.text}`}>{sig.status}</span>
                            </td>
                            <td className={`px-2 py-1.5 text-right text-xs font-mono ${sig.pnl_pct != null ? (sig.winning_trade ? "text-emerald-400" : "text-red-400") : "text-slate-700"}`}>
                              {sig.pnl_pct != null ? `${sig.winning_trade ? "+" : ""}${fmt(sig.pnl_pct)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                      {allSignals.length === 0 && (
                        <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-600 text-xs">No signals generated yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===== Analytics Tab ===== */}
          {activeTab === "analytics" && (
            <div className="space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <SummaryCard label="Total Signals" value={analytics.total} icon={Zap} color="bg-slate-600" />
                <SummaryCard label="Win Rate" value={`${analytics.winRate.toFixed(0)}%`} icon={Award} color="bg-emerald-600" />
                <SummaryCard label="Avg R:R" value={`1:${analytics.avgRR.toFixed(1)}`} icon={Target} color="bg-blue-600" />
                <SummaryCard label="Total PnL" value={`${analytics.totalPnl >= 0 ? "+" : ""}${fmt(analytics.totalPnl)}%`} icon={TrendingUp}
                  color={analytics.totalPnl >= 0 ? "bg-emerald-600" : "bg-red-600"} />
                <SummaryCard label="Completed" value={analytics.completed} icon={CheckCircle2} color="bg-amber-600" />
                <SummaryCard label="Wins" value={analytics.wins} icon={CheckCircle2} color="bg-emerald-600" />
                <SummaryCard label="Losses" value={analytics.losses} icon={XCircle} color="bg-red-600" />
                <SummaryCard label="Long Acc" value={`${analytics.longAcc.toFixed(0)}%`} icon={TrendingUp} color="bg-emerald-700" />
                <SummaryCard label="Short Acc" value={`${analytics.shortAcc.toFixed(0)}%`} icon={TrendingDown} color="bg-red-700" />
                <SummaryCard label="AI Accuracy" value={`${weights?.current_accuracy?.toFixed(0) ?? 0}%`} icon={Brain} color="bg-violet-600" />
              </div>

              {/* Sector Performance */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                  <Layers size={13} className="text-blue-400" /> Sector Performance
                </h3>
                <div className="space-y-1.5">
                  {analytics.sectorPerf.slice(0, 10).map(sec => (
                    <div key={sec.name} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-32 truncate">{sec.name}</span>
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${sec.acc >= 60 ? "bg-emerald-500" : sec.acc >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${sec.acc}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-400 w-12 text-right">{sec.acc.toFixed(0)}%</span>
                      <span className="text-[10px] text-slate-600 w-8 text-right">{sec.total}</span>
                    </div>
                  ))}
                  {analytics.sectorPerf.length === 0 && (
                    <p className="text-xs text-slate-600 py-3 text-center">No completed trades yet</p>
                  )}
                </div>
              </div>

              {/* Setup Type Performance */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                  <Activity size={13} className="text-amber-400" /> Setup Type Performance
                </h3>
                <div className="space-y-1.5">
                  {analytics.setupPerf.map(sp => (
                    <div key={sp.name} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-32 truncate">{sp.name}</span>
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${sp.acc >= 60 ? "bg-emerald-500" : sp.acc >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${sp.acc}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-400 w-12 text-right">{sp.acc.toFixed(0)}%</span>
                      <span className="text-[10px] text-slate-600 w-8 text-right">{sp.total}</span>
                    </div>
                  ))}
                  {analytics.setupPerf.length === 0 && (
                    <p className="text-xs text-slate-600 py-3 text-center">No completed trades yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== Learning Tab ===== */}
          {activeTab === "learning" && (
            <div className="space-y-4">
              {/* AI Accuracy */}
              <div className="bg-gradient-to-r from-violet-900/30 to-blue-900/20 border border-violet-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain size={16} className="text-violet-400" />
                    <h3 className="text-sm font-bold text-white">AI Learning Engine</h3>
                  </div>
                  <span className="text-2xl font-bold text-violet-400">{weights?.current_accuracy?.toFixed(0) ?? 0}%</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">Total Signals</p>
                    <p className="text-lg font-bold text-white">{weights?.total_signals ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">Wins</p>
                    <p className="text-lg font-bold text-emerald-400">{weights?.winning_trades ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase">Losses</p>
                    <p className="text-lg font-bold text-red-400">{weights?.losing_trades ?? 0}</p>
                  </div>
                </div>
              </div>

              {/* Current Model Weights */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <h3 className="text-xs font-bold text-white mb-3">Current Scoring Weights</h3>
                <div className="space-y-2">
                  {[
                    { label: "OI Change", value: weights?.oi_weight ?? 30, color: "bg-emerald-500" },
                    { label: "OI Velocity", value: weights?.oi_velocity_weight ?? 20, color: "bg-blue-500" },
                    { label: "Volume Spike", value: weights?.volume_weight ?? 15, color: "bg-amber-500" },
                    { label: "Market Structure", value: weights?.structure_weight ?? 10, color: "bg-cyan-500" },
                    { label: "CHOCH/BOS Quality", value: weights?.choch_bos_weight ?? 10, color: "bg-violet-500" },
                    { label: "Relative Strength", value: weights?.relative_strength_weight ?? 5, color: "bg-orange-500" },
                    { label: "Option Chain", value: weights?.option_chain_weight ?? 10, color: "bg-pink-500" },
                  ].map(w => (
                    <div key={w.label} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-36 truncate">{w.label}</span>
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${w.color}`} style={{ width: `${(w.value / 30) * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-slate-400 w-10 text-right">{w.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Best Configurations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                  <h3 className="text-xs font-bold text-white mb-2">Best OI Threshold</h3>
                  <p className="text-2xl font-bold text-emerald-400">+{weights?.best_oi_threshold ?? 5}%</p>
                  <p className="text-[10px] text-slate-500 mt-1">Setups with OI change above this show highest win rate</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                  <h3 className="text-xs font-bold text-white mb-2">Best Volume Threshold</h3>
                  <p className="text-2xl font-bold text-blue-400">{weights?.best_volume_threshold ?? 1.5}x</p>
                  <p className="text-[10px] text-slate-500 mt-1">Setups with volume ratio above this show highest win rate</p>
                </div>
              </div>

              {/* Notes */}
              {weights?.notes && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                  <h3 className="text-xs font-bold text-white mb-2">AI Insights</h3>
                  <p className="text-xs text-slate-400">{weights.notes}</p>
                </div>
              )}

              {/* How the learning engine works */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <h3 className="text-xs font-bold text-white mb-2">How the AI Learning Engine Works</h3>
                <ul className="space-y-1.5 text-[11px] text-slate-400">
                  <li className="flex items-start gap-1.5"><span className="text-slate-600">1.</span> Every completed signal is tracked: entry, exit, PnL, win/loss, holding time, MFE, MAE</li>
                  <li className="flex items-start gap-1.5"><span className="text-slate-600">2.</span> The engine analyzes which conditions (OI strength, volume, CHOCH quality, VWAP) correlated with wins</li>
                  <li className="flex items-start gap-1.5"><span className="text-slate-600">3.</span> Scoring weights are automatically adjusted — high-performing factors get more weight</li>
                  <li className="flex items-start gap-1.5"><span className="text-slate-600">4.</span> Optimal OI and volume thresholds are updated based on actual trade outcomes</li>
                  <li className="flex items-start gap-1.5"><span className="text-slate-600">5.</span> The model improves with each completed trade, increasing accuracy over time</li>
                </ul>
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
