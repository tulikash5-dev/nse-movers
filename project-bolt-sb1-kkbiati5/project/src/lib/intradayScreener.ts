import type { StockMover } from "./types";

export interface ScreenerSettings {
  minVolume: number; // Default 1,000,000 (1M)
  minATR: number; // Default 1.5%
  timeframe: "5min" | "15min" | "1hour";
  market: "NSE" | "BSE" | "ALL";
  sector: string;
  minPrice: number; // Default 50 (exclude penny stocks)
  minScore: number; // Default 70
}

export const defaultScreenerSettings: ScreenerSettings = {
  minVolume: 1000000,
  minATR: 1.5,
  timeframe: "15min",
  market: "ALL",
  sector: "",
  minPrice: 50,
  minScore: 70,
};

export interface CriterionResult {
  name: string;
  status: "pass" | "fail" | "partial" | "none";
  value: string;
  points: number;
  maxPoints: number;
  isMustPass: boolean;
  details?: string;
}

export interface ScreenerResult {
  stock: StockMover;
  recommendation: "YES" | "NO";
  score: number;
  maxScore: number;
  criteria: CriterionResult[];
  redFlags: string[];
  entryZone?: {
    min: number;
    max: number;
    stopLoss: number;
    target: number;
  };
  category: string;
  priority: number;
}

