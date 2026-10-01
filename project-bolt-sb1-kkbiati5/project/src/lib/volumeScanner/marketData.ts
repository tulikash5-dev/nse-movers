import type { Candle } from "./types";

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yahoo-finance-proxy`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Cache fetched candles for the session — keyed by symbol
const candleCache = new Map<string, { candles: Candle[]; fetchedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchRealCandles(symbol: string, range = "2y", interval = "1d"): Promise<Candle[]> {
  const cached = candleCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.candles;
  }

  const url = `${PROXY_URL}?symbol=${encodeURIComponent(symbol)}&interval=${interval}&range=${range}`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch ${symbol}: ${resp.status}`);
  }

  const data = await resp.json();
  const candles: Candle[] = (data.candles ?? [])
    .map((c: { time: string; timestamp: number; open: number; high: number; low: number; close: number; volume: number }) => ({
      date: c.timestamp > 0
        ? new Date(c.timestamp * 1000).toISOString().split("T")[0]
        : c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }))
    .filter((c: { date: string; close: number }) => c.close != null && c.date);

  candleCache.set(symbol, { candles, fetchedAt: Date.now() });
  return candles;
}

export async function fetchCandlesForWatchlist(
  symbols: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, Candle[]>> {
  const result = new Map<string, Candle[]>();
  const BATCH = 8;
  let done = 0;

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map(async (sym) => {
        const candles = await fetchRealCandles(sym);
        return [sym, candles] as const;
      }),
    );
    for (const r of settled) {
      if (r.status === "fulfilled") {
        result.set(r.value[0], r.value[1]);
      }
    }
    done += batch.length;
    onProgress?.(done, symbols.length);
  }

  return result;
}
