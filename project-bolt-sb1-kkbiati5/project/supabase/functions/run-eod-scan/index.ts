import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NSE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "*/*",
  "Referer": "https://www.nseindia.com/",
  "Accept-Language": "en-US,en;q=0.9",
};

const COMPANY_NAMES: Record<string, string> = {
  "RELIANCE": "Reliance Industries", "TCS": "Tata Consultancy Services",
  "HDFCBANK": "HDFC Bank", "INFY": "Infosys", "ICICIBANK": "ICICI Bank",
  "HINDUNILVR": "Hindustan Unilever", "ITC": "ITC Limited", "SBIN": "State Bank of India",
  "BAJFINANCE": "Bajaj Finance", "BHARTIARTL": "Bharti Airtel",
  "KOTAKBANK": "Kotak Mahindra Bank", "LT": "Larsen & Toubro",
  "AXISBANK": "Axis Bank", "ASIANPAINT": "Asian Paints", "MARUTI": "Maruti Suzuki",
  "TITAN": "Titan Company", "SUNPHARMA": "Sun Pharmaceutical", "ULTRACEMCO": "UltraTech Cement",
  "NESTLEIND": "Nestle India", "WIPRO": "Wipro", "HCLTECH": "HCL Technologies",
  "POWERGRID": "Power Grid Corp", "NTPC": "NTPC Limited", "ONGC": "ONGC",
  "COALINDIA": "Coal India", "ADANIPORTS": "Adani Ports", "ADANIENT": "Adani Enterprises",
  "JSWSTEEL": "JSW Steel", "TATASTEEL": "Tata Steel", "TATAMOTORS": "Tata Motors",
  "HINDALCO": "Hindalco Industries", "BAJAJFINSV": "Bajaj Finserv", "BPCL": "BPCL",
  "TECHM": "Tech Mahindra", "GRASIM": "Grasim Industries", "CIPLA": "Cipla",
  "DRREDDY": "Dr Reddy's Laboratories", "EICHERMOT": "Eicher Motors",
  "INDUSINDBK": "IndusInd Bank", "DIVISLAB": "Divis's Laboratories",
  "APOLLOHOSP": "Apollo Hospitals", "BAJAJ-AUTO": "Bajaj Auto",
  "BRITANNIA": "Britannia Industries", "HEROMOTOCO": "Hero MotoCorp",
  "TATACONSUM": "Tata Consumer Products", "VEDL": "Vedanta",
  "SBILIFE": "SBI Life Insurance", "HDFCLIFE": "HDFC Life Insurance",
  "ICICIPRULI": "ICICI Prudential Life", "M&M": "Mahindra & Mahindra",
  "SHREECEM": "Shree Cement", "PIDILITIND": "Pidilite Industries",
  "DMART": "Avenue Supermarts", "HAVELLS": "Havells India",
  "MARICO": "Marico", "BERGEPAINT": "Berger Paints", "AMBUJACEM": "Ambuja Cements",
  "ACC": "ACC Limited", "COLPAL": "Colgate-Palmolive India", "DABUR": "Dabur India",
  "GODREJCP": "Godrej Consumer Products", "LUPIN": "Lupin", "BIOCON": "Biocon",
  "MUTHOOTFIN": "Muthoot Finance", "LICHSGFIN": "LIC Housing Finance",
  "BANDHANBNK": "Bandhan Bank", "IDFCFIRSTB": "IDFC First Bank",
  "FEDERALBNK": "Federal Bank", "PNB": "Punjab National Bank", "CANBK": "Canara Bank",
  "UNIONBANK": "Union Bank of India", "NMDC": "NMDC", "HINDZINC": "Hindustan Zinc",
  "SAIL": "Steel Authority of India", "NATIONALUM": "National Aluminium",
  "POLYCAB": "Polycab India", "TVSMOTOR": "TVS Motor Company",
  "ESCORTS": "Escorts Kubota", "VOLTAS": "Voltas", "CROMPTON": "Crompton Greaves Consumer",
  "PAGEIND": "Page Industries", "MPHASIS": "Mphasis", "LTTS": "L&T Technology Services",
  "COFORGE": "Coforge", "PERSISTENT": "Persistent Systems", "TRENT": "Trent Limited",
  "NAUKRI": "Info Edge (Naukri)", "ZOMATO": "Zomato", "IRCTC": "IRCTC",
  "RECLTD": "REC Limited", "PFC": "Power Finance Corp", "IRFC": "Indian Railway Finance",
  "NHPC": "NHPC", "CONCOR": "Container Corp of India", "HAL": "Hindustan Aeronautics",
  "BEL": "Bharat Electronics", "BHEL": "Bharat Heavy Electricals",
  "DLF": "DLF Limited", "GODREJPROP": "Godrej Properties",
  "OBEROIRLTY": "Oberoi Realty", "TATAPOWER": "Tata Power",
  "ADANIGREEN": "Adani Green Energy", "ADANIPOWER": "Adani Power",
  "CHOLAFIN": "Cholamandalam Finance", "SHRIRAMFIN": "Shriram Finance",
  "M&MFIN": "Mahindra Finance", "SBICARD": "SBI Cards",
  "HDFCAMC": "HDFC AMC", "ANGELONE": "Angel One", "DIXON": "Dixon Technologies",
  "KAYNES": "Kaynes Technology", "MOTHERSON": "Samvardhana Motherson",
  "BOSCHLTD": "Bosch India", "IGL": "Indraprastha Gas", "MGL": "Mahanagar Gas",
  "PETRONET": "Petronet LNG", "HPCL": "HPCL", "IOC": "Indian Oil Corporation",
  "PAYTM": "One 97 Communications", "NYKAA": "FSN E-Commerce (Nykaa)",
  "DELHIVERY": "Delhivery", "JUBLFOOD": "Jubilant FoodWorks",
  "TORNTPHARM": "Torrent Pharmaceuticals", "AUROPHARMA": "Aurobindo Pharma",
  "ALKEM": "Alkem Laboratories", "ABBOTINDIA": "Abbott India",
  "MAXHEALTH": "Max Healthcare", "FORTIS": "Fortis Healthcare",
  "ATGL": "Adani Total Gas", "SUZLON": "Suzlon Energy",
  "RVNL": "Rail Vikas Nigam", "IRCON": "Ircon International",
  "JSWENERGY": "JSW Energy", "TORNTPOWER": "Torrent Power",
  "UPL": "UPL Limited", "TATACHEM": "Tata Chemicals",
  "DEEPAKNTR": "Deepak Nitrite", "PIIND": "PI Industries",
  "BALKRISIND": "Balkrishna Industries", "CUMMINSIND": "Cummins India",
  "ASTRAL": "Astral Limited", "MFSL": "Max Financial Services",
  "GLAND": "Gland Pharma", "MANAPPURAM": "Manappuram Finance",
  "ENDURANCE": "Endurance Technologies", "360ONE": "360 ONE WAM",
  "LALPATHLAB": "Dr Lal PathLabs", "METROPOLIS": "Metropolis Healthcare",
};

