// Multi-Timeframe CHOCH Detection Algorithm - Expert Trader Edition
// Implements Smart Money Concepts (SMC) + Institutional Trading Logic

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SwingPoint {
  type: "high" | "low";
  price: number;
  index: number;
  time: string;
  strength?: "strong" | "weak"; // Based on rejection wicks
}

export interface StructureAnalysis {
  trend: "bullish" | "bearish" | "ranging";
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  lastHH: number | null;
  lastHL: number | null;
  lastLH: number | null;
  lastLL: number | null;
  impulseHighs: SwingPoint[]; // Strong momentum candles
  impulseLows: SwingPoint[];
}

export interface ChochResult {
  detected: boolean;
  type: "bullish" | "bearish" | null;
  price: number;
  swingPoint: number;
  candleCloseBeyond: boolean;
  liquiditySweep: boolean;
  index: number;
  time: string;
  // Expert additions
  sweepDistance?: number; // How far price swept before reversal
  rejectionStrength?: "strong" | "moderate" | "weak";
}

export interface BosResult {
  detected: boolean;
  type: "bullish" | "bearish" | null;
  price: number;
  breakLevel: number;
  index: number;
  time: string;
  // Expert additions
  breakStrength: "strong" | "moderate" | "weak"; // Based on candle body vs wick
  retestLevel?: number; // Predicted retest zone
}

export interface VolumeAnalysis {
  hasSpike: boolean;
  spikeRatio: number;
  avgVolume: number;
  currentVolume: number;
  volumeTrend: "increasing" | "decreasing" | "neutral";
}

export interface OrderBlock {
  type: "bullish" | "bearish";
  high: number;
  low: number;
  index: number;
  time: string;
  mitigation: boolean; // Has price returned to this OB?
  strength: "high" | "medium" | "low"; // Based on impulse candle size
}

export interface FairValueGap {
  type: "bullish" | "bearish";
  high: number;
  low: number;
  index: number;
  filled: boolean; // Has the gap been filled?
}

export interface KeyLevel {
  type: "order_block_bullish" | "order_block_bearish" | "supply" | "demand" | "session_high" | "session_low" | "fvg_bullish" | "fvg_bearish";
  price: number;
  proximity: number;
  orderBlock?: OrderBlock;
  fvg?: FairValueGap;
}

export interface PDAZone {
  type: "premium" | "discount" | "equilibrium";
  high: number;
  low: number;
  currentPricePosition: number; // 0-100 percentage within the range
}

export interface FibonacciLevels {
  level_0: number;    // Swing low (for bullish) / high (for bearish)
  level_236: number;
  level_382: number;
  level_500: number;
  level_618: number;
  level_786: number;
  level_1: number;   // Swing high (for bullish) / low (for bearish)
}

export interface ChochAnalysisResult {
  // HTF Analysis (Step 1)
  htfBias: "bullish" | "bearish" | "neutral";
  htfStructure: string;
  htfChoch: ChochResult | null;
  htfOrderBlocks: OrderBlock[];
  htfFVGs: FairValueGap[];
  htfPDAZone: PDAZone | null;

  // MTF Analysis (Step 2)
  mtfBos: BosResult | null;
  mtfChoch: ChochResult | null;
  mtfOrderBlocks: OrderBlock[];
  mtfFVGs: FairValueGap[];
  mtfFibonacci: FibonacciLevels | null;

  // Confirmations
  volumeAnalysis: VolumeAnalysis;
  liquiditySweep: boolean;
  htfAlignment: boolean;
  keyLevelContext: KeyLevel | null;

  // Rule table (Step 3)
  rules: {
    candleBodyClose: { status: boolean; notes: string };
    breakOfStructure: { status: boolean; notes: string };
    volumeSpike: { status: boolean; notes: string };
    liquiditySweep: { status: boolean; notes: string };
    htfAlignment: { status: boolean; notes: string };
    keyLevelContext: { status: boolean; notes: string };
  };

  // Final Signal (Step 4)
  signal: "BUY" | "SELL" | "NO TRADE";
  signalStrength: "strong" | "medium" | "weak";
  confluenceScore: number; // 0-10

  // Trade Management
  entryPrice: number | null;
  stopLoss: number | null;
  target: number | null;
  riskReward: number | null;
  targets: { tp1: number | null; tp2: number | null; tp3: number | null };

