import type {
  Candle, Timeframe, PatternDetection, PatternStatus,
  ScoreBreakdown, IndicatorSnapshot, ScannerSettings,
} from "./types";
import { TIMEFRAME_WINDOW_DEFAULTS, TIMEFRAME_MIN_CANDLES, TIMEFRAME_WEIGHTS } from "./types";
import { sma, ema, rsi, macd, atr, adx, avgVolume, detectTrend, savitzkyGolaySmooth } from "./indicators";

interface WindowCandidate {
  startIndex: number;
  lowIndex: number;
  endIndex: number;
  resistance: number;
  smoothed: number[];
  shapeError: number;
  symmetryScore: number;
  priorDeclinePct: number;
  baseDuration: number;
  leftLen: number;
  rightLen: number;
}

export function detectRoundingBottom(
  candles: Candle[],
  timeframe: Timeframe,
  symbol: string,
  name: string,
  market: string,
  settings: ScannerSettings
): PatternDetection | null {
  const minCandles = TIMEFRAME_MIN_CANDLES[timeframe];
  const warnings: string[] = [];

  if (candles.length < minCandles) {
    warnings.push(`Only ${candles.length} candles available, need ${minCandles} for ${timeframe}.`);
    return makeInsufficientData(candles, timeframe, symbol, name, market, warnings);
  }

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const windowRange = TIMEFRAME_WINDOW_DEFAULTS[timeframe];
  const minWin = Math.max(settings.minPatternDuration, windowRange.min);
  const maxWin = Math.min(settings.maxPatternDuration, windowRange.max);

  // Search for best candidate window
  let best: WindowCandidate | null = null;
  let bestScore = -1;

  for (let winSize = minWin; winSize <= maxWin; winSize += Math.max(1, Math.floor(winSize / 20))) {
    for (let endIdx = candles.length - 1; endIdx >= winSize; endIdx--) {
      const startIdx = endIdx - winSize;
      const candidate = analyzeWindow(candles, startIdx, endIdx, settings);
      if (!candidate) continue;
      const score = scoreCandidate(candidate, settings);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }

  if (!best) {
    warnings.push("No valid rounding-bottom window found in the available data.");
    return makeInsufficientData(candles, timeframe, symbol, name, market, warnings);
  }

  // Compute indicators
  const indicators = computeIndicators(candles);
  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle.close;
  const zoneWidth = settings.resistanceZoneWidth / 100;
  const resistanceZoneLow = best.resistance * (1 - zoneWidth / 2);
  const resistanceZoneHigh = best.resistance * (1 + zoneWidth / 2);

  // Determine pattern status
  let status: PatternStatus;
  let breakoutPrice: number | null = null;
  let breakoutPercentage = 0;
  let breakoutVolumeRatio = 0;

  const breakoutBuffer = 1 + settings.breakoutBuffer / 100;
  const breakoutThreshold = best.resistance * breakoutBuffer;
  const nearBreakoutThreshold = best.resistance * (1 - settings.nearBreakoutDistance / 100);

  // Look for breakout in completed candles
  let foundBreakout = false;
  let foundRetest = false;
  let foundFailed = false;

  for (let i = best.endIndex; i < candles.length; i++) {
    const c = candles[i];
    if (!c.complete) continue;
    if (c.close >= breakoutThreshold) {
      foundBreakout = true;
      breakoutPrice = c.close;
      breakoutPercentage = ((c.close - best.resistance) / best.resistance) * 100;
      const avgVol = avgVolume(volumes.slice(0, i), 20) ?? 1;
      breakoutVolumeRatio = c.volume / avgVol;
      // Check for retest or failure after breakout
      for (let j = i + 1; j < candles.length; j++) {
        const cc = candles[j];
        if (!cc.complete) continue;
        if (cc.close < resistanceZoneLow) {
          foundFailed = true;
          break;
        }
        if (cc.low <= resistanceZoneHigh && cc.close >= resistanceZoneLow) {
          foundRetest = true;
        }
      }
      break;
    }
  }

  if (foundFailed) {
    status = "failed";
  } else if (foundBreakout && foundRetest) {
    status = "breakout_retest";
  } else if (foundBreakout) {
    status = "breakout_confirmed";
  } else if (currentPrice >= nearBreakoutThreshold && currentPrice < breakoutThreshold) {
    status = "near_breakout";
  } else {
    status = "forming";
  }

  // Apply filters
  if (settings.onlyConfirmed && status !== "breakout_confirmed" && status !== "breakout_retest") {
    return null;
  }
  if (!settings.includeForming && status === "forming") {
    return null;
  }

  // Volume ratio
  const vol20 = avgVolume(volumes, 20) ?? 0;
  const volumeRatio = vol20 > 0 ? lastCandle.volume / vol20 : 0;
  if (vol20 < settings.minAvgVolume) {
    warnings.push("Average volume below minimum threshold.");
  }

  // Compute score breakdown
  const scoreBreakdown = computeScoreBreakdown(best, indicators, status, timeframe, settings, breakoutVolumeRatio);

  // Higher timeframe confirmation (simplified: if daily or above, mark true)
  const htConfirmed = ["monthly", "weekly", "daily"].includes(timeframe);

  // Targets and invalidation
  const patternHeight = best.resistance - candles[best.lowIndex].low;
  const potentialTarget = best.resistance + patternHeight;
  const invalidationLevel = candles[best.lowIndex].low * 0.97;

  const confidence = normalizeScore(scoreBreakdown);

  if (confidence < settings.minConfidence) {
    return null;
  }

  const fmtDate = (ts: number) => new Date(ts).toISOString().split("T")[0];

  return {
    id: `${symbol}-${timeframe}-${best.startIndex}`,
    symbol,
    name,
    market,
    timeframe,
    status,
    confidence: Math.round(confidence),
    scoreBreakdown,
    patternStartIndex: best.startIndex,
    patternLowIndex: best.lowIndex,
    patternEndIndex: best.endIndex,
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
    rsi: indicators.rsi14 ?? 0,
    trend: detectTrend(closes),
    higherTimeframeConfirmed: htConfirmed,
    potentialTarget: Math.round(potentialTarget * 100) / 100,
    invalidationLevel: Math.round(invalidationLevel * 100) / 100,
    signalTimestamp: new Date().toISOString(),
    warnings,
    candles,
    smoothedCurve: best.smoothed,
    indicators,
  };
}

function analyzeWindow(candles: Candle[], startIdx: number, endIdx: number, settings: ScannerSettings): WindowCandidate | null {
  const window = candles.slice(startIdx, endIdx + 1);
  const closes = window.map(c => c.close);

  // Find the low
  let lowIdx = 0;
  let lowVal = Infinity;
  for (let i = 0; i < window.length; i++) {
    if (window[i].low < lowVal) {
      lowVal = window[i].low;
      lowIdx = i;
    }
  }

  const lowPosPct = lowIdx / window.length;

  // Bottom location: 35-65% of pattern window
  if (lowPosPct < 0.2 || lowPosPct > 0.8) return null;

  // Prior downtrend requirement
  const prePatternStart = Math.max(0, startIdx - settings.minPriorDowntrendLength);
  const preCloses = candles.slice(prePatternStart, startIdx + lowIdx).map(c => c.close);
  if (preCloses.length < 5) return null;

  const priorHigh = Math.max(...preCloses);
  const priorDeclinePct = ((priorHigh - lowVal) / priorHigh) * 100;
  if (priorDeclinePct < settings.minPriorDeclinePct) return null;

  // Resistance = highest close in the first 20% of the window
  const resistanceRegionEnd = Math.max(5, Math.floor(window.length * 0.2));
  let resistance = 0;
  for (let i = 0; i < resistanceRegionEnd && i < window.length; i++) {
    if (window[i].close > resistance) resistance = window[i].close;
  }
  if (resistance <= lowVal) return null;

  // Smooth the closes
  const smoothed = savitzkyGolaySmooth(closes, Math.min(7, Math.floor(window.length / 10) * 2 + 1));

  // Shape analysis: compare to ideal U-shape
  const idealU = generateIdealU(window.length, lowIdx);
  let shapeError = 0;
  for (let i = 0; i < window.length; i++) {
    if (isNaN(smoothed[i])) continue;
    const normalized = (smoothed[i] - lowVal) / (resistance - lowVal);
    const ideal = idealU[i];
    shapeError += Math.abs(normalized - ideal);
  }
  shapeError /= window.length;

  if (shapeError > settings.maxShapeError) return null;

  // Base duration
  const baseThreshold = lowVal + (resistance - lowVal) * 0.1;
  let baseDuration = 0;
  for (let i = Math.floor(window.length * 0.25); i < Math.floor(window.length * 0.75); i++) {
    if (i < window.length && window[i].close <= baseThreshold) baseDuration++;
  }
  const minBase = Math.max(5, Math.floor(window.length * 0.1));
  if (baseDuration < minBase) return null;

  // Right side recovery
  const rightStart = lowIdx + baseDuration;
  const rightLen = window.length - rightStart;
  if (rightLen < 5) return null;

  // Left side length
  const leftLen = lowIdx;

  // Symmetry: compare left and right durations
  const symmetryRatio = Math.min(leftLen, rightLen) / Math.max(leftLen, rightLen);
  const symmetryScore = symmetryRatio * 100;

  // V-shape rejection: check max single-candle contribution
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

  return {
    startIndex: startIdx,
    lowIndex: startIdx + lowIdx,
    endIndex: endIdx,
    resistance,
    smoothed,
    shapeError,
    symmetryScore,
    priorDeclinePct,
    baseDuration,
    leftLen,
    rightLen,
  };
}

function generateIdealU(length: number, lowIdx: number): number[] {
  const ideal: number[] = [];
  for (let i = 0; i < length; i++) {
    const t = (i - lowIdx) / Math.max(lowIdx, length - lowIdx);
    ideal.push(Math.max(0, t * t));
  }
  return ideal;
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
    sma20: sma20Arr[last] ?? null,
    sma50: sma50Arr[last] ?? null,
    sma200: sma200Arr ? sma200Arr[last] ?? null : null,
    ema20: ema20Arr[last] ?? null,
    ema50: ema50Arr[last] ?? null,
    rsi14: rsiArr[last] ?? null,
    macd: macdLine[last] ?? null,
    macdSignal: signalLine[last] ?? null,
    macdHist: hist[last] ?? null,
    atr14: atrArr[last] ?? null,
    avgVolume20: vol20,
    adx14: adxArr[last] ?? null,
  };
}