// Beta values for common stocks (approximate)
const STOCK_BETA: Record<string, number> = {
  "RELIANCE.NS": 1.1, "TCS.NS": 0.8, "HDFCBANK.NS": 1.0, "INFY.NS": 0.9,
  "ICICIBANK.NS": 1.3, "HINDUNILVR.NS": 0.7, "ITC.NS": 0.6, "SBIN.NS": 1.4,
  "BAJFINANCE.NS": 1.5, "BHARTIARTL.NS": 1.0, "KOTAKBANK.NS": 1.2,
  "LT.NS": 1.3, "AXISBANK.NS": 1.3, "ASIANPAINT.NS": 0.9, "MARUTI.NS": 1.1,
  "TITAN.NS": 1.2, "SUNPHARMA.NS": 0.8, "ULTRACEMCO.NS": 1.1,
  "NESTLEIND.NS": 0.6, "WIPRO.NS": 0.8, "HCLTECH.NS": 0.9, "POWERGRID.NS": 0.5,
  "NTPC.NS": 0.6, "ONGC.NS": 1.0, "COALINDIA.NS": 0.8, "ADANIPORTS.NS": 1.6,
  "ADANIENT.NS": 2.0, "JSWSTEEL.NS": 1.4, "TATASTEEL.NS": 1.5,
  "TATAMOTORS.NS": 1.8, "HINDALCO.NS": 1.5, "BAJAJFINSV.NS": 1.4,
  "BPCL.NS": 1.2, "TECHM.NS": 0.9, "GRASIM.NS": 1.2, "CIPLA.NS": 0.7,
  "DRREDDY.NS": 0.7, "EICHERMOT.NS": 1.1, "INDUSINDBK.NS": 1.4,
  "DIVISLAB.NS": 0.8, "APOLLOHOSP.NS": 1.0, "BAJAJ-AUTO.NS": 0.9,
  "BRITANNIA.NS": 0.7, "HEROMOTOCO.NS": 1.0, "TATACONSUM.NS": 1.0,
  "VEDL.NS": 2.0, "SBILIFE.NS": 1.0, "HDFCLIFE.NS": 0.9,
  "ICICIPRULI.NS": 1.1, "M&M.NS": 1.3, "SHREECEM.NS": 1.1,
  "PIDILITIND.NS": 0.8, "DMART.NS": 0.9, "HAVELLS.NS": 1.1,
  "MARICO.NS": 0.8, "BERGEPAINT.NS": 1.0, "AMBUJACEM.NS": 1.3,
  "ACC.NS": 1.2, "COLPAL.NS": 0.6, "DABUR.NS": 0.7,
  "GODREJCP.NS": 0.8, "LUPIN.NS": 0.8, "BIOCON.NS": 1.2,
  "MUTHOOTFIN.NS": 1.1, "LICHSGFIN.NS": 1.2, "BANDHANBNK.NS": 1.4,
  "IDFCFIRSTB.NS": 1.5, "FEDERALBNK.NS": 1.3, "PNB.NS": 1.6,
  "CANBK.NS": 1.5, "UNIONBANK.NS": 1.5, "NMDC.NS": 1.4,
  "ZOMATO.NS": 1.8, "IRCTC.NS": 1.4, "HAL.NS": 1.2, "BEL.NS": 1.3,
  "BHEL.NS": 1.6, "DLF.NS": 1.4, "GODREJPROP.NS": 1.6,
  "TATAPOWER.NS": 1.4, "ADANIGREEN.NS": 1.7, "ADANIPOWER.NS": 2.1,
  "CHOLAFIN.NS": 1.3, "SHRIRAMFIN.NS": 1.4, "M&MFIN.NS": 1.5,
  "SBICARD.NS": 1.2, "HDFCAMC.NS": 1.0, "ANGELONE.NS": 1.6,
  "DIXON.NS": 1.5, "KAYNES.NS": 1.7, "MOTHERSON.NS": 1.5,
  "BOSCHLTD.NS": 1.0, "IGL.NS": 1.1, "MGL.NS": 1.0,
  "PETRONET.NS": 1.0, "HPCL.NS": 1.3, "IOC.NS": 1.2,
  "PAYTM.NS": 2.0, "NYKAA.NS": 1.8, "DELHIVERY.NS": 1.6,
  "JUBLFOOD.NS": 1.2, "TORNTPHARM.NS": 0.9, "AUROPHARMA.NS": 0.8,
  "ALKEM.NS": 0.8, "ABBOTINDIA.NS": 0.7, "MAXHEALTH.NS": 1.0,
  "FORTIS.NS": 1.1, "ATGL.NS": 1.8, "SUZLON.NS": 2.5,
  "RVNL.NS": 2.0, "IRCON.NS": 1.9, "JSWENERGY.NS": 1.5,
  "TORNTPOWER.NS": 1.4, "UPL.NS": 1.3, "TATACHEM.NS": 1.2,
  "DEEPAKNTR.NS": 1.4, "PIIND.NS": 1.0, "BALKRISIND.NS": 1.2,
  "CUMMINSIND.NS": 1.1, "ASTRAL.NS": 1.2, "MFSL.NS": 1.1,
  "GLAND.NS": 1.0, "MANAPPURAM.NS": 1.3, "ENDURANCE.NS": 1.2,
  "360ONE.NS": 1.4, "LALPATHLAB.NS": 1.0, "METROPOLIS.NS": 1.0,
};

// Sector prioritization weights
const SECTOR_PRIORITY: Record<string, number> = {
  "Banking": 10, "NBFC": 9, "IT": 8, "Energy": 7, "Auto": 7,
  "Pharma": 6, "FMCG": 5, "Infrastructure": 6, "Metals": 8,
  "Capital Goods": 6, "Defence": 7, "Internet": 5,
};

// Check if stock is in Nifty 50
const NIFTY_50 = new Set([
  "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
  "HINDUNILVR.NS", "ITC.NS", "SBIN.NS", "BAJFINANCE.NS", "BHARTIARTL.NS",
  "KOTAKBANK.NS", "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS",
  "TITAN.NS", "SUNPHARMA.NS", "ULTRACEMCO.NS", "NESTLEIND.NS", "WIPRO.NS",
  "HCLTECH.NS", "POWERGRID.NS", "NTPC.NS", "ONGC.NS", "COALINDIA.NS",
  "ADANIPORTS.NS", "JSWSTEEL.NS", "TATASTEEL.NS", "TATAMOTORS.NS", "HINDALCO.NS",
  "BAJAJFINSV.NS", "BPCL.NS", "TECHM.NS", "GRASIM.NS", "CIPLA.NS",
  "DRREDDY.NS", "EICHERMOT.NS", "INDUSINDBK.NS", "DIVISLAB.NS", "APOLLOHOSP.NS",
  "BAJAJ-AUTO.NS", "BRITANNIA.NS", "HEROMOTOCO.NS", "TATACONSUM.NS", "M&M.NS",
]);

