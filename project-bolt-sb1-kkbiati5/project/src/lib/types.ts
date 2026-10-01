export type MoverType = "gainer" | "loser";

export interface StockMover {
  id: string;
  date: string;
  symbol: string;
  company_name: string;
  exchange: string;
  price: number;
  prev_close: number;
  pct_change: number;
  volume: number;
  sector: string | null;
  industry: string | null;
  mover_type: MoverType;
  created_at: string;
}

export interface SchedulerRun {
  id: string;
  run_at: string;
  status: "success" | "failed" | "running" | "partial";
  message: string | null;
  stocks_fetched: number;
  gainers_count: number;
  losers_count: number;
  threshold_used: number;
  triggered_by: "scheduler" | "manual";
}

export interface AppSetting {
  key: string;
  value: string;
  updated_at: string;
}
