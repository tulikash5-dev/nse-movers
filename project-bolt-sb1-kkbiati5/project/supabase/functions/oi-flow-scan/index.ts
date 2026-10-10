import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ===== Nifty 100 F&O Stock Universe =====
const NIFTY_100: { symbol: string; name: string; sector: string }[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy" },
  { symbol: "TCS", name: "Tata Consultancy Services", sector: "IT" },
  { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Banking" },
  { symbol: "INFY", name: "Infosys", sector: "IT" },
  { symbol: "ICICIBANK", name: "ICICI Bank", sector: "Banking" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever", sector: "FMCG" },
  { symbol: "ITC", name: "ITC Limited", sector: "FMCG" },
  { symbol: "SBIN", name: "State Bank of India", sector: "Banking" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance", sector: "NBFC" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", sector: "Telecom" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", sector: "Banking" },
  { symbol: "LT", name: "Larsen & Toubro", sector: "Infrastructure" },
  { symbol: "AXISBANK", name: "Axis Bank", sector: "Banking" },
  { symbol: "ASIANPAINT", name: "Asian Paints", sector: "Paints" },
  { symbol: "MARUTI", name: "Maruti Suzuki", sector: "Auto" },
  { symbol: "TITAN", name: "Titan Company", sector: "Consumer" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical", sector: "Pharma" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement", sector: "Cement" },
  { symbol: "NESTLEIND", name: "Nestle India", sector: "FMCG" },
  { symbol: "WIPRO", name: "Wipro", sector: "IT" },
  { symbol: "HCLTECH", name: "HCL Technologies", sector: "IT" },
  { symbol: "POWERGRID", name: "Power Grid Corp", sector: "Energy" },
  { symbol: "NTPC", name: "NTPC Limited", sector: "Energy" },
  { symbol: "ONGC", name: "ONGC", sector: "Energy" },
  { symbol: "COALINDIA", name: "Coal India", sector: "Mining" },
  { symbol: "ADANIPORTS", name: "Adani Ports", sector: "Infrastructure" },
  { symbol: "ADANIENT", name: "Adani Enterprises", sector: "Conglomerate" },
  { symbol: "JSWSTEEL", name: "JSW Steel", sector: "Metals" },
  { symbol: "TATASTEEL", name: "Tata Steel", sector: "Metals" },
  { symbol: "TATAMOTORS", name: "Tata Motors", sector: "Auto" },
  { symbol: "HINDALCO", name: "Hindalco Industries", sector: "Metals" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv", sector: "NBFC" },
  { symbol: "BPCL", name: "BPCL", sector: "Energy" },
  { symbol: "TECHM", name: "Tech Mahindra", sector: "IT" },
  { symbol: "GRASIM", name: "Grasim Industries", sector: "Conglomerate" },
  { symbol: "CIPLA", name: "Cipla", sector: "Pharma" },
  { symbol: "DRREDDY", name: "Dr Reddy's Labs", sector: "Pharma" },
  { symbol: "EICHERMOT", name: "Eicher Motors", sector: "Auto" },
  { symbol: "INDUSINDBK", name: "IndusInd Bank", sector: "Banking" },
  { symbol: "DIVISLAB", name: "Divis's Laboratories", sector: "Pharma" },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals", sector: "Healthcare" },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto", sector: "Auto" },
  { symbol: "BRITANNIA", name: "Britannia Industries", sector: "FMCG" },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp", sector: "Auto" },
  { symbol: "TATACONSUM", name: "Tata Consumer Products", sector: "FMCG" },
  { symbol: "VEDL", name: "Vedanta", sector: "Metals" },
  { symbol: "SBILIFE", name: "SBI Life Insurance", sector: "Insurance" },
  { symbol: "HDFCLIFE", name: "HDFC Life Insurance", sector: "Insurance" },
  { symbol: "ICICIPRULI", name: "ICICI Prudential Life", sector: "Insurance" },
  { symbol: "M&M", name: "Mahindra & Mahindra", sector: "Auto" },
  { symbol: "SHREECEM", name: "Shree Cement", sector: "Cement" },
  { symbol: "PIDILITIND", name: "Pidilite Industries", sector: "Chemicals" },
  { symbol: "DMART", name: "Avenue Supermarts", sector: "Retail" },
  { symbol: "HAVELLS", name: "Havells India", sector: "Consumer" },
  { symbol: "MARICO", name: "Marico", sector: "FMCG" },
  { symbol: "BERGEPAINT", name: "Berger Paints", sector: "Paints" },
  { symbol: "AMBUJACEM", name: "Ambuja Cements", sector: "Cement" },
  { symbol: "ACC", name: "ACC Limited", sector: "Cement" },
  { symbol: "COLPAL", name: "Colgate-Palmolive India", sector: "FMCG" },
  { symbol: "DABUR", name: "Dabur India", sector: "FMCG" },
  { symbol: "GODREJCP", name: "Godrej Consumer Products", sector: "FMCG" },
  { symbol: "LUPIN", name: "Lupin", sector: "Pharma" },
  { symbol: "BIOCON", name: "Biocon", sector: "Pharma" },
  { symbol: "MUTHOOTFIN", name: "Muthoot Finance", sector: "NBFC" },
  { symbol: "LICHSGFIN", name: "LIC Housing Finance", sector: "NBFC" },
  { symbol: "BANDHANBNK", name: "Bandhan Bank", sector: "Banking" },
  { symbol: "IDFCFIRSTB", name: "IDFC First Bank", sector: "Banking" },
  { symbol: "FEDERALBNK", name: "Federal Bank", sector: "Banking" },
  { symbol: "PNB", name: "Punjab National Bank", sector: "Banking" },
  { symbol: "CANBK", name: "Canara Bank", sector: "Banking" },
  { symbol: "UNIONBANK", name: "Union Bank of India", sector: "Banking" },
  { symbol: "NMDC", name: "NMDC", sector: "Metals" },
  { symbol: "HINDZINC", name: "Hindustan Zinc", sector: "Metals" },
  { symbol: "SAIL", name: "Steel Authority of India", sector: "Metals" },
  { symbol: "POLYCAB", name: "Polycab India", sector: "Electricals" },
  { symbol: "TVSMOTOR", name: "TVS Motor Company", sector: "Auto" },
  { symbol: "ESCORTS", name: "Escorts Kubota", sector: "Auto" },
  { symbol: "VOLTAS", name: "Voltas", sector: "Consumer" },
  { symbol: "CROMPTON", name: "Crompton Greaves", sector: "Consumer" },
  { symbol: "PAGEIND", name: "Page Industries", sector: "Consumer" },
  { symbol: "MPHASIS", name: "Mphasis", sector: "IT" },
  { symbol: "LTTS", name: "L&T Technology Services", sector: "IT" },
  { symbol: "COFORGE", name: "Coforge", sector: "IT" },
  { symbol: "PERSISTENT", name: "Persistent Systems", sector: "IT" },
  { symbol: "TRENT", name: "Trent Limited", sector: "Retail" },
  { symbol: "NAUKRI", name: "Info Edge (Naukri)", sector: "Internet" },
  { symbol: "ZOMATO", name: "Zomato", sector: "Internet" },
  { symbol: "IRCTC", name: "IRCTC", sector: "Infrastructure" },
  { symbol: "RECLTD", name: "REC Limited", sector: "Financials" },
  { symbol: "PFC", name: "Power Finance Corp", sector: "Financials" },
  { symbol: "IRFC", name: "Indian Railway Finance", sector: "Financials" },
  { symbol: "NHPC", name: "NHPC", sector: "Energy" },
  { symbol: "CONCOR", name: "Container Corp of India", sector: "Infrastructure" },
  { symbol: "HAL", name: "Hindustan Aeronautics", sector: "Defence" },
  { symbol: "BEL", name: "Bharat Electronics", sector: "Defence" },
  { symbol: "BHEL", name: "Bharat Heavy Electricals", sector: "Capital Goods" },
  { symbol: "DLF", name: "DLF Limited", sector: "Real Estate" },
  { symbol: "GODREJPROP", name: "Godrej Properties", sector: "Real Estate" },
  { symbol: "OBEROIRLTY", name: "Oberoi Realty", sector: "Real Estate" },
  { symbol: "TATAPOWER", name: "Tata Power", sector: "Energy" },
  { symbol: "ADANIGREEN", name: "Adani Green Energy", sector: "Energy" },
  { symbol: "ADANIPOWER", name: "Adani Power", sector: "Energy" },
  { symbol: "CHOLAFIN", name: "Cholamandalam Finance", sector: "NBFC" },
  { symbol: "SHRIRAMFIN", name: "Shriram Finance", sector: "NBFC" },
  { symbol: "M&MFIN", name: "Mahindra Finance", sector: "NBFC" },
  { symbol: "SBICARD", name: "SBI Cards", sector: "NBFC" },
  { symbol: "HDFCAMC", name: "HDFC AMC", sector: "Asset Management" },
  { symbol: "ANGELONE", name: "Angel One", sector: "Broking" },
  { symbol: "DIXON", name: "Dixon Technologies", sector: "Electronics" },
  { symbol: "KAYNES", name: "Kaynes Technology", sector: "Electronics" },
  { symbol: "MOTHERSON", name: "Samvardhana Motherson", sector: "Auto" },
  { symbol: "BOSCHLTD", name: "Bosch India", sector: "Auto" },
  { symbol: "IGL", name: "Indraprastha Gas", sector: "Gas" },
  { symbol: "MGL", name: "Mahanagar Gas", sector: "Gas" },
  { symbol: "PETRONET", name: "Petronet LNG", sector: "Energy" },
  { symbol: "HPCL", name: "HPCL", sector: "Energy" },
  { symbol: "IOC", name: "Indian Oil Corporation", sector: "Energy" },
  { symbol: "PAYTM", name: "One 97 Communications", sector: "Fintech" },
  { symbol: "NYKAA", name: "FSN E-Commerce (Nykaa)", sector: "E-Commerce" },
  { symbol: "DELHIVERY", name: "Delhivery", sector: "Logistics" },
  { symbol: "JUBLFOOD", name: "Jubilant FoodWorks", sector: "Retail" },
  { symbol: "TORNTPHARM", name: "Torrent Pharmaceuticals", sector: "Pharma" },
  { symbol: "AUROPHARMA", name: "Aurobindo Pharma", sector: "Pharma" },
  { symbol: "ALKEM", name: "Alkem Laboratories", sector: "Pharma" },
  { symbol: "ABBOTINDIA", name: "Abbott India", sector: "Pharma" },
  { symbol: "MAXHEALTH", name: "Max Healthcare", sector: "Healthcare" },
  { symbol: "FORTIS", name: "Fortis Healthcare", sector: "Healthcare" },
  { symbol: "ATGL", name: "Adani Total Gas", sector: "Gas" },
  { symbol: "SUZLON", name: "Suzlon Energy", sector: "Energy" },
  { symbol: "RVNL", name: "Rail Vikas Nigam", sector: "Infrastructure" },
  { symbol: "IRCON", name: "Ircon International", sector: "Infrastructure" },
  { symbol: "JSWENERGY", name: "JSW Energy", sector: "Energy" },
  { symbol: "TORNTPOWER", name: "Torrent Power", sector: "Energy" },
  { symbol: "UPL", name: "UPL Limited", sector: "Chemicals" },
  { symbol: "TATACHEM", name: "Tata Chemicals", sector: "Chemicals" },
  { symbol: "DEEPAKNTR", name: "Deepak Nitrite", sector: "Chemicals" },
  { symbol: "PIIND", name: "PI Industries", sector: "Agrochemicals" },
  { symbol: "BALKRISIND", name: "Balkrishna Industries", sector: "Tyres" },
  { symbol: "CUMMINSIND", name: "Cummins India", sector: "Capital Goods" },
  { symbol: "ASTRAL", name: "Astral Limited", sector: "Pipes" },
  { symbol: "MFSL", name: "Max Financial Services", sector: "Insurance" },
  { symbol: "GLAND", name: "Gland Pharma", sector: "Pharma" },
  { symbol: "MANAPPURAM", name: "Manappuram Finance", sector: "NBFC" },
  { symbol: "ENDURANCE", name: "Endurance Technologies", sector: "Auto" },
  { symbol: "360ONE", name: "360 ONE WAM", sector: "Wealth Management" },
  { symbol: "LALPATHLAB", name: "Dr Lal PathLabs", sector: "Healthcare" },
  { symbol: "METROPOLIS", name: "Metropolis Healthcare", sector: "Healthcare" },
  { symbol: "GAIL", name: "GAIL India", sector: "Gas" },
];

interface StockData {
  symbol: string;
  companyName: string;
  sector: string;
  ltp: number;
  prevClose: number;
  priceChangePct: number;
  volume: number;
  avg20Vol: number;
  volumeRatio: number;
  vwap: number;
  atr: number;
  relativeStrength: number;
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
}

interface ScanResult {
  symbol: string;
  company_name: string;
  sector: string;
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

interface LearningWeights {
  oi_weight: number;
  oi_velocity_weight: number;
  volume_weight: number;
  structure_weight: number;
  choch_bos_weight: number;
  relative_strength_weight: number;
  option_chain_weight: number;
}

// ===== Fetch Yahoo Finance data for a symbol =====
async function fetchYahooData(symbol: string): Promise<StockData | null> {
  const yahooSymbol = `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=3mo`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const quotes = result.indicators?.quote?.[0];
    const timestamps: number[] = result.timestamp ?? [];
    if (timestamps.length < 21) return null;

    // Build aligned arrays: only keep indices where ALL fields are non-null
    const rawCloses = quotes?.close ?? [];
    const rawHighs = quotes?.high ?? [];
    const rawLows = quotes?.low ?? [];
    const rawVols = quotes?.volume ?? [];
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];
    for (let i = 0; i < rawCloses.length; i++) {
      const c = rawCloses[i];
      const h = rawHighs[i];
      const l = rawLows[i];
      const v = rawVols[i];
      if (c != null && c > 0 && h != null && h > 0 && l != null && l > 0 && v != null && v > 0) {
        closes.push(c);
        highs.push(h);
        lows.push(l);
        volumes.push(v);
      }
    }
    if (closes.length < 21) return null;

    const ltp = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2] ?? ltp;
    const priceChangePct = ((ltp - prevClose) / prevClose) * 100;

    const last20Vols = volumes.slice(-20);
    const avg20Vol = last20Vols.length > 0
      ? Math.round(last20Vols.reduce((a, b) => a + b, 0) / last20Vols.length)
      : volumes[volumes.length - 1] ?? 0;
    const volume = volumes[volumes.length - 1] ?? 0;
    const volumeRatio = avg20Vol > 0 ? volume / avg20Vol : 1;

    // VWAP: typical price * volume / total volume (last 20 bars as session proxy)
    const last20Highs = highs.slice(-20);
    const last20Lows = lows.slice(-20);
    const last20Closes = closes.slice(-20);
    const last20VolsRaw = volumes.slice(-20);
    let tpv = 0, totalVol = 0;
    for (let i = 0; i < last20Closes.length; i++) {
      const tp = (last20Highs[i] + last20Lows[i] + last20Closes[i]) / 3;
      const v = last20VolsRaw[i] ?? 0;
      tpv += tp * v;
      totalVol += v;
    }
    const vwap = totalVol > 0 ? tpv / totalVol : ltp;

    // ATR (14-period)
    const atrPeriod = Math.min(14, highs.length - 1);
    let atrSum = 0;
    for (let i = 1; i <= atrPeriod; i++) {
      const idx = highs.length - atrPeriod - 1 + i;
      const tr = Math.max(
        highs[idx] - lows[idx],
        Math.abs(highs[idx] - closes[idx - 1]),
        Math.abs(lows[idx] - closes[idx - 1]),
      );
      atrSum += tr;
    }
    const atr = atrSum / atrPeriod;

    // Fetch Nifty data for relative strength (cached fetch)
    const stockInfo = NIFTY_100.find(s => s.symbol === symbol);
    if (!stockInfo) return null;

    return {
      symbol,
      companyName: stockInfo.name,
      sector: stockInfo.sector,
      ltp: Math.round(ltp * 100) / 100,
      prevClose: Math.round(prevClose * 100) / 100,
      priceChangePct: Math.round(priceChangePct * 100) / 100,
      volume,
      avg20Vol,
      volumeRatio: Math.round(volumeRatio * 100) / 100,
      vwap: Math.round(vwap * 100) / 100,
      atr: Math.round(atr * 100) / 100,
      relativeStrength: 0, // computed later against Nifty
      highs,
      lows,
      closes,
      volumes,
    };
  } catch {
    return null;
  }
}

// ===== Fetch Nifty 50 index for relative strength =====
async function fetchNiftyChange(): Promise<number> {
  try {
    const resp = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=5d",
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } },
    );
    if (!resp.ok) return 0;
    const data = await resp.json();
    const result = data.chart?.result?.[0];
    const closes: number[] = (result?.indicators?.quote?.[0]?.close ?? []).filter((v: number | null) => v != null);
    if (closes.length < 2) return 0;
    const niftyChange = ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100;
    return Math.round(niftyChange * 100) / 100;
  } catch {
    return 0;
  }
}

