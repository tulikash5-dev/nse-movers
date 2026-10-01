import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Company name and sector lookup tables for display purposes
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
  "INDUSINDBK": "IndusInd Bank", "DIVISLAB": "Divi's Laboratories",
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

interface StockResult {
  symbol: string;
  company_name: string;
  exchange: string;
  price: number;
  prev_close: number;
  pct_change: number;
  volume: number;
  sector: string | null;
  industry: string | null;
}

// NSE CM bhav copy ZIP (official end-of-day data for ALL listed equities)
// URL: https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{YYYYMMDD}_F_0000.csv.zip
// CSV cols (0-indexed): 7=TckrSymb, 8=SctySrs, 17=ClsPric, 19=PrvsClsgPric, 24=TtlTradgVol
async function fetchNSEBhavCopy(date: Date): Promise<StockResult[]> {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}${mm}${dd}`;
  const url = `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${dateStr}_F_0000.csv.zip`;

  console.log(`[NSE] Fetching ${url}`);
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/zip,*/*",
      "Referer": "https://www.nseindia.com/",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!resp.ok) throw new Error(`NSE bhav copy HTTP ${resp.status} for ${dateStr}`);

  const buffer = await resp.arrayBuffer();
  const zipData = new Uint8Array(buffer);

  // Decompress ZIP using fflate
  const files = unzipSync(zipData);
  const csvFilename = Object.keys(files).find(f => f.endsWith(".csv"));
  if (!csvFilename) throw new Error("No CSV file found in NSE bhav copy ZIP");

  const csvText = new TextDecoder("utf-8").decode(files[csvFilename]);
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) throw new Error("NSE bhav copy CSV is empty");

  console.log(`[NSE] ${lines.length - 1} rows, parsing EQ series...`);

  const results: StockResult[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 25) continue;

    const segment = cols[2].trim().toUpperCase();   // Sgmt: CM, SME, DV, etc.
    const symbol = cols[7].trim().toUpperCase();
    const series = cols[8].trim().toUpperCase();

    // Only include CM (Capital Markets) segment EQ series - excludes SME, Debt, etc.
    if (segment !== "CM") continue;
    if (series !== "EQ") continue;

    const closePrice = parseFloat(cols[17]);
    const prevClose = parseFloat(cols[19]);
    const volume = parseInt(cols[24]) || 0;

    if (isNaN(closePrice) || isNaN(prevClose)) continue;
    if (closePrice <= 0 || prevClose <= 0) continue;

    const pctChange = ((closePrice - prevClose) / prevClose) * 100;
    const nseSymbol = symbol + ".NS";

    results.push({
      symbol: nseSymbol,
      company_name: COMPANY_NAMES[symbol] ?? symbol,
      exchange: "NSE",
      price: Math.round(closePrice * 100) / 100,
      prev_close: Math.round(prevClose * 100) / 100,
      pct_change: Math.round(pctChange * 10000) / 10000,
      volume,
      sector: SECTORS[symbol] ?? null,
      industry: null,
    });
  }

  console.log(`[NSE] ${results.length} EQ stocks parsed`);
  return results;
}

// Returns IST date object from current UTC time
function getISTNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const triggeredBy: string = body.triggered_by ?? "scheduler";
    const backfill: boolean = body.backfill === true;
    const backfillFrom: string | undefined = body.backfill_from;
    const backfillTo: string | undefined = body.backfill_to;

    // Read current threshold setting
    const { data: settingRow } = await supabase
      .from("app_settings").select("value").eq("key", "threshold_pct").maybeSingle();
    const threshold = parseFloat(settingRow?.value ?? "3");

    const istNow = getISTNow();
    const today = toDateStr(istNow);

    // Create a run record
    const { data: runRow, error: runError } = await supabase
      .from("scheduler_runs")
      .insert({ status: "running", message: backfill ? "Backfilling missing dates..." : "Fetching NSE bhav copy...", threshold_used: threshold, triggered_by: triggeredBy })
      .select().single();
    if (runError) throw runError;
    const runId = runRow.id;

    console.log(`[${runId}] date=${today} threshold=±${threshold}% backfill=${backfill}`);

    // ===== BACKFILL MODE: fetch a range of dates =====
    if (backfill) {
      // Determine date range
      let fromDate: Date;
      let toDate: Date;

      if (backfillFrom && backfillTo) {
        fromDate = new Date(backfillFrom + "T00:00:00+05:30");
        toDate = new Date(backfillTo + "T00:00:00+05:30");
      } else {
        // Auto-detect: find the latest date in DB, backfill from there to today
        const { data: latestRow } = await supabase
          .from("stock_movers")
          .select("date")
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestRow?.date) {
          // Start from the day AFTER the last fetched date
          fromDate = new Date(latestRow.date + "T00:00:00+05:30");
          fromDate.setDate(fromDate.getDate() + 1);
        } else {
          // No data at all - backfill last 30 days
          fromDate = new Date(istNow);
          fromDate.setDate(fromDate.getDate() - 30);
        }
        toDate = new Date(istNow);
      }

      // Build list of trading days (skip weekends)
      const tradingDays: Date[] = [];
      const cursor = new Date(fromDate);
      while (cursor <= toDate) {
        const dow = cursor.getDay();
        if (dow !== 0 && dow !== 6) {
          tradingDays.push(new Date(cursor));
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      console.log(`[${runId}] Backfill: ${tradingDays.length} trading days from ${toDateStr(fromDate)} to ${toDateStr(toDate)}`);

      // Check which dates already have data (skip them)
      const dateStrings = tradingDays.map(d => toDateStr(d));
      const { data: existingDates } = await supabase
        .from("stock_movers")
        .select("date")
        .in("date", dateStrings)
        .order("date", { ascending: false });

      const existingDateSet = new Set((existingDates ?? []).map(r => r.date));
      const missingDays = tradingDays.filter(d => !existingDateSet.has(toDateStr(d)));

      console.log(`[${runId}] ${existingDateSet.size} dates already have data, ${missingDays.length} to fetch`);

      let totalFetched = 0;
      let totalGainers = 0;
      let totalLosers = 0;
      let datesSucceeded = 0;
      let datesFailed = 0;
      const failedDates: string[] = [];

      for (const day of missingDays) {
        const dayStr = toDateStr(day);
        try {
          const results = await fetchNSEBhavCopy(day);
          if (results.length <= 500) {
            console.log(`[${runId}] ${dayStr}: only ${results.length} stocks, skipping (likely holiday)`);
            continue;
          }

          const dayGainers = results.filter(s => s.pct_change >= threshold);
          const dayLosers = results.filter(s => s.pct_change <= -threshold);

          const rows = [
            ...dayGainers.map(s => ({ ...s, date: dayStr, mover_type: "gainer" })),
            ...dayLosers.map(s => ({ ...s, date: dayStr, mover_type: "loser" })),
          ];

          if (rows.length > 0) {
            const { error: upsertErr } = await supabase
              .from("stock_movers").upsert(rows, { onConflict: "date,symbol" });
            if (upsertErr) throw upsertErr;
          }

          totalFetched += results.length;
          totalGainers += dayGainers.length;
          totalLosers += dayLosers.length;
          datesSucceeded++;
          console.log(`[${runId}] ${dayStr}: ${results.length} stocks, ${dayGainers.length} gainers, ${dayLosers.length} losers`);
        } catch (e) {
          console.log(`[${runId}] ${dayStr} failed: ${e}`);
          datesFailed++;
          failedDates.push(dayStr);
        }

        // Rate limit between requests
        await new Promise(r => setTimeout(r, 500));
      }

      const status = datesSucceeded > 0 ? (datesFailed > 0 ? "partial" : "success") : "failed";
      const message = `Backfill ${toDateStr(fromDate)}→${toDateStr(toDate)}: ${datesSucceeded} dates fetched, ${datesFailed} failed${failedDates.length > 0 ? ` (${failedDates.join(", ")})` : ""}. ${totalGainers} gainers, ${totalLosers} losers.`;

      await supabase.from("scheduler_runs").update({
        status, message,
        stocks_fetched: totalFetched,
        gainers_count: totalGainers,
        losers_count: totalLosers,
      }).eq("id", runId);

      return new Response(JSON.stringify({
        success: datesSucceeded > 0,
        run_id: runId,
        dates_succeeded: datesSucceeded,
        dates_failed: datesFailed,
        failed_dates: failedDates,
        stocks_fetched: totalFetched,
        gainers_count: totalGainers,
        losers_count: totalLosers,
        message,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== NORMAL MODE: fetch latest available date =====
    let allResults: StockResult[] = [];
    let dataSource = "";
    let targetDate = today;

    // Try today first, then fall back up to 4 previous trading days
    // (handles weekends, holidays, and early-day fetches before bhav is published)
    for (let offset = 0; offset <= 4; offset++) {
      const tryDate = new Date(istNow);
      tryDate.setDate(tryDate.getDate() - offset);
      const tryDateStr = toDateStr(tryDate);

      // Skip weekends (Saturday=6, Sunday=0)
      const dow = tryDate.getDay();
      if (dow === 0 || dow === 6) continue;

      try {
        const results = await fetchNSEBhavCopy(tryDate);
        if (results.length > 500) {
          allResults = results;
          targetDate = tryDateStr;
          dataSource = offset === 0
            ? "NSE CM Bhav Copy (today)"
            : `NSE CM Bhav Copy (${tryDateStr})`;
          console.log(`[${runId}] Got ${results.length} stocks from ${tryDateStr}`);
          break;
        } else {
          console.log(`[${runId}] ${tryDateStr}: only ${results.length} stocks, skipping`);
        }
      } catch (e) {
        console.log(`[${runId}] ${tryDateStr} failed: ${e}`);
      }

      await new Promise(r => setTimeout(r, 300));
    }

    if (allResults.length === 0) {
      await supabase.from("scheduler_runs").update({
        status: "failed",
        message: "NSE bhav copy unavailable for today and last 4 trading days. Try again after 4:30 PM IST.",
        stocks_fetched: 0, gainers_count: 0, losers_count: 0,
      }).eq("id", runId);

      return new Response(JSON.stringify({
        success: false,
        error: "NSE bhav copy not yet available. The bhav copy is published after market close (~4:30–5:30 PM IST on weekdays).",
        run_id: runId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Filter by threshold
    const gainers = allResults.filter(s => s.pct_change >= threshold);
    const losers = allResults.filter(s => s.pct_change <= -threshold);

    console.log(`[${runId}] ${allResults.length} stocks → ${gainers.length} gainers, ${losers.length} losers`);

    // Upsert to database (use targetDate so historical fetches store correctly)
    const rows = [
      ...gainers.map(s => ({ ...s, date: targetDate, mover_type: "gainer" })),
      ...losers.map(s => ({ ...s, date: targetDate, mover_type: "loser" })),
    ];

    if (rows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("stock_movers").upsert(rows, { onConflict: "date,symbol" });
      if (upsertErr) throw upsertErr;
    }

    await supabase.from("app_settings").upsert({ key: "last_fetch_date", value: targetDate });

    const message = `${dataSource}: ${allResults.length} EQ stocks. ${gainers.length} gainers (+≥${threshold}%), ${losers.length} losers (-≥${threshold}%).`;

    await supabase.from("scheduler_runs").update({
      status: "success", message,
      stocks_fetched: allResults.length,
      gainers_count: gainers.length,
      losers_count: losers.length,
    }).eq("id", runId);

    return new Response(JSON.stringify({
      success: true, run_id: runId, date: targetDate, threshold,
      stocks_fetched: allResults.length, gainers_count: gainers.length,
      losers_count: losers.length, data_source: dataSource, message,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Fatal:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
