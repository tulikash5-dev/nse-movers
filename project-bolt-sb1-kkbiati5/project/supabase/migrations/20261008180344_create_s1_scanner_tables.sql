/*
# NSE Daily Fibonacci S1 Auto-Scanner Tables

1. New Tables
- s1_scan_runs: Tracks each scan cycle (timestamp, stocks scanned, matched count, status)
- s1_scan_results: Per-stock S1 calculation results (symbol, sector, is_fno, price, prev high/low/close, pivot, S1 level, distance %, volume, signal status, daily candles JSON for charting)

2. Security
- Single-tenant, no auth. All tables use TO anon, authenticated with USING(true) / WITH CHECK(true).
- RLS enabled on every table.

3. Notes
- Daily Fibonacci Pivot: P = (H + L + C) / 3, S1 = P - 0.382 * (H - L)
- A stock is flagged when today's close is within ±buffer% of S1, or when price opened above S1 and crossed below/touched S1 intraday
- F&O flag distinguishes F&O stocks from non-F&O stocks for filtering
- candles field stores last 60 daily OHLCV bars as JSON for chart rendering
*/

CREATE TABLE IF NOT EXISTS s1_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_time timestamptz DEFAULT now(),
  stocks_scanned int DEFAULT 0,
  matched_count int DEFAULT 0,
  crossed_count int DEFAULT 0,
  near_count int DEFAULT 0,
  status text DEFAULT 'running',
  message text,
  triggered_by text DEFAULT 'scheduler'
);

ALTER TABLE s1_scan_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "s1_runs_select" ON s1_scan_runs;
CREATE POLICY "s1_runs_select" ON s1_scan_runs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "s1_runs_insert" ON s1_scan_runs;
CREATE POLICY "s1_runs_insert" ON s1_scan_runs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "s1_runs_update" ON s1_scan_runs;
CREATE POLICY "s1_runs_update" ON s1_scan_runs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "s1_runs_delete" ON s1_scan_runs;
CREATE POLICY "s1_runs_delete" ON s1_scan_runs FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS s1_scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid REFERENCES s1_scan_runs(id) ON DELETE CASCADE,
  scan_time timestamptz DEFAULT now(),
  symbol text NOT NULL,
  company_name text,
  sector text,
  is_fno boolean DEFAULT true,
  current_price numeric,
  prev_high numeric,
  prev_low numeric,
  prev_close numeric,
  pivot_level numeric,
  s1_level numeric,
  distance_to_s1_pct numeric,
  volume bigint,
  avg_volume bigint,
  volume_ratio numeric,
  signal_status text,
  daily_high numeric,
  daily_low numeric,
  daily_open numeric,
  crossed_s1_today boolean DEFAULT false,
  candles jsonb
);

ALTER TABLE s1_scan_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "s1_results_select" ON s1_scan_results;
CREATE POLICY "s1_results_select" ON s1_scan_results FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "s1_results_insert" ON s1_scan_results;
CREATE POLICY "s1_results_insert" ON s1_scan_results FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "s1_results_update" ON s1_scan_results;
CREATE POLICY "s1_results_update" ON s1_scan_results FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "s1_results_delete" ON s1_scan_results;
CREATE POLICY "s1_results_delete" ON s1_scan_results FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_s1_res_run ON s1_scan_results(scan_run_id);
CREATE INDEX IF NOT EXISTS idx_s1_res_symbol ON s1_scan_results(symbol);
CREATE INDEX IF NOT EXISTS idx_s1_res_status ON s1_scan_results(signal_status);
