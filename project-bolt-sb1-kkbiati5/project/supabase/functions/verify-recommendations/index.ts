import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all pending recommendations
    const { data: pending, error: fetchError } = await supabase
      .from("volume_recommendations")
      .select("*")
      .eq("status", "PENDING");

    if (fetchError) throw fetchError;
    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending recommendations to verify", verified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let verified = 0;
    let skipped = 0;
    const today = new Date().toISOString().split("T")[0];

    for (const rec of pending) {
      // Only verify if at least 1 calendar day has passed since scan_date
      const scanDate = new Date(rec.scan_date);
      const now = new Date();
      const daysSince = Math.floor((now.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince < 1) {
        skipped++;
        continue;
      }

      // Fetch latest price from Yahoo Finance
      const yahooSymbol = rec.ticker.includes(".")
        ? rec.ticker.toUpperCase()
        : `${rec.ticker.toUpperCase()}.NS`;

      try {
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`;
        const response = await fetch(yahooUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });

        if (!response.ok) {
          console.error(`Yahoo API error for ${rec.ticker}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];
        if (!result) continue;

        const timestamps: number[] = result.timestamp || [];
        const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];

        // Find the most recent close that is after scan_date
        let verifyPrice: number | null = null;
        let verifyDate: string | null = null;
        for (let i = timestamps.length - 1; i >= 0; i--) {
          const tsDate = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
          if (tsDate > rec.scan_date && closes[i] != null) {
            verifyPrice = closes[i];
            verifyDate = tsDate;
            break;
          }
        }

        if (verifyPrice == null || verifyDate == null) continue;

        // Determine outcome
        const entry = rec.entry_price;
        const stop = rec.suggested_stop;
        let status: string;
        let pnlPct: number;

        if (rec.action === "LONG") {
          pnlPct = ((verifyPrice - entry) / entry) * 100;
          if (stop != null && verifyPrice <= stop) {
            status = "STOPPED";
          } else if (verifyPrice > entry) {
            status = "CORRECT";
          } else {
            status = "WRONG";
          }
        } else {
          // SHORT
          pnlPct = ((entry - verifyPrice) / entry) * 100;
          if (stop != null && verifyPrice >= stop) {
            status = "STOPPED";
          } else if (verifyPrice < entry) {
            status = "CORRECT";
          } else {
            status = "WRONG";
          }
        }

        await supabase
          .from("volume_recommendations")
          .update({
            status,
            verification_date: verifyDate,
            verification_price: verifyPrice,
            pnl_pct: Math.round(pnlPct * 100) / 100,
          })
          .eq("id", rec.id);

        verified++;
      } catch (err) {
        console.error(`Failed to verify ${rec.ticker}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified,
        skipped,
        total: pending.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Verify error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
