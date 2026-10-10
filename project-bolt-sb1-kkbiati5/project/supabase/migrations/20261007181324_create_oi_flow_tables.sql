/*
# Smart OI Flow Intelligence - Database Schema

Creates tables for the automated OI flow scanner system.

1. New Tables
- oif_scan_snapshots: Stores per-stock scan data every 5 minutes (price, volume, OI proxy, VWAP, ATR, structure, classification, confidence, grade, signal, entry/SL/targets)
- oif_signals: Stores generated BUY/SELL signals with full trade plan and status tracking
- oif_signal_reviews: Tracks completed signal outcomes (PnL, win/loss, MFE, MAE, holding time)
- oif_learning_weights: Stores AI model weights that auto-adjust based on trade outcomes
- oif_scan_runs: Tracks each scan cycle (timestamp, stocks scanned, summary stats)

2. Security
- Single-tenant, no auth. All tables use TO anon, authenticated with USING(true) / WITH CHECK(true).
- RLS enabled on every table.

3. Important Notes
- OI data is proxied from volume + price action (NSE OI API is not server-accessible). The oi_change_pct field stores this proxy value, clearly labeled in the UI.
- The learning engine updates oif_learning_weights after each completed trade review.
*/

-- ===== Scan Runs =====
CREATE TABLE IF NOT EXISTS oif_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_time timestamptz DEFAULT now(),
  stocks_scanned int DEFAULT 0,
  signals_count int DEFAULT 0,
  bullish_count int DEFAULT 0,
  bearish_count int DEFAULT 0,
  long_buildup_count int DEFAULT 0,
  short_buildup_count int DEFAULT 0,
  short_covering_count int DEFAULT 0,
  long_unwinding_count int DEFAULT 0,
  market_sentiment text DEFAULT 'Neutral',
  nifty_trend text DEFAULT 'Sideways',
  banknifty_trend text DEFAULT 'Sideways',
  status text DEFAULT 'running',
  message text,
  triggered_by text DEFAULT 'scheduler'
);

ALTER TABLE oif_scan_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oif_runs_select" ON oif_scan_runs;
CREATE POLICY "oif_runs_select" ON oif_scan_runs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "oif_runs_insert" ON oif_scan_runs;
CREATE POLICY "oif_runs_insert" ON oif_scan_runs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "oif_runs_update" ON oif_scan_runs;
CREATE POLICY "oif_runs_update" ON oif_scan_runs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "oif_runs_delete" ON oif_scan_runs;
CREATE POLICY "oif_runs_delete" ON oif_scan_runs FOR DELETE TO anon, authenticated USING (true);

-- ===== Scan Snapshots (per stock per scan) =====
CREATE TABLE IF NOT EXISTS oif_scan_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid REFERENCES oif_scan_runs(id) ON DELETE CASCADE,
  scan_time timestamptz DEFAULT now(),
  symbol text NOT NULL,
  company_name text,
  sector text,
  ltp numeric,
  price_change_pct numeric,
  volume bigint,
  avg_20d_volume bigint,
  volume_ratio numeric,
  oi_change_pct numeric,
  oi_velocity text,
  vwap numeric,
  atr numeric,
  relative_strength numeric,
  market_structure text,
  choch boolean DEFAULT false,
  choch_type text,
  bos boolean DEFAULT false,
  bos_type text,
  classification text,
  confidence_score int DEFAULT 0,
  grade text,
  signal text,
  entry_price numeric,
  stop_loss numeric,
  target_1 numeric,
  target_2 numeric,
  target_3 numeric,
  risk_reward numeric,
  rank int
);

ALTER TABLE oif_scan_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oif_snap_select" ON oif_scan_snapshots;
CREATE POLICY "oif_snap_select" ON oif_scan_snapshots FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "oif_snap_insert" ON oif_scan_snapshots;
CREATE POLICY "oif_snap_insert" ON oif_scan_snapshots FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "oif_snap_update" ON oif_scan_snapshots;
CREATE POLICY "oif_snap_update" ON oif_scan_snapshots FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "oif_snap_delete" ON oif_scan_snapshots;
CREATE POLICY "oif_snap_delete" ON oif_scan_snapshots FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_oif_snap_run ON oif_scan_snapshots(scan_run_id);
CREATE INDEX IF NOT EXISTS idx_oif_snap_symbol ON oif_scan_snapshots(symbol);
CREATE INDEX IF NOT EXISTS idx_oif_snap_time ON oif_scan_snapshots(scan_time DESC);