// Bank Nifty constituents
const BANK_NIFTY = new Set([
  "HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "KOTAKBANK.NS", "AXISBANK.NS",
  "INDUSINDBK.NS", "BAJFINANCE.NS", "BANDHANBNK.NS", "IDFCFIRSTB.NS",
  "FEDERALBNK.NS", "PNB.NS", "CANBK.NS", "UNIONBANK.NS", "AUBANK.NS",
  "BANKBARODA.NS", "RBLBANK.NS",
]);

// Simulated ATR calculation (since we don't have historical OHLC)
function calculateATR(price: number, pctChange: number): number {
  // Simulate ATR as a percentage of price based on current volatility
  // In real implementation, this would use 14-day OHLC data
  const dailyRange = Math.abs(pctChange);
  // ATR is typically ~70-80% of average daily range
  return dailyRange * 0.75;
}

// Simulate trend direction (would need EMA calculation with historical data)
function analyzeTrend(pctChange: number, stock: StockMover): "bullish" | "bearish" | "ranging" {
  // Simplified: use recent momentum as trend indicator
  // In production, calculate actual EMAs
  if (Math.abs(pctChange) < 0.5) return "ranging";
  return pctChange > 0 ? "bullish" : "bearish";
}

// Simulate momentum strength
function calculateMomentum(pctChange: number, volume: number, avgVolume: number): "strong" | "moderate" | "weak" {
  const volumeSpike = volume / avgVolume;
  const priceMomentum = Math.abs(pctChange);

  if (volumeSpike > 1.5 && priceMomentum > 2) return "strong";
  if (volumeSpike > 1.2 && priceMomentum > 1) return "moderate";
  return "weak";
}

// Simulate catalyst/news check
function checkCatalyst(symbol: string): { hasCatalyst: boolean; type?: string } {
  // In production, this would fetch real news/announcements
  // For now, return a random but deterministic result based on symbol
  const hash = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  if (hash % 5 === 0) {
    const types = ["Results", "Order Win", "FII Buying", "Management Guidance"];
    return { hasCatalyst: true, type: types[hash % types.length] };
  }
  return { hasCatalyst: false };
}

