/*
# Create Multi-Timeframe Rounding Bottom Scanner tables

1. Overview
   This migration creates the database schema for the Rounding Bottom Scanner application.
   It stores instruments, OHLCV candles, scan jobs, pattern detections, timeframe
   confirmations, alerts, scanner settings, and backtest results.

2. New Tables
   - `scanner_instruments`: Master list of tradeable instruments (symbol, name, market, type).
   - `scanner_candles`: OHLCV candle data per symbol + timeframe.
   - `scanner_scan_jobs`: Records of each scan execution (status, timestamps, counts).
   - `scanner_pattern_detections`: Detected rounding-bottom patterns with full metrics.
   - `scanner_timeframe_confirmations`: Per-timeframe confirmation rows linked to a detection.
   - `scanner_alerts`: Alert configurations and fired alerts.
   - `scanner_settings`: Key-value store for scanner configuration.
   - `scanner_backtest_results`: Backtest run results and statistics.

3. Security
   - RLS enabled on every table.
   - Single-tenant (no auth): policies allow anon + authenticated full CRUD since
     the data is intentionally shared/public for this scanner app.
*/

-- Instruments
CREATE TABLE IF NOT EXISTS scanner_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  name text NOT NULL,
  market text NOT NULL DEFAULT 'Unknown',
  type text NOT NULL DEFAULT 'stock',
  sector text,
  industry text,
  market_cap numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scanner_instruments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_instruments" ON scanner_instruments;
CREATE POLICY "anon_select_instruments" ON scanner_instruments FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_instruments" ON scanner_instruments;
CREATE POLICY "anon_insert_instruments" ON scanner_instruments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_instruments" ON scanner_instruments;
CREATE POLICY "anon_update_instruments" ON scanner_instruments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_instruments" ON scanner_instruments;
CREATE POLICY "anon_delete_instruments" ON scanner_instruments FOR DELETE
  TO anon, authenticated USING (true);

-- Candles
CREATE TABLE IF NOT EXISTS scanner_candles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  timeframe text NOT NULL,
  timestamp bigint NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  volume numeric NOT NULL DEFAULT 0,
  complete boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (symbol, timeframe, timestamp)
);

ALTER TABLE scanner_candles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_candles" ON scanner_candles;
CREATE POLICY "anon_select_candles" ON scanner_candles FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_candles" ON scanner_candles;
CREATE POLICY "anon_insert_candles" ON scanner_candles FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_candles" ON scanner_candles;
CREATE POLICY "anon_update_candles" ON scanner_candles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_candles" ON scanner_candles;
CREATE POLICY "anon_delete_candles" ON scanner_candles FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_scanner_candles_symbol_tf ON scanner_candles (symbol, timeframe, timestamp);

-- Scan jobs
CREATE TABLE IF NOT EXISTS scanner_scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  symbols_scanned integer NOT NULL DEFAULT 0,
  patterns_found integer NOT NULL DEFAULT 0,
  triggered_by text NOT NULL DEFAULT 'manual',
  settings jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scanner_scan_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_scan_jobs" ON scanner_scan_jobs;
CREATE POLICY "anon_select_scan_jobs" ON scanner_scan_jobs FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_scan_jobs" ON scanner_scan_jobs;
CREATE POLICY "anon_insert_scan_jobs" ON scanner_scan_jobs FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_scan_jobs" ON scanner_scan_jobs;
CREATE POLICY "anon_update_scan_jobs" ON scanner_scan_jobs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_scan_jobs" ON scanner_scan_jobs;
CREATE POLICY "anon_delete_scan_jobs" ON scanner_scan_jobs FOR DELETE
  TO anon, authenticated USING (true);