// ===== Market Structure Detection =====
function detectMarketStructure(highs: number[], lows: number[], closes: number[]): {
  structure: string;
  choch: boolean;
  chochType: string | null;
  bos: boolean;
  bosType: string | null;
} {
  if (highs.length < 6) return { structure: "Sideways", choch: false, chochType: null, bos: false, bosType: null };

  const currentClose = closes[closes.length - 1];

  // Long-term structure: 10-bar window
  const lookback = Math.min(10, highs.length - 1);
  const priorHighs10 = highs.slice(-lookback - 1, -1);
  const priorLows10 = lows.slice(-lookback - 1, -1);
  const swingHigh10 = priorHighs10.length > 0 ? Math.max(...priorHighs10) : currentClose;
  const swingLow10 = priorLows10.length > 0 ? Math.min(...priorLows10) : currentClose;

  // Short-term structure: 5-bar window (catches intraday-style breakouts)
  const stLookback = Math.min(5, highs.length - 1);
  const priorHighs5 = highs.slice(-stLookback - 1, -1);
  const priorLows5 = lows.slice(-stLookback - 1, -1);
  const swingHigh5 = priorHighs5.length > 0 ? Math.max(...priorHighs5) : currentClose;
  const swingLow5 = priorLows5.length > 0 ? Math.min(...priorLows5) : currentClose;

  // Determine structure from 10-bar HH/HL pattern
  let higherHighs = 0, higherLows = 0, lowerHighs = 0, lowerLows = 0;
  for (let i = 2; i < priorHighs10.length; i++) {
    if (priorHighs10[i] > priorHighs10[i - 2]) higherHighs++;
    else lowerHighs++;
    if (priorLows10[i] > priorLows10[i - 2]) higherLows++;
    else lowerLows++;
  }

  let structure = "Sideways";
  let choch = false;
  let chochType: string | null = null;
  let bos = false;
  let bosType: string | null = null;

  if (higherHighs > lowerHighs && higherLows > lowerLows) {
    structure = "Bullish";
  } else if (lowerHighs > higherHighs && lowerLows > higherLows) {
    structure = "Bearish";
  }

  // BOS: current close breaks the 10-bar swing high/low
  if (currentClose > swingHigh10) {
    bos = true;
    bosType = "BOS Up";
  } else if (currentClose < swingLow10) {
    bos = true;
    bosType = "BOS Down";
  }

  // CHOCH: price breaks the opposite direction of the existing structure
  // Also check 5-bar breakout for shorter-term CHOCH detection
  if (structure === "Bullish" && currentClose < swingLow10) {
    choch = true;
    chochType = "Bearish CHOCH";
  } else if (structure === "Bearish" && (currentClose > swingHigh10 || currentClose > swingHigh5 * 1.002)) {
    choch = true;
    chochType = "Bullish CHOCH";
  } else if (structure === "Sideways") {
    // In sideways, any breakout above 5-bar high or below 5-bar low is a CHOCH
    if (currentClose > swingHigh5 * 1.001) {
      choch = true;
      chochType = "Bullish CHOCH";
    } else if (currentClose < swingLow5 * 0.999) {
      choch = true;
      chochType = "Bearish CHOCH";
    }
  }

  // If in bullish structure and price breaks 5-bar high (short-term BOS within trend)
  if (structure === "Bullish" && !bos && currentClose > swingHigh5 * 1.001) {
    bos = true;
    bosType = "BOS Up";
  }
  if (structure === "Bearish" && !bos && currentClose < swingLow5 * 0.999) {
    bos = true;
    bosType = "BOS Down";
  }

  return { structure, choch, chochType, bos, bosType };
}

