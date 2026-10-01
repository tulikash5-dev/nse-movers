import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get("symbol");
    const interval = url.searchParams.get("interval") || "15m";
    const range = url.searchParams.get("range") || "5d";

    if (!symbol) {
      return new Response(
        JSON.stringify({ error: "Symbol parameter required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform Indian symbol to Yahoo format if needed
    const yahooSymbol = symbol.includes(".")
      ? symbol.toUpperCase()
      : `${symbol.toUpperCase()}.NS`;

    // Fetch from Yahoo Finance
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${range}`;

    const response = await fetch(yahooUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Yahoo API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Yahoo Finance error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Parse and transform the data
    const result = data.chart?.result?.[0];
    if (!result) {
      return new Response(
        JSON.stringify({ error: "No data available from Yahoo Finance" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const meta = result.meta || {};

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (
        quotes.open?.[i] != null &&
        quotes.high?.[i] != null &&
        quotes.low?.[i] != null &&
        quotes.close?.[i] != null
      ) {
        candles.push({
          time: new Date(timestamps[i] * 1000).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Kolkata",
          }),
          timestamp: timestamps[i],
          open: quotes.open[i],
          high: quotes.high[i],
          low: quotes.low[i],
          close: quotes.close[i],
          volume: quotes.volume?.[i] || 0,
        });
      }
    }

    const responseData = {
      symbol,
      yahooSymbol,
      meta: {
        currency: meta.currency,
        exchange: meta.exchangeName,
        instrumentType: meta.instrumentType,
        regularMarketPrice: meta.regularMarketPrice,
        previousClose: meta.previousClosePrice,
      },
      candles,
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
