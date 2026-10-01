// Deterministic synthetic OHLCV data generator for NSE watchlist.
// Uses a seeded PRNG so the same symbol always produces the same series,
// creating realistic-looking price action with volume spikes and trends.

import type { Candle, Instrument } from "./types";
import { WATCHLIST } from "./types";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSymbol(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface SymbolProfile {
  basePrice: number;
  volatility: number;
  trendBias: number;
  baseVolume: number;
}

const PROFILES: Record<string, SymbolProfile> = {};
for (const inst of WATCHLIST) {
  const seed = hashSymbol(inst.symbol);
  const rng = mulberry32(seed);
  PROFILES[inst.symbol] = {
    basePrice: 100 + rng() * 2800,
    volatility: 0.01 + rng() * 0.03,
    trendBias: (rng() - 0.5) * 0.0008,
    baseVolume: 3_000_000 + rng() * 20_000_000,
  };
}

export function generateCandles(symbol: string, days = 400): Candle[] {
  const profile = PROFILES[symbol] ?? {
    basePrice: 500,
    volatility: 0.02,
    trendBias: 0,
    baseVolume: 5_000_000,
  };

  const seed = hashSymbol(symbol);
  const rng = mulberry32(seed);

  const candles: Candle[] = [];
  let price = profile.basePrice;
  let trendPhase = 0;
  let trendLength = 0;
  let phaseBias = 0;

  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    if (trendLength <= 0) {
      trendPhase = Math.floor(rng() * 4);
      trendLength = 15 + Math.floor(rng() * 40);
      phaseBias =
        trendPhase === 0
          ? 0.002
          : trendPhase === 1
          ? -0.002
          : trendPhase === 2
          ? 0.004
          : -0.004;
    }
    trendLength--;

    const dailyChange =
      (rng() - 0.5) * 2 * profile.volatility +
      phaseBias +
      profile.trendBias;
    const open = price;
    const close = Math.max(1, price * (1 + dailyChange));
    const range = Math.abs(close - open) + price * profile.volatility * rng();
    const high = Math.max(open, close) + range * rng() * 0.5;
    const low = Math.min(open, close) - range * rng() * 0.5;

    let volume = profile.baseVolume * (0.6 + rng() * 0.8);
    if (Math.abs(dailyChange) > profile.volatility * 1.2) {
      volume *= 1.3 + rng() * 1.5;
    }
    if (rng() < 0.08) volume *= 2 + rng() * 2;

    candles.push({
      date: d.toISOString().split("T")[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(Math.max(0.1, low) * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.round(volume),
    });

    price = close;
  }

  return candles;
}

export function getWatchlist(): Instrument[] {
  return WATCHLIST;
}