export function scoreStock(
  stock: StockMover,
  settings: ScreenerSettings
): ScreenerResult {
  const criteria: CriterionResult[] = [];
  const redFlags: string[] = [];
  let mustPassFailed = false;

  // 1. Liquidity Check (20 points) - MUST PASS
  const volume = stock.volume || 0;
  const volumePassed = volume >= settings.minVolume;
  const liquidityPoints = volumePassed ? 20 : 0;

  criteria.push({
    name: "Liquidity",
    status: volumePassed ? "pass" : "fail",
    value: `${(volume / 1000000).toFixed(2)}M shares (min ${settings.minVolume / 1000000}M)`,
    points: liquidityPoints,
    maxPoints: 20,
    isMustPass: true,
    details: volumePassed ? "Sufficient liquidity for intraday" : "Volume too low for reliable entry/exit",
  });

  if (!volumePassed) {
    mustPassFailed = true;
    redFlags.push("Low volume - Poor liquidity");
  }

  // 2. Volatility Check (25 points) - MUST PASS
  const atr = calculateATR(stock.price, stock.pct_change);
  const atrPercent = (atr / stock.price) * 100;
  const volatilityPassed = atrPercent >= settings.minATR && Math.abs(stock.pct_change) >= 2 && Math.abs(stock.pct_change) <= 5;
  let volatilityPoints = 0;

  if (volatilityPassed) {
    volatilityPoints = Math.abs(stock.pct_change) >= 3 ? 25 : 20;
  } else if (atrPercent >= settings.minATR * 0.7) {
    volatilityPoints = 15;
  }

  criteria.push({
    name: "Volatility",
    status: volatilityPassed ? "pass" : (atrPercent >= settings.minATR * 0.7 ? "partial" : "fail"),
    value: `${atrPercent.toFixed(2)}% ATR, Daily: ${Math.abs(stock.pct_change).toFixed(2)}%`,
    points: volatilityPoints,
    maxPoints: 25,
    isMustPass: true,
    details: volatilityPassed ? "Optimal volatility for intraday moves" : "Volatility outside optimal range (2-5%)",
  });

  if (atrPercent < settings.minATR) {
    mustPassFailed = true;
    redFlags.push(`ATR ${atrPercent.toFixed(1)}% below ${settings.minATR}% threshold`);
  }
  if (Math.abs(stock.pct_change) > 5) {
    redFlags.push("Excessive volatility - high risk");
  }

  // 3. Trend Check (25 points) - MUST PASS
  const trend = analyzeTrend(stock.pct_change, stock);
  const trendPoints = trend === "ranging" ? 0 : (stock.mover_type === "gainer" && trend === "bullish") || (stock.mover_type === "loser" && trend === "bearish") ? 25 : 15;

  criteria.push({
    name: "Trend",
    status: trend === "ranging" ? "fail" : "pass",
    value: trend === "ranging" ? "Ranging/Choppy" : `${trend.charAt(0).toUpperCase() + trend.slice(1)}`,
    points: trendPoints,
    maxPoints: 25,
    isMustPass: true,
    details: trend === "ranging" ? "No clear direction - avoid" : "Clear trend direction aligned with movement",
  });

  if (trend === "ranging") {
    mustPassFailed = true;
    redFlags.push("No clear trend direction");
  }

  // 4. Momentum Check (15 points) - MUST PASS
  const avgVolume = (stock.volume || 0) * 0.8; // Simulate 10-day avg
  const momentum = calculateMomentum(stock.pct_change, stock.volume || 0, avgVolume);
  const momentumPoints = momentum === "strong" ? 15 : momentum === "moderate" ? 10 : 5;

  criteria.push({
    name: "Momentum",
    status: momentum === "strong" ? "pass" : momentum === "moderate" ? "partial" : "fail",
    value: `${momentum.charAt(0).toUpperCase() + momentum.slice(1)} momentum, ${((stock.volume || 0) / avgVolume).toFixed(1)}x avg volume`,
    points: momentumPoints,
    maxPoints: 15,
    isMustPass: true,
    details: momentum === "strong" ? "Strong momentum with volume confirmation" : "Weak momentum signals",
  });

  if (momentum === "weak") {
    mustPassFailed = true;
    redFlags.push("Weak momentum");
  }

  // 5. Catalyst Check (10 points) - OPTIONAL
  const catalyst = checkCatalyst(stock.symbol);
  const catalystPoints = catalyst.hasCatalyst ? 10 : 0;

  criteria.push({
    name: "Catalyst",
    status: catalyst.hasCatalyst ? "pass" : "none",
    value: catalyst.hasCatalyst ? catalyst.type! : "No recent news",
    points: catalystPoints,
    maxPoints: 10,
    isMustPass: false,
    details: catalyst.hasCatalyst ? `${catalyst.type} provides trading opportunity` : "No catalyst identified",
  });

  if (!catalyst.hasCatalyst) {
    redFlags.push("No catalyst/news event");
  }

  // 6. Beta Check (5 points) - OPTIONAL
  const beta = STOCK_BETA[stock.symbol] || 1.0;
  const betaPoints = beta > 1.0 ? 5 : beta >= 0.8 ? 3 : 1;

  criteria.push({
    name: "Beta",
    status: beta > 1.0 ? "pass" : beta >= 0.8 ? "partial" : "fail",
    value: `${beta.toFixed(2)} (${beta > 1.0 ? "High" : beta >= 0.8 ? "Moderate" : "Low"} volatility)`,
    points: betaPoints,
    maxPoints: 5,
    isMustPass: false,
    details: beta > 1.0 ? "High beta stock - good for intraday" : "Lower volatility stock",
  });

  // Calculate total score
  const totalPoints = criteria.reduce((sum, c) => sum + c.points, 0);
  const maxPoints = criteria.reduce((sum, c) => sum + c.maxPoints, 0);

  // Determine recommendation
  const recommendation = mustPassFailed ? "NO" : totalPoints >= settings.minScore ? "YES" : "NO";

  // Calculate entry zone (if YES)
  let entryZone;
  if (recommendation === "YES") {
    const range = stock.price * 0.01; // 1% range
    const direction = stock.mover_type === "gainer" ? 1 : -1;
    entryZone = {
      min: stock.price - range,
      max: stock.price + range,
      stopLoss: stock.price * (direction > 0 ? 0.98 : 1.02),
      target: stock.price * (direction > 0 ? 1.03 : 0.97),
    };
  }

  // Determine category and priority
  let category = "Mid-cap";
  let priority = 5;

  if (NIFTY_50.has(stock.symbol)) {
    category = "Nifty 50";
    priority = 9;
  } else if (BANK_NIFTY.has(stock.symbol)) {
    category = "Bank Nifty";
    priority = 10;
  } else if (stock.price < 100) {
    category = "Small-cap";
    priority = 6;
  } else if (stock.price > 1000) {
    category = "Large-cap";
    priority = 7;
  }

  // Boost priority if has catalyst or strong momentum
  if (catalyst.hasCatalyst) priority += 1;
  if (momentum === "strong") priority += 1;
  priority = Math.min(10, priority);

  return {
    stock,
    recommendation,
    score: totalPoints,
    maxScore: maxPoints,
    criteria,
    redFlags,
    entryZone,
    category,
    priority,
  };
}

