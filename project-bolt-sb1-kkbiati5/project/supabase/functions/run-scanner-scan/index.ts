import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ===================== TYPES =====================
type Timeframe = "monthly" | "weekly" | "daily" | "4h" | "1h" | "15m" | "5m";

const TIMEFRAME_ORDER: Timeframe[] = ["monthly", "weekly", "daily", "4h", "1h", "15m", "5m"];

const TIMEFRAME_WEIGHTS: Record<Timeframe, number> = {
  monthly: 25, weekly: 20, daily: 20, "4h": 15, "1h": 10, "15m": 5, "5m": 5,
};

const TIMEFRAME_MIN_CANDLES: Record<Timeframe, number> = {
  monthly: 120, weekly: 260, daily: 500, "4h": 1000, "1h": 1500, "15m": 2000, "5m": 3000,
};

const TIMEFRAME_WINDOW_DEFAULTS: Record<Timeframe, { min: number; max: number }> = {
  monthly: { min: 12, max: 60 }, weekly: { min: 20, max: 104 },
  daily: { min: 40, max: 260 }, "4h": { min: 60, max: 400 },
  "1h": { min: 80, max: 500 }, "15m": { min: 100, max: 600 }, "5m": { min: 120, max: 800 },
};

interface Candle {
  timestamp: number; open: number; high: number; low: number; close: number; volume: number; complete: boolean;
}

type PatternStatus = "forming" | "near_breakout" | "breakout_confirmed" | "breakout_retest" | "failed" | "insufficient_data";
type TrendDirection = "uptrend" | "downtrend" | "sideways";

interface ScoreBreakdown {
  priorDowntrend: number; smoothness: number; baseDuration: number; symmetry: number;
  resistanceClarity: number; breakoutQuality: number; volumeConfirmation: number;
  momentum: number; retestQuality: number; dataQuality: number; timeframeWeight: number;
}

interface IndicatorSnapshot {
  sma20: number | null; sma50: number | null; sma200: number | null;
  ema20: number | null; ema50: number | null; rsi14: number | null;
  macd: number | null; macdSignal: number | null; macdHist: number | null;
  atr14: number | null; avgVolume20: number | null; adx14: number | null;
}

interface ScannerSettings {
  enabledTimeframes: Timeframe[]; scanOrder: Timeframe[]; primaryTimeframe: Timeframe;
  requireLowerTFConfirmation: boolean; minConfidence: number;
  minPatternDuration: number; maxPatternDuration: number;
  minAvgVolume: number; minBreakoutVolumeMultiplier: number; minBreakoutPct: number;
  volumeMandatory: boolean; higherTFMandatory: boolean;
  includeForming: boolean; onlyConfirmed: boolean;
  minPriorDeclinePct: number; minPriorDowntrendLength: number;
  nearBreakoutDistance: number; breakoutBuffer: number;
  maxShapeError: number; resistanceZoneWidth: number;
  adjustedPrices: boolean; autoScan: boolean;
}

const DEFAULT_SETTINGS: ScannerSettings = {
  enabledTimeframes: ["monthly", "weekly", "daily", "4h", "1h", "15m", "5m"],
  scanOrder: ["monthly", "weekly", "daily", "4h", "1h", "15m", "5m"],
  primaryTimeframe: "daily",
  requireLowerTFConfirmation: false,
  minConfidence: 50, minPatternDuration: 40, maxPatternDuration: 260,
  minAvgVolume: 100000, minBreakoutVolumeMultiplier: 1.5, minBreakoutPct: 1,
  volumeMandatory: false, higherTFMandatory: false,
  includeForming: true, onlyConfirmed: false,
  minPriorDeclinePct: 20, minPriorDowntrendLength: 20,
  nearBreakoutDistance: 3, breakoutBuffer: 1,
  maxShapeError: 0.15, resistanceZoneWidth: 2,
  adjustedPrices: true, autoScan: true,
};

interface Instrument { symbol: string; name: string; market: string; type: string }

interface PatternDetection {
  id: string; symbol: string; name: string; market: string; timeframe: Timeframe;
  status: PatternStatus; confidence: number; scoreBreakdown: ScoreBreakdown;
  patternStartIndex: number; patternLowIndex: number; patternEndIndex: number;
  patternStartDate: string; patternLowDate: string; patternEndDate: string;
  patternDuration: number; leftResistance: number;
  resistanceZoneLow: number; resistanceZoneHigh: number;
  currentPrice: number; breakoutPrice: number | null; breakoutPercentage: number;
  volumeRatio: number; rsi: number; trend: TrendDirection;
  higherTimeframeConfirmed: boolean; potentialTarget: number; invalidationLevel: number;
  signalTimestamp: string; warnings: string[];
}