  // Expert additions
  invalidationLevel: number | null; // Where the setup fails
  maxRiskPercent: number; // Suggested risk per trade
  positionSizeGuidance: string;
}

export interface ChochConfig {
  swingLookback: number;
  bodyCloseThreshold: number;
  volumeSpikeMultiplier: number;
  liquiditySweepThreshold: number;
  keyLevelProximity: number;
  riskRewardRatio: number;
  // Expert additions
  orderBlockMinBodyRatio: number; // Minimum body/candle ratio for valid OB
  fvgMinRatio: number; // Minimum gap for valid FVG
  fibExtensionTargets: boolean; // Use fib extensions for targets
}

export const defaultChochConfig: ChochConfig = {
  swingLookback: 5,
  bodyCloseThreshold: 0.1,
  volumeSpikeMultiplier: 1.5,
  liquiditySweepThreshold: 0.2,
  keyLevelProximity: 1,
  riskRewardRatio: 2,
  orderBlockMinBodyRatio: 0.6,
  fvgMinRatio: 0.3,
  fibExtensionTargets: true,
};

// ============ SWING DETECTION ============

export function detectSwingPoints(
  candles: Candle[],
  lookback: number = 5
): { highs: SwingPoint[]; lows: SwingPoint[] } {
  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];

  if (candles.length < lookback * 2 + 1) {
    return { highs, lows };
  }

  for (let i = lookback; i < candles.length - lookback; i++) {
    const currentHigh = candles[i].high;
    const currentLow = candles[i].low;
    const currentBody = Math.abs(candles[i].close - candles[i].open);
    const candleRange = currentHigh - currentLow;

    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= currentHigh) isSwingHigh = false;
      if (candles[j].low <= currentLow) isSwingLow = false;
    }

    // Determine strength based on rejection wick
    const upperWick = currentHigh - Math.max(candles[i].open, candles[i].close);
    const lowerWick = Math.min(candles[i].open, candles[i].close) - currentLow;

    if (isSwingHigh) {
      highs.push({
        type: "high",
        price: currentHigh,
        index: i,
        time: candles[i].time,
        strength: upperWick > candleRange * 0.5 ? "strong" : "weak",
      });
    }

    if (isSwingLow) {
      lows.push({
        type: "low",
        price: currentLow,
        index: i,
        time: candles[i].time,
        strength: lowerWick > candleRange * 0.5 ? "strong" : "weak",
      });
    }
  }

  return { highs, lows };
}

// ============ STRUCTURE ANALYSIS ============

export function analyzeStructure(
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[]
): StructureAnalysis {
  const result: StructureAnalysis = {
    trend: "ranging",
    swingHighs,
    swingLows,
    lastHH: null,
    lastHL: null,
    lastLH: null,
    lastLL: null,
    impulseHighs: [],
    impulseLows: [],
  };

  if (swingHighs.length < 2 || swingLows.length < 2) {
    return result;
  }

  const recentHighs = swingHighs.slice(-3);
  const recentLows = swingLows.slice(-3);

  // Analyze HH/HL pattern
  const higherHighs = recentHighs.length >= 2 &&
    recentHighs.every((h, i) => i === 0 || h.price > recentHighs[i - 1].price);
  const higherLows = recentLows.length >= 2 &&
    recentLows.every((l, i) => i === 0 || l.price > recentLows[i - 1].price);

  // Analyze LH/LL pattern
  const lowerHighs = recentHighs.length >= 2 &&
    recentHighs.every((h, i) => i === 0 || h.price < recentHighs[i - 1].price);
  const lowerLows = recentLows.length >= 2 &&
    recentLows.every((l, i) => i === 0 || l.price < recentLows[i - 1].price);

  // Determine trend
  if (higherHighs && higherLows) {
    result.trend = "bullish";
    if (recentHighs.length >= 1) result.lastHH = recentHighs[recentHighs.length - 1].price;
    if (recentLows.length >= 1) result.lastHL = recentLows[recentLows.length - 1].price;
  } else if (lowerHighs && lowerLows) {
    result.trend = "bearish";
    if (recentHighs.length >= 1) result.lastLH = recentHighs[recentHighs.length - 1].price;
    if (recentLows.length >= 1) result.lastLL = recentLows[recentLows.length - 1].price;
  } else {
    result.trend = "ranging";
  }

  // Identify impulse moves (strong swing points)
  result.impulseHighs = swingHighs.filter(s => s.strength === "strong");
  result.impulseLows = swingLows.filter(s => s.strength === "strong");

  return result;
}

