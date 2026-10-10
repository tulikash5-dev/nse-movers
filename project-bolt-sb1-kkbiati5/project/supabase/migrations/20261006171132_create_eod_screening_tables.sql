/*
# Create EOD Screening Tables for Automated Intraday Watchlist

## Purpose
Stores end-of-day scan results that screen NSE stocks into Long, Short, and
Reversal candidates for next-day intraday trading. Includes derivative analysis,
bulk deals, and a morning readiness checklist.

## New Tables

1. `eod_scan_runs` — Metadata for each scan execution
   - id (uuid PK)
   - scan_date (date, the trading day the data is from)
   - run_at (timestamptz, when the scan ran)
   - status (text: success/failed/running/partial)
   - message (text, summary)
   - total_stocks_scanned (int)
   - long_count, short_count, reversal_count (int)
   - triggered_by (text: scheduler/manual)
   - data_source (text: which NSE feed was used)

2. `eod_candidates` — Individual stock candidates with full trade plan
   - id (uuid PK)
   - scan_run_id (uuid FK → eod_scan_runs)
   - scan_date (date)
   - symbol (text)
   - company_name (text)
   - sector (text, nullable)
   - setup_type (text: long/short/reversal)
   - direction (text: LONG/SHORT)
   - close_price (numeric)
   - pct_change (numeric)
   - day_high (numeric)
   - day_low (numeric)
   - day_open (numeric)
   - volume (bigint)
   - avg_20d_volume (bigint)
   - volume_ratio (numeric: volume / avg_20d_volume)
   - delivery_pct (numeric, nullable)
   - oi_change_pct (numeric, nullable)
   - oi_signal (text, nullable: long_buildup/short_buildup/long_unwinding/short_covering)
   - near_52wk_high (boolean)
   - near_52wk_low (boolean)
   - in_bulk_deal (boolean)
   - cas_imbalance (numeric, nullable)
   - pivot_r1, pivot_r2, pivot_s1, pivot_s2 (numeric)
   - pivot_pp (numeric: pivot point)
   - trigger_price (numeric: breakout above day_high or breakdown below day_low)
   - stop_loss (numeric)
   - conviction_score (int: 1-5)
   - conviction_reasons (text[]: factors contributing to score)
   - created_at (timestamptz)

3. `eod_derivative_summary` — Derivative analysis breakdown
   - id (uuid PK)
   - scan_run_id (uuid FK → eod_scan_runs)
   - scan_date (date)
   - category (text: long_buildup/short_buildup/long_unwinding/short_covering)
   - symbol (text)
   - pct_change (numeric)
   - oi_change_pct (numeric)
   - volume (bigint)
   - created_at (timestamptz)

4. `eod_bulk_deals` — Bulk/block deal records
   - id (uuid PK)
   - scan_run_id (uuid FK → eod_scan_runs)
   - scan_date (date)
   - symbol (text)
   - company_name (text)
   - deal_type (text: bulk/block)
   - buy_qty (bigint)
   - sell_qty (bigint)
   - trade_price (numeric)
   - net_qty (bigint: buy - sell)
   - created_at (timestamptz)

5. `eod_checklist` — Morning pre-open readiness checklist
   - id (uuid PK)
   - scan_run_id (uuid FK → eod_scan_runs)
   - scan_date (date)
   - item_text (text)
   - item_category (text: global/derivatives/stock_specific/risk)
   - is_checked (boolean, default false)
   - sort_order (int)
   - created_at (timestamptz)

## Security
- RLS enabled on all tables.
- Anon + authenticated CRUD (single-tenant, no auth screen, data is intentionally public).

## Indexes
- eod_candidates: scan_run_id, scan_date, setup_type
- eod_derivative_summary: scan_run_id
- eod_bulk_deals: scan_run_id
- eod_checklist: scan_run_id
*/

-- ===== eod_scan_runs =====
CREATE TABLE IF NOT EXISTS eod_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_date date NOT NULL,
  run_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('success','failed','running','partial')),
  message text,
  total_stocks_scanned int DEFAULT 0,
  long_count int DEFAULT 0,
  short_count int DEFAULT 0,
  reversal_count int DEFAULT 0,
  triggered_by text DEFAULT 'scheduler' CHECK (triggered_by IN ('scheduler','manual')),
  data_source text
);

ALTER TABLE eod_scan_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_eod_scan_runs" ON eod_scan_runs;
CREATE POLICY "anon_select_eod_scan_runs" ON eod_scan_runs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_eod_scan_runs" ON eod_scan_runs;
CREATE POLICY "anon_insert_eod_scan_runs" ON eod_scan_runs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_eod_scan_runs" ON eod_scan_runs;
CREATE POLICY "anon_update_eod_scan_runs" ON eod_scan_runs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_eod_scan_runs" ON eod_scan_runs;
CREATE POLICY "anon_delete_eod_scan_runs" ON eod_scan_runs FOR DELETE TO anon, authenticated USING (true);

