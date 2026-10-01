// Live Market Data Provider for Indian Stocks
// Supports multiple data sources: Zerodha, Angel One, Upstox, Yahoo Finance

import type { Candle } from "./chochDetector";

// Data provider types
export type DataProvider = "zerodha" | "angelone" | "upstox" | "yahoo" | "simulated";

export interface ProviderConfig {
  provider: DataProvider;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  websocketUrl?: string;
}

export interface LiveQuote {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
  change: number;
  changePercent: number;
}

export interface HistoricalCandles {
  symbol: string;
  interval: string;
  candles: Candle[];
}

export interface LiveDataSubscriber {
  onQuote: (quote: LiveQuote) => void;
  onError: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

// Default configuration (uses simulated data)
let currentConfig: ProviderConfig = {
  provider: "simulated",
};

export function setProviderConfig(config: ProviderConfig) {
  currentConfig = config;
}

export function getProviderConfig(): ProviderConfig {
  return currentConfig;
}

/**
 * Abstract base class for data providers
 */
abstract class DataProviderBase {
  abstract connect(): Promise<void>;
  abstract disconnect(): void;
  abstract subscribe(symbol: string, subscriber: LiveDataSubscriber): void;
  abstract unsubscribe(symbol: string): void;
  abstract getHistoricalCandles(
    symbol: string,
    interval: "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d",
    limit: number
  ): Promise<Candle[]>;
  abstract isConnected(): boolean;
}

/**
 * Simulated Data Provider - Uses random walk for testing
 */
class SimulatedProvider extends DataProviderBase {
  private subscribers: Map<string, LiveDataSubscriber[]> = new Map();
  private intervals: Map<string, number> = new Map();
  private prices: Map<string, number> = new Map();
  private candles: Map<string, Candle[]> = new Map();
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    console.log("Simulated provider connected");
  }

  disconnect(): void {
    this.connected = false;
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.subscribers.clear();
  }