export function getStructureDescription(structure: StructureAnalysis): string {
  const parts: string[] = [];

  if (structure.trend === "bullish") {
    if (structure.lastHH) parts.push(`HH @ ${structure.lastHH.toFixed(2)}`);
    if (structure.lastHL) parts.push(`HL @ ${structure.lastHL.toFixed(2)}`);
    return `Bullish: ${parts.join(" → ")}`;
  } else if (structure.trend === "bearish") {
    if (structure.lastLH) parts.push(`LH @ ${structure.lastLH.toFixed(2)}`);
    if (structure.lastLL) parts.push(`LL @ ${structure.lastLL.toFixed(2)}`);
    return `Bearish: ${parts.join(" → ")}`;
  }

  return "Ranging: No clear structure";
}

// ============ CHOCH DETECTION ============

export function detectChoch(
  candles: Candle[],
  structure: StructureAnalysis,
  config: ChochConfig = defaultChochConfig
): ChochResult | null {
  if (candles.length < 3 || structure.swingHighs.length < 2 || structure.swingLows.length < 2) {
    return null;
  }

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];

  // Bullish CHOCH: Close above swing high in downtrend/range
  if (structure.trend === "bearish" || structure.trend === "ranging") {
    const lastSwingHigh = structure.swingHighs[structure.swingHighs.length - 1];
    // Use the most relevant swing high (not necessarily the last)
    const relevantSwingHighs = structure.swingHighs.filter(s => s.index >= candles.length - 20);

    for (const swingHigh of relevantSwingHighs.reverse()) {
      if (lastCandle.close > swingHigh.price) {
        const sweepThreshold = swingHigh.price * (config.liquiditySweepThreshold / 100);
        const hadSweep = candles.slice(-5).some(c =>
          c.high > swingHigh.price && Math.abs(c.high - swingHigh.price) <= sweepThreshold
        );

        const bodySize = Math.abs(lastCandle.close - lastCandle.open);
        const candleRange = lastCandle.high - lastCandle.low;
        const rejectionStrength = bodySize > candleRange * 0.7 ? "strong" :
                                   bodySize > candleRange * 0.4 ? "moderate" : "weak";

        return {
          detected: true,
          type: "bullish",
          price: lastCandle.close,
          swingPoint: swingHigh.price,
          candleCloseBeyond: true,
          liquiditySweep: hadSweep,
          index: candles.length - 1,
          time: lastCandle.time,
          sweepDistance: hadSweep ? (lastCandle.high - swingHigh.price) / swingHigh.price * 100 : 0,
          rejectionStrength,
        };
      }
    }
  }

  // Bearish CHOCH: Close below swing low in uptrend/range
  if (structure.trend === "bullish" || structure.trend === "ranging") {
    const relevantSwingLows = structure.swingLows.filter(s => s.index >= candles.length - 20);

    for (const swingLow of relevantSwingLows.reverse()) {
      if (lastCandle.close < swingLow.price) {
        const sweepThreshold = swingLow.price * (config.liquiditySweepThreshold / 100);
        const hadSweep = candles.slice(-5).some(c =>
          c.low < swingLow.price && Math.abs(swingLow.price - c.low) <= sweepThreshold
        );

        const bodySize = Math.abs(lastCandle.close - lastCandle.open);
        const candleRange = lastCandle.high - lastCandle.low;
        const rejectionStrength = bodySize > candleRange * 0.7 ? "strong" :
                                   bodySize > candleRange * 0.4 ? "moderate" : "weak";

        return {
          detected: true,
          type: "bearish",
          price: lastCandle.close,
          swingPoint: swingLow.price,
          candleCloseBeyond: true,
          liquiditySweep: hadSweep,
          index: candles.length - 1,
          time: lastCandle.time,
          sweepDistance: hadSweep ? (swingLow.price - lastCandle.low) / swingLow.price * 100 : 0,
          rejectionStrength,
        };
      }
    }
  }

  return null;
}

// ============ BOS DETECTION ============