-- ===== eod_candidates =====
CREATE TABLE IF NOT EXISTS eod_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid REFERENCES eod_scan_runs(id) ON DELETE CASCADE,
  scan_date date NOT NULL,
  symbol text NOT NULL,
  company_name text,
  sector text,
  setup_type text NOT NULL CHECK (setup_type IN ('long','short','reversal')),
  direction text NOT NULL CHECK (direction IN ('LONG','SHORT')),
  close_price numeric,
  pct_change numeric,
  day_high numeric,
  day_low numeric,
  day_open numeric,
  volume bigint,
  avg_20d_volume bigint,
  volume_ratio numeric,
  delivery_pct numeric,
  oi_change_pct numeric,
  oi_signal text CHECK (oi_signal IS NULL OR oi_signal IN ('long_buildup','short_buildup','long_unwinding','short_covering')),
  near_52wk_high boolean DEFAULT false,
  near_52wk_low boolean DEFAULT false,
  in_bulk_deal boolean DEFAULT false,
  cas_imbalance numeric,
  pivot_pp numeric,
  pivot_r1 numeric,
  pivot_r2 numeric,
  pivot_s1 numeric,
  pivot_s2 numeric,
  trigger_price numeric,
  stop_loss numeric,
  conviction_score int DEFAULT 1 CHECK (conviction_score >= 1 AND conviction_score <= 5),
  conviction_reasons text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eod_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_eod_candidates" ON eod_candidates;
CREATE POLICY "anon_select_eod_candidates" ON eod_candidates FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_eod_candidates" ON eod_candidates;
CREATE POLICY "anon_insert_eod_candidates" ON eod_candidates FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_eod_candidates" ON eod_candidates;
CREATE POLICY "anon_update_eod_candidates" ON eod_candidates FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_eod_candidates" ON eod_candidates;
CREATE POLICY "anon_delete_eod_candidates" ON eod_candidates FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_eod_candidates_run_id ON eod_candidates(scan_run_id);
CREATE INDEX IF NOT EXISTS idx_eod_candidates_date ON eod_candidates(scan_date);
CREATE INDEX IF NOT EXISTS idx_eod_candidates_setup ON eod_candidates(setup_type);

-- ===== eod_derivative_summary =====
CREATE TABLE IF NOT EXISTS eod_derivative_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid REFERENCES eod_scan_runs(id) ON DELETE CASCADE,
  scan_date date NOT NULL,
  category text NOT NULL CHECK (category IN ('long_buildup','short_buildup','long_unwinding','short_covering')),
  symbol text NOT NULL,
  pct_change numeric,
  oi_change_pct numeric,
  volume bigint,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eod_derivative_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_eod_deriv" ON eod_derivative_summary;
CREATE POLICY "anon_select_eod_deriv" ON eod_derivative_summary FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_eod_deriv" ON eod_derivative_summary;
CREATE POLICY "anon_insert_eod_deriv" ON eod_derivative_summary FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_eod_deriv" ON eod_derivative_summary;
CREATE POLICY "anon_update_eod_deriv" ON eod_derivative_summary FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_eod_deriv" ON eod_derivative_summary;
CREATE POLICY "anon_delete_eod_deriv" ON eod_derivative_summary FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_eod_deriv_run_id ON eod_derivative_summary(scan_run_id);

-- ===== eod_bulk_deals =====
CREATE TABLE IF NOT EXISTS eod_bulk_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid REFERENCES eod_scan_runs(id) ON DELETE CASCADE,
  scan_date date NOT NULL,
  symbol text NOT NULL,
  company_name text,
  deal_type text CHECK (deal_type IN ('bulk','block')),
  buy_qty bigint,
  sell_qty bigint,
  trade_price numeric,
  net_qty bigint,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eod_bulk_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_eod_bulk" ON eod_bulk_deals;
CREATE POLICY "anon_select_eod_bulk" ON eod_bulk_deals FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_eod_bulk" ON eod_bulk_deals;
CREATE POLICY "anon_insert_eod_bulk" ON eod_bulk_deals FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_eod_bulk" ON eod_bulk_deals;
CREATE POLICY "anon_update_eod_bulk" ON eod_bulk_deals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_eod_bulk" ON eod_bulk_deals;
CREATE POLICY "anon_delete_eod_bulk" ON eod_bulk_deals FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_eod_bulk_run_id ON eod_bulk_deals(scan_run_id);

-- ===== eod_checklist =====
CREATE TABLE IF NOT EXISTS eod_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid REFERENCES eod_scan_runs(id) ON DELETE CASCADE,
  scan_date date NOT NULL,
  item_text text NOT NULL,
  item_category text CHECK (item_category IN ('global','derivatives','stock_specific','risk')),
  is_checked boolean DEFAULT false,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eod_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_eod_checklist" ON eod_checklist;
CREATE POLICY "anon_select_eod_checklist" ON eod_checklist FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_eod_checklist" ON eod_checklist;
CREATE POLICY "anon_insert_eod_checklist" ON eod_checklist FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_eod_checklist" ON eod_checklist;
CREATE POLICY "anon_update_eod_checklist" ON eod_checklist FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_eod_checklist" ON eod_checklist;
CREATE POLICY "anon_delete_eod_checklist" ON eod_checklist FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_eod_checklist_run_id ON eod_checklist(scan_run_id);
