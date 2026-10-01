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

    // Fetch all PENDING trade list items that have a target price
    const { data: pending, error: fetchError } = await supabase
      .from("trade_list")
      .select("*")
      .eq("target_status", "PENDING")
      .not("target_price", "is", null);

    if (fetchError) throw fetchError;
    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending targets to verify", verified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let verified = 0;
    let skipped = 0;
    const now = new Date();

    for (const trade of pending) {
      // Only verify if at least 1 calendar day has passed since created_at
      const createdDate = new Date(trade.created_at);
      const daysSince = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince < 1) {
        skipped++;
        continue;
      }

      const yahooSymbol = trade.ticker.includes(".")
        ? trade.ticker.toUpperCase()
        : `${trade.ticker.toUpperCase()}.NS`;

      try {
        // Fetch 5 days of daily candles to check if target or stop was hit
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=5d`;
        const response = await fetch(yahooUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });

        if (!response.ok) {
          console.error(`Yahoo API error for ${trade.ticker}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];
        if (!result) continue;

        const timestamps: number[] = result.timestamp || [];
        const highs: (number | null)[] = result.indicators?.quote?.[0]?.high || [];
        const lows: (number | null)[] = result.indicators?.quote?.[0]?.low || [];
        const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];

        const createdDateStr = createdDate.toISOString().split("T")[0];

        // Check candles after the trade was created
        let targetHit = false;
        let stopHit = false;
        let lastClose: number | null = null;
        let lastDate: string | null = null;

        for (let i = 0; i < timestamps.length; i++) {
          const tsDate = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
          if (tsDate <= createdDateStr) continue;
          if (highs[i] == null || lows[i] == null) continue;

          lastClose = closes[i];
          lastDate = tsDate;

          if (trade.direction === "LONG") {
            // Target hit if high >= target_price
            if (trade.target_price != null && highs[i]! >= trade.target_price) {
              targetHit = true;
            }
            // Stop hit if low <= suggested_stop
            if (trade.suggested_stop != null && lows[i]! <= trade.suggested_stop) {
              stopHit = true;
            }
          } else {
            // SHORT: target hit if low <= target_price
            if (trade.target_price != null && lows[i]! <= trade.target_price) {
              targetHit = true;
            }
            // Stop hit if high >= suggested_stop
            if (trade.suggested_stop != null && highs[i]! >= trade.suggested_stop) {
              stopHit = true;
            }
          }
        }

        if (lastDate == null) continue;

        // Determine final status — stop takes priority (risk management first)
        let status: string;
        if (stopHit && !targetHit) {
          status = "STOP_HIT";
        } else if (targetHit && !stopHit) {
          status = "TARGET_HIT";
        } else if (targetHit && stopHit) {
          // Both hit on same day — conservative: assume stop first
          status = "STOP_HIT";
        } else if (daysSince >= 5) {
          // Neither hit after 5 trading days — expired
          status = "EXPIRED";
        } else {
          // Still pending — not enough days yet
          continue;
        }

        await supabase
          .from("trade_list")
          .update({
            target_status: status,
            target_checked_at: new Date().toISOString(),
          })
          .eq("id", trade.id);

        verified++;
      } catch (err) {
        console.error(`Failed to verify ${trade.ticker}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified,
        skipped,
        total: pending.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Verify trade targets error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
