import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ===== Stock Universe =====
const FNO_STOCKS: { symbol: string; name: string; sector: string }[] = [
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
  { symbol: "VEDL", name: "Vedanta", sector: "Metals" },
  { symbol: "SBILIFE", name: "SBI Life Insurance", sector: "Insurance" },
  { symbol: "HDFCLIFE", name: "HDFC Life Insurance", sector: "Insurance" },
  { symbol: "M&M", name: "Mahindra & Mahindra", sector: "Auto" },
  { symbol: "SHREECEM", name: "Shree Cement", sector: "Cement" },
  { symbol: "PIDILITIND", name: "Pidilite Industries", sector: "Chemicals" },
  { symbol: "DMART", name: "Avenue Supermarts", sector: "Retail" },
  { symbol: "GODREJCP", name: "Godrej Consumer Products", sector: "FMCG" },
  { symbol: "DABUR", name: "Dabur India", sector: "FMCG" },
  { symbol: "JSWSTEEL", name: "JSW Steel", sector: "Metals" },
  { symbol: "AMBUJACEM", name: "Ambuja Cements", sector: "Cement" },
  { symbol: "ACC", name: "ACC Limited", sector: "Cement" },
  { symbol: "CANBK", name: "Canara Bank", sector: "Banking" },
  { symbol: "PNB", name: "Punjab National Bank", sector: "Banking" },
  { symbol: "BANKBARODA", name: "Bank of Baroda", sector: "Banking" },
  { symbol: "GAIL", name: "GAIL India", sector: "Gas" },
  { symbol: "HAL", name: "Hindustan Aeronautics", sector: "Defence" },
  { symbol: "BEL", name: "Bharat Electronics", sector: "Defence" },
  { symbol: "TATAPOWER", name: "Tata Power", sector: "Energy" },
  { symbol: "TVSMOTOR", name: "TVS Motor Company", sector: "Auto" },
];

const NON_FNO_STOCKS: { symbol: string; name: string; sector: string }[] = [
  { symbol: "CELLO", name: "Cello World", sector: "Consumer" },
  { symbol: "TRENT", name: "Trent Limited", sector: "Retail" },
  { symbol: "NAUKRI", name: "Info Edge (Naukri)", sector: "Internet" },
  { symbol: "ZOMATO", name: "Zomato", sector: "Internet" },
  { symbol: "IRCTC", name: "IRCTC", sector: "Infrastructure" },
  { symbol: "POLYCAB", name: "Polycab India", sector: "Electricals" },
  { symbol: "HAVELLS", name: "Havells India", sector: "Consumer" },
  { symbol: "MARICO", name: "Marico", sector: "FMCG" },
  { symbol: "BERGEPAINT", name: "Berger Paints", sector: "Paints" },
  { symbol: "COLPAL", name: "Colgate-Palmolive India", sector: "FMCG" },
  { symbol: "PAGEIND", name: "Page Industries", sector: "Consumer" },
  { symbol: "VOLTAS", name: "Voltas", sector: "Consumer" },
  { symbol: "CROMPTON", name: "Crompton Greaves", sector: "Consumer" },
  { symbol: "DIXON", name: "Dixon Technologies", sector: "Electronics" },
  { symbol: "ASTRAL", name: "Astral Limited", sector: "Pipes" },
  { symbol: "MUTHOOTFIN", name: "Muthoot Finance", sector: "NBFC" },
  { symbol: "LICHSGFIN", name: "LIC Housing Finance", sector: "NBFC" },
  { symbol: "BANDHANBNK", name: "Bandhan Bank", sector: "Banking" },
  { symbol: "IDFCFIRSTB", name: "IDFC First Bank", sector: "Banking" },
  { symbol: "FEDERALBNK", name: "Federal Bank", sector: "Banking" },
  { symbol: "NMDC", name: "NMDC", sector: "Metals" },
  { symbol: "SAIL", name: "Steel Authority of India", sector: "Metals" },
  { symbol: "SUZLON", name: "Suzlon Energy", sector: "Energy" },
  { symbol: "RVNL", name: "Rail Vikas Nigam", sector: "Infrastructure" },
  { symbol: "IRFC", name: "Indian Railway Finance", sector: "Financials" },
  { symbol: "NHPC", name: "NHPC", sector: "Energy" },
  { symbol: "RECLTD", name: "REC Limited", sector: "Financials" },
  { symbol: "PFC", name: "Power Finance Corp", sector: "Financials" },
  { symbol: "PAYTM", name: "One 97 Communications", sector: "Fintech" },
  { symbol: "NYKAA", name: "FSN E-Commerce (Nykaa)", sector: "E-Commerce" },
  { symbol: "DELHIVERY", name: "Delhivery", sector: "Logistics" },
  { symbol: "JUBLFOOD", name: "Jubilant FoodWorks", sector: "Retail" },
  { symbol: "MAXHEALTH", name: "Max Healthcare", sector: "Healthcare" },
  { symbol: "FORTIS", name: "Fortis Healthcare", sector: "Healthcare" },
  { symbol: "LALPATHLAB", name: "Dr Lal PathLabs", sector: "Healthcare" },
  { symbol: "METROPOLIS", name: "Metropolis Healthcare", sector: "Healthcare" },
  { symbol: "TORNTPHARM", name: "Torrent Pharmaceuticals", sector: "Pharma" },
  { symbol: "ALKEM", name: "Alkem Laboratories", sector: "Pharma" },
  { symbol: "ABBOTINDIA", name: "Abbott India", sector: "Pharma" },
  { symbol: "BIOCON", name: "Biocon", sector: "Pharma" },
  { symbol: "LUPIN", name: "Lupin", sector: "Pharma" },
  { symbol: "DLF", name: "DLF Limited", sector: "Real Estate" },
  { symbol: "GODREJPROP", name: "Godrej Properties", sector: "Real Estate" },
  { symbol: "OBEROIRLTY", name: "Oberoi Realty", sector: "Real Estate" },
  { symbol: "CONCOR", name: "Container Corp of India", sector: "Infrastructure" },
  { symbol: "BHEL", name: "Bharat Heavy Electricals", sector: "Capital Goods" },
  { symbol: "CUMMINSIND", name: "Cummins India", sector: "Capital Goods" },
  { symbol: "BALKRISIND", name: "Balkrishna Industries", sector: "Tyres" },
  { symbol: "ENDURANCE", name: "Endurance Technologies", sector: "Auto" },
  { symbol: "ESCORTS", name: "Escorts Kubota", sector: "Auto" },
  { symbol: "MOTHERSON", name: "Samvardhana Motherson", sector: "Auto" },
];

interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  isFno: boolean;
}

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ScanResultRow {
  symbol: string;
  company_name: string;
  sector: string;
  is_fno: boolean;
  current_price: number;
  prev_high: number;
  prev_low: number;
  prev_close: number;
  pivot_level: number;
  s1_level: number;
  distance_to_s1_pct: number;
  volume: number;
  avg_volume: number;
  volume_ratio: number;
  signal_status: string;
  daily_high: number;
  daily_low: number;
  daily_open: number;
  crossed_s1_today: boolean;
  candles: CandleData[];
}

async function fetchYahooData(symbol: string): Promise<{
  currentPrice: number;
  prevHigh: number;
  prevLow: number;
  prevClose: number;
  dailyOpen: number;
  dailyHigh: number;
  dailyLow: number;
  volume: number;
  avgVolume: number;
  candles: CandleData[];
} | null> {
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
    if (timestamps.length < 3) return null;

    // Build aligned candle array
    const candles: CandleData[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = quotes?.open?.[i];
      const h = quotes?.high?.[i];
      const l = quotes?.low?.[i];
      const c = quotes?.close?.[i];
      const v = quotes?.volume?.[i];
      if (o != null && o > 0 && h != null && h > 0 && l != null && l > 0 && c != null && c > 0 && v != null && v > 0) {
        candles.push({ time: timestamps[i] * 1000, open: o, high: h, low: l, close: c, volume: v });
      }
    }
    if (candles.length < 3) return null;

    const today = candles[candles.length - 1];
    const prev = candles[candles.length - 2];

    const last20Vols = candles.slice(-21, -1).map(c => c.volume);
    const avgVolume = last20Vols.length > 0
      ? Math.round(last20Vols.reduce((a, b) => a + b, 0) / last20Vols.length)
      : today.volume;

    return {
      currentPrice: Math.round(today.close * 100) / 100,
      prevHigh: prev.high,
      prevLow: prev.low,
      prevClose: prev.close,
      dailyOpen: today.open,
      dailyHigh: today.high,
      dailyLow: today.low,
      volume: today.volume,
      avgVolume,
      candles: candles.slice(-60),
    };
  } catch {
    return null;
  }
}

function computeFibS1(prevHigh: number, prevLow: number, prevClose: number): { pivot: number; s1: number } {
  const pivot = (prevHigh + prevLow + prevClose) / 3;
  const s1 = pivot - 0.382 * (prevHigh - prevLow);
  return {
    pivot: Math.round(pivot * 100) / 100,
    s1: Math.round(s1 * 100) / 100,
  };
}

