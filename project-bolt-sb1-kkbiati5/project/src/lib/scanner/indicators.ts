import type { Candle } from "./types";

export function sma(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) result[i] = sum / period;
  }
  return result;
}

export function ema(values: number[], period: number): number[] {
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

export function rsi(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
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

export function macd(closes: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const signalLine = ema(macdLine, signal);
  const hist = macdLine.map((m, i) => m - signalLine[i]);
  return { macdLine, signalLine, hist };
}

export function atr(candles: Candle[], period = 14): number[] {
  const result: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < 2) return result;
  const trs: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
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

export function adx(candles: Candle[], period = 14): number[] {
  const result: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < period * 2) return result;
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  const trs: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const smoothedTR: number[] = [0];
  const smoothedPlus: number[] = [0];
  const smoothedMinus: number[] = [0];
  let trSum = 0, plusSum = 0, minusSum = 0;
  for (let i = 1; i <= period && i < trs.length; i++) {
    trSum += trs[i];
    plusSum += plusDM[i];
    minusSum += minusDM[i];
  }
  if (trs.length > period) {
    smoothedTR[period] = trSum;
    smoothedPlus[period] = plusSum;
    smoothedMinus[period] = minusSum;
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
  let adxSum = 0;
  let count = 0;
  for (let i = period; i < period * 2 && i < dx.length; i++) {
    if (!isNaN(dx[i])) { adxSum += dx[i]; count++; }
  }
  if (count > 0) result[period * 2 - 1] = adxSum / count;
  for (let i = period * 2; i < dx.length; i++) {
    if (!isNaN(dx[i])) {
      result[i] = (result[i - 1] * (period - 1) + dx[i]) / period;
    }
  }
  return result;
}

export function avgVolume(volumes: number[], period: number): number | null {
  if (volumes.length < period) return null;
  let sum = 0;
  for (let i = volumes.length - period; i < volumes.length; i++) sum += volumes[i];
  return sum / period;
}

export function detectTrend(closes: number[]): "uptrend" | "downtrend" | "sideways" {
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

export function savitzkyGolaySmooth(values: number[], windowSize = 5): number[] {
  const result: number[] = new Array(values.length).fill(NaN);
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = -half; j <= half; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < values.length) {
        sum += values[idx];
        count++;
      }
    }
    result[i] = sum / count;
  }
  return result;
}