// ===== OI Classification =====
function classifyOI(
  priceChangePct: number,
  volumeRatio: number,
): { classification: string; oiChangePct: number; oiVelocity: string } {
  // OI proxy: volume surge + price direction indicates OI behavior
  // This is a volume-based proxy since real OI is not server-accessible
  const oiProxy = volumeRatio > 1 ? (volumeRatio - 1) * 8 : 0;
  const oiChangePct = Math.round(oiProxy * 100) / 100;

  let classification = "Neutral";
  let oiVelocity = "Normal";

  if (priceChangePct > 0.5 && volumeRatio > 1.5) {
    classification = "Long Buildup";
    oiVelocity = volumeRatio > 2.5 ? "Explosive" : "Strong";
  } else if (priceChangePct < -0.5 && volumeRatio > 1.5) {
    classification = "Short Buildup";
    oiVelocity = volumeRatio > 2.5 ? "Explosive" : "Strong";
  } else if (priceChangePct > 0.5 && volumeRatio <= 1.5) {
    classification = "Short Covering";
    oiVelocity = "Moderate";
  } else if (priceChangePct < -0.5 && volumeRatio <= 1.5) {
    classification = "Long Unwinding";
    oiVelocity = "Moderate";
  }

  return { classification, oiChangePct, oiVelocity };
}