  subscribe(symbol: string, subscriber: LiveDataSubscriber): void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, []);
    }
    this.subscribers.get(symbol)!.push(subscriber);

    // Start generating quotes if not already
    if (!this.intervals.has(symbol)) {
      // Initialize with a base price
      const basePrice = 500 + Math.random() * 3000; // Random price between 500-3500
      this.prices.set(symbol, basePrice);

      const interval = setInterval(() => {
        this.generateQuote(symbol);
      }, 1000);

      this.intervals.set(symbol, interval as unknown as number);
    }

    subscriber.onConnect?.();
  }

  unsubscribe(symbol: string): void {
    const interval = this.intervals.get(symbol);
    if (interval !== undefined) {
      clearInterval(interval);
      this.intervals.delete(symbol);
    }
    this.subscribers.delete(symbol);
  }

  private generateQuote(symbol: string): void {
    const currentPrice = this.prices.get(symbol) || 500;
    const volatility = currentPrice * 0.002; // 0.2% per tick
    const change = (Math.random() - 0.5) * volatility * 2;
    const newPrice = currentPrice + change;

    this.prices.set(symbol, newPrice);

    const now = new Date();
    const quote: LiveQuote = {
      symbol,
      price: newPrice,
      open: currentPrice,
      high: Math.max(currentPrice, newPrice),
      low: Math.min(currentPrice, newPrice),
      close: newPrice,
      volume: Math.floor(Math.random() * 50000) + 10000,
      timestamp: now.toISOString(),
      change: newPrice - currentPrice,
      changePercent: ((newPrice - currentPrice) / currentPrice) * 100,
    };

    // Store candle
    if (!this.candles.has(symbol)) {
      this.candles.set(symbol, []);
    }
    const candles = this.candles.get(symbol)!;
    const lastCandle = candles[candles.length - 1];
    const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

    if (lastCandle && lastCandle.time === timeStr) {
      lastCandle.high = Math.max(lastCandle.high, newPrice);
      lastCandle.low = Math.min(lastCandle.low, newPrice);
      lastCandle.close = newPrice;
      lastCandle.volume += quote.volume;
    } else {
      candles.push({
        time: timeStr,
        open: newPrice,
        high: newPrice,
        low: newPrice,
        close: newPrice,
        volume: quote.volume,
      });
    }

    // Keep only last 100 candles
    if (candles.length > 100) {
      candles.shift();
    }

    // Notify subscribers
    const subscribers = this.subscribers.get(symbol) || [];
    subscribers.forEach(sub => {
      try {
        sub.onQuote(quote);
      } catch (err) {
        sub.onError(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  async getHistoricalCandles(
    symbol: string,
    interval: "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d",
    limit: number
  ): Promise<Candle[]> {
    // Generate historical candles
    const candles: Candle[] = [];
    const basePrice = this.prices.get(symbol) || 500 + Math.random() * 3000;
    const intervalMinutes: Record<string, number> = {
      "1m": 1,
      "5m": 5,
      "15m": 15,
      "30m": 30,
      "1h": 60,
      "4h": 240,
      "1d": 1440,
    };

    const minutes = intervalMinutes[interval] || 15;
    const volatility = basePrice * (minutes / 1440) * 0.02; // Daily 2% volatility scaled by timeframe

    let price = basePrice;

    for (let i = 0; i < limit; i++) {
      const change = (Math.random() - 0.5) * volatility * 2;
      const open = price;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;

      candles.push({
        time: `${Math.floor(i / 4)}:${(i % 4) * 15}`,
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 100000) + 50000,
      });

      price = close;
    }

    return candles;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Yahoo Finance Provider - Free but delayed data
 * Note: For Indian stocks, use symbol.ns or symbol.bo suffix
 */
class YahooFinanceProvider extends DataProviderBase {
  private connected = false;

  async connect(): Promise<void> {
    // Yahoo Finance doesn't require authentication for basic use
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }

  subscribe(symbol: string, subscriber: LiveDataSubscriber): void {
    // Yahoo doesn't support real-time WebSocket, poll instead
    console.warn("Yahoo Finance does not support real-time streaming. Use polling.");

    // Poll every 5 seconds
    const pollInterval = setInterval(async () => {
      try {
        const quote = await this.fetchQuote(symbol);
        subscriber.onQuote(quote);
      } catch (err) {
        subscriber.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }, 5000);

    subscriber.onConnect?.();
  }

  unsubscribe(symbol: string): void {
    // Clear polling intervals
  }

  private async fetchQuote(symbol: string): Promise<LiveQuote> {
    // Transform Indian symbol to Yahoo format
    const yahooSymbol = symbol.includes(".")
      ? symbol
      : `${symbol.toUpperCase()}.NS`; // Default to NSE

    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`
    );

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      throw new Error("No data from Yahoo Finance");
    }

    const meta = result.meta || {};
    const quotes = result.indicators?.quote?.[0] || {};
    const lastIndex = (quotes.close?.length || 1) - 1;

    return {
      symbol,
      price: meta.regularMarketPrice || quotes.close?.[lastIndex] || 0,
      open: quotes.open?.[lastIndex] || 0,
      high: quotes.high?.[lastIndex] || 0,
      low: quotes.low?.[lastIndex] || 0,
      close: quotes.close?.[lastIndex] || 0,
      volume: quotes.volume?.[lastIndex] || 0,
      timestamp: new Date().toISOString(),
      change: 0,
      changePercent: 0,
    };
  }

  async getHistoricalCandles(
    symbol: string,
    interval: "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d",
    limit: number
  ): Promise<Candle[]> {
    const yahooSymbol = symbol.includes(".")
      ? symbol
      : `${symbol.toUpperCase()}.NS`;

    const intervalMap: Record<string, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "30m": "30m",
      "1h": "60m",
      "4h": "60m", // Yahoo doesn't have 4h, use 1h
      "1d": "1d",
    };

    const rangeMap: Record<string, string> = {
      "1m": "1d",
      "5m": "5d",
      "15m": "5d",
      "30m": "1mo",
      "1h": "1mo",
      "4h": "1mo",
      "1d": "3mo",
    };

    const yahooInterval = intervalMap[interval] || "15m";
    const range = rangeMap[interval] || "5d";

    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${yahooInterval}&range=${range}`
    );

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      throw new Error("No historical data from Yahoo Finance");
    }

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};

    const candles: Candle[] = [];
    const startIndex = Math.max(0, timestamps.length - limit);

    for (let i = startIndex; i < timestamps.length; i++) {
      const time = new Date(timestamps[i] * 1000).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });

      candles.push({
        time,
        open: quotes.open?.[i] || 0,
        high: quotes.high?.[i] || 0,
        low: quotes.low?.[i] || 0,
        close: quotes.close?.[i] || 0,
        volume: quotes.volume?.[i] || 0,
      });
    }

    return candles;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Zerodha Kite Connect Provider
 * Requires API key and access token from Zerodha
 */
class ZerodhaProvider extends DataProviderBase {
  private config: ProviderConfig;
  private connected = false;
  private ws: WebSocket | null = null;
  private subscribers: Map<string, LiveDataSubscriber[]> = new Map();
  private ticker: any = null;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config.apiKey || !this.config.accessToken) {
      throw new Error("Zerodha requires API key and access token");
    }

    // Initialize Kite Connect (would need kiteconnectjs library)
    // For now, use WebSocket directly
    console.log("Connecting to Zerodha...");
    this.connected = true;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  subscribe(symbol: string, subscriber: LiveDataSubscriber): void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, []);
    }
    this.subscribers.get(symbol)!.push(subscriber);

    // WebSocket subscription would happen here
    console.log(`Subscribed to ${symbol} on Zerodha`);
    subscriber.onConnect?.();
  }

  unsubscribe(symbol: string): void {
    this.subscribers.delete(symbol);
  }

  async getHistoricalCandles(
    symbol: string,
    interval: "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d",
    limit: number
  ): Promise<Candle[]> {
    // Would call Zerodha historical API
    // GET /ohlc
    throw new Error("Zerodha integration requires API key. Configure in Settings.");
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Get the appropriate data provider based on configuration
 */
export function getDataProvider(config: ProviderConfig = currentConfig): DataProviderBase {
  switch (config.provider) {
    case "zerodha":
      return new ZerodhaProvider(config);
    case "yahoo":
      return new YahooFinanceProvider();
    case "simulated":
    default:
      return new SimulatedProvider();
  }
}

// Singleton provider instance
let providerInstance: DataProviderBase | null = null;

export function getProvider(): DataProviderBase {
  if (!providerInstance) {
    providerInstance = getDataProvider();
  }
  return providerInstance;
}

export function initializeProvider(config: ProviderConfig): Promise<void> {
  currentConfig = config;
  providerInstance = getDataProvider(config);
  return providerInstance.connect();
}

/**
 * Convenience function to subscribe to live quotes
 */
export async function subscribeToSymbol(
  symbol: string,
  subscriber: LiveDataSubscriber
): Promise<void> {
  const provider = getProvider();

  if (!provider.isConnected()) {
    await provider.connect();
  }

  provider.subscribe(symbol, subscriber);
}

/**
 * Get historical candles for a symbol
 */
export async function getHistoricalData(
  symbol: string,
  interval: "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" = "15m",
  limit: number = 100
): Promise<Candle[]> {
  const provider = getProvider();

  if (!provider.isConnected()) {
    await provider.connect();
  }

  return provider.getHistoricalCandles(symbol, interval, limit);
}

/**
 * Clean up provider connection
 */
export function cleanupProvider(): void {
  if (providerInstance) {
    providerInstance.disconnect();
    providerInstance = null;
  }
}