// ===================== INDICATORS =====================
function sma(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) result[i] = sum / period;
  }
  return result;
}

function ema(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  const k = 2 / (period + 1);
  let prev = values[0];
  result[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result[i] = prev;
  }
  return result;
}

function rsi(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) avgGain += change; else avgLoss -= change;
  }
  avgGain /= period; avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function macd(closes: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const signalLine = ema(macdLine, signal);
  const hist = macdLine.map((m, i) => m - signalLine[i]);
  return { macdLine, signalLine, hist };
}

function atr(candles: Candle[], period = 14): number[] {
  const result: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < 2) return result;
  const trs: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  let sum = 0;
  for (let i = 1; i <= period && i < trs.length; i++) sum += trs[i];
  if (trs.length > period) result[period] = sum / period;
  for (let i = period + 1; i < trs.length; i++) {
    sum = sum - trs[i - period] + trs[i];
    result[i] = sum / period;
  }
  return result;
}

function adx(candles: Candle[], period = 14): number[] {
  const result: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < period * 2) return result;
  const plusDM: number[] = [0], minusDM: number[] = [0], trs: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const smoothedTR: number[] = [0], smoothedPlus: number[] = [0], smoothedMinus: number[] = [0];
  let trSum = 0, plusSum = 0, minusSum = 0;
  for (let i = 1; i <= period && i < trs.length; i++) {
    trSum += trs[i]; plusSum += plusDM[i]; minusSum += minusDM[i];
  }
  if (trs.length > period) {
    smoothedTR[period] = trSum; smoothedPlus[period] = plusSum; smoothedMinus[period] = minusSum;
  }
  for (let i = period + 1; i < trs.length; i++) {
    smoothedTR[i] = smoothedTR[i - 1] - smoothedTR[i - 1] / period + trs[i];
    smoothedPlus[i] = smoothedPlus[i - 1] - smoothedPlus[i - 1] / period + plusDM[i];
    smoothedMinus[i] = smoothedMinus[i - 1] - smoothedMinus[i - 1] / period + minusDM[i];
  }
  const dx: number[] = new Array(candles.length).fill(NaN);
  for (let i = period; i < candles.length; i++) {
    if (smoothedTR[i] > 0) {
      const plusDI = 100 * (smoothedPlus[i] / smoothedTR[i]);
      const minusDI = 100 * (smoothedMinus[i] / smoothedTR[i]);
      const sum = plusDI + minusDI;
      dx[i] = sum > 0 ? 100 * Math.abs(plusDI - minusDI) / sum : 0;
    }
  }
  let adxSum = 0, count = 0;
  for (let i = period; i < period * 2 && i < dx.length; i++) {
    if (!isNaN(dx[i])) { adxSum += dx[i]; count++; }
  }
  if (count > 0) result[period * 2 - 1] = adxSum / count;
  for (let i = period * 2; i < dx.length; i++) {
    if (!isNaN(dx[i])) result[i] = (result[i - 1] * (period - 1) + dx[i]) / period;
  }
  return result;
}

function avgVolume(volumes: number[], period: number): number | null {
  if (volumes.length < period) return null;
  let sum = 0;
  for (let i = volumes.length - period; i < volumes.length; i++) sum += volumes[i];
  return sum / period;
}

function detectTrend(closes: number[]): TrendDirection {
  if (closes.length < 50) return "sideways";
  const recent = closes.slice(-50);
  const sma50 = sma(recent, Math.min(50, recent.length));
  const lastSMA = sma50[sma50.length - 1];
  if (isNaN(lastSMA)) return "sideways";
  const price = recent[recent.length - 1];
  const slope = (recent[recent.length - 1] - recent[recent.length - 20]) / recent[recent.length - 20];
  if (price > lastSMA && slope > 0.02) return "uptrend";
  if (price < lastSMA && slope < -0.02) return "downtrend";
  return "sideways";
}

function savitzkyGolaySmooth(values: number[], windowSize = 5): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < values.length; i++) {
    let sum = 0, count = 0;
    for (let j = -half; j <= half; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < values.length) { sum += values[idx]; count++; }
    }
    result[i] = sum / count;
  }
  return result;
}