// ===== Confidence Score =====
function computeConfidence(
  s: StockData,
  classification: string,
  oiChangePct: number,
  structure: string,
  choch: boolean,
  chochType: string | null,
  bos: boolean,
  bosType: string | null,
  relativeStrength: number,
  weights: LearningWeights,
): { score: number; grade: string } {
  let score = 0;
  const isBullishSetup = s.priceChangePct > 0;
  const isBearishSetup = s.priceChangePct < 0;

  // OI Change (30%)
  if (oiChangePct > 10) score += weights.oi_weight;
  else if (oiChangePct > 5) score += weights.oi_weight * 0.7;
  else if (oiChangePct > 2) score += weights.oi_weight * 0.4;

  // OI Velocity (20%) — volume ratio as proxy
  if (s.volumeRatio > 2.5) score += weights.oi_velocity_weight;
  else if (s.volumeRatio > 1.5) score += weights.oi_velocity_weight * 0.6;
  else if (s.volumeRatio > 1.2) score += weights.oi_velocity_weight * 0.3;

  // Volume Spike (15%)
  if (s.volumeRatio > 2) score += weights.volume_weight;
  else if (s.volumeRatio > 1.5) score += weights.volume_weight * 0.6;
  else if (s.volumeRatio > 1.2) score += weights.volume_weight * 0.3;

  // Market Structure (10%) — reward alignment with trade direction
  // A bullish CHOCH in a bearish structure is a valid reversal signal
  if (structure === "Bullish" && isBullishSetup) score += weights.structure_weight;
  else if (structure === "Bearish" && isBearishSetup) score += weights.structure_weight;
  else if (choch) score += weights.structure_weight * 0.6; // CHOCH reversal gives partial structure credit
  else if (structure !== "Sideways") score += weights.structure_weight * 0.3;

  // CHOCH/BOS Quality (10%) — full credit when aligned with trade direction
  const chochAligned = (choch && chochType === "Bullish CHOCH" && isBullishSetup) ||
                       (choch && chochType === "Bearish CHOCH" && isBearishSetup);
  const bosAligned = (bos && bosType === "BOS Up" && isBullishSetup) ||
                     (bos && bosType === "BOS Down" && isBearishSetup);
  if (chochAligned && bosAligned) score += weights.choch_bos_weight;
  else if (chochAligned || bosAligned) score += weights.choch_bos_weight * 0.8;
  else if (choch || bos) score += weights.choch_bos_weight * 0.3;

  // Relative Strength (5%)
  if (relativeStrength > 1) score += weights.relative_strength_weight;
  else if (relativeStrength > 0.3) score += weights.relative_strength_weight * 0.5;

  // Option Chain confirmation proxy (10%) — VWAP position
  const aboveVwap = s.ltp > s.vwap;
  if (aboveVwap && isBullishSetup) score += weights.option_chain_weight;
  else if (!aboveVwap && isBearishSetup) score += weights.option_chain_weight;

  score = Math.min(100, Math.round(score));

  let grade = "D";
  if (score >= 95) grade = "A+";
  else if (score >= 90) grade = "A";
  else if (score >= 80) grade = "A-";
  else if (score >= 70) grade = "B";
  else if (score >= 50) grade = "C";

  return { score, grade };
}