-- Pattern detections
CREATE TABLE IF NOT EXISTS scanner_pattern_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_job_id uuid REFERENCES scanner_scan_jobs(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  name text,
  market text,
  timeframe text NOT NULL,
  status text NOT NULL,
  confidence integer NOT NULL,
  score_breakdown jsonb NOT NULL,
  pattern_start_index integer,
  pattern_low_index integer,
  pattern_end_index integer,
  pattern_start_date text,
  pattern_low_date text,
  pattern_end_date text,
  pattern_duration integer,
  left_resistance numeric,
  resistance_zone_low numeric,
  resistance_zone_high numeric,
  current_price numeric,
  breakout_price numeric,
  breakout_percentage numeric,
  volume_ratio numeric,
  rsi numeric,
  trend text,
  higher_tf_confirmed boolean DEFAULT false,
  potential_target numeric,
  invalidation_level numeric,
  signal_timestamp timestamptz DEFAULT now(),
  warnings jsonb DEFAULT '[]'::jsonb,
  indicators jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scanner_pattern_detections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_detections" ON scanner_pattern_detections;
CREATE POLICY "anon_select_detections" ON scanner_pattern_detections FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_detections" ON scanner_pattern_detections;
CREATE POLICY "anon_insert_detections" ON scanner_pattern_detections FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_detections" ON scanner_pattern_detections;
CREATE POLICY "anon_update_detections" ON scanner_pattern_detections FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_detections" ON scanner_pattern_detections;
CREATE POLICY "anon_delete_detections" ON scanner_pattern_detections FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_detections_symbol ON scanner_pattern_detections (symbol);
CREATE INDEX IF NOT EXISTS idx_detections_confidence ON scanner_pattern_detections (confidence DESC);

-- Timeframe confirmations
CREATE TABLE IF NOT EXISTS scanner_timeframe_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detection_id uuid REFERENCES scanner_pattern_detections(id) ON DELETE CASCADE,
  timeframe text NOT NULL,
  status text NOT NULL,
  trend text,
  breakout boolean DEFAULT false,
  volume numeric,
  rsi numeric,
  score integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scanner_timeframe_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tf_conf" ON scanner_timeframe_confirmations;
CREATE POLICY "anon_select_tf_conf" ON scanner_timeframe_confirmations FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tf_conf" ON scanner_timeframe_confirmations;
CREATE POLICY "anon_insert_tf_conf" ON scanner_timeframe_confirmations FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tf_conf" ON scanner_timeframe_confirmations;
CREATE POLICY "anon_update_tf_conf" ON scanner_timeframe_confirmations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tf_conf" ON scanner_timeframe_confirmations;
CREATE POLICY "anon_delete_tf_conf" ON scanner_timeframe_confirmations FOR DELETE
  TO anon, authenticated USING (true);

-- Alerts
CREATE TABLE IF NOT EXISTS scanner_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  timeframe text NOT NULL,
  event_type text NOT NULL,
  pattern_status text,
  confidence integer,
  resistance numeric,
  breakout_price numeric,
  volume_ratio numeric,
  pattern_duration integer,
  potential_target numeric,
  invalidation_level numeric,
  fired_at timestamptz DEFAULT now(),
  delivered boolean DEFAULT false,
  delivery_channels jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scanner_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_alerts" ON scanner_alerts;
CREATE POLICY "anon_select_alerts" ON scanner_alerts FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_alerts" ON scanner_alerts;
CREATE POLICY "anon_insert_alerts" ON scanner_alerts FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_alerts" ON scanner_alerts;
CREATE POLICY "anon_update_alerts" ON scanner_alerts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_alerts" ON scanner_alerts;
CREATE POLICY "anon_delete_alerts" ON scanner_alerts FOR DELETE
  TO anon, authenticated USING (true);

-- Scanner settings (key-value)
CREATE TABLE IF NOT EXISTS scanner_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE scanner_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON scanner_settings;
CREATE POLICY "anon_select_settings" ON scanner_settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settings" ON scanner_settings;
CREATE POLICY "anon_insert_settings" ON scanner_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settings" ON scanner_settings;
CREATE POLICY "anon_update_settings" ON scanner_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_settings" ON scanner_settings;
CREATE POLICY "anon_delete_settings" ON scanner_settings FOR DELETE
  TO anon, authenticated USING (true);

-- Backtest results
CREATE TABLE IF NOT EXISTS scanner_backtest_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  timeframe text NOT NULL,
  signal_date text,
  status text,
  confidence integer,
  entry_price numeric,
  target_price numeric,
  stop_price numeric,
  outcome text,
  max_favorable numeric,
  max_adverse numeric,
  bars_to_outcome integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scanner_backtest_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_backtest" ON scanner_backtest_results;
CREATE POLICY "anon_select_backtest" ON scanner_backtest_results FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_backtest" ON scanner_backtest_results;
CREATE POLICY "anon_insert_backtest" ON scanner_backtest_results FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_backtest" ON scanner_backtest_results;
CREATE POLICY "anon_update_backtest" ON scanner_backtest_results FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_backtest" ON scanner_backtest_results;
CREATE POLICY "anon_delete_backtest" ON scanner_backtest_results FOR DELETE
  TO anon, authenticated USING (true);