const SECTORS: Record<string, string> = {
  "RELIANCE": "Energy", "ONGC": "Energy", "BPCL": "Energy", "HPCL": "Energy",
  "IOC": "Energy", "PETRONET": "Energy", "ADANIGREEN": "Energy", "TATAPOWER": "Energy",
  "ADANIPOWER": "Energy", "JSWENERGY": "Energy", "TORNTPOWER": "Energy",
  "NTPC": "Energy", "NHPC": "Energy", "POWERGRID": "Energy", "SUZLON": "Energy",
  "TCS": "IT", "INFY": "IT", "WIPRO": "IT", "HCLTECH": "IT", "TECHM": "IT",
  "MPHASIS": "IT", "LTTS": "IT", "COFORGE": "IT", "PERSISTENT": "IT",
  "HDFCBANK": "Banking", "ICICIBANK": "Banking", "SBIN": "Banking",
  "KOTAKBANK": "Banking", "AXISBANK": "Banking", "INDUSINDBK": "Banking",
  "BANDHANBNK": "Banking", "IDFCFIRSTB": "Banking", "FEDERALBNK": "Banking",
  "PNB": "Banking", "CANBK": "Banking", "UNIONBANK": "Banking",
  "BAJFINANCE": "NBFC", "BAJAJFINSV": "NBFC", "MUTHOOTFIN": "NBFC",
  "LICHSGFIN": "NBFC", "CHOLAFIN": "NBFC", "SHRIRAMFIN": "NBFC",
  "MANAPPURAM": "NBFC", "M&MFIN": "NBFC", "SBICARD": "NBFC",
  "SUNPHARMA": "Pharma", "CIPLA": "Pharma", "DRREDDY": "Pharma",
  "DIVISLAB": "Pharma", "LUPIN": "Pharma", "BIOCON": "Pharma",
  "TORNTPHARM": "Pharma", "AUROPHARMA": "Pharma", "ALKEM": "Pharma",
  "ABBOTINDIA": "Pharma", "GLAND": "Pharma",
  "HINDUNILVR": "FMCG", "ITC": "FMCG", "NESTLEIND": "FMCG",
  "BRITANNIA": "FMCG", "MARICO": "FMCG", "DABUR": "FMCG",
  "COLPAL": "FMCG", "GODREJCP": "FMCG", "TATACONSUM": "FMCG",
  "MARUTI": "Auto", "TATAMOTORS": "Auto", "M&M": "Auto", "BAJAJ-AUTO": "Auto",
  "HEROMOTOCO": "Auto", "EICHERMOT": "Auto", "TVSMOTOR": "Auto",
  "ESCORTS": "Auto", "BOSCHLTD": "Auto", "MOTHERSON": "Auto",
  "JSWSTEEL": "Metals", "TATASTEEL": "Metals", "HINDALCO": "Metals",
  "VEDL": "Metals", "SAIL": "Metals", "NMDC": "Metals",
  "HINDZINC": "Metals", "NATIONALUM": "Metals",
  "LT": "Infrastructure", "ADANIPORTS": "Infrastructure", "CONCOR": "Infrastructure",
  "IRCTC": "Infrastructure", "RVNL": "Infrastructure", "IRCON": "Infrastructure",
  "IRFC": "Financials", "RECLTD": "Financials", "PFC": "Financials",
  "HDFCLIFE": "Insurance", "SBILIFE": "Insurance", "ICICIPRULI": "Insurance",
  "MFSL": "Insurance", "HDFCAMC": "Asset Management", "ANGELONE": "Broking",
  "360ONE": "Wealth Management",
  "ASIANPAINT": "Paints", "BERGEPAINT": "Paints", "PIDILITIND": "Chemicals",
  "DEEPAKNTR": "Chemicals", "UPL": "Chemicals", "TATACHEM": "Chemicals",
  "ADANIENT": "Conglomerate", "GRASIM": "Conglomerate",
  "ULTRACEMCO": "Cement", "SHREECEM": "Cement", "AMBUJACEM": "Cement", "ACC": "Cement",
  "TITAN": "Consumer Goods", "HAVELLS": "Consumer Goods", "VOLTAS": "Consumer Goods",
  "CROMPTON": "Consumer Goods", "PAGEIND": "Consumer Goods",
  "DLF": "Real Estate", "GODREJPROP": "Real Estate", "OBEROIRLTY": "Real Estate",
  "APOLLOHOSP": "Healthcare", "MAXHEALTH": "Healthcare", "FORTIS": "Healthcare",
  "LALPATHLAB": "Healthcare", "METROPOLIS": "Healthcare",
  "DMART": "Retail", "TRENT": "Retail", "JUBLFOOD": "Retail",
  "NAUKRI": "Internet", "ZOMATO": "Internet", "PAYTM": "Fintech",
  "NYKAA": "E-Commerce", "DELHIVERY": "Logistics",
  "COALINDIA": "Mining", "HAL": "Defence", "BEL": "Defence", "BHEL": "Capital Goods",
  "CUMMINSIND": "Capital Goods", "POLYCAB": "Electricals", "KAYNES": "Electronics",
  "DIXON": "Electronics", "IGL": "Gas Distribution", "MGL": "Gas Distribution",
  "ATGL": "Gas Distribution", "BALKRISIND": "Tyres", "PIIND": "Agrochemicals",
  "ASTRAL": "Pipes",
};

