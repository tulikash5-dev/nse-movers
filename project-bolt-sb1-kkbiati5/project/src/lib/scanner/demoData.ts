import type { Candle, Timeframe, Instrument } from "./types";
import { TIMEFRAME_MIN_CANDLES } from "./types";

export const DEMO_INSTRUMENTS: Instrument[] = [
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
  monthly: 30 * 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "5m": 5 * 60 * 1000,
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
  count: number,
  intervalMs: number,
  startPrice: number,
  declinePct: number,
  baseDurationPct: number,
  breakout: boolean,
  rng: () => number,
  volatility: number
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
      // Pre-pattern: gentle uptrend near resistance
      const t = i / prePatternLen;
      close = resistance * (0.95 + 0.05 * t + (rng() - 0.5) * volatility * 0.5);
    } else if (elapsed < leftLen) {
      // Left side decline - decelerating
      const t = elapsed / leftLen;
      const eased = 1 - Math.pow(1 - t, 2);
      close = resistance - (resistance - lowPrice) * eased * 0.95;
    } else if (elapsed < leftLen + baseLen) {
      // Base - flat near low with slight oscillation
      const t = (elapsed - leftLen) / baseLen;
      const wave = Math.sin(t * Math.PI * 2) * 0.01 * lowPrice;
      close = lowPrice + wave + (rng() - 0.5) * volatility * lowPrice * 0.3;
    } else if (elapsed < patternLen) {
      // Right side recovery - gradual
      const t = (elapsed - leftLen - baseLen) / rightLen;
      const eased = Math.pow(t, 2);
      close = lowPrice + (resistance - lowPrice) * eased * 0.95;
    } else {
      // Post-pattern
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
      timestamp: ts,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
      complete: i < count - 1,
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

export function generateDemoCandles(symbol: string, timeframe: Timeframe): Candle[] {
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
  if (profile.type === "uptrend") {
    return generateUptrend(count, intervalMs, profile.startPrice, rng, profile.vol);
  }
  return generateSideways(count, intervalMs, profile.startPrice, rng, profile.vol);
}

export function isDemoMode(): boolean {
  return !import.meta.env.VITE_MARKET_DATA_API_KEY;
}
