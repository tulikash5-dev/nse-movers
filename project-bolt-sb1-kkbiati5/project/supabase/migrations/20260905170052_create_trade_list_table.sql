/*
# Create trade_list table for "Stocks to Trade Today"

1. Purpose
   Stores stocks that the user selects from any page (Volume Finder, Scanner,
   Home, etc.) to track for trading today. Each entry records the stock symbol,
   the direction (LONG or SHORT), the source page, entry price, stop-loss,
   and optional notes. Users can remove entries when done.

2. New Tables
   - `trade_list`
     - `id` (uuid, PK)
     - `ticker` (text, not null) — stock symbol
     - `direction` (text, not null) — LONG or SHORT
     - `source` (text) — which page added it (volume-finder, scanner, home, etc.)
     - `entry_price` (numeric) — price at time of selection
     - `suggested_stop` (numeric) — stop-loss if provided
     - `notes` (text) — optional user notes
     - `created_at` (timestamptz, default now())

3. Security
   - RLS enabled, anon+authenticated full CRUD (single-tenant, no auth).
*/

CREATE TABLE IF NOT EXISTS trade_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  source text,
  entry_price numeric(12,2),
  suggested_stop numeric(12,2),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_list_ticker ON trade_list(ticker);
CREATE INDEX IF NOT EXISTS idx_trade_list_direction ON trade_list(direction);
CREATE INDEX IF NOT EXISTS idx_trade_list_created ON trade_list(created_at);

ALTER TABLE trade_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_trade_list" ON trade_list;
CREATE POLICY "anon_select_trade_list" ON trade_list FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_trade_list" ON trade_list;
CREATE POLICY "anon_insert_trade_list" ON trade_list FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_trade_list" ON trade_list;
CREATE POLICY "anon_update_trade_list" ON trade_list FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_trade_list" ON trade_list;
CREATE POLICY "anon_delete_trade_list" ON trade_list FOR DELETE
  TO anon, authenticated USING (true);