function computeScoreBreakdown(
  candidate: WindowCandidate,
  indicators: IndicatorSnapshot,
  status: PatternStatus,
  timeframe: Timeframe,
  settings: ScannerSettings,
  breakoutVolRatio: number
): ScoreBreakdown {
  // Prior downtrend quality (0-15)
  const priorDowntrend = Math.min(15, (candidate.priorDeclinePct / settings.minPriorDeclinePct) * 10);

  // Smoothness (0-15)
  const smoothness = Math.max(0, Math.min(15, (1 - candidate.shapeError / settings.maxShapeError) * 15));

  // Base duration (0-10)
  const basePct = candidate.baseDuration / (candidate.endIndex - candidate.startIndex);
  const baseDuration = Math.min(10, basePct * 30);

  // Symmetry (0-10)
  const symmetry = Math.min(10, candidate.symmetryScore / 10);

  // Resistance clarity (0-10)
  const resistanceClarity = 8;

  // Breakout quality (0-15)
  let breakoutQuality = 0;
  if (status === "breakout_confirmed") breakoutQuality = 15;
  else if (status === "breakout_retest") breakoutQuality = 13;
  else if (status === "near_breakout") breakoutQuality = 8;
  else if (status === "forming") breakoutQuality = 4;
  else if (status === "failed") breakoutQuality = 0;

  // Volume confirmation (0-10)
  let volumeConfirmation = 0;
  if (indicators.avgVolume20 && indicators.avgVolume20 > 0) {
    if (breakoutVolRatio >= settings.minBreakoutVolumeMultiplier) volumeConfirmation = 10;
    else volumeConfirmation = Math.min(10, breakoutVolRatio * 5);
  }

  // Momentum (0-10)
  let momentum = 0;
  if (indicators.rsi14 != null) {
    if (indicators.rsi14 > 50) momentum += 4;
    if (indicators.rsi14 > 60) momentum += 2;
  }
  if (indicators.macdHist != null && indicators.macdHist > 0) momentum += 4;

  // Retest quality (0-5)
  let retestQuality = 0;
  if (status === "breakout_retest") retestQuality = 5;

  // Data quality (0-5)
  const dataQuality = 5;

  // Timeframe weight (0-20)
  const tfWeight = TIMEFRAME_WEIGHTS[timeframe];

  return {
    priorDowntrend,
    smoothness,
    baseDuration,
    symmetry,
    resistanceClarity,
    breakoutQuality,
    volumeConfirmation,
    momentum,
    retestQuality,
    dataQuality,
    timeframeWeight: tfWeight,
  };
}