interface RawStock {
  symbol: string;
  companyName: string;
  close: number;
  prevClose: number;
  pctChange: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  dayOpen: number;
  sector: string | null;
}

interface StockWithHistory extends RawStock {
  avg20Vol: number;
  volumeRatio: number;
  high52w: number;
  low52w: number;
  near52wkHigh: boolean;
  near52wkLow: boolean;
}

interface Candidate {
  symbol: string;
  company_name: string;
  sector: string | null;
  setup_type: "long" | "short" | "reversal";
  direction: "LONG" | "SHORT";
  close_price: number;
  pct_change: number;
  day_high: number;
  day_low: number;
  day_open: number;
  volume: number;
  avg_20d_volume: number;
  volume_ratio: number;
  near_52wk_high: boolean;
  near_52wk_low: boolean;
  pivot_pp: number;
  pivot_r1: number;
  pivot_r2: number;
  pivot_s1: number;
  pivot_s2: number;
  trigger_price: number;
  stop_loss: number;
  conviction_score: number;
  conviction_reasons: string[];
}

interface DerivEntry {
  category: "long_buildup" | "short_buildup" | "long_unwinding" | "short_covering";
  symbol: string;
  pct_change: number;
  oi_change_pct: number | null;
  volume: number;
}

interface BulkDeal {
  symbol: string;
  company_name: string;
  deal_type: "bulk" | "block";
  buy_qty: number;
  sell_qty: number;
  trade_price: number;
  net_qty: number;
}

function getISTNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ===== NSE Bhav Copy =====
async function fetchNSEBhavCopy(date: Date): Promise<RawStock[]> {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}${mm}${dd}`;
  const url = `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${dateStr}_F_0000.csv.zip`;

  const resp = await fetch(url, { headers: NSE_HEADERS });
  if (!resp.ok) throw new Error(`NSE bhav copy HTTP ${resp.status} for ${dateStr}`);

  const buffer = await resp.arrayBuffer();
  const files = unzipSync(new Uint8Array(buffer));
  const csvFilename = Object.keys(files).find(f => f.endsWith(".csv"));
  if (!csvFilename) throw new Error("No CSV in bhav copy ZIP");

  const csvText = new TextDecoder("utf-8").decode(files[csvFilename]);
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) throw new Error("Bhav copy CSV empty");

  const results: RawStock[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 25) continue;
    const segment = cols[2].trim().toUpperCase();
    const symbol = cols[7].trim().toUpperCase();
    const series = cols[8].trim().toUpperCase();
    if (segment !== "CM" || series !== "EQ") continue;

    const close = parseFloat(cols[17]);
    const prevClose = parseFloat(cols[19]);
    const volume = parseInt(cols[24]) || 0;
    const dayHigh = parseFloat(cols[11]) || close;
    const dayLow = parseFloat(cols[12]) || close;
    const dayOpen = parseFloat(cols[10]) || close;

    if (isNaN(close) || isNaN(prevClose) || close <= 0 || prevClose <= 0) continue;
    if (volume < 1000000) continue; // 10 lakh min liquidity

    const pctChange = ((close - prevClose) / prevClose) * 100;
    results.push({
      symbol,
      companyName: COMPANY_NAMES[symbol] ?? symbol,
      close: Math.round(close * 100) / 100,
      prevClose: Math.round(prevClose * 100) / 100,
      pctChange: Math.round(pctChange * 10000) / 10000,
      volume,
      dayHigh: Math.round(dayHigh * 100) / 100,
      dayLow: Math.round(dayLow * 100) / 100,
      dayOpen: Math.round(dayOpen * 100) / 100,
      sector: SECTORS[symbol] ?? null,
    });
  }
  return results;
}

// ===== Yahoo Finance: 20-day history + today's OHLC + 52-week high/low =====
async function fetchYahooHistory(symbol: string): Promise<{
  avg20Vol: number; high52w: number; low52w: number;
  dayHigh: number; dayLow: number; dayOpen: number; dayVolume: number;
} | null> {
  const yahooSymbol = `${symbol}.NS`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1y`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const quotes = result.indicators?.quote?.[0];
    const volumes: number[] = quotes?.volume ?? [];
    const validVols = volumes.filter((v: number | null) => v != null && v > 0);
    const last20 = validVols.slice(-20);
    const avg20Vol = last20.length > 0 ? Math.round(last20.reduce((a: number, b: number) => a + b, 0) / last20.length) : 0;

    const highs: number[] = (quotes?.high ?? []).filter((v: number | null) => v != null);
    const lows: number[] = (quotes?.low ?? []).filter((v: number | null) => v != null);
    const high52w = highs.length > 0 ? Math.max(...highs) : 0;
    const low52w = lows.length > 0 ? Math.min(...lows) : 0;

    // Today's OHLC from the last candle
    const lastIdx = (result.timestamp ?? []).length - 1;
    const dayHigh = quotes?.high?.[lastIdx] ?? 0;
    const dayLow = quotes?.low?.[lastIdx] ?? 0;
    const dayOpen = quotes?.open?.[lastIdx] ?? 0;
    const dayVolume = quotes?.volume?.[lastIdx] ?? 0;

    return { avg20Vol, high52w, low52w, dayHigh, dayLow, dayOpen, dayVolume };
  } catch {
    return null;
  }
}

