export type Timeframe = "monthly" | "weekly" | "daily" | "4h" | "1h" | "15m" | "5m";

export const TIMEFRAME_ORDER: Timeframe[] = ["monthly", "weekly", "daily", "4h", "1h", "15m", "5m"];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  daily: "Daily",
  "4h": "4-Hour",
  "1h": "1-Hour",
  "15m": "15-Min",
  "5m": "5-Min",
};

export const TIMEFRAME_WEIGHTS: Record<Timeframe, number> = {
  monthly: 25,
  weekly: 20,
  daily: 20,
  "4h": 15,
  "1h": 10,
  "15m": 5,
  "5m": 5,
};

export const TIMEFRAME_MIN_CANDLES: Record<Timeframe, number> = {
  monthly: 120,
  weekly: 260,
  daily: 500,
  "4h": 1000,
  "1h": 1500,
  "15m": 2000,
  "5m": 3000,
};

export const TIMEFRAME_WINDOW_DEFAULTS: Record<Timeframe, { min: number; max: number }> = {
  monthly: { min: 12, max: 60 },
  weekly: { min: 20, max: 104 },
  daily: { min: 40, max: 260 },
  "4h": { min: 60, max: 400 },
  "1h": { min: 80, max: 500 },
  "15m": { min: 100, max: 600 },
  "5m": { min: 120, max: 800 },
};

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete: boolean;
}

export type PatternStatus =
  | "forming"
  | "near_breakout"
  | "breakout_confirmed"
  | "breakout_retest"
  | "failed"
  | "insufficient_data";

export const STATUS_LABELS: Record<PatternStatus, string> = {
  forming: "Forming",
  near_breakout: "Near Breakout",
  breakout_confirmed: "Breakout Confirmed",
  breakout_retest: "Breakout Retest",
  failed: "Failed",
  insufficient_data: "Insufficient Data",
};

export type TrendDirection = "uptrend" | "downtrend" | "sideways";

export interface ScoreBreakdown {
  priorDowntrend: number;
  smoothness: number;
  baseDuration: number;
  symmetry: number;
  resistanceClarity: number;
  breakoutQuality: number;
  volumeConfirmation: number;
  momentum: number;
  retestQuality: number;
  dataQuality: number;
  timeframeWeight: number;
}

export interface PatternDetection {
  id: string;
  symbol: string;
  name: string;
  market: string;
  timeframe: Timeframe;
  status: PatternStatus;
  confidence: number;
  scoreBreakdown: ScoreBreakdown;
  patternStartIndex: number;
  patternLowIndex: number;
  patternEndIndex: number;
  patternStartDate: string;
  patternLowDate: string;
  patternEndDate: string;
  patternDuration: number;
  leftResistance: number;
  resistanceZoneLow: number;
  resistanceZoneHigh: number;
  currentPrice: number;
  breakoutPrice: number | null;
  breakoutPercentage: number;
  volumeRatio: number;
  rsi: number;
  trend: TrendDirection;
  higherTimeframeConfirmed: boolean;
  potentialTarget: number;
  invalidationLevel: number;
  signalTimestamp: string;
  warnings: string[];
  candles: Candle[];
  smoothedCurve: number[];
  indicators: IndicatorSnapshot;
}

export interface IndicatorSnapshot {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema20: number | null;
  ema50: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  atr14: number | null;
  avgVolume20: number | null;
  adx14: number | null;
}

export interface TimeframeMatrixRow {
  timeframe: Timeframe;
  status: PatternStatus | "none";
  trend: TrendDirection;
  breakout: boolean;
  volume: number | null;
  rsi: number | null;
  score: number;
}

export interface ScannerSettings {
  enabledTimeframes: Timeframe[];
  scanOrder: Timeframe[];
  primaryTimeframe: Timeframe;
  requireLowerTFConfirmation: boolean;
  minConfidence: number;
  minPatternDuration: number;
  maxPatternDuration: number;
  minAvgVolume: number;
  minBreakoutVolumeMultiplier: number;
  minBreakoutPct: number;
  volumeMandatory: boolean;
  higherTFMandatory: boolean;
  includeForming: boolean;
  onlyConfirmed: boolean;
  minPriorDeclinePct: number;
  minPriorDowntrendLength: number;
  nearBreakoutDistance: number;
  breakoutBuffer: number;
  maxShapeError: number;
  resistanceZoneWidth: number;
  adjustedPrices: boolean;
  autoScan: boolean;
}

export const DEFAULT_SETTINGS: ScannerSettings = {
  enabledTimeframes: ["monthly", "weekly", "daily", "4h", "1h", "15m", "5m"],
  scanOrder: ["monthly", "weekly", "daily", "4h", "1h", "15m", "5m"],
  primaryTimeframe: "daily",
  requireLowerTFConfirmation: false,
  minConfidence: 50,
  minPatternDuration: 40,
  maxPatternDuration: 260,
  minAvgVolume: 100000,
  minBreakoutVolumeMultiplier: 1.5,
  minBreakoutPct: 1,
  volumeMandatory: false,
  higherTFMandatory: false,
  includeForming: true,
  onlyConfirmed: false,
  minPriorDeclinePct: 20,
  minPriorDowntrendLength: 20,
  nearBreakoutDistance: 3,
  breakoutBuffer: 1,
  maxShapeError: 0.15,
  resistanceZoneWidth: 2,
  adjustedPrices: true,
  autoScan: false,
};

export interface Instrument {
  symbol: string;
  name: string;
  market: string;
  type: "stock" | "etf" | "crypto" | "index";
}