function normalizeScore(breakdown: ScoreBreakdown): number {
  const total =
    breakdown.priorDowntrend +
    breakdown.smoothness +
    breakdown.baseDuration +
    breakdown.symmetry +
    breakdown.resistanceClarity +
    breakdown.breakoutQuality +
    breakdown.volumeConfirmation +
    breakdown.momentum +
    breakdown.retestQuality +
    breakdown.dataQuality +
    breakdown.timeframeWeight;
  const maxTotal = 15 + 15 + 10 + 10 + 10 + 15 + 10 + 10 + 5 + 5 + 25;
  return (total / maxTotal) * 100;
}

function makeInsufficientData(
  candles: Candle[],
  timeframe: Timeframe,
  symbol: string,
  name: string,
  market: string,
  warnings: string[]
): PatternDetection {
  const lastCandle = candles[candles.length - 1] ?? { close: 0, timestamp: Date.now() };
  return {
    id: `${symbol}-${timeframe}-insufficient`,
    symbol, name, market, timeframe,
    status: "insufficient_data",
    confidence: 0,
    scoreBreakdown: {
      priorDowntrend: 0, smoothness: 0, baseDuration: 0, symmetry: 0,
      resistanceClarity: 0, breakoutQuality: 0, volumeConfirmation: 0,
      momentum: 0, retestQuality: 0, dataQuality: 0, timeframeWeight: 0,
    },
    patternStartIndex: 0, patternLowIndex: 0, patternEndIndex: 0,
    patternStartDate: "", patternLowDate: "", patternEndDate: "",
    patternDuration: 0, leftResistance: 0,
    resistanceZoneLow: 0, resistanceZoneHigh: 0,
    currentPrice: lastCandle.close ?? 0, breakoutPrice: null,
    breakoutPercentage: 0, volumeRatio: 0, rsi: 0,
    trend: "sideways", higherTimeframeConfirmed: false,
    potentialTarget: 0, invalidationLevel: 0,
    signalTimestamp: new Date().toISOString(),
    warnings, candles, smoothedCurve: [],
    indicators: {
      sma20: null, sma50: null, sma200: null, ema20: null, ema50: null,
      rsi14: null, macd: null, macdSignal: null, macdHist: null,
      atr14: null, avgVolume20: null, adx14: null,
    },
  };
}

export function getConfidenceLabel(score: number): string {
  if (score >= 80) return "Very strong multi-timeframe alignment";
  if (score >= 65) return "Strong setup";
  if (score >= 50) return "Developing or moderate setup";
  if (score >= 35) return "Weak setup";
  return "Ignore by default";
}

export function getStatusColor(status: PatternStatus): string {
  switch (status) {
    case "breakout_confirmed": return "text-emerald-400 bg-emerald-900/40 border-emerald-800";
    case "forming":
    case "near_breakout": return "text-blue-400 bg-blue-900/40 border-blue-800";
    case "breakout_retest": return "text-orange-400 bg-orange-900/40 border-orange-800";
    case "failed": return "text-red-400 bg-red-900/40 border-red-800";
    default: return "text-slate-400 bg-slate-800/40 border-slate-700";
  }
}