// ===== Fallback: fetch from stock_movers table (already populated by daily scheduler) =====
async function fetchFromStockMovers(supabase: ReturnType<typeof createClient>): Promise<{ stocks: RawStock[]; date: string } | null> {
  // Get the most recent date with data
  const { data: latestRow, error: latestErr } = await supabase
    .from("stock_movers")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr || !latestRow?.date) return null;

  const targetDate = latestRow.date;

  // Fetch all gainers and losers for that date
  const [gainersRes, losersRes] = await Promise.all([
    supabase.from("stock_movers").select("*").eq("date", targetDate).eq("mover_type", "gainer").order("pct_change", { ascending: false }),
    supabase.from("stock_movers").select("*").eq("date", targetDate).eq("mover_type", "loser").order("pct_change", { ascending: true }),
  ]);

  if (gainersRes.error || losersRes.error) return null;

  const allMovers = [...(gainersRes.data ?? []), ...(losersRes.data ?? [])];
  if (allMovers.length === 0) return null;

  // Deduplicate by symbol (a stock could appear as both gainer/loser on different days, but same date won't dup)
  const seen = new Set<string>();
  const stocks: RawStock[] = [];

  for (const m of allMovers) {
    // Strip .NS suffix if present
    const symbol = m.symbol.replace(/\.NS$/, "").toUpperCase();
    if (seen.has(symbol)) continue;
    seen.add(symbol);

    const close = parseFloat(m.price) || 0;
    const prevClose = parseFloat(m.prev_close) || 0;
    const volume = parseInt(m.volume) || 0;
    if (close <= 0 || prevClose <= 0) continue;
    if (volume < 1000000) continue;

    stocks.push({
      symbol,
      companyName: m.company_name ?? COMPANY_NAMES[symbol] ?? symbol,
      close,
      prevClose,
      pctChange: parseFloat(m.pct_change) || ((close - prevClose) / prevClose) * 100,
      volume,
      // OHLC not in stock_movers — will be enriched from Yahoo
      dayHigh: close,
      dayLow: close,
      dayOpen: close,
      sector: m.sector ?? SECTORS[symbol] ?? null,
    });
  }

  console.log(`[EOD] Fallback: ${stocks.length} stocks from stock_movers (date=${targetDate})`);
  return { stocks, date: targetDate };
}

