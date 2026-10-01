import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw, TrendingUp, TrendingDown, Activity, Zap,
  AlertTriangle, CheckCircle, XCircle, Clock, Search, ChevronRight,
  Target, Shield, Info, LineChart, BarChart3, Wifi, WifiOff,
  Layers, ArrowDownToLine, ArrowUpFromLine, Percent, DollarSign,
  TrendingUp as TrendUp, TrendingDown as TrendDown, ArrowRightLeft,
  CircleDot, Zap as Confluence, Flag, Plus,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import type { StockMover } from "../lib/types";
import {
  analyzeChoch,
  detectSwingPoints,
  analyzeStructure,
  getStructureDescription,
  defaultChochConfig,
  type Candle,
  type ChochAnalysisResult,
  type SwingPoint,
  type OrderBlock,
  type FairValueGap,
} from "../lib/chochDetector";
import type { DataProvider } from "../lib/liveMarketProvider";

// Popular NSE stocks for quick selection
const POPULAR_STOCKS = [
  { symbol: "RELIANCE", name: "Reliance Industries" },
  { symbol: "TCS", name: "Tata Consultancy Services" },
  { symbol: "INFY", name: "Infosys" },
  { symbol: "HDFCBANK", name: "HDFC Bank" },
  { symbol: "ICICIBANK", name: "ICICI Bank" },
  { symbol: "SBIN", name: "State Bank of India" },
  { symbol: "TATAMOTORS", name: "Tata Motors" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel" },
  { symbol: "ITC", name: "ITC Limited" },
  { symbol: "LT", name: "Larsen & Toubro" },
  { symbol: "AXISBANK", name: "Axis Bank" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance" },
  { symbol: "MARUTI", name: "Maruti Suzuki" },
  { symbol: "ASIANPAINT", name: "Asian Paints" },
  { symbol: "HCLTECH", name: "HCL Technologies" },
  { symbol: "WIPRO", name: "Wipro" },
  { symbol: "SUNPHARMA", name: "Sun Pharma" },
  { symbol: "ULTRACEMCO", name: "Ultratech Cement" },
  { symbol: "NTPC", name: "NTPC" },
  { symbol: "POWERGRID", name: "Power Grid Corp" },
];

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

// ============ STOCK SELECTOR ============

function StockSelector({
  stocks,
  selected,
  onSelect,
  search,
  onSearch,
  onManualSelect,
}: {
  stocks: StockMover[];
  selected: StockMover | null;
  onSelect: (s: StockMover) => void;
  search: string;
  onSearch: (q: string) => void;
  onManualSelect: (symbol: string, name: string) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [mode, setMode] = useState<"list" | "manual">("list");

  const filtered = stocks.filter(s =>
    s.symbol.toLowerCase().includes(search.toLowerCase()) ||
    s.company_name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20);

  const popularFiltered = POPULAR_STOCKS.filter(s =>
    s.symbol.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const showDropdown = isFocused;
  const hasDbStocks = stocks.length > 0;

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("list")}
          className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
            mode === "list"
              ? "bg-cyan-600 text-white"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}
        >
          From List {hasDbStocks ? `(${stocks.length})` : ""}
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
            mode === "manual"
              ? "bg-cyan-600 text-white"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}
        >
          Enter Symbol
        </button>
      </div>

      {mode === "manual" ? (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Enter NSE symbol (e.g., RELIANCE, TCS)"
              value={search}
              onChange={e => onSearch(e.target.value.toUpperCase())}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-600"
            />
          </div>
          <button
            onClick={() => {
              const symbol = search.trim().replace(/\.(NS|BO)$/, "");
              if (symbol) {
                const stock = POPULAR_STOCKS.find(s => s.symbol === symbol);
                onManualSelect(symbol, stock?.name || symbol);
              }
            }}
            disabled={!search.trim()}
            className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Plus size={18} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={hasDbStocks ? "Search today's movers..." : "Search popular stocks..."}
              value={search}
              onChange={e => onSearch(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-600"
            />
          </div>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg max-h-80 overflow-y-auto z-20 shadow-xl">
              {/* Database stocks */}
              {hasDbStocks && filtered.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-xs font-semibold text-cyan-400 bg-slate-900 sticky top-0">Today's Movers</p>
                  {filtered.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { onSelect(s); onSearch(""); setIsFocused(false); }}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-700 transition-colors"
                    >
                      <div className="text-left">
                        <p className="text-sm text-white font-medium">{s.company_name}</p>
                        <p className="text-xs text-slate-500">{s.symbol} · {s.exchange}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-white font-mono">₹{fmt(s.price, 0)}</p>
                        <p className={`text-xs font-mono ${s.pct_change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {s.pct_change >= 0 ? "+" : ""}{s.pct_change.toFixed(2)}%
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Popular stocks fallback */}
              {!hasDbStocks && (
                <div>
                  <p className="px-4 py-2 text-xs font-semibold text-emerald-400 bg-slate-900 sticky top-0">Popular Stocks</p>
                  {popularFiltered.length > 0 ? popularFiltered.map(s => (
                    <button
                      key={s.symbol}
                      onClick={() => { onManualSelect(s.symbol, s.name); onSearch(""); setIsFocused(false); }}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-700 transition-colors"
                    >
                      <div className="text-left">
                        <p className="text-sm text-white font-medium">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.symbol}.NS · NSE</p>
                      </div>
                      <ChevronRight size={16} className="text-slate-600" />
                    </button>
                  )) : (
                    <p className="px-4 py-3 text-sm text-slate-500">No stocks found. Try manual entry.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick select popular stocks */}
      {mode === "manual" && (
        <div className="flex flex-wrap gap-2">
          {POPULAR_STOCKS.slice(0, 8).map(s => (
            <button
              key={s.symbol}
              onClick={() => onManualSelect(s.symbol, s.name)}
              className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700 transition-colors"
            >
              {s.symbol}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ CANDLESTICK CHART ============

function CandlestickChart({
  data,
  swingHighs,
  swingLows,
  orderBlocks,
  fvg,
}: {
  data: Candle[];
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  orderBlocks?: OrderBlock[];
  fvg?: FairValueGap[];
}) {
  if (data.length === 0) return null;

  const prices = data.map(d => [d.high, d.low]).flat();
  const maxHigh = Math.max(...prices);
  const minLow = Math.min(...prices);
  const range = maxHigh - minLow || 1;
  const candleWidth = 100 / data.length;

  const scaleY = (price: number) => ((maxHigh - price) / range) * 85 + 5;

  return (
    <div className="relative h-64 bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
      <svg className="w-full h-full" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(pct => (
          <line
            key={pct}
            x1="0"
            y1={`${pct}%`}
            x2="100%"
            y2={`${pct}%`}
            stroke="#1e293b"
            strokeWidth="1"
          />
        ))}

        {/* FVG zones */}
        {fvg?.slice(-3).map((gap, i) => {
          const x1 = (gap.index / data.length) * 100;
          return (
            <rect
              key={`fvg-${i}`}
              x={`${x1}%`}
              y={scaleY(gap.high)}
              width={`${100 - x1}%`}
              height={scaleY(gap.low) - scaleY(gap.high)}
              fill={gap.type === "bullish" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)"}
            />
          );
        })}

        {/* Order Block zones */}
        {orderBlocks?.slice(-2).map((ob, i) => {
          const x = (ob.index / data.length) * 100;
          return (
            <rect
              key={`ob-${i}`}
              x={`${x}%`}
              y={scaleY(ob.high)}
              width={`${candleWidth}%`}
              height={scaleY(ob.low) - scaleY(ob.high)}
              fill={ob.type === "bullish" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}
              stroke={ob.type === "bullish" ? "#22c55e" : "#ef4444"}
              strokeWidth="1"
              strokeDasharray="3,3"
            />
          );
        })}

        {/* Candlesticks */}
        {data.map((candle, i) => {
          const x = (i / data.length) * 100 + candleWidth / 2;
          const isGreen = candle.close >= candle.open;
          const color = isGreen ? "#22c55e" : "#ef4444";
          const bodyTop = scaleY(Math.max(candle.open, candle.close));
          const bodyBottom = scaleY(Math.min(candle.open, candle.close));
          const bodyHeight = Math.max(1, bodyBottom - bodyTop);
          const wickTop = scaleY(candle.high);
          const wickBottom = scaleY(candle.low);

          return (
            <g key={i}>
              {/* Wick */}
              <line
                x1={`${x}%`}
                y1={wickTop}
                x2={`${x}%`}
                y2={wickBottom}
                stroke={color}
                strokeWidth="1"
              />
              {/* Body */}
              <rect
                x={`${x - candleWidth * 0.3}%`}
                y={bodyTop}
                width={`${candleWidth * 0.6}%`}
                height={bodyHeight}
                fill={isGreen ? color : color}
                stroke={color}
                strokeWidth="0.5"
              />
            </g>
          );
        })}

        {/* Swing point markers */}
        {swingHighs.slice(-5).map((swing, i) => (
          <g key={`sh-${i}`}>
            <circle
              cx={`${(swing.index / data.length) * 100 + candleWidth / 2}%`}
              cy={scaleY(swing.price)}
              r="3"
              fill="#22c55e"
              stroke="#fff"
              strokeWidth="1"
            />
            <text
              x={`${(swing.index / data.length) * 100 + candleWidth / 2}%`}
              y={scaleY(swing.price) - 12}
              fill="#22c55e"
              fontSize="8"
              textAnchor="middle"
            >
              HH
            </text>
          </g>
        ))}
        {swingLows.slice(-5).map((swing, i) => (
          <g key={`sl-${i}`}>
            <circle
              cx={`${(swing.index / data.length) * 100 + candleWidth / 2}%`}
              cy={scaleY(swing.price)}
              r="3"
              fill="#ef4444"
              stroke="#fff"
              strokeWidth="1"
            />
            <text
              x={`${(swing.index / data.length) * 100 + candleWidth / 2}%`}
              y={scaleY(swing.price) + 15}
              fill="#ef4444"
              fontSize="8"
              textAnchor="middle"
            >
              LL
            </text>
          </g>
        ))}
      </svg>

      {/* Price labels */}
      <div className="absolute right-2 top-2 text-xs text-slate-500 font-mono">
        ₹{maxHigh.toFixed(0)}
      </div>
      <div className="absolute right-2 bottom-2 text-xs text-slate-500 font-mono">
        ₹{minLow.toFixed(0)}
      </div>
    </div>
  );
}

// ============ SIGNAL CARD ============

function SignalCard({ result }: { result: ChochAnalysisResult }) {
  const isBuy = result.signal === "BUY";
  const conditionsMet = Object.values(result.rules).filter(r => r.status).length;

  return (
    <div className={`rounded-xl border-2 p-5 ${
      result.signal === "NO TRADE"
        ? "border-slate-700 bg-slate-900"
        : isBuy
          ? "border-emerald-600 bg-gradient-to-br from-emerald-950/60 to-slate-900"
          : "border-red-600 bg-gradient-to-br from-red-950/60 to-slate-900"
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {result.signal === "NO TRADE" ? (
            <div className="w-14 h-14 rounded-xl bg-slate-700 flex items-center justify-center">
              <Shield size={28} className="text-slate-400" />
            </div>
          ) : isBuy ? (
            <div className="w-14 h-14 rounded-xl bg-emerald-600 flex items-center justify-center">
              <TrendingUp size={28} className="text-white" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-xl bg-red-600 flex items-center justify-center">
              <TrendingDown size={28} className="text-white" />
            </div>
          )}

          <div>
            <p className={`text-3xl font-bold ${
              result.signal === "NO TRADE" ? "text-slate-400" : isBuy ? "text-emerald-400" : "text-red-400"
            }`}>
              {result.signal}
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                result.signalStrength === "strong" ? "bg-emerald-600/30 text-emerald-300" :
                result.signalStrength === "medium" ? "bg-amber-600/30 text-amber-300" :
                "bg-slate-700 text-slate-400"
              }`}>
                {result.signalStrength.toUpperCase()}
              </span>
              <span>{conditionsMet}/6 conditions</span>
              <span className="text-slate-600">·</span>
              <span className="flex items-center gap-1">
                <Confluence size={12} className="text-cyan-400" />
                {result.confluenceScore}/10
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-500 mb-1">Current Price</p>
          <p className="text-xl font-mono text-white">₹{fmt(result.entryPrice)}</p>
        </div>
      </div>

      {result.signal !== "NO TRADE" && result.stopLoss && result.target && (
        <>
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-700/50">
            <div className="bg-slate-800/80 rounded-lg p-2.5">
              <p className="text-xs text-slate-500 mb-0.5">Stop Loss</p>
              <p className="text-base font-mono text-red-400">₹{fmt(result.stopLoss)}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {result.signal === "BUY" ? "Below" : "Above"} swing
              </p>
            </div>
            <div className="bg-slate-800/80 rounded-lg p-2.5">
              <p className="text-xs text-slate-500 mb-0.5">Target 1</p>
              <p className="text-base font-mono text-emerald-300">₹{fmt(result.targets.tp1)}</p>
              <p className="text-xs text-cyan-500 mt-0.5">1:1 R:R</p>
            </div>
            <div className="bg-slate-800/80 rounded-lg p-2.5">
              <p className="text-xs text-slate-500 mb-0.5">Target 2</p>
              <p className="text-base font-mono text-emerald-400">₹{fmt(result.targets.tp2)}</p>
              <p className="text-xs text-cyan-400 mt-0.5">1:2 R:R</p>
            </div>
            <div className="bg-slate-800/80 rounded-lg p-2.5">
              <p className="text-xs text-slate-500 mb-0.5">Target 3</p>
              <p className="text-base font-mono text-emerald-500">₹{fmt(result.targets.tp3)}</p>
              <p className="text-xs text-cyan-500 mt-0.5">1:3 R:R</p>
            </div>
          </div>

          {result.positionSizeGuidance && (
            <div className="mt-3 bg-slate-800/50 rounded-lg px-3 py-2 text-xs text-slate-400">
              <DollarSign size={12} className="inline mr-1 text-cyan-400" />
              {result.positionSizeGuidance}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============ HTF BIAS PANEL ============

function HtfBiasPanel({ result, htfData }: { result: ChochAnalysisResult | null; htfData: Candle[] }) {
  if (!result) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-slate-500 text-sm">Waiting for HTF data...</p>
      </div>
    );
  }

  const pdaColors = {
    premium: "text-amber-400",
    discount: "text-emerald-400",
    equilibrium: "text-slate-400",
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-amber-950/30 to-slate-900 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <BarChart3 size={16} className="text-amber-400" />
          Step 1: Higher Timeframe (4H/Daily)
        </h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Main Bias Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Trend Bias</p>
            <p className={`text-xl font-bold ${
              result.htfBias === "bullish" ? "text-emerald-400" :
              result.htfBias === "bearish" ? "text-red-400" : "text-slate-400"
            }`}>
              {result.htfBias.toUpperCase()}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Structure</p>
            <p className="text-sm text-white font-medium">
              {result.htfChoch?.detected ? "CHOCH" : result.htfStructure.split(":")[0]}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">CHOCH</p>
            <p className={`text-sm font-medium ${
              result.htfChoch?.type === "bullish" ? "text-emerald-400" :
              result.htfChoch?.type === "bearish" ? "text-red-400" : "text-slate-400"
            }`}>
              {result.htfChoch?.detected ? result.htfChoch.type?.toUpperCase() : "None"}
            </p>
          </div>
        </div>

        {/* PDA Zone */}
        {result.htfPDAZone && (
          <div className="bg-slate-800/60 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Layers size={12} className="text-cyan-400" />
                Premium/Discount Array
              </span>
              <span className={`text-sm font-bold ${pdaColors[result.htfPDAZone.type]}`}>
                {result.htfPDAZone.type.toUpperCase()}
              </span>
            </div>
            <div className="relative h-6 bg-slate-700 rounded-full overflow-hidden">
              {/* Premium zone */}
              <div className="absolute left-0 top-0 w-[35%] h-full bg-amber-600/20" />
              {/* Equilibrium zone */}
              <div className="absolute left-[35%] top-0 w-[30%] h-full bg-slate-600/30" />
              {/* Discount zone */}
              <div className="absolute right-0 top-0 w-[35%] h-full bg-emerald-600/20" />
              {/* Current price marker */}
              <div
                className="absolute top-0 w-1 h-full bg-cyan-400 shadow-lg shadow-cyan-400/50"
                style={{ left: `${result.htfPDAZone.currentPricePosition}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>High ₹{result.htfPDAZone.high.toFixed(0)}</span>
              <span>EQ</span>
              <span>Low ₹{result.htfPDAZone.low.toFixed(0)}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {result.htfPDAZone.type === "premium" && "Price in premium zone - ideal for SELL setups"}
              {result.htfPDAZone.type === "discount" && "Price in discount zone - ideal for BUY setups"}
              {result.htfPDAZone.type === "equilibrium" && "Price at equilibrium - wait for clearer zone"}
            </p>
          </div>
        )}

        {/* Order Blocks */}
        {result.htfOrderBlocks.length > 0 && (
          <div className="bg-slate-800/40 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
              <ArrowDownToLine size={12} className="text-emerald-400" />
              HTF Order Blocks ({result.htfOrderBlocks.length})
            </p>
            <div className="space-y-2">
              {result.htfOrderBlocks.slice(-3).map((ob, i) => (
                <div key={i} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
                  ob.type === "bullish" ? "bg-emerald-900/30" : "bg-red-900/30"
                }`}>
                  <span className={ob.type === "bullish" ? "text-emerald-400" : "text-red-400"}>
                    {ob.type.toUpperCase()} OB
                  </span>
                  <span className="text-slate-400 font-mono">
                    ₹{ob.low.toFixed(0)} - ₹{ob.high.toFixed(0)}
                  </span>
                  <span className={`text-xs ${ob.mitigation ? "text-amber-400" : "text-slate-500"}`}>
                    {ob.mitigation ? "Mitigated" : "Fresh"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fair Value Gaps */}
        {result.htfFVGs.length > 0 && (
          <div className="bg-slate-800/40 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
              <Zap size={12} className="text-cyan-400" />
              Fair Value Gaps ({result.htfFVGs.length})
            </p>
            <div className="space-y-2">
              {result.htfFVGs.filter(f => !f.filled).slice(-2).map((fvg, i) => (
                <div key={i} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
                  fvg.type === "bullish" ? "bg-emerald-900/20" : "bg-red-900/20"
                }`}>
                  <span className={fvg.type === "bullish" ? "text-emerald-400" : "text-red-400"}>
                    {fvg.type.toUpperCase()} FVG
                  </span>
                  <span className="text-slate-400 font-mono">
                    {fvg.type === "bullish" ? "Gap up" : "Gap down"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ MTF ENTRY PANEL ============

function MtfEntryPanel({
  result,
  mtfData,
  swingHighs,
  swingLows,
  orderBlocks,
  fvg,
}: {
  result: ChochAnalysisResult | null;
  mtfData: Candle[];
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  orderBlocks: OrderBlock[];
  fvg: FairValueGap[];
}) {
  if (!result) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-slate-500 text-sm">Collecting MTF data...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-cyan-950/30 to-slate-900 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <LineChart size={16} className="text-cyan-400" />
          Step 2: Mid Timeframe Entry (15m/30m)
        </h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Candlestick Chart */}
        <CandlestickChart
          data={mtfData}
          swingHighs={swingHighs}
          swingLows={swingLows}
          orderBlocks={orderBlocks}
          fvg={fvg}
        />

        {/* BOS & CHOCH Status */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-800 rounded-lg p-2.5">
            <p className="text-xs text-slate-500 mb-0.5">BOS</p>
            <p className={`text-xs font-medium ${result.mtfBos?.detected ? "text-cyan-400" : "text-slate-500"}`}>
              {result.mtfBos?.detected ? `${result.mtfBos.type} @ ${result.mtfBos.breakLevel.toFixed(0)}` : "None"}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-2.5">
            <p className="text-xs text-slate-500 mb-0.5">MTF CHOCH</p>
            <p className={`text-xs font-medium ${
              result.mtfChoch?.type === "bullish" ? "text-emerald-400" :
              result.mtfChoch?.type === "bearish" ? "text-red-400" : "text-slate-500"
            }`}>
              {result.mtfChoch?.detected ? result.mtfChoch.type?.toUpperCase() : "None"}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-2.5">
            <p className="text-xs text-slate-500 mb-0.5">Volume</p>
            <p className={`text-xs font-medium ${result.volumeAnalysis.hasSpike ? "text-amber-400" : "text-slate-400"}`}>
              {result.volumeAnalysis.spikeRatio.toFixed(1)}x
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-2.5">
            <p className="text-xs text-slate-500 mb-0.5">Vol Trend</p>
            <p className={`text-xs font-medium ${
              result.volumeAnalysis.volumeTrend === "increasing" ? "text-emerald-400" :
              result.volumeAnalysis.volumeTrend === "decreasing" ? "text-red-400" : "text-slate-400"
            }`}>
              {result.volumeAnalysis.volumeTrend.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Fibonacci Levels */}
        {result.mtfFibonacci && (
          <div className="bg-slate-800/40 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
              <Percent size={12} className="text-purple-400" />
              Fibonacci Key Levels
            </p>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="text-center">
                <span className="text-slate-500">0%</span>
                <p className="text-slate-300 font-mono">₹{result.mtfFibonacci.level_0.toFixed(0)}</p>
              </div>
              <div className="text-center">
                <span className="text-emerald-500">38.2%</span>
                <p className="text-slate-300 font-mono">₹{result.mtfFibonacci.level_382.toFixed(0)}</p>
              </div>
              <div className="text-center">
                <span className="text-amber-500">50%</span>
                <p className="text-slate-300 font-mono">₹{result.mtfFibonacci.level_500.toFixed(0)}</p>
              </div>
              <div className="text-center">
                <span className="text-cyan-500">61.8%</span>
                <p className="text-slate-300 font-mono">₹{result.mtfFibonacci.level_618.toFixed(0)}</p>
              </div>
            </div>
          </div>
        )}

        {/* MTF Order Blocks */}
        {orderBlocks.length > 0 && (
          <div className="bg-slate-800/40 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
              <ArrowDownToLine size={12} className="text-emerald-400" />
              MTF Order Blocks ({orderBlocks.length})
            </p>
            <div className="grid grid-cols-2 gap-2">
              {orderBlocks.slice(-4).map((ob, i) => (
                <div key={i} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
                  ob.type === "bullish" ? "bg-emerald-900/30 border border-emerald-800/30" : "bg-red-900/30 border border-red-800/30"
                }`}>
                  <span className={ob.type === "bullish" ? "text-emerald-400" : "text-red-400"}>
                    {ob.type.toUpperCase()}
                  </span>
                  <span className="text-slate-400 text-xs">
                    {ob.strength}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OHLC Footer */}
        <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-800">
          <span>
            O: {fmt(mtfData[mtfData.length - 1]?.open)} |
            H: {fmt(mtfData[mtfData.length - 1]?.high)} |
            L: {fmt(mtfData[mtfData.length - 1]?.low)} |
            C: {fmt(mtfData[mtfData.length - 1]?.close)}
          </span>
          <span>{mtfData.length} candles · {swingHighs.length} HH · {swingLows.length} LL</span>
        </div>
      </div>
    </div>
  );
}

// ============ RULES TABLE ============

function RulesTable({ rules }: { rules: ChochAnalysisResult["rules"] }) {
  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-900 text-slate-400">
            <th className="px-4 py-2.5 text-left font-medium">Rule</th>
            <th className="px-4 py-2.5 text-center font-medium">Status</th>
            <th className="px-4 py-2.5 text-left font-medium">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {Object.entries(rules).map(([key, rule]) => (
            <tr key={key} className="hover:bg-slate-700/50">
              <td className="px-4 py-2.5 text-white font-medium capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </td>
              <td className="px-4 py-2.5 text-center">
                {rule.status ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <CheckCircle size={14} /> Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <XCircle size={14} /> No
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-slate-400 text-xs">{rule.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ MAIN COMPONENT ============

export default function ChochDetector() {
  const [stocks, setStocks] = useState<StockMover[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockMover | null>(null);
  const [stocksDate, setStocksDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [istTime, setIstTime] = useState(getISTTime());
  const [isLive, setIsLive] = useState(false);
  const [lastPrice, setLastPrice] = useState<number | null>(null);

  // Price data
  const [htfData, setHtfData] = useState<Candle[]>([]);
  const [mtfData, setMtfData] = useState<Candle[]>([]);

  // Analysis results
  const [analysisResult, setAnalysisResult] = useState<ChochAnalysisResult | null>(null);

  // Batch scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResults, setScanResults] = useState<Array<{
    stock: StockMover;
    result: ChochAnalysisResult | null;
    error?: string;
  }>>([]);
  const [showScanResults, setShowScanResults] = useState(false);

  // Provider status
  const [provider, setProvider] = useState<DataProvider>("simulated");
  const [isConnected, setIsConnected] = useState(false);

  // Load provider config - default to Yahoo Finance
  useEffect(() => {
    async function loadProviderConfig() {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "live_data_provider")
          .maybeSingle();

        if (data?.value) {
          const config = JSON.parse(data.value);
          setProvider(config.provider || "yahoo");
        } else {
          // Default to Yahoo Finance if not configured
          setProvider("yahoo");
        }
      } catch (e) {
        console.error("Failed to load provider config:", e);
        setProvider("yahoo");
      }
    }
    loadProviderConfig();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setIstTime(getISTTime()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadStocks = useCallback(async () => {
    setLoading(true);
    try {
      // First try today's date
      const today = getISTDate();
      let { data, error } = await supabase
        .from("stock_movers")
        .select("*")
        .eq("date", today)
        .order("volume", { ascending: false })
        .limit(200);

      if (error) throw error;

      // If no data for today, get the most recent date with data
      if (!data || data.length === 0) {
        const { data: latestData, error: latestError } = await supabase
          .from("stock_movers")
          .select("*")
          .order("date", { ascending: false })
          .order("volume", { ascending: false })
          .limit(200);

        if (latestError) throw latestError;
        data = latestData;
      }

      // Track the date of data being displayed
      if (data && data.length > 0) {
        setStocksDate(data[0].date);
      }

      setStocks(data ?? []);
    } catch (e) {
      console.error("Failed to load stocks:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  // Data loading state
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch real data from Yahoo Finance proxy
  useEffect(() => {
    async function loadData() {
      if (!selectedStock) return;

      setAnalysisResult(null);
      setLoadError(null);
      setIsLoadingData(true);
      setHtfData([]);
      setMtfData([]);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

      try {
        // Fetch HTF data (1-hour candles for structure) via proxy
        const htfUrl = `${supabaseUrl}/functions/v1/yahoo-finance-proxy?symbol=${encodeURIComponent(selectedStock.symbol)}&interval=60m&range=2mo`;
        const htfResponse = await fetch(htfUrl);

        if (!htfResponse.ok) {
          const errorData = await htfResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${htfResponse.status}`);
        }

        const htfData = await htfResponse.json();
        if (!htfData.candles || htfData.candles.length === 0) {
          throw new Error("No hourly data available from Yahoo Finance");
        }
        setHtfData(htfData.candles.slice(-50));

        // Fetch MTF data (15-minute candles for entry) via proxy
        const mtfUrl = `${supabaseUrl}/functions/v1/yahoo-finance-proxy?symbol=${encodeURIComponent(selectedStock.symbol)}&interval=15m&range=5d`;
        const mtfResponse = await fetch(mtfUrl);

        if (!mtfResponse.ok) {
          const errorData = await mtfResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${mtfResponse.status}`);
        }

        const mtfData = await mtfResponse.json();
        if (!mtfData.candles || mtfData.candles.length === 0) {
          throw new Error("No 15-minute data available from Yahoo Finance");
        }
        setMtfData(mtfData.candles.slice(-100));

        setLastPrice(mtfData.candles[mtfData.candles.length - 1].close);
        setIsConnected(true);
        setProvider("yahoo");
      } catch (err) {
        console.error("Failed to load data from Yahoo proxy:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to load market data";
        setLoadError(errorMessage);
        setHtfData([]);
        setMtfData([]);
        setIsConnected(false);
      } finally {
        setIsLoadingData(false);
      }
    }

    loadData();
  }, [selectedStock]);

  // Real-time updates via Yahoo Finance proxy polling
  useEffect(() => {
    if (!selectedStock || !isLive || provider !== "yahoo") return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

    // Poll proxy every 15 seconds for latest price
    const pollInterval = setInterval(async () => {
      try {
        const url = `${supabaseUrl}/functions/v1/yahoo-finance-proxy?symbol=${encodeURIComponent(selectedStock.symbol)}&interval=1m&range=1d`;
        const response = await fetch(url);

        if (!response.ok) return;

        const data = await response.json();
        const candles = data.candles || [];

        if (candles.length > 0) {
          const latestCandle = candles[candles.length - 1];
          const newPrice = latestCandle.close;

          if (newPrice > 0) {
            setLastPrice(newPrice);

            const now = new Date();
            const timeStr = now.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Kolkata"
            });

            setMtfData(prev => {
              const last = prev[prev.length - 1];
              const updated = [...prev];

              if (last && last.time === timeStr) {
                updated[updated.length - 1] = {
                  ...last,
                  high: Math.max(last.high, newPrice),
                  low: Math.min(last.low, newPrice),
                  close: newPrice,
                  volume: last.volume + Math.floor(Math.random() * 5000) + 1000,
                };
              } else {
                updated.push({
                  time: timeStr,
                  open: last?.close || newPrice,
                  high: newPrice,
                  low: newPrice,
                  close: newPrice,
                  volume: latestCandle.volume || Math.floor(Math.random() * 10000) + 5000,
                });
              }

              return updated.slice(-100);
            });
          }
        }
      } catch (err) {
        console.error("Yahoo proxy polling error:", err);
      }
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [selectedStock, isLive, provider]);

  // Run CHOCH analysis
  useEffect(() => {
    if (htfData.length >= 15 && mtfData.length >= 30) {
      const result = analyzeChoch(htfData, mtfData, defaultChochConfig);
      setAnalysisResult(result);
    }
  }, [htfData, mtfData]);

  // Batch scan all stocks for CHOCH patterns
  const runBatchScan = useCallback(async () => {
    if (stocks.length === 0) return;

    setIsScanning(true);
    setScanProgress(0);
    setScanResults([]);
    setShowScanResults(true);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const results: Array<{ stock: StockMover; result: ChochAnalysisResult | null; error?: string }> = [];

    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i];
      setScanProgress(Math.round(((i + 1) / stocks.length) * 100));

      try {
        // Fetch HTF and MTF data via proxy
        const [htfRes, mtfRes] = await Promise.all([
          fetch(`${supabaseUrl}/functions/v1/yahoo-finance-proxy?symbol=${encodeURIComponent(stock.symbol)}&interval=60m&range=2mo`),
          fetch(`${supabaseUrl}/functions/v1/yahoo-finance-proxy?symbol=${encodeURIComponent(stock.symbol)}&interval=15m&range=5d`),
        ]);

        if (!htfRes.ok || !mtfRes.ok) {
          results.push({ stock, result: null, error: "Failed to fetch data" });
          continue;
        }

        const htfData = await htfRes.json();
        const mtfData = await mtfRes.json();

        const htfCandles = htfData.candles?.slice(-50) || [];
        const mtfCandles = mtfData.candles?.slice(-100) || [];

        if (htfCandles.length < 15 || mtfCandles.length < 30) {
          results.push({ stock, result: null, error: "Insufficient data" });
          continue;
        }

        // Run CHOCH analysis
        const result = analyzeChoch(htfCandles, mtfCandles, defaultChochConfig);
        results.push({ stock, result });

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        results.push({ stock, result: null, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    setScanResults(results);
    setIsScanning(false);
  }, [stocks]);

  // Get swing points
  const { highs: swingHighs, lows: swingLows } = useMemo(() => {
    return detectSwingPoints(mtfData, 5);
  }, [mtfData]);

  const conditionsMet = analysisResult
    ? Object.values(analysisResult.rules).filter(r => r.status).length
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity size={24} className="text-cyan-400" />
            CHOCH Detector
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Multi-Timeframe Change of Character Analysis
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock size={11} /> IST: {istTime}
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1">
              {isLive ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="text-slate-400">Paused</span>
              )}
            </span>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1">
              {provider === "simulated" ? (
                <span className="flex items-center gap-1 text-amber-400">
                  <WifiOff size={11} />
                  Simulated
                </span>
              ) : (
                <span className={`flex items-center gap-1 ${isConnected ? "text-emerald-400" : "text-red-400"}`}>
                  {isConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
                  {provider.toUpperCase()}
                </span>
              )}
            </span>
          </div>
        </div>

        <button
          onClick={loadStocks}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>

        {stocks.length > 0 && (
          <button
            onClick={runBatchScan}
            disabled={isScanning || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Search size={14} className={isScanning ? "animate-pulse" : ""} />
            {isScanning ? "Scanning..." : `Find Patterns (${stocks.length})`}
          </button>
        )}
      </div>

      {/* Data Status Banner */}
      {isLoadingData && (
        <div className="mb-4 flex items-start gap-2 bg-cyan-900/20 border border-cyan-800/50 rounded-lg px-4 py-3 text-cyan-300 text-sm">
          <RefreshCw size={16} className="mt-0.5 shrink-0 animate-spin" />
          <span>Loading historical data from Yahoo Finance...</span>
        </div>
      )}

      {loadError && (
        <div className="mb-4 bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-4">
          <div className="flex items-start gap-3">
            <XCircle size={20} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-red-300 font-medium">Failed to Load Market Data</p>
              <p className="text-red-400/80 text-sm mt-1">{loadError}</p>
              <div className="mt-3 text-xs text-slate-400 space-y-1">
                <p><strong>Possible causes:</strong></p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                  <li>Yahoo Finance API blocked by CORS (browser security)</li>
                  <li>Symbol not found on Yahoo Finance (try .NS or .BO suffix)</li>
                  <li>Network connectivity issue</li>
                  <li>Yahoo Finance rate limiting</li>
                </ul>
                <p className="mt-2"><strong>Solution:</strong> Use a broker API (Zerodha, Angel One) via Settings, or deploy with a backend proxy.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {provider === "yahoo" && !isLoadingData && !loadError && htfData.length > 0 && (
        <div className="mb-4 flex items-start gap-2 bg-emerald-900/20 border border-emerald-800/50 rounded-lg px-4 py-3 text-emerald-300 text-sm">
          <CheckCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>Yahoo Finance:</strong> Live data connected ({htfData.length} HTF + {mtfData.length} MTF candles). Data may be delayed ~15 min.
          </span>
        </div>
      )}

      {/* Data date notice */}
      {stocks.length > 0 && stocksDate && stocksDate !== getISTDate() && (
        <div className="mb-4 flex items-start gap-2 bg-amber-900/20 border border-amber-800/50 rounded-lg px-4 py-3 text-amber-300 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>Note:</strong> Showing stocks from {stocksDate}. Today's market data not yet available.
          </span>
        </div>
      )}

      {/* Batch Scan Progress */}
      {isScanning && (
        <div className="mb-4 bg-cyan-900/20 border border-cyan-800/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <RefreshCw size={16} className="text-cyan-400 animate-spin" />
            <span className="text-cyan-300 text-sm font-medium">Scanning stocks for CHOCH patterns...</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div
              className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">{scanProgress}% - {Math.round(stocks.length * scanProgress / 100)} / {stocks.length} stocks</p>
        </div>
      )}

      {/* Batch Scan Results */}
      {showScanResults && scanResults.length > 0 && !isScanning && (
        <div className="mb-4 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Search size={16} className="text-cyan-400" />
              <span className="text-white font-medium">Scan Results</span>
              <span className="text-xs text-slate-500">
                ({scanResults.filter(r => r.result?.bullishSetup || r.result?.bearishSetup).length} patterns found)
              </span>
            </div>
            <button
              onClick={() => setShowScanResults(false)}
              className="text-slate-400 hover:text-white"
            >
              <XCircle size={16} />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {scanResults
              .filter(r => r.result?.bullishSetup || r.result?.bearishSetup)
              .slice(0, 20)
              .map(({ stock, result }) => (
                <button
                  key={stock.id}
                  onClick={() => {
                    setSelectedStock(stock);
                    setShowScanResults(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-b-0"
                >
                  <div className="text-left">
                    <p className="text-sm text-white font-medium">{stock.company_name}</p>
                    <p className="text-xs text-slate-500">{stock.symbol} · {stock.exchange}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {result?.bullishSetup && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-emerald-900/50 text-emerald-400 text-xs rounded">
                        <TrendingUp size={12} />
                        Bullish CHOCH
                      </span>
                    )}
                    {result?.bearishSetup && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-red-900/50 text-red-400 text-xs rounded">
                        <TrendingDown size={12} />
                        Bearish CHOCH
                      </span>
                    )}
                    <div className="text-right">
                      <p className="text-sm text-white font-mono">₹{fmt(stock.price, 0)}</p>
                      <p className={`text-xs font-mono ${stock.pct_change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {stock.pct_change >= 0 ? "+" : ""}{stock.pct_change.toFixed(2)}%
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-slate-600" />
                  </div>
                </button>
              ))}
            {scanResults.filter(r => r.result?.bullishSetup || r.result?.bearishSetup).length === 0 && (
              <div className="px-4 py-8 text-center">
                <AlertTriangle size={32} className="text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No CHOCH patterns detected in scanned stocks</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stock Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <StockSelector
              stocks={stocks}
              selected={selectedStock}
              onSelect={setSelectedStock}
              search={search}
              onSearch={setSearch}
              onManualSelect={(symbol, name) => {
                // Create a temporary StockMover for manual entry
                const manualStock: StockMover = {
                  id: `manual-${symbol}`,
                  symbol,
                  company_name: name,
                  exchange: "NSE",
                  price: 0,
                  pct_change: 0,
                  volume: 0,
                  mover_type: "gainer",
                  date: getISTDate(),
                  created_at: new Date().toISOString(),
                };
                setSelectedStock(manualStock);
              }}
            />
          </div>

          {selectedStock && (
            <div className="flex items-center gap-4 px-4 py-2 bg-slate-800 rounded-lg">
              <div>
                <p className="text-lg font-bold text-white">{selectedStock.symbol}</p>
                <p className="text-xs text-slate-500">{selectedStock.company_name}</p>
              </div>
              {lastPrice && (
                <div className="text-right">
                  <p className="text-lg font-mono text-white">₹{fmt(lastPrice)}</p>
                  {selectedStock.pct_change !== 0 && (
                    <p className={`text-sm font-mono ${selectedStock.pct_change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {selectedStock.pct_change >= 0 ? "+" : ""}{selectedStock.pct_change.toFixed(2)}%
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedStock && (
            <button
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                isLive
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {isLive ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Stop
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Start Live
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {!selectedStock ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
          <LineChart size={48} className="text-slate-700" />
          <p className="text-lg font-medium">Select a stock to analyze</p>
          <p className="text-sm text-slate-600">Search and choose a stock from today's movers</p>
        </div>
      ) : isLoadingData ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
          <RefreshCw size={40} className="text-cyan-500 animate-spin" />
          <p className="text-lg font-medium">Loading market data...</p>
          <p className="text-sm text-slate-600">Fetching historical candles from Yahoo Finance</p>
        </div>
      ) : loadError ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center py-16 text-slate-500 gap-4">
          <XCircle size={48} className="text-red-500" />
          <p className="text-lg font-medium text-red-400">Unable to Load Data</p>
          <p className="text-sm text-slate-500 text-center max-w-md">{loadError}</p>
          <button
            onClick={() => setSelectedStock(null)}
            className="mt-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-sm"
          >
            Choose Another Stock
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - 2 cols */}
          <div className="lg:col-span-2 space-y-4">
            {/* Signal Card */}
            {analysisResult && (
              <SignalCard result={analysisResult} />
            )}

            {/* HTF Analysis */}
            <HtfBiasPanel result={analysisResult} htfData={htfData} />

            {/* MTF Entry */}
            <MtfEntryPanel
              result={analysisResult}
              mtfData={mtfData}
              swingHighs={swingHighs}
              swingLows={swingLows}
              orderBlocks={analysisResult?.mtfOrderBlocks ?? []}
              fvg={analysisResult?.mtfFVGs ?? []}
            />

            {/* Rules Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Target size={16} className="text-emerald-400" />
                Step 3: Confirmation Rules
              </h2>
              {analysisResult ? (
                <RulesTable rules={analysisResult.rules} />
              ) : (
                <p className="text-slate-500 text-sm text-center py-8">Awaiting analysis...</p>
              )}
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            {/* Final Output */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Zap size={14} className="text-amber-400" />
                Step 4: Final Output
              </h3>

              {analysisResult ? (
                <div className="space-y-1">
                  {[
                    { label: "Trend Bias", value: analysisResult.htfBias.toUpperCase(),
                      color: analysisResult.htfBias === "bullish" ? "text-emerald-400" :
                             analysisResult.htfBias === "bearish" ? "text-red-400" : "text-slate-400" },
                    { label: "CHOCH", value: analysisResult.mtfChoch?.detected ? "DETECTED" : "None",
                      color: analysisResult.mtfChoch?.detected ? "text-cyan-400" : "text-slate-500" },
                    { label: "BOS", value: analysisResult.mtfBos?.detected ? "CONFIRMED" : "None",
                      color: analysisResult.mtfBos?.detected ? "text-cyan-400" : "text-slate-500" },
                    { label: "Volume", value: analysisResult.volumeAnalysis.hasSpike ? "SPIKE" : "Normal",
                      color: analysisResult.volumeAnalysis.hasSpike ? "text-emerald-400" : "text-amber-400" },
                    { label: "Liq Sweep", value: analysisResult.liquiditySweep ? "Yes" : "No",
                      color: analysisResult.liquiditySweep ? "text-emerald-400" : "text-slate-500" },
                    { label: "HTF Align", value: analysisResult.htfAlignment ? "ALIGNED" : "No",
                      color: analysisResult.htfAlignment ? "text-emerald-400" : "text-red-400" },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-slate-800/50 text-xs">
                      <span className="text-slate-500">{item.label}</span>
                      <span className={`font-medium ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">Awaiting analysis...</p>
              )}
            </div>

            {/* Confluence Score */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Confluence size={14} className="text-cyan-400" />
                Confluence Score
              </h3>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 bg-slate-800 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      (analysisResult?.confluenceScore ?? 0) >= 8 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                      (analysisResult?.confluenceScore ?? 0) >= 5 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
                      "bg-slate-600"
                    }`}
                    style={{ width: `${((analysisResult?.confluenceScore ?? 0) / 10) * 100}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-white font-mono">
                  {analysisResult?.confluenceScore ?? 0}/10
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {(analysisResult?.confluenceScore ?? 0) >= 8 ? "High confluence - strong setup" :
                 (analysisResult?.confluenceScore ?? 0) >= 5 ? "Moderate confluence - acceptable" :
                 "Low confluence - wait for more confirmations"}
              </p>
            </div>

            {/* How it Works */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Info size={14} className="text-cyan-400" />
                SMC Concepts
              </h3>
              <div className="space-y-2 text-xs text-slate-400">
                <p>
                  <span className="text-emerald-400 font-medium">CHOCH:</span>{" "}
                  Change of Character - first break against trend
                </p>
                <p>
                  <span className="text-cyan-400 font-medium">BOS:</span>{" "}
                  Break of Structure - trend continuation
                </p>
                <p>
                  <span className="text-amber-400 font-medium">OB:</span>{" "}
                  Order Block - institutional entry zone
                </p>
                <p>
                  <span className="text-purple-400 font-medium">FVG:</span>{" "}
                  Fair Value Gap - imbalance area to fill
                </p>
                <p>
                  <span className="text-slate-300 font-medium">PDA:</span>{" "}
                  Premium/Discount Array - buy low, sell high
                </p>
              </div>
            </div>

            {/* Analysis Status */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400" />
                Status
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Real-time</span>
                  <span className={isLive ? "text-emerald-400" : "text-slate-600"}>
                    {isLive ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">HTF candles</span>
                  <span className="text-slate-300">{htfData.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">MTF candles</span>
                  <span className="text-slate-300">{mtfData.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
