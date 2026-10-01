// Volume Momentum Alert — types and configurable constants

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ActionType = "LONG" | "SHORT" | "NO_TRADE";

export type SignalType =
  | "golden_cross"
  | "death_cross"
  | "uptrend"
  | "downtrend"
  | "no_trend"
  | "low_liquidity"
  | "volume_fade"
  | "conflict";

export type FlagType =
  | "overbought"
  | "oversold"
  | "low_liquidity"
  | "volume_fading"
  | "overextended";

export interface VolumeAlert {
  ticker: string;
  date: string;
  action: ActionType;
  signal_type: SignalType;
  message: string;
  close: number;
  fast_ma: number | null;
  slow_ma: number | null;
  rsi: number | null;
  volume_ratio: number | null;
  avg_daily_volume_20d: number | null;
  suggested_stop: number | null;
  suggested_target: number | null;
  suggested_position_size: number | null;
  risk_reward_ratio: number | null;
  flags: FlagType[];
  risk_checks_passed: boolean;
  disclaimer: string;
  // Extra fields for UI
  atr: number | null;
  change_pct: number | null;
  volume: number | null;
}

export interface VolumeScannerSettings {
  fastMaPeriod: number;
  slowMaPeriod: number;
  longSlowMaPeriod: number;
  rsiPeriod: number;
  volumeMaPeriod: number;
  atrPeriod: number;
  bollingerPeriod: number;
  bollingerStdDev: number;
  minAvgDailyVolume: number;
  volumeRatioThreshold: number;
  rsiOverbought: number;
  rsiOversold: number;
  allowOverboughtLongs: boolean;
  allowOversoldShorts: boolean;
  riskPerTradePct: number;
  dailyLossCapPct: number;
  weeklyLossCapPct: number;
  atrMultiplierForStop: number;
  maxHoldingDays: number;
  accountEquity: number;
  maTolerancePct: number;
}

export const DEFAULT_VOLUME_SETTINGS: VolumeScannerSettings = {
  fastMaPeriod: 10,
  slowMaPeriod: 50,
  longSlowMaPeriod: 200,
  rsiPeriod: 14,
  volumeMaPeriod: 20,
  atrPeriod: 14,
  bollingerPeriod: 20,
  bollingerStdDev: 2,
  minAvgDailyVolume: 5_000_000,
  volumeRatioThreshold: 1.0,
  rsiOverbought: 70,
  rsiOversold: 30,
  allowOverboughtLongs: false,
  allowOversoldShorts: false,
  riskPerTradePct: 1.0,
  dailyLossCapPct: 5.0,
  weeklyLossCapPct: 7.0,
  atrMultiplierForStop: 2.0,
  maxHoldingDays: 30,
  accountEquity: 1_000_000,
  maTolerancePct: 0.5,
};

export interface Instrument {
  symbol: string;
  name: string;
  sector: string;
}