// ===================== DEMO DATA =====================
const DEMO_INSTRUMENTS: Instrument[] = [
  { symbol: "AAPL", name: "Apple Inc.", market: "NASDAQ", type: "stock" },
  { symbol: "MSFT", name: "Microsoft Corp.", market: "NASDAQ", type: "stock" },
  { symbol: "NVDA", name: "NVIDIA Corp.", market: "NASDAQ", type: "stock" },
  { symbol: "AMZN", name: "Amazon.com Inc.", market: "NASDAQ", type: "stock" },
  { symbol: "TSLA", name: "Tesla Inc.", market: "NASDAQ", type: "stock" },
  { symbol: "GOOGL", name: "Alphabet Inc.", market: "NASDAQ", type: "stock" },
  { symbol: "META", name: "Meta Platforms", market: "NASDAQ", type: "stock" },
  { symbol: "BTC-USD", name: "Bitcoin", market: "Crypto", type: "crypto" },
  { symbol: "ETH-USD", name: "Ethereum", market: "Crypto", type: "crypto" },
  { symbol: "SPY", name: "S&P 500 ETF", market: "NYSE", type: "etf" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", market: "NASDAQ", type: "etf" },
  { symbol: "RELIANCE", name: "Reliance Industries", market: "NSE", type: "stock" },
  { symbol: "TCS", name: "Tata Consultancy Services", market: "NSE", type: "stock" },
  { symbol: "INFY", name: "Infosys Ltd.", market: "NSE", type: "stock" },
  { symbol: "HDFCBANK", name: "HDFC Bank", market: "NSE", type: "stock" },
];

const TF_MS: Record<Timeframe, number> = {
  monthly: 30 * 24 * 60 * 60 * 1000, weekly: 7 * 24 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000, "4h": 4 * 60 * 60 * 1000,
  "1h": 60 * 60 * 1000, "15m": 15 * 60 * 1000, "5m": 5 * 60 * 1000,
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateRoundingBottom(
  count: number, intervalMs: number, startPrice: number, declinePct: number,
  baseDurationPct: number, breakout: boolean, rng: () => number, volatility: number
): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const startTime = now - count * intervalMs;
  const resistance = startPrice;
  const lowPrice = startPrice * (1 - declinePct / 100);
  const patternLen = Math.floor(count * 0.55);
  const prePatternLen = count - patternLen;
  const baseLen = Math.floor(patternLen * baseDurationPct);
  const leftLen = Math.floor((patternLen - baseLen) / 2);
  const rightLen = patternLen - baseLen - leftLen;

  for (let i = 0; i < count; i++) {
    const ts = startTime + i * intervalMs;
    const elapsed = i - prePatternLen;
    let close: number;

    if (elapsed < 0) {
      const t = i / prePatternLen;
      close = resistance * (0.95 + 0.05 * t + (rng() - 0.5) * volatility * 0.5);
    } else if (elapsed < leftLen) {
      const t = elapsed / leftLen;
      const eased = 1 - Math.pow(1 - t, 2);
      close = resistance - (resistance - lowPrice) * eased * 0.95;
    } else if (elapsed < leftLen + baseLen) {
      const t = (elapsed - leftLen) / baseLen;
      const wave = Math.sin(t * Math.PI * 2) * 0.01 * lowPrice;
      close = lowPrice + wave + (rng() - 0.5) * volatility * lowPrice * 0.3;
    } else if (elapsed < patternLen) {
      const t = (elapsed - leftLen - baseLen) / rightLen;
      const eased = Math.pow(t, 2);
      close = lowPrice + (resistance - lowPrice) * eased * 0.95;
    } else {
      if (breakout) {
        const t = (elapsed - patternLen) / (count - patternLen);
        close = resistance * (1 + 0.05 * t + (rng() - 0.5) * volatility * 0.3);
      } else {
        const t = (elapsed - patternLen) / (count - patternLen);
        close = resistance * (0.97 - 0.02 * t + (rng() - 0.5) * volatility * 0.3);
      }
    }

    const noise = (rng() - 0.5) * volatility * close;
    close = Math.max(close + noise, 0.01);
    const open = close * (1 + (rng() - 0.5) * volatility * 0.5);
    const high = Math.max(open, close) * (1 + rng() * volatility * 0.3);
    const low = Math.min(open, close) * (1 - rng() * volatility * 0.3);
    const volume = Math.floor(500000 + rng() * 2000000 * (1 + Math.abs(close - open) / open * 10));

    candles.push({
      timestamp: ts, open: Math.round(open * 100) / 100, high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100, close: Math.round(close * 100) / 100,
      volume, complete: i < count - 1,
    });
  }
  return candles;
}

function generateUptrend(count: number, intervalMs: number, startPrice: number, rng: () => number, volatility: number): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const startTime = now - count * intervalMs;
  for (let i = 0; i < count; i++) {
    const ts = startTime + i * intervalMs;
    const t = i / count;
    const close = startPrice * (1 + t * 0.8 + (rng() - 0.5) * volatility);
    const open = close * (1 + (rng() - 0.5) * volatility * 0.5);
    const high = Math.max(open, close) * (1 + rng() * volatility * 0.3);
    const low = Math.min(open, close) * (1 - rng() * volatility * 0.3);
    const volume = Math.floor(500000 + rng() * 1500000);
    candles.push({
      timestamp: ts, open, high, low, close: Math.round(close * 100) / 100,
      volume, complete: i < count - 1,
    });
  }
  return candles;
}