function classifySignal(
  currentPrice: number,
  s1: number,
  dailyOpen: number,
  dailyLow: number,
  bufferPct: number,
): { status: string; crossedToday: boolean; distancePct: number } {
  const distancePct = Math.round(((currentPrice - s1) / s1) * 10000) / 100;
  const buffer = s1 * (bufferPct / 100);

  // Crossed S1 today: opened above S1 and low went below S1
  const crossedToday = dailyOpen > s1 && dailyLow <= s1;

  // Near S1: within ±buffer% of S1
  const nearS1 = Math.abs(currentPrice - s1) <= buffer;

  let status = "Above S1";
  if (currentPrice < s1) {
    status = crossedToday ? "Crossed S1" : "Below S1";
  } else if (nearS1) {
    status = "Near S1";
  }

  return { status, crossedToday, distancePct };
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
    const bufferPct: number = body.buffer_pct ?? 1.0;

    const { data: runRow, error: runError } = await supabase
      .from("s1_scan_runs")
      .insert({ status: "running", message: "Starting S1 scanner...", triggered_by: triggeredBy })
      .select().single();
    if (runError) throw runError;
    const runId = runRow.id;

    const allStocks: StockInfo[] = [
      ...FNO_STOCKS.map(s => ({ ...s, isFno: true })),
      ...NON_FNO_STOCKS.map(s => ({ ...s, isFno: false })),
    ];

    const results: ScanResultRow[] = [];
    const BATCH = 6;

    for (let i = 0; i < allStocks.length; i += BATCH) {
      const batch = allStocks.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map(async (stock) => {
          const data = await fetchYahooData(stock.symbol);
          if (!data) return null;

          const { pivot, s1 } = computeFibS1(data.prevHigh, data.prevLow, data.prevClose);
          const { status, crossedToday, distancePct } = classifySignal(
            data.currentPrice, s1, data.dailyOpen, data.dailyLow, bufferPct,
          );

          // Store all stocks within ±5% of S1 OR that crossed S1 today
          // The frontend buffer slider will narrow this down
          const near = Math.abs(distancePct) <= 5.0 || crossedToday;
          if (!near) return null;

          return {
            symbol: stock.symbol,
            company_name: stock.name,
            sector: stock.sector,
            is_fno: stock.isFno,
            current_price: data.currentPrice,
            prev_high: Math.round(data.prevHigh * 100) / 100,
            prev_low: Math.round(data.prevLow * 100) / 100,
            prev_close: Math.round(data.prevClose * 100) / 100,
            pivot_level: pivot,
            s1_level: s1,
            distance_to_s1_pct: distancePct,
            volume: data.volume,
            avg_volume: data.avgVolume,
            volume_ratio: Math.round((data.volume / data.avgVolume) * 100) / 100,
            signal_status: status,
            daily_high: Math.round(data.dailyHigh * 100) / 100,
            daily_low: Math.round(data.dailyLow * 100) / 100,
            daily_open: Math.round(data.dailyOpen * 100) / 100,
            crossed_s1_today: crossedToday,
            candles: data.candles,
          } as ScanResultRow;
        }),
      );

      for (const r of settled) {
        if (r.status === "fulfilled" && r.value) results.push(r.value);
      }
      await new Promise(r => setTimeout(r, 120));
    }

    console.log(`[S1] Matched ${results.length} stocks near S1`);

    if (results.length === 0) {
      await supabase.from("s1_scan_runs").update({
        status: "success",
        message: "Scan complete. No stocks near S1 today.",
        stocks_scanned: allStocks.length,
        matched_count: 0,
      }).eq("id", runId);
      return new Response(JSON.stringify({
        success: true,
        run_id: runId,
        stocks_scanned: allStocks.length,
        matched: 0,
        message: "No stocks near S1 today.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sort by distance to S1 (closest first)
    results.sort((a, b) => Math.abs(a.distance_to_s1_pct) - Math.abs(b.distance_to_s1_pct));

    const crossedCount = results.filter(r => r.crossed_s1_today).length;
    const nearCount = results.filter(r => !r.crossed_s1_today).length;

    // Delete old results for this run
    await supabase.from("s1_scan_results").delete().eq("scan_run_id", runId);

    // Insert results in batches
    const rows = results.map(r => ({
      scan_run_id: runId,
      symbol: r.symbol,
      company_name: r.company_name,
      sector: r.sector,
      is_fno: r.is_fno,
      current_price: r.current_price,
      prev_high: r.prev_high,
      prev_low: r.prev_low,
      prev_close: r.prev_close,
      pivot_level: r.pivot_level,
      s1_level: r.s1_level,
      distance_to_s1_pct: r.distance_to_s1_pct,
      volume: r.volume,
      avg_volume: r.avg_volume,
      volume_ratio: r.volume_ratio,
      signal_status: r.signal_status,
      daily_high: r.daily_high,
      daily_low: r.daily_low,
      daily_open: r.daily_open,
      crossed_s1_today: r.crossed_s1_today,
      candles: JSON.stringify(r.candles),
    }));

    for (let i = 0; i < rows.length; i += 50) {
      await supabase.from("s1_scan_results").insert(rows.slice(i, i + 50));
    }

    await supabase.from("s1_scan_runs").update({
      status: "success",
      message: `Scan complete. ${results.length} stocks matched S1 criteria.`,
      stocks_scanned: allStocks.length,
      matched_count: results.length,
      crossed_count: crossedCount,
      near_count: nearCount,
    }).eq("id", runId);

    return new Response(JSON.stringify({
      success: true,
      run_id: runId,
      stocks_scanned: allStocks.length,
      matched: results.length,
      crossed: crossedCount,
      near: nearCount,
      message: `Scan complete: ${results.length} stocks near S1`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("S1 Scanner Fatal:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