export function detectBos(
  candles: Candle[],
  structure: StructureAnalysis,
  config: ChochConfig = defaultChochConfig
): BosResult | null {
  if (candles.length < 3) return null;

  const lastCandle = candles[candles.length - 1];
  const bodyClose = lastCandle.close;

  // Bullish BOS: Breaking above recent swing high (continuation)
  if (structure.trend === "bullish" && structure.swingHighs.length >= 2) {
    const recentSwingHigh = structure.swingHighs[structure.swingHighs.length - 2];
    const currentSwingHigh = structure.swingHighs[structure.swingHighs.length - 1];

    // Break of the most recent swing high
    const breakLevel = currentSwingHigh.price;
    if (bodyClose > breakLevel) {
      const bodySize = Math.abs(lastCandle.close - lastCandle.open);
      const candleRange = lastCandle.high - lastCandle.low;
      const breakStrength = bodySize > candleRange * 0.7 ? "strong" :
                            bodySize > candleRange * 0.4 ? "moderate" : "weak";

      return {
        detected: true,
        type: "bullish",
        price: bodyClose,
        breakLevel,
        index: candles.length - 1,
        time: lastCandle.time,
        breakStrength,
        retestLevel: breakLevel,
      };
    }
  }

  // Bearish BOS: Breaking below recent swing low (continuation)
  if (structure.trend === "bearish" && structure.swingLows.length >= 2) {
    const currentSwingLow = structure.swingLows[structure.swingLows.length - 1];

    const breakLevel = currentSwingLow.price;
    if (bodyClose < breakLevel) {
      const bodySize = Math.abs(lastCandle.close - lastCandle.open);
      const candleRange = lastCandle.high - lastCandle.low;
      const breakStrength = bodySize > candleRange * 0.7 ? "strong" :
                            bodySize > candleRange * 0.4 ? "moderate" : "weak";

      return {
        detected: true,
        type: "bearish",
        price: bodyClose,
        breakLevel,
        index: candles.length - 1,
        time: lastCandle.time,
        breakStrength,
        retestLevel: breakLevel,
      };
    }
  }

  return null;
}

// ============ ORDER BLOCK DETECTION ============

export function detectOrderBlocks(
  candles: Candle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  config: ChochConfig = defaultChochConfig
): OrderBlock[] {
  const orderBlocks: OrderBlock[] = [];

  if (candles.length < 10) return orderBlocks;

  // Calculate average true range for body ratio
  const atr = calculateATR(candles, 14);
  const avgBody = candles.slice(-20).reduce((sum, c) =>
    sum + Math.abs(c.close - c.open), 0) / 20;

  // Bullish Order Blocks: Last bearish candle before a strong bullish move to swing high
  for (const swing of swingHighs.slice(-5)) {
    if (swing.index < 3) continue;

    // Look for the last bearish candle before the move up
    for (let i = swing.index - 1; i >= Math.max(0, swing.index - 5); i--) {
      const candle = candles[i];
      if (candle.close < candle.open) {
        // Bearish candle
        const bodySize = Math.abs(candle.close - candle.open);
        const nextMove = candles.slice(i + 1, swing.index + 1);
        const isImpulse = nextMove.some(c =>
          Math.abs(c.close - c.open) > avgBody * 1.5
        );

        if (bodySize > avgBody * config.orderBlockMinBodyRatio || isImpulse) {
          const ob: OrderBlock = {
            type: "bullish",
            high: candle.open,
            low: candle.low,
            index: i,
            time: candle.time,
            mitigation: candles.slice(swing.index).some(c =>
              c.low <= candle.high && c.low >= candle.low
            ),
            strength: bodySize > avgBody * 1.5 ? "high" :
                     bodySize > avgBody ? "medium" : "low",
          };
          orderBlocks.push(ob);
          break;
        }
      }
    }
  }

  // Bearish Order Blocks: Last bullish candle before a strong bearish move to swing low
  for (const swing of swingLows.slice(-5)) {
    if (swing.index < 3) continue;

    for (let i = swing.index - 1; i >= Math.max(0, swing.index - 5); i--) {
      const candle = candles[i];
      if (candle.close > candle.open) {
        // Bullish candle
        const bodySize = Math.abs(candle.close - candle.open);
        const nextMove = candles.slice(i + 1, swing.index + 1);
        const isImpulse = nextMove.some(c =>
          Math.abs(c.close - c.open) > avgBody * 1.5
        );

        if (bodySize > avgBody * config.orderBlockMinBodyRatio || isImpulse) {
          const ob: OrderBlock = {
            type: "bearish",
            high: candle.high,
            low: candle.open,
            index: i,
            time: candle.time,
            mitigation: candles.slice(swing.index).some(c =>
              c.high >= candle.low && c.high <= candle.high
            ),
            strength: bodySize > avgBody * 1.5 ? "high" :
                     bodySize > avgBody ? "medium" : "low",
          };
          orderBlocks.push(ob);
          break;
        }
      }
    }
  }

  return orderBlocks;
}