function generateSideways(count: number, intervalMs: number, price: number, rng: () => number, volatility: number): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const startTime = now - count * intervalMs;
  for (let i = 0; i < count; i++) {
    const ts = startTime + i * intervalMs;
    const close = price * (1 + (rng() - 0.5) * 0.1 + Math.sin(i / 20) * 0.03);
    const open = close * (1 + (rng() - 0.5) * volatility * 0.5);
    const high = Math.max(open, close) * (1 + rng() * volatility * 0.3);
    const low = Math.min(open, close) * (1 - rng() * volatility * 0.3);
    const volume = Math.floor(500000 + rng() * 1000000);
    candles.push({
      timestamp: ts, open, high, low, close: Math.round(close * 100) / 100,
      volume, complete: i < count - 1,
    });
  }
  return candles;
}

const INSTRUMENT_PROFILES: Record<string, { type: string; startPrice: number; decline: number; basePct: number; breakout: boolean; vol: number }> = {
  AAPL: { type: "rounding", startPrice: 180, decline: 28, basePct: 0.25, breakout: true, vol: 0.015 },
  MSFT: { type: "rounding", startPrice: 380, decline: 22, basePct: 0.3, breakout: false, vol: 0.012 },
  NVDA: { type: "rounding", startPrice: 500, decline: 35, basePct: 0.2, breakout: true, vol: 0.025 },
  AMZN: { type: "rounding", startPrice: 145, decline: 25, basePct: 0.28, breakout: true, vol: 0.018 },
  TSLA: { type: "uptrend", startPrice: 200, decline: 0, basePct: 0, breakout: false, vol: 0.03 },
  GOOGL: { type: "rounding", startPrice: 140, decline: 20, basePct: 0.35, breakout: false, vol: 0.014 },
  META: { type: "rounding", startPrice: 320, decline: 30, basePct: 0.22, breakout: true, vol: 0.02 },
  "BTC-USD": { type: "rounding", startPrice: 65000, decline: 40, basePct: 0.3, breakout: true, vol: 0.03 },
  "ETH-USD": { type: "rounding", startPrice: 3500, decline: 32, basePct: 0.25, breakout: false, vol: 0.028 },
  SPY: { type: "sideways", startPrice: 450, decline: 0, basePct: 0, breakout: false, vol: 0.008 },
  QQQ: { type: "uptrend", startPrice: 380, decline: 0, basePct: 0, breakout: false, vol: 0.01 },
  RELIANCE: { type: "rounding", startPrice: 2800, decline: 24, basePct: 0.3, breakout: true, vol: 0.015 },
  TCS: { type: "rounding", startPrice: 3500, decline: 18, basePct: 0.35, breakout: false, vol: 0.012 },
  INFY: { type: "sideways", startPrice: 1500, decline: 0, basePct: 0, breakout: false, vol: 0.013 },
  HDFCBANK: { type: "rounding", startPrice: 1600, decline: 22, basePct: 0.28, breakout: true, vol: 0.014 },
};

function generateDemoCandles(symbol: string, timeframe: Timeframe): Candle[] {
  const profile = INSTRUMENT_PROFILES[symbol];
  const intervalMs = TF_MS[timeframe];
  const minCandles = TIMEFRAME_MIN_CANDLES[timeframe];
  const count = Math.max(minCandles, 600);
  const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + timeframe.length * 100;
  const rng = mulberry32(seed);

  if (!profile || profile.type === "rounding") {
    const p = profile ?? { type: "rounding", startPrice: 100, decline: 25, basePct: 0.25, breakout: true, vol: 0.015 };
    return generateRoundingBottom(count, intervalMs, p.startPrice, p.decline, p.basePct, p.breakout, rng, p.vol);
  }
  if (profile.type === "uptrend") return generateUptrend(count, intervalMs, profile.startPrice, rng, profile.vol);
  return generateSideways(count, intervalMs, profile.startPrice, rng, profile.vol);
}

// ===================== DETECTOR =====================
interface WindowCandidate {
  startIndex: number; lowIndex: number; endIndex: number; resistance: number;
  smoothed: number[]; shapeError: number; symmetryScore: number;
  priorDeclinePct: number; baseDuration: number; leftLen: number; rightLen: number;
}

function generateIdealU(length: number, lowIdx: number): number[] {
  const ideal: number[] = [];
  for (let i = 0; i < length; i++) {
    const t = (i - lowIdx) / Math.max(lowIdx, length - lowIdx);
    ideal.push(Math.max(0, t * t));
  }
  return ideal;
}

