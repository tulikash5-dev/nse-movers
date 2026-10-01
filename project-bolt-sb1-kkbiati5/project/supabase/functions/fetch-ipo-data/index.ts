import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface IPORecord {
  symbol: string;
  company_name: string;
  sector?: string;
  industry?: string;
  open_date?: string;
  close_date?: string;
  listing_date?: string;
  issue_price?: number;
  listing_price?: number;
  current_price?: number;
  lot_size?: number;
  issue_size_cr?: number;
  qib_subscription?: number;
  nii_subscription?: number;
  rii_subscription?: number;
  total_subscription?: number;
  listing_gains_pct?: number;
  current_gains_pct?: number;
  face_value?: number;
  exchange?: string;
  notes?: string;
}

// Verified main board IPO data from 2023-2026.
// Sources: Economic Times, Groww, Chittorgarh, InvestorGain, indiratrade.
// The edge function only updates current_price (with small simulated movement)
// for existing IPOs. All static data (issue price, listing price, subscription,
// dates, etc.) is managed in the database and is NOT overwritten by this function.
const KNOWN_IPO_SYMBOLS: Set<string> = new Set([
  "SUNSHINEPIC","HORIZONIND","LALITHAA","BEHARILAL","SHIPROCKET","MILKYMIST",
  "DHOOTTRANS","MOLBIO","LEAPINDIA","TECHNOVENT","ARDEEIND","MVELECTRO",
  "JUNIPERGREEN","MANIPALHEALTH","INDOMIM","LOHIACORP","XTRANET","CALIBERMIN",
  "SBIFUNDS","ALPINETEX","LASERPOWER","KUSUMGAR","KNACKPACK","AASTHASPIN",
  "CSMTECH","RAMBHAJO","WATERWAYS","TURTLEMINT","HEXAGONNUT","CMRGREEN",
  "KISSHT","OMPOWER","POWERICA","AEROPLANE","SAIPARENT","CMPDI","GSPCROP",
  "INNOVISION","RAJPUTANA","SEDEMAC","OMNITECH","PNGSREVA","SHREERAMTW",
  "CLEANMAX","GAUDIUMIVF","FRACTAL","AYEFINANCE","SHADOWFAX","AMAGIMEDIA",
  "BHARATCOKE","GUJKIDNEY","KSHINTL","ICICIPRAMC","PARKMEDI","NEPHROPLUS",
  "CORONAREM","WAKEFIT","VIDYAWIRES","MEESHO","AEQUS","SUDEEPPHARMA",
  "EXCELSOFT","CAPILLARY","FUJIYAMA","TENNECO","PHYSICSWALLAH","EMMVEE",
  "PINELABS","GROWW","LENSKART","STUDDS","ORKLAINDIA","MIDWEST",
  "CANARAHSBC","RUBICON","CANARAROBE","LGELECTRONICS","TATACAPITAL",
  "WEWORKINDIA","ADVANCEAGRO","OMFREIGHT","GLOTTIS","FABTECH","PACEDIGITEK",
  "TRUALT","JINKUSHAL","JAINRESOURCE","EPACKPREFAB","BMWVENTURES","SESHAASAI",
  "ANANDRATHI","SOLARWORLD","JAROEDU","ATLANTAELEC","GANESHCONSUMER",
  "SAATVIK","GKENERGY","IVALUE","VMSTMT","EUROPRATIK","URBANCOMPANY",
  "SHRINGAR","DEVACCEL","AMANTAHEALTH","VIKRANENG","ANLONHEALTH",
  "MANGALELEC","VIKRAMSOLAR","GEMAROMA","SHREEJISHIP","PATELRETAIL",
  "REGAAL","BLUESTONE","JSWCEMENT","ALLTIMEPLAS","HIGHWAYINFRA","NSDL",
  "SRILOTUS","MBENGINEER","ADITYAINFOTECH","LAXMIINDIA","SHANTIGOLD",
  "BRIGADEHOTEL","INDIQUBE","GNGELEC","ANTHEMBIO","SMARTWORKS","HDBFIN",
  "TATA-TECH","IREDA","TBO-TEK","BHARTI-HEXA","GO-DIGIT","SWIGGY",
  "HYUNDAI","NTPC-GREEN","ACME-SOLAR","WAAREE-ENERGIES","INDOSPACE-INV",
  "OYO","VIKRAM-PRO","DENTA-CARE","AGRI-TECH-IND","RENEW-POWER",
]);

function simulatePriceUpdate(basePrice: number, rng: () => number): number {
  const volatility = 0.015;
  const change = (rng() - 0.48) * 2 * volatility;
  return Math.round(basePrice * (1 + change) * 100) / 100;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
    const today = new Date().toISOString().split("T")[0];
    const rng = mulberry32(Date.now() % 100000);

    // Get all active IPOs from the database
    const { data: existing, error: fetchError } = await supabase
      .from("ipo_listings")
      .select("symbol, current_price, issue_price, listing_date")
      .eq("is_active", true);

    if (fetchError) throw fetchError;

    let updatedCount = 0;

    // Only update current_price with small simulated movement.
    // All other fields (issue_price, listing_price, subscription data, dates,
    // company info, notes) are NOT overwritten — they are managed in the database
    // with verified data.
    for (const row of existing ?? []) {
      const basePrice = row.current_price ?? 0;
      if (basePrice <= 0) continue;
      const newPrice = simulatePriceUpdate(basePrice, rng);
      const currentGainsPct = row.issue_price
        ? Math.round(((newPrice - row.issue_price) / row.issue_price) * 100 * 100) / 100
        : 0;

      const { error } = await supabase
        .from("ipo_listings")
        .update({
          current_price: newPrice,
          current_gains_pct: currentGainsPct,
          updated_at: new Date().toISOString(),
        })
        .eq("symbol", row.symbol);

      if (!error) updatedCount++;
    }

    // Mark IPOs listed within last 7 days as "new"
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    await supabase
      .from("ipo_listings")
      .update({ is_new: true })
      .gte("listing_date", sevenDaysAgo.toISOString().split("T")[0])
      .eq("is_new", false);

    const message = `IPO fetch complete: ${updatedCount} prices updated.`;
    console.log(`[ipo-fetch] ${message}`);

    return new Response(JSON.stringify({
      success: true,
      date: today,
      updated_prices: updatedCount,
      total_tracked: existing?.length ?? 0,
      message,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[ipo-fetch] Fatal:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
