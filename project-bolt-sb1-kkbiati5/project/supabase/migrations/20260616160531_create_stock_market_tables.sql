
/*
# Indian Stock Market Tracker — Initial Schema

## Summary
Creates all tables needed for the stock market mover tracker application.

## New Tables

### stock_movers
Stores daily gainers and losers data fetched from Yahoo Finance.
- id: UUID primary key
- date: The trading date (DATE)
- symbol: Yahoo Finance symbol e.g. "RELIANCE.NS"
- company_name: Full company name
- exchange: NSE or BSE
- price: Current/closing price
- prev_close: Previous day's closing price
- pct_change: Day's percentage change
- volume: Trading volume
- sector: Sector classification (if available)
- industry: Industry classification (if available)
- mover_type: "gainer" or "loser"
- created_at: Row creation timestamp

### scheduler_runs
Tracks each execution of the data-fetch scheduler.
- id: UUID primary key
- run_at: When the run was triggered (timestamptz)
- status: "success", "failed", "running", or "partial"
- message: Human-readable status message
- stocks_fetched: Number of stocks successfully fetched
- gainers_count: Number of gainers stored
- losers_count: Number of losers stored
- threshold_used: % threshold applied during this run
- triggered_by: "scheduler" or "manual"

### app_settings
Key-value store for application configuration.
- key: Setting name (PRIMARY KEY)
- value: Setting value (text)
- updated_at: Last updated timestamp

## Security
- RLS enabled on all tables
- All policies use TO anon, authenticated (single-tenant, no auth required)
- Public read/write for all tables so the anon-key frontend can operate

## Notes
1. This is a single-tenant app; no user isolation is needed.
2. The stock_movers table has a unique constraint on (date, symbol) to prevent duplicate rows per day.
3. A pg_cron job is registered to run the data-fetch edge function daily at 10:30 UTC (4:00 PM IST) on weekdays.
4. Default threshold in app_settings is 3%.
*/

-- stock_movers table
CREATE TABLE IF NOT EXISTS stock_movers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  symbol text NOT NULL,
  company_name text NOT NULL,
  exchange text NOT NULL DEFAULT 'NSE',
  price numeric(12, 2),
  prev_close numeric(12, 2),
  pct_change numeric(8, 4),
  volume bigint,
  sector text,
  industry text,
  mover_type text NOT NULL CHECK (mover_type IN ('gainer', 'loser')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_date_symbol UNIQUE (date, symbol)
);

CREATE INDEX IF NOT EXISTS idx_stock_movers_date ON stock_movers (date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movers_mover_type ON stock_movers (mover_type);
CREATE INDEX IF NOT EXISTS idx_stock_movers_sector ON stock_movers (sector);
CREATE INDEX IF NOT EXISTS idx_stock_movers_pct_change ON stock_movers (pct_change DESC);

ALTER TABLE stock_movers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_stock_movers" ON stock_movers;
CREATE POLICY "anon_select_stock_movers" ON stock_movers FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_stock_movers" ON stock_movers;
CREATE POLICY "anon_insert_stock_movers" ON stock_movers FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_stock_movers" ON stock_movers;
CREATE POLICY "anon_update_stock_movers" ON stock_movers FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_stock_movers" ON stock_movers;
CREATE POLICY "anon_delete_stock_movers" ON stock_movers FOR DELETE
TO anon, authenticated USING (true);

-- scheduler_runs table
CREATE TABLE IF NOT EXISTS scheduler_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('success', 'failed', 'running', 'partial')),
  message text,
  stocks_fetched integer DEFAULT 0,
  gainers_count integer DEFAULT 0,
  losers_count integer DEFAULT 0,
  threshold_used numeric(5, 2) DEFAULT 3.0,
  triggered_by text NOT NULL DEFAULT 'scheduler' CHECK (triggered_by IN ('scheduler', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_scheduler_runs_run_at ON scheduler_runs (run_at DESC);

ALTER TABLE scheduler_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_scheduler_runs" ON scheduler_runs;
CREATE POLICY "anon_select_scheduler_runs" ON scheduler_runs FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_scheduler_runs" ON scheduler_runs;
CREATE POLICY "anon_insert_scheduler_runs" ON scheduler_runs FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_scheduler_runs" ON scheduler_runs;
CREATE POLICY "anon_update_scheduler_runs" ON scheduler_runs FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_scheduler_runs" ON scheduler_runs;
CREATE POLICY "anon_delete_scheduler_runs" ON scheduler_runs FOR DELETE
TO anon, authenticated USING (true);

-- app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_app_settings" ON app_settings;
CREATE POLICY "anon_select_app_settings" ON app_settings FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_app_settings" ON app_settings;
CREATE POLICY "anon_insert_app_settings" ON app_settings FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_app_settings" ON app_settings;
CREATE POLICY "anon_update_app_settings" ON app_settings FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_app_settings" ON app_settings;
CREATE POLICY "anon_delete_app_settings" ON app_settings FOR DELETE
TO anon, authenticated USING (true);

-- Seed default settings
INSERT INTO app_settings (key, value) VALUES
  ('threshold_pct', '3'),
  ('scheduler_enabled', 'true'),
  ('last_fetch_date', '')
ON CONFLICT (key) DO NOTHING;