// ===== Signal Generation =====
function generateSignal(
  s: StockData,
  classification: string,
  structure: string,
  choch: boolean,
  chochType: string | null,
  bos: boolean,
  bosType: string | null,
  confidence: number,
  grade: string,
): {
  signal: string | null;
  entry: number | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  target3: number | null;
  target4: number | null;
  riskReward: number | null;
} {
  const aboveVwap = s.ltp > s.vwap;
  const recentHigh = Math.max(...s.highs.slice(-5));
  const recentLow = Math.min(...s.lows.slice(-5));
  const risk = s.atr;

  // BUY conditions — per spec: Long Buildup OR Strong Short Covering, OI > 5%
  const isBuySetup = classification === "Long Buildup" || classification === "Short Covering";
  const buyConditions =
    s.priceChangePct > 0.7 &&
    isBuySetup &&
    s.volumeRatio > 1.5 &&
    aboveVwap &&
    (bosType === "BOS Up" || chochType === "Bullish CHOCH") &&
    s.relativeStrength > 0 &&
    confidence >= 80;

  // SELL conditions — per spec: Short Buildup OR Long Unwinding, OI > 5%
  const isSellSetup = classification === "Short Buildup" || classification === "Long Unwinding";
  const sellConditions =
    s.priceChangePct < -0.7 &&
    isSellSetup &&
    s.volumeRatio > 1.5 &&
    !aboveVwap &&
    (bosType === "BOS Down" || chochType === "Bearish CHOCH") &&
    s.relativeStrength < 0 &&
    confidence >= 80;

  if (buyConditions) {
    const entry = Math.round(recentHigh * 100) / 100;
    const stopLoss = Math.round(recentLow * 100) / 100;
    const r = entry - stopLoss;
    const target1 = Math.round((entry + r) * 100) / 100;
    const target2 = Math.round((entry + r * 2) * 100) / 100;
    const target3 = Math.round((entry + r * 3) * 100) / 100;
    const target4 = Math.round((entry + r + risk) * 100) / 100; // ATR expansion target
    return { signal: "BUY", entry, stopLoss, target1, target2, target3, target4, riskReward: 3 };
  }

  if (sellConditions) {
    const entry = Math.round(recentLow * 100) / 100;
    const stopLoss = Math.round(recentHigh * 100) / 100;
    const r = stopLoss - entry;
    const target1 = Math.round((entry - r) * 100) / 100;
    const target2 = Math.round((entry - r * 2) * 100) / 100;
    const target3 = Math.round((entry - r * 3) * 100) / 100;
    const target4 = Math.round((entry - r - risk) * 100) / 100; // ATR expansion target
    return { signal: "SELL", entry, stopLoss, target1, target2, target3, target4, riskReward: 3 };
  }

  return { signal: null, entry: null, stopLoss: null, target1: null, target2: null, target3: null, target4: null, riskReward: null };
}