function analyzeWindow(candles: Candle[], startIdx: number, endIdx: number, settings: ScannerSettings): WindowCandidate | null {
  const window = candles.slice(startIdx, endIdx + 1);
  const closes = window.map(c => c.close);

  let lowIdx = 0, lowVal = Infinity;
  for (let i = 0; i < window.length; i++) {
    if (window[i].low < lowVal) { lowVal = window[i].low; lowIdx = i; }
  }

  const lowPosPct = lowIdx / window.length;
  if (lowPosPct < 0.2 || lowPosPct > 0.8) return null;

  const prePatternStart = Math.max(0, startIdx - settings.minPriorDowntrendLength);
  const preCloses = candles.slice(prePatternStart, startIdx + lowIdx).map(c => c.close);
  if (preCloses.length < 5) return null;

  const priorHigh = Math.max(...preCloses);
  const priorDeclinePct = ((priorHigh - lowVal) / priorHigh) * 100;
  if (priorDeclinePct < settings.minPriorDeclinePct) return null;

  const resistanceRegionEnd = Math.max(5, Math.floor(window.length * 0.2));
  let resistance = 0;
  for (let i = 0; i < resistanceRegionEnd && i < window.length; i++) {
    if (window[i].close > resistance) resistance = window[i].close;
  }
  if (resistance <= lowVal) return null;

  const smoothed = savitzkyGolaySmooth(closes, Math.min(7, Math.floor(window.length / 10) * 2 + 1));
  const idealU = generateIdealU(window.length, lowIdx);
  let shapeError = 0;
  for (let i = 0; i < window.length; i++) {
    if (isNaN(smoothed[i])) continue;
    const normalized = (smoothed[i] - lowVal) / (resistance - lowVal);
    shapeError += Math.abs(normalized - idealU[i]);
  }
  shapeError /= window.length;
  if (shapeError > settings.maxShapeError) return null;

  const baseThreshold = lowVal + (resistance - lowVal) * 0.1;
  let baseDuration = 0;
  for (let i = Math.floor(window.length * 0.25); i < Math.floor(window.length * 0.75); i++) {
    if (i < window.length && window[i].close <= baseThreshold) baseDuration++;
  }
  const minBase = Math.max(5, Math.floor(window.length * 0.1));
  if (baseDuration < minBase) return null;

  const rightStart = lowIdx + baseDuration;
  const rightLen = window.length - rightStart;
  if (rightLen < 5) return null;
  const leftLen = lowIdx;
  const symmetryRatio = Math.min(leftLen, rightLen) / Math.max(leftLen, rightLen);
  const symmetryScore = symmetryRatio * 100;

  const rightCloses = closes.slice(rightStart);
  if (rightCloses.length > 1) {
    const totalRecovery = rightCloses[rightCloses.length - 1] - rightCloses[0];
    let maxSingleCandle = 0;
    for (let i = 1; i < rightCloses.length; i++) {
      const change = rightCloses[i] - rightCloses[i - 1];
      if (change > maxSingleCandle) maxSingleCandle = change;
    }
    if (totalRecovery > 0 && maxSingleCandle / totalRecovery > 0.35) return null;
  }

  return { startIndex: startIdx, lowIndex: startIdx + lowIdx, endIndex: endIdx, resistance, smoothed, shapeError, symmetryScore, priorDeclinePct, baseDuration, leftLen, rightLen };
}

function scoreCandidate(candidate: WindowCandidate, settings: ScannerSettings): number {
  let score = 0;
  score += Math.min(100, candidate.priorDeclinePct * 2);
  score += (1 - candidate.shapeError / settings.maxShapeError) * 100;
  score += candidate.symmetryScore;
  return score;
}

function computeIndicators(candles: Candle[]): IndicatorSnapshot {
  const closes = candles.map(c => c.close);
  const sma20Arr = sma(closes, 20);
  const sma50Arr = sma(closes, 50);
  const sma200Arr = closes.length >= 200 ? sma(closes, 200) : null;
  const ema20Arr = ema(closes, 20);
  const ema50Arr = ema(closes, 50);
  const rsiArr = rsi(closes, 14);
  const { macdLine, signalLine, hist } = macd(closes);
  const atrArr = atr(candles, 14);
  const adxArr = adx(candles, 14);
  const vol20 = avgVolume(candles.map(c => c.volume), 20);
  const last = candles.length - 1;
  return {
    sma20: sma20Arr[last] ?? null, sma50: sma50Arr[last] ?? null,
    sma200: sma200Arr ? sma200Arr[last] ?? null : null,
    ema20: ema20Arr[last] ?? null, ema50: ema50Arr[last] ?? null,
    rsi14: rsiArr[last] ?? null, macd: macdLine[last] ?? null,
    macdSignal: signalLine[last] ?? null, macdHist: hist[last] ?? null,
    atr14: atrArr[last] ?? null, avgVolume20: vol20, adx14: adxArr[last] ?? null,
  };
}