// ============ FAIR VALUE GAP DETECTION ============

export function detectFairValueGaps(
  candles: Candle[],
  config: ChochConfig = defaultChochConfig
): FairValueGap[] {
  const gaps: FairValueGap[] = [];

  if (candles.length < 3) return gaps;

  const avgRange = candles.slice(-20).reduce((sum, c) =>
    sum + (c.high - c.low), 0) / 20;

  // Bullish FVG: Gap between candle 1 low and candle 3 high
  for (let i = 2; i < candles.length; i++) {
    const candle1 = candles[i - 2];
    const candle3 = candles[i];

    // Bullish FVG: candle1 is bullish impulse, gap between candle1 high and candle3 low
    if (candle1.close > candle1.open && candle3.close > candle3.open) {
      const gapLow = candle1.high;
      const gapHigh = candle3.low;
      const gapSize = gapHigh - gapLow;

      if (gapSize > 0 && gapSize > avgRange * config.fvgMinRatio) {
        gaps.push({
          type: "bullish",
          high: gapHigh,
          low: gapLow,
          index: i - 2,
          filled: candles.slice(i).some(c => c.low <= gapLow),
        });
      }
    }

    // Bearish FVG: candle1 is bearish impulse, gap between candle1 low and candle3 high
    const bcandle1 = candles[i - 2];
    const bcandle3 = candles[i];

    if (bcandle1.close < bcandle1.open && bcandle3.close < bcandle3.open) {
      const gapHigh = bcandle1.low;
      const gapLow = bcandle3.high;
      const gapSize = gapHigh - gapLow;

      if (gapSize > 0 && gapSize > avgRange * config.fvgMinRatio) {
        gaps.push({
          type: "bearish",
          high: gapHigh,
          low: gapLow,
          index: i - 2,
          filled: candles.slice(i).some(c => c.high >= gapHigh),
        });
      }
    }
  }

  return gaps;
}

// ============ PD ARRAY (PREMIUM/DISCOUNT) ============

export function calculatePDAZone(
  candles: Candle[],
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[]
): PDAZone | null {
  if (swingHighs.length < 1 || swingLows.length < 1) return null;

  const recentHigh = swingHighs[swingHighs.length - 1]?.price || Math.max(...candles.slice(-50).map(c => c.high));
  const recentLow = swingLows[swingLows.length - 1]?.price || Math.min(...candles.slice(-50).map(c => c.low));

  const currentPrice = candles[candles.length - 1].close;
  const range = recentHigh - recentLow;

  if (range <= 0) return null;

  const currentPricePosition = ((recentHigh - currentPrice) / range) * 100;

  let type: "premium" | "discount" | "equilibrium";
  if (currentPricePosition < 35) {
    type = "premium"; // Price in upper 35% - expensive
  } else if (currentPricePosition > 65) {
    type = "discount"; // Price in lower 35% - cheap
  } else {
    type = "equilibrium"; // Price in middle 30%
  }

  return {
    type,
    high: recentHigh,
    low: recentLow,
    currentPricePosition,
  };
}

// ============ FIBONACCI LEVELS ============

export function calculateFibonacciLevels(
  swingHigh: number,
  swingLow: number,
  direction: "bullish" | "bearish"
): FibonacciLevels {
  const range = swingHigh - swingLow;

  if (direction === "bullish") {
    // For bullish retracements
    return {
      level_0: swingLow,
      level_236: swingLow + range * 0.236,
      level_382: swingLow + range * 0.382,
      level_500: swingLow + range * 0.5,
      level_618: swingLow + range * 0.618,
      level_786: swingLow + range * 0.786,
      level_1: swingHigh,
    };
  } else {
    // For bearish retracements
    return {
      level_0: swingHigh,
      level_236: swingHigh - range * 0.236,
      level_382: swingHigh - range * 0.382,
      level_500: swingHigh - range * 0.5,
      level_618: swingHigh - range * 0.618,
      level_786: swingHigh - range * 0.786,
      level_1: swingLow,
    };
  }
}