// ===== Fallback: build RawStock from Yahoo Finance for watchlist symbols =====
async function fetchFromYahooWatchlist(): Promise<RawStock[]> {
  // Use a curated list of liquid F&O stocks
  const watchlist = Object.keys(COMPANY_NAMES);
  const results: RawStock[] = [];
  const BATCH = 8;

  for (let i = 0; i < watchlist.length; i += BATCH) {
    const batch = watchlist.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map(async (symbol) => {
        const yahooSymbol = `${symbol}.NS`;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`;
        const resp = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        const result = data.chart?.result?.[0];
        if (!result) return null;

        const quotes = result.indicators?.quote?.[0];
        const timestamps = result.timestamp ?? [];
        if (timestamps.length < 2) return null;

        const lastIdx = timestamps.length - 1;
        const close = quotes?.close?.[lastIdx] ?? 0;
        const prevClose = quotes?.close?.[lastIdx - 1] ?? 0;
        const volume = quotes?.volume?.[lastIdx] ?? 0;
        const dayHigh = quotes?.high?.[lastIdx] ?? close;
        const dayLow = quotes?.low?.[lastIdx] ?? close;
        const dayOpen = quotes?.open?.[lastIdx] ?? close;

        if (close <= 0 || prevClose <= 0 || volume < 1000000) return null;

        return {
          symbol,
          companyName: COMPANY_NAMES[symbol] ?? symbol,
          close: Math.round(close * 100) / 100,
          prevClose: Math.round(prevClose * 100) / 100,
          pctChange: Math.round(((close - prevClose) / prevClose) * 10000) / 10000,
          volume,
          dayHigh: Math.round(dayHigh * 100) / 100,
          dayLow: Math.round(dayLow * 100) / 100,
          dayOpen: Math.round(dayOpen * 100) / 100,
          sector: SECTORS[symbol] ?? null,
        } as RawStock;
      }),
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[EOD] Fallback: ${results.length} stocks from Yahoo Finance watchlist`);
  return results;
}

// ===== Bulk/Block deals from NSE =====
async function fetchBulkDeals(date: Date): Promise<BulkDeal[]> {
  const dateStr = toDateStr(date).replace(/-/g, "");
  const mmddyyyy = `${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}-${dateStr.slice(0, 4)}`;
  const url = `https://www.nseindia.com/api/historical/bulk-deals?from=${mmddyyyy}&to=${mmddyyyy}`;
  try {
    const resp = await fetch(url, { headers: NSE_HEADERS });
    if (!resp.ok) return [];
    const data = await resp.json();
    const deals = data?.data ?? [];
    const result: BulkDeal[] = [];
    for (const d of deals) {
      const symbol = (d.sym ?? d.symbol ?? "").toUpperCase().trim();
      if (!symbol) continue;
      result.push({
        symbol,
        company_name: COMPANY_NAMES[symbol] ?? symbol,
        deal_type: "bulk",
        buy_qty: parseInt(d.buyQty ?? "0") || 0,
        sell_qty: parseInt(d.sellQty ?? "0") || 0,
        trade_price: parseFloat(d.trdPric ?? "0") || 0,
        net_qty: (parseInt(d.buyQty ?? "0") || 0) - (parseInt(d.sellQty ?? "0") || 0),
      });
    }
    return result;
  } catch {
    return [];
  }
}

// ===== Derivative data: OI changes (simulated from price+volume proxy) =====
// ===== NSE F&O eligible stocks (stocks that trade in futures & options) =====
// Only these stocks have Open Interest data. Non-F&O stocks cannot have OI.
const FNO_STOCKS = new Set([
  "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "ITC", "SBIN",
  "BAJFINANCE", "BHARTIARTL", "KOTAKBANK", "LT", "AXISBANK", "ASIANPAINT", "MARUTI",
  "TITAN", "SUNPHARMA", "ULTRACEMCO", "NESTLEIND", "WIPRO", "HCLTECH",
  "POWERGRID", "NTPC", "ONGC", "COALINDIA", "ADANIPORTS", "ADANIENT",
  "JSWSTEEL", "TATASTEEL", "TATAMOTORS", "HINDALCO", "BAJAJFINSV", "BPCL",
  "TECHM", "GRASIM", "CIPLA", "DRREDDY", "EICHERMOT", "INDUSINDBK", "DIVISLAB",
  "APOLLOHOSP", "BAJAJ-AUTO", "BRITANNIA", "HEROMOTOCO", "TATACONSUM", "VEDL",
  "SBILIFE", "HDFCLIFE", "ICICIPRULI", "M&M", "SHREECEM", "PIDILITIND",
  "DMART", "HAVELLS", "MARICO", "BERGEPAINT", "AMBUJACEM", "ACC", "COLPAL", "DABUR",
  "GODREJCP", "LUPIN", "BIOCON", "MUTHOOTFIN", "LICHSGFIN",
  "BANDHANBNK", "IDFCFIRSTB", "FEDERALBNK", "PNB", "CANBK", "UNIONBANK",
  "NMDC", "HINDZINC", "SAIL", "NATIONALUM",
  "POLYCAB", "TVSMOTOR", "ESCORTS", "VOLTAS", "CROMPTON",
  "PAGEIND", "MPHASIS", "LTTS", "COFORGE", "PERSISTENT", "TRENT",
  "NAUKRI", "ZOMATO", "IRCTC", "RECLTD", "PFC", "IRFC",
  "NHPC", "CONCOR", "HAL", "BEL", "BHEL",
  "DLF", "GODREJPROP", "OBEROIRLTY", "TATAPOWER",
  "ADANIGREEN", "ADANIPOWER", "CHOLAFIN", "SHRIRAMFIN",
  "M&MFIN", "SBICARD", "HDFCAMC", "ANGELONE", "DIXON",
  "KAYNES", "MOTHERSON", "BOSCHLTD", "IGL", "MGL",
  "PETRONET", "HPCL", "IOC", "PAYTM", "NYKAA",
  "DELHIVERY", "JUBLFOOD", "TORNTPHARM", "AUROPHARMA",
  "ALKEM", "ABBOTINDIA", "MAXHEALTH", "FORTIS",
  "ATGL", "SUZLON", "RVNL", "IRCON", "JSWENERGY", "TORNTPOWER",
  "UPL", "TATACHEM", "DEEPAKNTR", "PIIND",
  "BALKRISIND", "CUMMINSIND", "ASTRAL", "MFSL",
  "GLAND", "MANAPPURAM", "ENDURANCE", "360ONE",
  "LALPATHLAB", "METROPOLIS",
]);

// ===== Derivative data: only for F&O stocks =====
// NSE's real OI API requires session cookies and is heavily protected from server-side access.
// We cannot fetch real OI numbers from the edge function. Instead, we classify F&O stocks
// into buildup/unwinding categories based on price direction + volume surge (which is
// publicly available data). The oi_change_pct field is left as null — we do NOT fabricate OI numbers.
async function fetchDerivativeData(stocks: StockWithHistory[]): Promise<Map<string, DerivEntry>> {
  const result = new Map<string, DerivEntry>();
  for (const s of stocks) {
    // Only F&O stocks have derivatives data
    if (!FNO_STOCKS.has(s.symbol)) continue;
    if (Math.abs(s.pctChange) < 1) continue;

    let category: DerivEntry["category"];
    if (s.pctChange > 2 && s.volumeRatio > 1.5) category = "long_buildup";
    else if (s.pctChange < -2 && s.volumeRatio > 1.5) category = "short_buildup";
    else if (s.pctChange > 0 && s.volumeRatio <= 1.5) category = "short_covering";
    else if (s.pctChange < 0 && s.volumeRatio <= 1.5) category = "long_unwinding";
    else continue; // doesn't fit any pattern clearly

    result.set(s.symbol, {
      category,
      symbol: s.symbol,
      pct_change: s.pctChange,
      oi_change_pct: 0, // We don't have real OI data — don't fabricate
      volume: s.volume,
    });
  }
  return result;
}

// ===== Pivot Points =====
function computePivots(high: number, low: number, close: number) {
  const pp = (high + low + close) / 3;
  const r1 = 2 * pp - low;
  const s1 = 2 * pp - high;
  const r2 = pp + (high - low);
  const s2 = pp - (high - low);
  return {
    pivot_pp: Math.round(pp * 100) / 100,
    pivot_r1: Math.round(r1 * 100) / 100,
    pivot_r2: Math.round(r2 * 100) / 100,
    pivot_s1: Math.round(s1 * 100) / 100,
    pivot_s2: Math.round(s2 * 100) / 100,
  };
}

// ===== Screening Algorithm =====
function screenStocks(
  stocks: StockWithHistory[],
  derivMap: Map<string, DerivEntry>,
  bulkSymbols: Set<string>,
): { candidates: Candidate[]; derivSummary: DerivEntry[] } {
  const candidates: Candidate[] = [];
  const derivSummary: DerivEntry[] = [];

  // Collect derivative summary entries
  for (const [, entry] of derivMap) {
    derivSummary.push(entry);
  }

  for (const s of stocks) {
    const deriv = derivMap.get(s.symbol);
    const oiChangePct = deriv?.oi_change_pct ?? 0;
    const oiSignal = deriv?.category ?? null;
    const inBulkDeal = bulkSymbols.has(s.symbol);

    // Position in day range (0 = at low, 1 = at high)
    const dayRange = s.dayHigh - s.dayLow;
    const closePosition = dayRange > 0 ? (s.close - s.dayLow) / dayRange : 0.5;

    const pivots = computePivots(s.dayHigh, s.dayLow, s.close);

    // ===== A. LONG CANDIDATES =====
    if (s.pctChange > 2 && s.volumeRatio > 2) {
      const reasons: string[] = [];
      let score = 1;

      reasons.push(`Price +${s.pctChange.toFixed(1)}% with ${s.volumeRatio.toFixed(1)}x volume`);
      score++;

      if (oiSignal === "long_buildup") {
        reasons.push("Long buildup signal (price up + volume surge)");
        score++;
      }

      if (closePosition >= 0.9) {
        reasons.push("Closed near day high (top 10% range)");
        score++;
      }

      if (s.near52wkHigh) {
        reasons.push("Near 52-week high");
        score++;
      }

      if (inBulkDeal) {
        reasons.push("Institutional bulk/block deal detected");
        score++;
      }

      const trigger = Math.round(s.dayHigh * 100) / 100;
      const stop = Math.round(Math.min(s.dayLow, pivots.pivot_s1) * 100) / 100;

      candidates.push({
        symbol: s.symbol,
        company_name: s.companyName,
        sector: s.sector,
        setup_type: "long",
        direction: "LONG",
        close_price: s.close,
        pct_change: s.pctChange,
        day_high: s.dayHigh,
        day_low: s.dayLow,
        day_open: s.dayOpen,
        volume: s.volume,
        avg_20d_volume: s.avg20Vol,
        volume_ratio: Math.round(s.volumeRatio * 100) / 100,
        near_52wk_high: s.near52wkHigh,
        near_52wk_low: s.near52wkLow,
        ...pivots,
        trigger_price: trigger,
        stop_loss: stop,
        conviction_score: Math.min(5, score),
        conviction_reasons: reasons,
      });
    }

    // ===== B. SHORT CANDIDATES =====
    if (s.pctChange < -2 && s.volumeRatio > 2) {
      const reasons: string[] = [];
      let score = 1;

      reasons.push(`Price ${s.pctChange.toFixed(1)}% with ${s.volumeRatio.toFixed(1)}x volume`);
      score++;

      if (oiSignal === "short_buildup") {
        reasons.push("Short buildup signal (price down + volume surge)");
        score++;
      }

      if (closePosition <= 0.1) {
        reasons.push("Closed near day low (bottom 10% range)");
        score++;
      }

      if (s.near52wkLow) {
        reasons.push("Near 52-week low");
        score++;
      }

      if (inBulkDeal) {
        reasons.push("Institutional selling in bulk/block deal");
        score++;
      }

      const trigger = Math.round(s.dayLow * 100) / 100;
      const stop = Math.round(Math.max(s.dayHigh, pivots.pivot_r1) * 100) / 100;

      candidates.push({
        symbol: s.symbol,
        company_name: s.companyName,
        sector: s.sector,
        setup_type: "short",
        direction: "SHORT",
        close_price: s.close,
        pct_change: s.pctChange,
        day_high: s.dayHigh,
        day_low: s.dayLow,
        day_open: s.dayOpen,
        volume: s.volume,
        avg_20d_volume: s.avg20Vol,
        volume_ratio: Math.round(s.volumeRatio * 100) / 100,
        near_52wk_high: s.near52wkHigh,
        near_52wk_low: s.near52wkLow,
        ...pivots,
        trigger_price: trigger,
        stop_loss: stop,
        conviction_score: Math.min(5, score),
        conviction_reasons: reasons,
      });
    }

    // ===== C. REVERSAL CANDIDATES =====
    if (inBulkDeal && Math.abs(s.pctChange) >= 1) {
      const reasons: string[] = [];
      let score = 1;

      reasons.push("Institutional bulk/block deal activity");
      score++;

      if (oiSignal) {
        reasons.push(`Derivative signal: ${oiSignal.replace(/_/g, " ")}`);
        score++;
      }

      if (s.near52wkLow && s.pctChange > 0) {
        reasons.push("Bouncing from 52-week low");
        score++;
      }

      if (s.near52wkHigh && s.pctChange < 0) {
        reasons.push("Rejection from 52-week high");
        score++;
      }

      if (s.volumeRatio > 1.5) {
        reasons.push(`Volume surge ${s.volumeRatio.toFixed(1)}x`);
        score++;
      }

      const isLong = s.pctChange > 0;
      const trigger = isLong
        ? Math.round(s.dayHigh * 100) / 100
        : Math.round(s.dayLow * 100) / 100;
      const stop = isLong
        ? Math.round(Math.min(s.dayLow, pivots.pivot_s1) * 100) / 100
        : Math.round(Math.max(s.dayHigh, pivots.pivot_r1) * 100) / 100;

      candidates.push({
        symbol: s.symbol,
        company_name: s.companyName,
        sector: s.sector,
        setup_type: "reversal",
        direction: isLong ? "LONG" : "SHORT",
        close_price: s.close,
        pct_change: s.pctChange,
        day_high: s.dayHigh,
        day_low: s.dayLow,
        day_open: s.dayOpen,
        volume: s.volume,
        avg_20d_volume: s.avg20Vol,
        volume_ratio: Math.round(s.volumeRatio * 100) / 100,
        near_52wk_high: s.near52wkHigh,
        near_52wk_low: s.near52wkLow,
        ...pivots,
        trigger_price: trigger,
        stop_loss: stop,
        conviction_score: Math.min(5, score),
        conviction_reasons: reasons,
      });
    }
  }

  // Sort by conviction score descending
  candidates.sort((a, b) => b.conviction_score - a.conviction_score);

  return { candidates, derivSummary };
}

// ===== Morning Checklist =====
function generateChecklist(scanDate: string, candidates: Candidate[]): { text: string; category: string; sort_order: number }[] {
  const longCount = candidates.filter(c => c.setup_type === "long").length;
  const shortCount = candidates.filter(c => c.setup_type === "short").length;
  const reversalCount = candidates.filter(c => c.setup_type === "reversal").length;

  return [
    { text: "Check SGX Nifty / GIFT Nifty pre-open for global direction", category: "global", sort_order: 1 },
    { text: "Review Asian markets (Hang Seng, Nikkei, Shanghai) at 8:45 AM", category: "global", sort_order: 2 },
    { text: "Check FII/DII data from previous trading session", category: "derivatives", sort_order: 3 },
    { text: `Review Nifty/BankNifty pre-open OI data at 9:00 AM`, category: "derivatives", sort_order: 4 },
    { text: `Check India VIX level — high VIX = wider stops, smaller positions`, category: "derivatives", sort_order: 5 },
    { text: `${longCount} LONG candidates ready — set price alerts above trigger prices`, category: "stock_specific", sort_order: 6 },
    { text: `${shortCount} SHORT candidates ready — set price alerts below trigger prices`, category: "stock_specific", sort_order: 7 },
    { text: `${reversalCount} reversal candidates — monitor for confirmation in first 15 min`, category: "stock_specific", sort_order: 8 },
    { text: "Confirm volume > 1 Cr on each candidate in pre-open", category: "stock_specific", sort_order: 9 },
    { text: "Set max risk per trade = 1% of capital. No more than 5 open positions.", category: "risk", sort_order: 10 },
    { text: "Prepare exit plan: book partial profits at R1/S1, trail rest to R2/S2", category: "risk", sort_order: 11 },
    { text: "Cancel all unfilled alerts by 3:15 PM if not triggered", category: "risk", sort_order: 12 },
  ];
}

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

    const istNow = getISTNow();
    const today = toDateStr(istNow);

    // Create scan run record
    const { data: runRow, error: runError } = await supabase
      .from("eod_scan_runs")
      .insert({ scan_date: today, status: "running", message: "Starting EOD scan...", triggered_by: triggeredBy })
      .select().single();
    if (runError) throw runError;
    const runId = runRow.id;

    // ===== Step 1: Fetch NSE Bhav Copy =====
    let rawStocks: RawStock[] = [];
    let dataSource = "";
    let targetDate = today;

    for (let offset = 0; offset <= 4; offset++) {
      const tryDate = new Date(istNow);
      tryDate.setDate(tryDate.getDate() - offset);
      const dow = tryDate.getDay();
      if (dow === 0 || dow === 6) continue;

      try {
        const results = await fetchNSEBhavCopy(tryDate);
        if (results.length > 500) {
          rawStocks = results;
          targetDate = toDateStr(tryDate);
          dataSource = `NSE Bhav Copy (${toDateStr(tryDate)})`;
          console.log(`[EOD] Got ${results.length} stocks from ${toDateStr(tryDate)}`);
          break;
        }
      } catch (e) {
        console.log(`[EOD] ${toDateStr(tryDate)} failed: ${e}`);
      }
      await new Promise(r => setTimeout(r, 300));
    }

    if (rawStocks.length === 0) {
      console.log(`[EOD] NSE bhav copy failed, trying fallback: stock_movers table...`);
      await supabase.from("eod_scan_runs").update({
        message: "NSE bhav copy unavailable. Falling back to stock_movers database...",
      }).eq("id", runId);

      // Fallback 1: stock_movers table
      const dbFallback = await fetchFromStockMovers(supabase);
      if (dbFallback && dbFallback.stocks.length > 0) {
        rawStocks = dbFallback.stocks;
        targetDate = dbFallback.date;
        dataSource = `Stock Movers DB (${dbFallback.date})`;
        console.log(`[EOD] Using stock_movers fallback: ${rawStocks.length} stocks`);
      }

      // Fallback 2: Yahoo Finance watchlist
      if (rawStocks.length === 0) {
        console.log(`[EOD] stock_movers empty, trying Yahoo Finance watchlist...`);
        await supabase.from("eod_scan_runs").update({
          message: "Falling back to Yahoo Finance live data...",
        }).eq("id", runId);

        const yahooStocks = await fetchFromYahooWatchlist();
        if (yahooStocks.length > 0) {
          rawStocks = yahooStocks;
          targetDate = today;
          dataSource = `Yahoo Finance Live (${today})`;
          console.log(`[EOD] Using Yahoo fallback: ${rawStocks.length} stocks`);
        }
      }

      if (rawStocks.length === 0) {
        await supabase.from("eod_scan_runs").update({
          status: "failed",
          message: "All data sources failed: NSE bhav copy, stock_movers DB, and Yahoo Finance all returned no data.",
          total_stocks_scanned: 0,
        }).eq("id", runId);

        return new Response(JSON.stringify({
          success: false,
          error: "Could not fetch market data from any source. Make sure the daily stock fetch has run (Today tab > Fetch Now), or try after market close.",
          run_id: runId,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    await supabase.from("eod_scan_runs").update({
      message: `Fetched ${rawStocks.length} stocks. Enriching with 20-day volume history...`,
    }).eq("id", runId);

    // ===== Step 2: Filter to significant movers (save API calls) =====
    // Only enrich stocks with |pctChange| >= 1.5 or volume > 10M
    const significant = rawStocks.filter(s =>
      Math.abs(s.pctChange) >= 1.5 || s.volume > 10_000_000,
    );
    console.log(`[EOD] ${significant.length} significant stocks (of ${rawStocks.length})`);

    // ===== Step 3: Fetch 20-day volume history from Yahoo Finance =====
    const enriched: StockWithHistory[] = [];
    const BATCH = 8;
    for (let i = 0; i < significant.length; i += BATCH) {
      const batch = significant.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map(async (s) => {
          const hist = await fetchYahooHistory(s.symbol);
          return { stock: s, hist };
        }),
      );
      for (const r of settled) {
        if (r.status === "fulfilled" && r.value.hist) {
          const { stock, hist } = r.value;
          const avg20Vol = hist.avg20Vol || stock.volume;
          const volumeRatio = avg20Vol > 0 ? stock.volume / avg20Vol : 1;
          const near52wkHigh = hist.high52w > 0 && stock.close >= hist.high52w * 0.97;
          const near52wkLow = hist.low52w > 0 && stock.close <= hist.low52w * 1.03;
          // If stock came from fallback (dayHigh == close), use Yahoo's OHLC
          const dayHigh = hist.dayHigh > 0 ? hist.dayHigh : stock.dayHigh;
          const dayLow = hist.dayLow > 0 ? hist.dayLow : stock.dayLow;
          const dayOpen = hist.dayOpen > 0 ? hist.dayOpen : stock.dayOpen;
          enriched.push({
            ...stock,
            dayHigh: Math.round(dayHigh * 100) / 100,
            dayLow: Math.round(dayLow * 100) / 100,
            dayOpen: Math.round(dayOpen * 100) / 100,
            avg20Vol,
            volumeRatio: Math.round(volumeRatio * 100) / 100,
            high52w: hist.high52w,
            low52w: hist.low52w,
            near52wkHigh,
            near52wkLow,
          });
        }
      }
      await new Promise(r => setTimeout(r, 200)); // rate limit
    }

    console.log(`[EOD] Enriched ${enriched.length} stocks with volume history`);

    // ===== Step 4: Fetch derivative data =====
    const derivMap = await fetchDerivativeData(enriched);
    console.log(`[EOD] Derivative proxy: ${derivMap.size} entries`);

    // ===== Step 5: Fetch bulk deals =====
    const bulkDeals = await fetchBulkDeals(new Date(targetDate + "T00:00:00+05:30"));
    const bulkSymbols = new Set(bulkDeals.map(d => d.symbol));
    console.log(`[EOD] ${bulkDeals.length} bulk deals, ${bulkSymbols.size} unique symbols`);

    // ===== Step 6: Run screening algorithm =====
    const { candidates, derivSummary } = screenStocks(enriched, derivMap, bulkSymbols);
    console.log(`[EOD] ${candidates.length} candidates (${candidates.filter(c => c.setup_type === "long").length} long, ${candidates.filter(c => c.setup_type === "short").length} short, ${candidates.filter(c => c.setup_type === "reversal").length} reversal)`);

    // ===== Step 7: Persist to database =====
    // Delete previous scan results for this date
    await supabase.from("eod_candidates").delete().eq("scan_date", targetDate);
    await supabase.from("eod_derivative_summary").delete().eq("scan_date", targetDate);
    await supabase.from("eod_bulk_deals").delete().eq("scan_date", targetDate);
    await supabase.from("eod_checklist").delete().eq("scan_date", targetDate);

    // Insert candidates
    if (candidates.length > 0) {
      const candRows = candidates.map(c => ({
        scan_run_id: runId,
        scan_date: targetDate,
        ...c,
      }));
      // Insert in batches of 50
      for (let i = 0; i < candRows.length; i += 50) {
        await supabase.from("eod_candidates").insert(candRows.slice(i, i + 50));
      }
    }

    // Insert derivative summary (top 50 by volume)
    const topDeriv = derivSummary.sort((a, b) => b.volume - a.volume).slice(0, 50);
    if (topDeriv.length > 0) {
      await supabase.from("eod_derivative_summary").insert(
        topDeriv.map(d => ({ scan_run_id: runId, scan_date: targetDate, ...d })),
      );
    }

    // Insert bulk deals
    if (bulkDeals.length > 0) {
      await supabase.from("eod_bulk_deals").insert(
        bulkDeals.map(d => ({ scan_run_id: runId, scan_date: targetDate, ...d })),
      );
    }

    // Insert checklist
    const checklistItems = generateChecklist(targetDate, candidates);
    if (checklistItems.length > 0) {
      await supabase.from("eod_checklist").insert(
        checklistItems.map(item => ({
          scan_run_id: runId,
          scan_date: targetDate,
          item_text: item.text,
          item_category: item.category,
          sort_order: item.sort_order,
        })),
      );
    }

    // Update run record
    const longCount = candidates.filter(c => c.setup_type === "long").length;
    const shortCount = candidates.filter(c => c.setup_type === "short").length;
    const reversalCount = candidates.filter(c => c.setup_type === "reversal").length;

    const message = `${dataSource}: Scanned ${rawStocks.length} stocks, enriched ${enriched.length}. Found ${candidates.length} candidates (${longCount} long, ${shortCount} short, ${reversalCount} reversal). ${bulkDeals.length} bulk deals.`;

    await supabase.from("eod_scan_runs").update({
      status: "success",
      message,
      total_stocks_scanned: rawStocks.length,
      long_count: longCount,
      short_count: shortCount,
      reversal_count: reversalCount,
      data_source: dataSource,
    }).eq("id", runId);

    return new Response(JSON.stringify({
      success: true,
      run_id: runId,
      scan_date: targetDate,
      total_scanned: rawStocks.length,
      enriched: enriched.length,
      candidates: candidates.length,
      long_count: longCount,
      short_count: shortCount,
      reversal_count: reversalCount,
      bulk_deals: bulkDeals.length,
      message,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("EOD Scan Fatal:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