export const WATCHLIST: Instrument[] = [
  // Banking & Financials
  { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Banking" },
  { symbol: "ICICIBANK", name: "ICICI Bank", sector: "Banking" },
  { symbol: "SBIN", name: "State Bank of India", sector: "Banking" },
  { symbol: "AXISBANK", name: "Axis Bank", sector: "Banking" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", sector: "Banking" },
  { symbol: "INDUSINDBK", name: "IndusInd Bank", sector: "Banking" },
  { symbol: "BANKBARODA", name: "Bank of Baroda", sector: "Banking" },
  { symbol: "PNB", name: "Punjab National Bank", sector: "Banking" },
  { symbol: "FEDERALBNK", name: "Federal Bank", sector: "Banking" },
  { symbol: "IDFCFIRSTB", name: "IDFC First Bank", sector: "Banking" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance", sector: "NBFC" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv", sector: "NBFC" },
  { symbol: "CHOLAFIN", name: "Cholamandalam Finance", sector: "NBFC" },
  { symbol: "MUTHOOTFIN", name: "Muthoot Finance", sector: "NBFC" },
  { symbol: "SBILIFE", name: "SBI Life Insurance", sector: "Insurance" },
  { symbol: "HDFCLIFE", name: "HDFC Life Insurance", sector: "Insurance" },
  { symbol: "ICICIPRULI", name: "ICICI Prudential Life", sector: "Insurance" },
  { symbol: "ICICIGI", name: "ICICI Lombard", sector: "Insurance" },
  // IT & Tech
  { symbol: "TCS", name: "Tata Consultancy Services", sector: "IT" },
  { symbol: "INFY", name: "Infosys", sector: "IT" },
  { symbol: "WIPRO", name: "Wipro", sector: "IT" },
  { symbol: "HCLTECH", name: "HCL Technologies", sector: "IT" },
  { symbol: "TECHM", name: "Tech Mahindra", sector: "IT" },
  { symbol: "LTIM", name: "LTIMindtree", sector: "IT" },
  { symbol: "PERSISTENT", name: "Persistent Systems", sector: "IT" },
  { symbol: "COFORGE", name: "Coforge", sector: "IT" },
  { symbol: "MPHASIS", name: "Mphasis", sector: "IT" },
  { symbol: "OFSS", name: "Oracle Financial Services", sector: "IT" },
  // Energy & Power
  { symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy" },
  { symbol: "ONGC", name: "Oil & Natural Gas Corp", sector: "Energy" },
  { symbol: "COALINDIA", name: "Coal India", sector: "Energy" },
  { symbol: "NTPC", name: "NTPC Ltd", sector: "Power" },
  { symbol: "POWERGRID", name: "Power Grid Corp", sector: "Power" },
  { symbol: "ADANIENT", name: "Adani Enterprises", sector: "Energy" },
  { symbol: "ADANIGREEN", name: "Adani Green Energy", sector: "Energy" },
  { symbol: "ADANIPOWER", name: "Adani Power", sector: "Power" },
  { symbol: "TATAPOWER", name: "Tata Power", sector: "Power" },
  { symbol: "IOC", name: "Indian Oil Corp", sector: "Energy" },
  { symbol: "BPCL", name: "Bharat Petroleum", sector: "Energy" },
  { symbol: "GAIL", name: "GAIL India", sector: "Energy" },
  { symbol: "PETRONET", name: "Petronet LNG", sector: "Energy" },
  // Auto & Ancillaries
  { symbol: "MARUTI", name: "Maruti Suzuki", sector: "Auto" },
  { symbol: "TATAMOTORS", name: "Tata Motors", sector: "Auto" },
  { symbol: "M&M", name: "Mahindra & Mahindra", sector: "Auto" },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto", sector: "Auto" },
  { symbol: "EICHERMOT", name: "Eicher Motors", sector: "Auto" },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp", sector: "Auto" },
  { symbol: "TVSMOTOR", name: "TVS Motor Company", sector: "Auto" },
  { symbol: "ASHOKLEY", name: "Ashok Leyland", sector: "Auto" },
  { symbol: "BOSCHLTD", name: "Bosch Ltd", sector: "Auto Ancillary" },
  { symbol: "MOTHERSON", name: "Samvardhana Motherson", sector: "Auto Ancillary" },
  // FMCG & Consumer
  { symbol: "ITC", name: "ITC Ltd", sector: "FMCG" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever", sector: "FMCG" },
  { symbol: "NESTLEIND", name: "Nestle India", sector: "FMCG" },
  { symbol: "BRITANNIA", name: "Britannia Industries", sector: "FMCG" },
  { symbol: "DABUR", name: "Dabur India", sector: "FMCG" },
  { symbol: "GODREJCP", name: "Godrej Consumer Products", sector: "FMCG" },
  { symbol: "MARICO", name: "Marico Ltd", sector: "FMCG" },
  { symbol: "COLPAL", name: "Colgate Palmolive", sector: "FMCG" },
  { symbol: "TATACONSUM", name: "Tata Consumer Products", sector: "FMCG" },
  { symbol: "UNITDSPR", name: "United Spirits", sector: "FMCG" },
  // Pharma & Healthcare
  { symbol: "SUNPHARMA", name: "Sun Pharma", sector: "Pharma" },
  { symbol: "DRREDDY", name: "Dr Reddys Labs", sector: "Pharma" },
  { symbol: "CIPLA", name: "Cipla", sector: "Pharma" },
  { symbol: "DIVISLAB", name: "Divis Laboratories", sector: "Pharma" },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals", sector: "Healthcare" },
  { symbol: "AUROPHARMA", name: "Aurobindo Pharma", sector: "Pharma" },
  { symbol: "LUPIN", name: "Lupin Ltd", sector: "Pharma" },
  { symbol: "BIOCON", name: "Biocon", sector: "Pharma" },
  { symbol: "TORNTPHARM", name: "Torrent Pharma", sector: "Pharma" },
  // Metal & Mining
  { symbol: "TATASTEEL", name: "Tata Steel", sector: "Metal" },
  { symbol: "JSWSTEEL", name: "JSW Steel", sector: "Metal" },
  { symbol: "HINDALCO", name: "Hindalco Industries", sector: "Metal" },
  { symbol: "VEDL", name: "Vedanta", sector: "Metal" },
  { symbol: "JINDALSTEL", name: "Jindal Steel & Power", sector: "Metal" },
  { symbol: "SAIL", name: "Steel Authority of India", sector: "Metal" },
  { symbol: "NMDC", name: "NMDC Ltd", sector: "Metal" },
  { symbol: "HINDZINC", name: "Hindustan Zinc", sector: "Metal" },
  // Telecom & Media
  { symbol: "BHARTIARTL", name: "Bharti Airtel", sector: "Telecom" },
  { symbol: "IDEA", name: "Vodafone Idea", sector: "Telecom" },
  { symbol: "INDUS TOWERS", name: "Indus Towers", sector: "Telecom" },
  { symbol: "SUNTV", name: "Sun TV Network", sector: "Media" },
  { symbol: "ZEE", name: "Zee Entertainment", sector: "Media" },
  { symbol: "PVR", name: "PVR INOX", sector: "Media" },
  // Construction & Infrastructure
  { symbol: "LT", name: "Larsen & Toubro", sector: "Construction" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement", sector: "Cement" },
  { symbol: "GRASIM", name: "Grasim Industries", sector: "Cement" },
  { symbol: "SHREECEM", name: "Shree Cement", sector: "Cement" },
  { symbol: "AMBUJACEM", name: "Ambuja Cements", sector: "Cement" },
  { symbol: "ACC", name: "ACC Ltd", sector: "Cement" },
  { symbol: "DLF", name: "DLF Ltd", sector: "Realty" },
  { symbol: "GODREJPROP", name: "Godrej Properties", sector: "Realty" },
  { symbol: "OBEROIRLTY", name: "Oberoi Realty", sector: "Realty" },
  { symbol: "PHOENIXLTD", name: "The Phoenix Mills", sector: "Realty" },
  // Retail & Services
  { symbol: "TRENT", name: "Trent Ltd", sector: "Retail" },
  { symbol: "DMART", name: "Avenue Supermarts", sector: "Retail" },
  { symbol: "NYKAA", name: "FSN E-Commerce (Nykaa)", sector: "Retail" },
  { symbol: "ZOMATO", name: "Zomato Ltd", sector: "Services" },
  { symbol: "PBFINTECH", name: "PolicyBazaar (PB Fintech)", sector: "Services" },
  { symbol: "PAYTM", name: "One97 Communications (Paytm)", sector: "Services" },
  // Chemicals & Fertilizers
  { symbol: "PIDILITIND", name: "Pidilite Industries", sector: "Chemicals" },
  { symbol: "SRF", name: "SRF Ltd", sector: "Chemicals" },
  { symbol: "UPL", name: "UPL Ltd", sector: "Chemicals" },
  { symbol: "DEEPAKNTR", name: "Deepak Nitrite", sector: "Chemicals" },
  { symbol: "COROMANDEL", name: "Coromandel International", sector: "Fertilizers" },
  { symbol: "CHAMBLFERT", name: "Chambal Fertilizers", sector: "Fertilizers" },
  // Electrical & Equipment
  { symbol: "SIEMENS", name: "Siemens India", sector: "Equipment" },
  { symbol: "ABB", name: "ABB India", sector: "Equipment" },
  { symbol: "BEL", name: "Bharat Electronics", sector: "Defense" },
  { symbol: "HAL", name: "Hindustan Aeronautics", sector: "Defense" },
  { symbol: "BHEL", name: "Bharat Heavy Electricals", sector: "Equipment" },
  // Paints & Packaging
  { symbol: "ASIANPAINT", name: "Asian Paints", sector: "Paints" },
  { symbol: "BERGEPAINT", name: "Berger Paints", sector: "Paints" },
  // Financial Services
  { symbol: "HDFCAMC", name: "HDFC Asset Management", sector: "Financial Services" },
  { symbol: "ABSLOC", name: "ABS Leasing & Solutions", sector: "Financial Services" },
  { symbol: "MCDOWELL-N", name: "United Breweries", sector: "Beverages" },
];