// ============ VOLUME ANALYSIS ============

export function analyzeVolume(
  candles: Candle[],
  lookback: number = 20
): VolumeAnalysis {
  if (candles.length < 2) {
    return {
      hasSpike: false,
      spikeRatio: 0,
      avgVolume: 0,
      currentVolume: 0,
      volumeTrend: "neutral",
    };
  }

  const volumeHistory = candles.slice(-lookback - 1, -1).map(c => c.volume);
  const avgVolume = volumeHistory.length > 0
    ? volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length
    : 0;

  const currentVolume = candles[candles.length - 1].volume;
  const spikeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;

  // Determine volume trend (last 5 vs previous 5)
  const recentVol = volumeHistory.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const prevVol = volumeHistory.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;

  let volumeTrend: "increasing" | "decreasing" | "neutral" = "neutral";
  if (recentVol > prevVol * 1.2) volumeTrend = "increasing";
  else if (recentVol < prevVol * 0.8) volumeTrend = "decreasing";

  return {
    hasSpike: spikeRatio >= defaultChochConfig.volumeSpikeMultiplier,
    spikeRatio,
    avgVolume,
    currentVolume,
    volumeTrend,
  };
}

// ============ ATR CALCULATION ============

export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0;

  const trueRanges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );

    trueRanges.push(tr);
  }

  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((a, b) => a + b, 0) / recentTR.length;
}

// ============ MAIN ANALYSIS FUNCTION ============