function computeScoreBreakdown(
  candidate: WindowCandidate, indicators: IndicatorSnapshot, status: PatternStatus,
  timeframe: Timeframe, settings: ScannerSettings, breakoutVolRatio: number
): ScoreBreakdown {
  const priorDowntrend = Math.min(15, (candidate.priorDeclinePct / settings.minPriorDeclinePct) * 10);
  const smoothness = Math.max(0, Math.min(15, (1 - candidate.shapeError / settings.maxShapeError) * 15));
  const basePct = candidate.baseDuration / (candidate.endIndex - candidate.startIndex);
  const baseDuration = Math.min(10, basePct * 30);
  const symmetry = Math.min(10, candidate.symmetryScore / 10);
  const resistanceClarity = 8;
  let breakoutQuality = 0;
  if (status === "breakout_confirmed") breakoutQuality = 15;
  else if (status === "breakout_retest") breakoutQuality = 13;
  else if (status === "near_breakout") breakoutQuality = 8;
  else if (status === "forming") breakoutQuality = 4;
  let volumeConfirmation = 0;
  if (indicators.avgVolume20 && indicators.avgVolume20 > 0) {
    if (breakoutVolRatio >= settings.minBreakoutVolumeMultiplier) volumeConfirmation = 10;
    else volumeConfirmation = Math.min(10, breakoutVolRatio * 5);
  }
  let momentum = 0;
  if (indicators.rsi14 != null) {
    if (indicators.rsi14 > 50) momentum += 4;
    if (indicators.rsi14 > 60) momentum += 2;
  }
  if (indicators.macdHist != null && indicators.macdHist > 0) momentum += 4;
  let retestQuality = 0;
  if (status === "breakout_retest") retestQuality = 5;
  const dataQuality = 5;
  const tfWeight = TIMEFRAME_WEIGHTS[timeframe];
  return { priorDowntrend, smoothness, baseDuration, symmetry, resistanceClarity, breakoutQuality, volumeConfirmation, momentum, retestQuality, dataQuality, timeframeWeight: tfWeight };
}

function normalizeScore(breakdown: ScoreBreakdown): number {
  const total = breakdown.priorDowntrend + breakdown.smoothness + breakdown.baseDuration + breakdown.symmetry + breakdown.resistanceClarity + breakdown.breakoutQuality + breakdown.volumeConfirmation + breakdown.momentum + breakdown.retestQuality + breakdown.dataQuality + breakdown.timeframeWeight;
  const maxTotal = 15 + 15 + 10 + 10 + 10 + 15 + 10 + 10 + 5 + 5 + 25;
  return (total / maxTotal) * 100;
}