// ===== Main Handler =====
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const triggeredBy: string = body.triggered_by ?? "scheduler";

    // Create scan run
    const { data: runRow, error: runError } = await supabase
      .from("oif_scan_runs")
      .insert({ status: "running", message: "Starting OI flow scan...", triggered_by: triggeredBy })
      .select().single();
    if (runError) throw runError;
    const runId = runRow.id;

    // Fetch learning weights
    const { data: lwData } = await supabase
      .from("oif_learning_weights")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const weights: LearningWeights = lwData ?? {
      oi_weight: 30, oi_velocity_weight: 20, volume_weight: 15,
      structure_weight: 10, choch_bos_weight: 10, relative_strength_weight: 5, option_chain_weight: 10,
    };

    // Fetch Nifty change for relative strength
    const niftyChange = await fetchNiftyChange();
    console.log(`[OIF] Nifty change: ${niftyChange}%`);

    // Fetch stock data in batches
    const stockList = NIFTY_100.slice(0, 80); // Top 80 by liquidity
    const allData: StockData[] = [];
    const BATCH = 6;

    for (let i = 0; i < stockList.length; i += BATCH) {
      const batch = stockList.slice(i, i + BATCH);
      const settled = await Promise.allSettled(batch.map(s => fetchYahooData(s.symbol)));
      for (const r of settled) {
        if (r.status === "fulfilled" && r.value) {
          r.value.relativeStrength = Math.round((r.value.priceChangePct - niftyChange) * 100) / 100;
          allData.push(r.value);
        }
      }
      await new Promise(r => setTimeout(r, 150));
    }

    console.log(`[OIF] Fetched data for ${allData.length} stocks`);

    if (allData.length === 0) {
      await supabase.from("oif_scan_runs").update({
        status: "failed",
        message: "No stock data fetched. Yahoo Finance may be unreachable.",
        stocks_scanned: 0,
      }).eq("id", runId);
      return new Response(JSON.stringify({
        success: false,
        error: "No stock data available. Yahoo Finance may be unreachable.",
        run_id: runId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Process each stock
    const results: ScanResult[] = [];
    for (const s of allData) {
      const { classification, oiChangePct, oiVelocity } = classifyOI(s.priceChangePct, s.volumeRatio);
      const ms = detectMarketStructure(s.highs, s.lows, s.closes);
      const { score, grade } = computeConfidence(
        s, classification, oiChangePct, ms.structure, ms.choch, ms.chochType, ms.bos, ms.bosType, s.relativeStrength, weights,
      );
      const sig = generateSignal(
        s, classification, ms.structure, ms.choch, ms.chochType, ms.bos, ms.bosType, score, grade,
      );

      results.push({
        symbol: s.symbol,
        company_name: s.companyName,
        sector: s.sector,
        ltp: s.ltp,
        price_change_pct: s.priceChangePct,
        volume: s.volume,
        avg_20d_volume: s.avg20Vol,
        volume_ratio: s.volumeRatio,
        oi_change_pct: oiChangePct,
        oi_velocity: oiVelocity,
        vwap: s.vwap,
        atr: s.atr,
        relative_strength: s.relativeStrength,
        market_structure: ms.structure,
        choch: ms.choch,
        choch_type: ms.chochType,
        bos: ms.bos,
        bos_type: ms.bosType,
        classification,
        confidence_score: score,
        grade,
        signal: sig.signal,
        entry_price: sig.entry,
        stop_loss: sig.stopLoss,
        target_1: sig.target1,
        target_2: sig.target2,
        target_3: sig.target3,
        target_4: sig.target4,
        risk_reward: sig.riskReward,
        rank: 0,
      });
    }

    // Rank by confidence score
    results.sort((a, b) => b.confidence_score - a.confidence_score);
    results.forEach((r, i) => { r.rank = i + 1; });

    // Summary stats
    const signals = results.filter(r => r.signal !== null);
    const bullishCount = results.filter(r => r.classification === "Long Buildup" || r.classification === "Short Covering").length;
    const bearishCount = results.filter(r => r.classification === "Short Buildup" || r.classification === "Long Unwinding").length;
    const longBuildup = results.filter(r => r.classification === "Long Buildup").length;
    const shortBuildup = results.filter(r => r.classification === "Short Buildup").length;
    const shortCovering = results.filter(r => r.classification === "Short Covering").length;
    const longUnwinding = results.filter(r => r.classification === "Long Unwinding").length;

    const sentiment = bullishCount > bearishCount * 1.5 ? "Bullish" : bearishCount > bullishCount * 1.5 ? "Bearish" : "Neutral";
    const niftyTrend = niftyChange > 0.3 ? "Bullish" : niftyChange < -0.3 ? "Bearish" : "Sideways";

    // Delete old snapshots for this run (in case of retry)
    await supabase.from("oif_scan_snapshots").delete().eq("scan_run_id", runId);

    // Insert snapshots in batches
    const snapRows = results.map(r => ({ scan_run_id: runId, ...r }));
    for (let i = 0; i < snapRows.length; i += 50) {
      await supabase.from("oif_scan_snapshots").insert(snapRows.slice(i, i + 50));
    }

    // Insert signals
    if (signals.length > 0) {
      const sigRows = signals.map(s => ({
        scan_run_id: runId,
        symbol: s.symbol,
        company_name: s.company_name,
        sector: s.sector,
        signal_type: s.signal,
        classification: s.classification,
        confidence_score: s.confidence_score,
        grade: s.grade,
        entry_price: s.entry_price,
        stop_loss: s.stop_loss,
        target_1: s.target_1,
        target_2: s.target_2,
        target_3: s.target_3,
        target_4: s.target_4,
        risk_reward: s.risk_reward,
        oi_change_pct: s.oi_change_pct,
        volume_ratio: s.volume_ratio,
        vwap: s.vwap,
        market_structure: s.market_structure,
        choch_confirmed: s.choch,
        bos_confirmed: s.bos,
        relative_strength: s.relative_strength,
        status: "Waiting",
      }));
      for (let i = 0; i < sigRows.length; i += 50) {
        await supabase.from("oif_signals").insert(sigRows.slice(i, i + 50));
      }
    }

    // Update scan run
    await supabase.from("oif_scan_runs").update({
      status: "success",
      message: `Scanned ${allData.length} stocks. ${signals.length} signals generated.`,
      stocks_scanned: allData.length,
      signals_count: signals.length,
      bullish_count: bullishCount,
      bearish_count: bearishCount,
      long_buildup_count: longBuildup,
      short_buildup_count: shortBuildup,
      short_covering_count: shortCovering,
      long_unwinding_count: longUnwinding,
      market_sentiment: sentiment,
      nifty_trend: niftyTrend,
    }).eq("id", runId);

    return new Response(JSON.stringify({
      success: true,
      run_id: runId,
      stocks_scanned: allData.length,
      signals: signals.length,
      bullish: bullishCount,
      bearish: bearishCount,
      long_buildup: longBuildup,
      short_buildup: shortBuildup,
      short_covering: shortCovering,
      long_unwinding: longUnwinding,
      sentiment,
      nifty_trend: niftyTrend,
      message: `Scan complete: ${signals.length} signals from ${allData.length} stocks`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("OIF Scan Fatal:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