export function analyzeChoch(
  htfCandles: Candle[],
  mtfCandles: Candle[],
  config: ChochConfig = defaultChochConfig
): ChochAnalysisResult {
  // Step 1: Higher Timeframe Analysis
  const htfSwings = detectSwingPoints(htfCandles, config.swingLookback);
  const htfStructure = analyzeStructure(htfSwings.highs, htfSwings.lows);
  const htfChoch = detectChoch(htfCandles, htfStructure, config);
  const htfOrderBlocks = detectOrderBlocks(htfCandles, htfSwings.highs, htfSwings.lows, config);
  const htfFVGs = detectFairValueGaps(htfCandles, config);
  const htfPDAZone = calculatePDAZone(htfCandles, htfSwings.highs, htfSwings.lows);

  const htfBias = htfChoch?.detected
    ? htfChoch.type!
    : htfStructure.trend === "bullish"
      ? "bullish"
      : htfStructure.trend === "bearish"
        ? "bearish"
        : "neutral";

  // Step 2: Mid Timeframe Entry Analysis
  const mtfSwings = detectSwingPoints(mtfCandles, Math.max(3, config.swingLookback - 2));
  const mtfStructure = analyzeStructure(mtfSwings.highs, mtfSwings.lows);
  const mtfBos = detectBos(mtfCandles, mtfStructure, config);
  const mtfChoch = detectChoch(mtfCandles, mtfStructure, config);
  const mtfOrderBlocks = detectOrderBlocks(mtfCandles, mtfSwings.highs, mtfSwings.lows, config);
  const mtfFVGs = detectFairValueGaps(mtfCandles, config);

  // Calculate Fibonacci levels
  let mtfFibonacci: FibonacciLevels | null = null;
  const swingHigh = mtfSwings.highs[mtfSwings.highs.length - 1]?.price;
  const swingLow = mtfSwings.lows[mtfSwings.lows.length - 1]?.price;

  if (swingHigh && swingLow) {
    const direction = mtfStructure.trend === "bullish" ? "bullish" :
                     mtfStructure.trend === "bearish" ? "bearish" : "bullish";
    mtfFibonacci = calculateFibonacciLevels(swingHigh, swingLow, direction);
  }

  // Volume Analysis
  const volumeAnalysis = analyzeVolume(mtfCandles);

  // Key Levels
  const currentPrice = mtfCandles[mtfCandles.length - 1]?.close ?? 0;
  const allKeyLevels: KeyLevel[] = [];

  // Add order blocks as key levels
  [...htfOrderBlocks, ...mtfOrderBlocks].slice(-3).forEach(ob => {
    allKeyLevels.push({
      type: ob.type === "bullish" ? "order_block_bullish" : "order_block_bearish",
      price: (ob.high + ob.low) / 2,
      proximity: Math.abs(currentPrice - (ob.high + ob.low) / 2) / currentPrice * 100,
      orderBlock: ob,
    });
  });

  // Add FVGs as key levels
  [...htfFVGs, ...mtfFVGs].slice(-3).forEach(fvg => {
    allKeyLevels.push({
      type: fvg.type === "bullish" ? "fvg_bullish" : "fvg_bearish",
      price: (fvg.high + fvg.low) / 2,
      proximity: Math.abs(currentPrice - (fvg.high + fvg.low) / 2) / currentPrice * 100,
      fvg,
    });
  });

  // Find nearest key level
  const nearestKeyLevel = allKeyLevels.sort((a, b) => a.proximity - b.proximity)[0];
  const nearKeyLevel = nearestKeyLevel && nearestKeyLevel.proximity <= config.keyLevelProximity;

  // Liquidity Sweep
  const hasLiquiditySweep = (htfChoch?.liquiditySweep || mtfChoch?.liquiditySweep) ?? false;

  // HTF Alignment
  const htfAlignment = htfBias !== "neutral" && (
    mtfChoch?.type === htfBias ||
    mtfBos?.type === htfBias ||
    mtfStructure.trend === htfBias
  );

  // Confluence Score (0-10)
  let confluenceScore = 0;
  if (mtfChoch?.detected) confluenceScore += 2;
  if (mtfBos?.detected) confluenceScore += 1;
  if (htfAlignment) confluenceScore += 2;
  if (volumeAnalysis.hasSpike) confluenceScore += 1;
  if (hasLiquiditySweep) confluenceScore += 1;
  if (nearKeyLevel) confluenceScore += 1;
  if (volumeAnalysis.volumeTrend === "increasing") confluenceScore += 1;
  if (htfPDAZone?.type === "discount" && htfBias === "bullish") confluenceScore += 0.5;
  if (htfPDAZone?.type === "premium" && htfBias === "bearish") confluenceScore += 0.5;

  confluenceScore = Math.min(10, Math.round(confluenceScore));

  // Step 3: Build Rules Table
  const rules = {
    candleBodyClose: {
      status: mtfChoch?.candleCloseBeyond ?? false,
      notes: mtfChoch?.candleCloseBeyond
        ? `Body close beyond ${mtfChoch.swingPoint.toFixed(2)} (${mtfChoch.rejectionStrength} rejection)`
        : "No confirmed candle close beyond swing",
    },
    breakOfStructure: {
      status: mtfBos?.detected ?? false,
      notes: mtfBos?.detected
        ? `${mtfBos.breakStrength.toUpperCase()} break at ${mtfBos.breakLevel.toFixed(2)}`
        : "No break of structure confirmed",
    },
    volumeSpike: {
      status: volumeAnalysis.hasSpike,
      notes: volumeAnalysis.hasSpike
        ? `${volumeAnalysis.spikeRatio.toFixed(2)}x avg (${volumeAnalysis.volumeTrend})`
        : `Volume ${volumeAnalysis.spikeRatio.toFixed(2)}x avg`,
    },
    liquiditySweep: {
      status: hasLiquiditySweep,
      notes: hasLiquiditySweep
        ? `Sweep ${mtfChoch?.sweepDistance?.toFixed(3)}% before reversal`
        : "No liquidity sweep identified",
    },
    htfAlignment: {
      status: htfAlignment,
      notes: htfAlignment
        ? `MTF aligned with ${htfBias.toUpperCase()} HTF bias`
        : `HTF: ${htfBias.toUpperCase()}, MTF not aligned`,
    },
    keyLevelContext: {
      status: nearKeyLevel ?? false,
      notes: nearestKeyLevel
        ? `${nearestKeyLevel.type.replace(/_/g, " ")} (${nearestKeyLevel.proximity.toFixed(2)}% away)`
        : "No key levels in proximity",
    },
  };

  // Step 4: Generate Signal
  const conditionsMet = Object.values(rules).filter(r => r.status).length;

  let signal: "BUY" | "SELL" | "NO TRADE" = "NO TRADE";
  let signalStrength: "strong" | "medium" | "weak" = "weak";
  let entryPrice: number | null = null;
  let stopLoss: number | null = null;
  let target: number | null = null;
  let riskReward: number | null = null;
  let invalidationLevel: number | null = null;

  const atr = calculateATR(mtfCandles, 14);

  // Calculate trade parameters if conditions are met
  if (conditionsMet >= 4 && mtfChoch?.detected && htfAlignment) {
    signal = mtfChoch.type === "bullish" ? "BUY" : "SELL";
    signalStrength = confluenceScore >= 8 ? "strong" : confluenceScore >= 5 ? "medium" : "weak";

    const swingPoint = mtfChoch.swingPoint;

    if (signal === "BUY") {
      entryPrice = currentPrice;
      stopLoss = swingPoint - atr * 1.5;
      invalidationLevel = stopLoss;

      // Use nearest bearish OB or FVG for refined entry
      const nearbyBearishOB = mtfOrderBlocks.filter(ob => ob.type === "bearish" && ob.low > stopLoss).sort((a, b) => a.low - b.low)[0];
      if (nearbyBearishOB && Math.abs(nearbyBearishOB.low - entryPrice) < atr * 2) {
        stopLoss = nearbyBearishOB.low - atr * 0.5;
      }

      // Multiple targets based on Fibonacci
      const range = currentPrice - stopLoss;
      target = entryPrice + range * config.riskRewardRatio;
    } else {
      entryPrice = currentPrice;
      stopLoss = swingPoint + atr * 1.5;
      invalidationLevel = stopLoss;

      const nearbyBullishOB = mtfOrderBlocks.filter(ob => ob.type === "bullish" && ob.high < stopLoss).sort((a, b) => b.high - a.high)[0];
      if (nearbyBullishOB && Math.abs(nearbyBullishOB.high - entryPrice) < atr * 2) {
        stopLoss = nearbyBullishOB.high + atr * 0.5;
      }

      const range = stopLoss - entryPrice;
      target = entryPrice - range * config.riskRewardRatio;
    }

    if (entryPrice && stopLoss) {
      riskReward = Math.abs(target! - entryPrice) / Math.abs(entryPrice - stopLoss);
    }
  }

  // Calculate multiple targets
  const targets = {
    tp1: entryPrice && stopLoss ? entryPrice + (Math.abs(entryPrice - stopLoss) * 1) * (signal === "BUY" ? 1 : -1) : null,
    tp2: entryPrice && stopLoss ? entryPrice + (Math.abs(entryPrice - stopLoss) * 2) * (signal === "BUY" ? 1 : -1) : null,
    tp3: entryPrice && stopLoss ? entryPrice + (Math.abs(entryPrice - stopLoss) * 3) * (signal === "BUY" ? 1 : -1) : null,
  };

  // Position size guidance
  const maxRiskPercent = 1; // 1% risk per trade
  let positionSizeGuidance = "";
  if (signal !== "NO TRADE" && entryPrice && stopLoss) {
    const riskPerShare = Math.abs(entryPrice - stopLoss);
    positionSizeGuidance = `Risk ₹${(riskPerShare).toFixed(2)}/share. For 1% account risk on ₹1L portfolio: ${Math.floor(1000 / riskPerShare)} shares max.`;
  }

  return {
    htfBias,
    htfStructure: getStructureDescription(htfStructure),
    htfChoch,
    htfOrderBlocks,
    htfFVGs,
    htfPDAZone,
    mtfBos,
    mtfChoch,
    mtfOrderBlocks,
    mtfFVGs,
    mtfFibonacci,
    volumeAnalysis,
    liquiditySweep: hasLiquiditySweep,
    htfAlignment,
    keyLevelContext: nearestKeyLevel,
    rules,
    signal,
    signalStrength,
    confluenceScore,
    entryPrice,
    stopLoss,
    target,
    riskReward,
    targets,
    invalidationLevel,
    maxRiskPercent,
    positionSizeGuidance,
  };
}

export function formatAnalysisResult(result: ChochAnalysisResult): string[] {
  return [
    `Trend: ${result.htfBias.toUpperCase()}`,
    `CHOCH: ${result.mtfChoch?.detected ? `${result.mtfChoch.type?.toUpperCase()} @ ${result.mtfChoch.price.toFixed(2)}` : "None"}`,
    `BOS: ${result.mtfBos?.detected ? `${result.mtfBos.type?.toUpperCase()}` : "None"}`,
    `Volume: ${result.volumeAnalysis.spikeRatio.toFixed(2)}x`,
    `Confluence: ${result.confluenceScore}/10`,
    `Signal: ${result.signal} (${result.signalStrength})`,
  ];
}