function detectRoundingBottom(
  candles: Candle[], timeframe: Timeframe, symbol: string, name: string, market: string, settings: ScannerSettings
): PatternDetection | null {
  const minCandles = TIMEFRAME_MIN_CANDLES[timeframe];
  if (candles.length < minCandles) return null;

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const windowRange = TIMEFRAME_WINDOW_DEFAULTS[timeframe];
  const minWin = Math.max(settings.minPatternDuration, windowRange.min);
  const maxWin = Math.min(settings.maxPatternDuration, windowRange.max);

  let best: WindowCandidate | null = null;
  let bestScore = -1;

  for (let winSize = minWin; winSize <= maxWin; winSize += Math.max(1, Math.floor(winSize / 20))) {
    for (let endIdx = candles.length - 1; endIdx >= winSize; endIdx--) {
      const startIdx = endIdx - winSize;
      const candidate = analyzeWindow(candles, startIdx, endIdx, settings);
      if (!candidate) continue;
      const score = scoreCandidate(candidate, settings);
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
  }

  if (!best) return null;

  const indicators = computeIndicators(candles);
  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle.close;
  const zoneWidth = settings.resistanceZoneWidth / 100;
  const resistanceZoneLow = best.resistance * (1 - zoneWidth / 2);
  const resistanceZoneHigh = best.resistance * (1 + zoneWidth / 2);

  let status: PatternStatus;
  let breakoutPrice: number | null = null;
  let breakoutPercentage = 0;
  let breakoutVolumeRatio = 0;

  const breakoutBuffer = 1 + settings.breakoutBuffer / 100;
  const breakoutThreshold = best.resistance * breakoutBuffer;
  const nearBreakoutThreshold = best.resistance * (1 - settings.nearBreakoutDistance / 100);

  let foundBreakout = false, foundRetest = false, foundFailed = false;

  for (let i = best.endIndex; i < candles.length; i++) {
    const c = candles[i];
    if (!c.complete) continue;
    if (c.close >= breakoutThreshold) {
      foundBreakout = true;
      breakoutPrice = c.close;
      breakoutPercentage = ((c.close - best.resistance) / best.resistance) * 100;
      const avgVol = avgVolume(volumes.slice(0, i), 20) ?? 1;
      breakoutVolumeRatio = c.volume / avgVol;
      for (let j = i + 1; j < candles.length; j++) {
        const cc = candles[j];
        if (!cc.complete) continue;
        if (cc.close < resistanceZoneLow) { foundFailed = true; break; }
        if (cc.low <= resistanceZoneHigh && cc.close >= resistanceZoneLow) foundRetest = true;
      }
      break;
    }
  }

  if (foundFailed) status = "failed";
  else if (foundBreakout && foundRetest) status = "breakout_retest";
  else if (foundBreakout) status = "breakout_confirmed";
  else if (currentPrice >= nearBreakoutThreshold && currentPrice < breakoutThreshold) status = "near_breakout";
  else status = "forming";

  if (settings.onlyConfirmed && status !== "breakout_confirmed" && status !== "breakout_retest") return null;
  if (!settings.includeForming && status === "forming") return null;

  const vol20 = avgVolume(volumes, 20) ?? 0;
  const volumeRatio = vol20 > 0 ? lastCandle.volume / vol20 : 0;

  const scoreBreakdown = computeScoreBreakdown(best, indicators, status, timeframe, settings, breakoutVolumeRatio);
  const htConfirmed = ["monthly", "weekly", "daily"].includes(timeframe);
  const patternHeight = best.resistance - candles[best.lowIndex].low;
  const potentialTarget = best.resistance + patternHeight;
  const invalidationLevel = candles[best.lowIndex].low * 0.97;
  const confidence = normalizeScore(scoreBreakdown);

  if (confidence < settings.minConfidence) return null;

  const fmtDate = (ts: number) => new Date(ts).toISOString().split("T")[0];

  return {
    id: `${symbol}-${timeframe}-${best.startIndex}`, symbol, name, market, timeframe,
    status, confidence: Math.round(confidence), scoreBreakdown,
    patternStartIndex: best.startIndex, patternLowIndex: best.lowIndex, patternEndIndex: best.endIndex,
    patternStartDate: fmtDate(candles[best.startIndex].timestamp),
    patternLowDate: fmtDate(candles[best.lowIndex].timestamp),
    patternEndDate: fmtDate(candles[best.endIndex].timestamp),
    patternDuration: best.endIndex - best.startIndex,
    leftResistance: Math.round(best.resistance * 100) / 100,
    resistanceZoneLow: Math.round(resistanceZoneLow * 100) / 100,
    resistanceZoneHigh: Math.round(resistanceZoneHigh * 100) / 100,
    currentPrice: Math.round(currentPrice * 100) / 100,
    breakoutPrice: breakoutPrice ? Math.round(breakoutPrice * 100) / 100 : null,
    breakoutPercentage: Math.round(breakoutPercentage * 100) / 100,
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    rsi: indicators.rsi14 ?? 0, trend: detectTrend(closes),
    higherTimeframeConfirmed: htConfirmed,
    potentialTarget: Math.round(potentialTarget * 100) / 100,
    invalidationLevel: Math.round(invalidationLevel * 100) / 100,
    signalTimestamp: new Date().toISOString(), warnings: [],
  };
}

// ===================== EDGE FUNCTION =====================

function getISTNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const triggeredBy: string = body.triggered_by ?? "scheduler";
    const customSettings = body.settings ?? null;
    const settings: ScannerSettings = { ...DEFAULT_SETTINGS, ...(customSettings ?? {}) };

    const istNow = getISTNow();
    const scanDate = toDateStr(istNow);

    // Create scan job record
    const { data: scanJob, error: jobError } = await supabase
      .from("scanner_scan_jobs")
      .insert({
        status: "running",
        triggered_by: triggeredBy,
        settings: settings as unknown as Record<string, unknown>,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) throw jobError;
    const jobId = scanJob.id;

    console.log(`[scanner] job=${jobId} date=${scanDate} triggered_by=${triggeredBy}`);

    // Run the scanner across all instruments and enabled timeframes
    const instruments = DEMO_INSTRUMENTS;
    const timeframes = settings.enabledTimeframes;
    const allDetections: PatternDetection[] = [];

    for (const inst of instruments) {
      for (const tf of timeframes) {
        try {
          const candles = generateDemoCandles(inst.symbol, tf);
          const detection = detectRoundingBottom(candles, tf, inst.symbol, inst.name, inst.market, settings);
          if (detection && detection.status !== "insufficient_data") {
            allDetections.push(detection);
          }
        } catch (e) {
          console.log(`[scanner] ${inst.symbol} ${tf} error: ${e}`);
        }
      }
    }

    console.log(`[scanner] Found ${allDetections.length} patterns across ${instruments.length} instruments`);

    // Sort by confidence descending
    allDetections.sort((a, b) => b.confidence - a.confidence);

    // Delete previous detections for this scan job's date to avoid duplicates
    await supabase.from("scanner_pattern_detections").delete().eq("scan_job_id", jobId);

    // Insert all detections into the database
    const detectionRows = allDetections.map(d => ({
      scan_job_id: jobId,
      symbol: d.symbol,
      name: d.name,
      market: d.market,
      timeframe: d.timeframe,
      status: d.status,
      confidence: d.confidence,
      score_breakdown: d.scoreBreakdown as unknown as Record<string, unknown>,
      pattern_start_index: d.patternStartIndex,
      pattern_low_index: d.patternLowIndex,
      pattern_end_index: d.patternEndIndex,
      pattern_start_date: d.patternStartDate,
      pattern_low_date: d.patternLowDate,
      pattern_end_date: d.patternEndDate,
      pattern_duration: d.patternDuration,
      left_resistance: d.leftResistance,
      resistance_zone_low: d.resistanceZoneLow,
      resistance_zone_high: d.resistanceZoneHigh,
      current_price: d.currentPrice,
      breakout_price: d.breakoutPrice,
      breakout_percentage: d.breakoutPercentage,
      volume_ratio: d.volumeRatio,
      rsi: d.rsi,
      trend: d.trend,
      higher_tf_confirmed: d.higherTimeframeConfirmed,
      potential_target: d.potentialTarget,
      invalidation_level: d.invalidationLevel,
      signal_timestamp: d.signalTimestamp,
      warnings: d.warnings as unknown as Record<string, unknown>,
    }));

    let insertedCount = 0;
    if (detectionRows.length > 0) {
      const { error: insertError } = await supabase
        .from("scanner_pattern_detections")
        .insert(detectionRows);
      if (insertError) throw insertError;
      insertedCount = detectionRows.length;
    }

    // Publish highlighted alerts for top patterns (confidence >= 65, or breakout confirmed)
    const highlighted = allDetections.filter(d =>
      d.confidence >= 65 ||
      d.status === "breakout_confirmed" ||
      d.status === "breakout_retest"
    );

    const alertRows = highlighted.map(d => ({
      symbol: d.symbol,
      timeframe: d.timeframe,
      event_type: d.status === "breakout_confirmed" ? "breakout_confirmed" :
                  d.status === "breakout_retest" ? "breakout_retest" :
                  d.status === "near_breakout" ? "near_breakout" : "high_confidence_pattern",
      pattern_status: d.status,
      confidence: d.confidence,
      resistance: d.leftResistance,
      breakout_price: d.breakoutPrice,
      volume_ratio: d.volumeRatio,
      pattern_duration: d.patternDuration,
      potential_target: d.potentialTarget,
      invalidation_level: d.invalidationLevel,
      fired_at: new Date().toISOString(),
      delivered: false,
      delivery_channels: ["in_app"] as unknown as Record<string, unknown>,
    }));

    let alertCount = 0;
    if (alertRows.length > 0) {
      const { error: alertError } = await supabase
        .from("scanner_alerts")
        .insert(alertRows);
      if (alertError) {
        console.log(`[scanner] Alert insert error: ${alertError.message}`);
      } else {
        alertCount = alertRows.length;
      }
    }

    // Update scan job as completed
    const message = `Scan complete: ${instruments.length} instruments × ${timeframes.length} timeframes. ${allDetections.length} patterns found, ${highlighted.length} highlighted. ${alertCount} alerts published.`;

    await supabase.from("scanner_scan_jobs").update({
      status: "success",
      symbols_scanned: instruments.length,
      patterns_found: allDetections.length,
      completed_at: new Date().toISOString(),
      message,
    }).eq("id", jobId);

    // Store last scan date in settings
    await supabase.from("scanner_settings").upsert({
      key: "last_auto_scan_date",
      value: scanDate,
      updated_at: new Date().toISOString(),
    });

    console.log(`[scanner] ${message}`);

    return new Response(JSON.stringify({
      success: true,
      job_id: jobId,
      scan_date: scanDate,
      symbols_scanned: instruments.length,
      patterns_found: allDetections.length,
      highlighted_count: highlighted.length,
      alerts_published: alertCount,
      top_patterns: allDetections.slice(0, 10).map(d => ({
        symbol: d.symbol, timeframe: d.timeframe, status: d.status,
        confidence: d.confidence, current_price: d.currentPrice,
        potential_target: d.potentialTarget, invalidation_level: d.invalidationLevel,
      })),
      message,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[scanner] Fatal:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