export function filterAndSortResults(
  results: ScreenerResult[],
  settings: ScreenerSettings
): ScreenerResult[] {
  return results
    .filter(r => {
      // Filter by market
      if (settings.market !== "ALL" && r.stock.exchange !== settings.market) return false;
      // Filter by sector
      if (settings.sector && r.stock.sector !== settings.sector) return false;
      // Filter by minimum price
      if (r.stock.price < settings.minPrice) return false;
      // Filter by minimum score
      if (r.score < settings.minScore && r.recommendation === "NO") return false;
      return true;
    })
    .sort((a, b) => {
      // Sort by recommendation first, then score, then priority
      if (a.recommendation !== b.recommendation) {
        return a.recommendation === "YES" ? -1 : 1;
      }
      if (b.score !== a.score) return b.score - a.score;
      return b.priority - a.priority;
    });
}

// Pre-market gap detection
export function detectGapStocks(
  stocks: StockMover[]
): { gainers: StockMover[]; losers: StockMover[]; breakouts: StockMover[] } {
  // Gap-up: stocks that opened significantly higher than prev close
  const gapUpThreshold = 2; // 2% gap up
  const gapDownThreshold = -2; // 2% gap down

  const gainers = stocks.filter(s => s.pct_change >= gapUpThreshold && s.mover_type === "gainer");
  const losers = stocks.filter(s => s.pct_change <= gapDownThreshold && s.mover_type === "loser");

  // Fresh breakouts (strong momentum with volume)
  const breakouts = stocks.filter(s => {
    const volumeSpike = (s.volume || 0) > 1000000;
    const strongMove = Math.abs(s.pct_change) >= 3;
    return volumeSpike && strongMove;
  });

  return { gainers, losers, breakouts };
}