-- ===== Signals =====
CREATE TABLE IF NOT EXISTS oif_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid REFERENCES oif_scan_runs(id) ON DELETE CASCADE,
  signal_time timestamptz DEFAULT now(),
  symbol text NOT NULL,
  company_name text,
  sector text,
  signal_type text NOT NULL,
  classification text,
  confidence_score int DEFAULT 0,
  grade text,
  entry_price numeric,
  stop_loss numeric,
  target_1 numeric,
  target_2 numeric,
  target_3 numeric,
  risk_reward numeric,
  oi_change_pct numeric,
  volume_ratio numeric,
  vwap numeric,
  market_structure text,
  choch_confirmed boolean DEFAULT false,
  bos_confirmed boolean DEFAULT false,
  relative_strength numeric,
  status text DEFAULT 'Waiting',
  -- Status: Waiting, Triggered, Target 1 Hit, Target 2 Hit, Target 3 Hit, SL Hit, Closed
  exit_price numeric,
  exit_time timestamptz,
  pnl_pct numeric,
  pnl_r numeric,
  max_favorable_excursion numeric,
  max_adverse_excursion numeric,
  holding_time_minutes int,
  winning_trade boolean,
  triggered_at timestamptz
);

ALTER TABLE oif_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oif_sig_select" ON oif_signals;
CREATE POLICY "oif_sig_select" ON oif_signals FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "oif_sig_insert" ON oif_signals;
CREATE POLICY "oif_sig_insert" ON oif_signals FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "oif_sig_update" ON oif_signals;
CREATE POLICY "oif_sig_update" ON oif_signals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "oif_sig_delete" ON oif_signals;
CREATE POLICY "oif_sig_delete" ON oif_signals FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_oif_sig_time ON oif_signals(signal_time DESC);
CREATE INDEX IF NOT EXISTS idx_oif_sig_status ON oif_signals(status);
CREATE INDEX IF NOT EXISTS idx_oif_sig_symbol ON oif_signals(symbol);

-- ===== Learning Weights =====
CREATE TABLE IF NOT EXISTS oif_learning_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  updated_at timestamptz DEFAULT now(),
  oi_weight numeric DEFAULT 30,
  oi_velocity_weight numeric DEFAULT 20,
  volume_weight numeric DEFAULT 15,
  structure_weight numeric DEFAULT 10,
  choch_bos_weight numeric DEFAULT 10,
  relative_strength_weight numeric DEFAULT 5,
  option_chain_weight numeric DEFAULT 10,
  total_signals int DEFAULT 0,
  winning_trades int DEFAULT 0,
  losing_trades int DEFAULT 0,
  current_accuracy numeric DEFAULT 0,
  best_oi_threshold numeric DEFAULT 5,
  best_volume_threshold numeric DEFAULT 1.5,
  notes text
);

ALTER TABLE oif_learning_weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oif_lw_select" ON oif_learning_weights;
CREATE POLICY "oif_lw_select" ON oif_learning_weights FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "oif_lw_insert" ON oif_learning_weights;
CREATE POLICY "oif_lw_insert" ON oif_learning_weights FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "oif_lw_update" ON oif_learning_weights;
CREATE POLICY "oif_lw_update" ON oif_learning_weights FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "oif_lw_delete" ON oif_learning_weights;
CREATE POLICY "oif_lw_delete" ON oif_learning_weights FOR DELETE TO anon, authenticated USING (true);

-- Seed default weights row
INSERT INTO oif_learning_weights (oi_weight, oi_velocity_weight, volume_weight, structure_weight, choch_bos_weight, relative_strength_weight, option_chain_weight)
VALUES (30, 20, 15, 10, 10, 5, 10)
ON CONFLICT DO NOTHING;
