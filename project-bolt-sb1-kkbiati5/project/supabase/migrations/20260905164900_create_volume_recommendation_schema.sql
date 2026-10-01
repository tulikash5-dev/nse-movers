/*
# Volume Scanner Recommendation Tracking — Schema

1. New Tables
   - `volume_recommendations` — stores each LONG/SHORT signal with entry price,
     stop, indicators; later updated with verification price and outcome.
2. Security
   - RLS enabled, anon+authenticated full CRUD (single-tenant, no auth).
*/

CREATE TABLE IF NOT EXISTS volume_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_date date NOT NULL,
  ticker text NOT NULL,
  action text NOT NULL CHECK (action IN ('LONG', 'SHORT')),
  signal_type text NOT NULL,
  entry_price numeric(12,2) NOT NULL,
  suggested_stop numeric(12,2),
  volume_ratio numeric(8,2),
  rsi numeric(5,2),
  change_pct numeric(8,2),
  message text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CORRECT', 'WRONG', 'STOPPED')),
  verification_date date,
  verification_price numeric(12,2),
  pnl_pct numeric(8,2),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vol_rec_scan_date ON volume_recommendations(scan_date);
CREATE INDEX IF NOT EXISTS idx_vol_rec_ticker ON volume_recommendations(ticker);
CREATE INDEX IF NOT EXISTS idx_vol_rec_status ON volume_recommendations(status);

ALTER TABLE volume_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_vol_rec" ON volume_recommendations;
CREATE POLICY "anon_select_vol_rec" ON volume_recommendations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_vol_rec" ON volume_recommendations;
CREATE POLICY "anon_insert_vol_rec" ON volume_recommendations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_vol_rec" ON volume_recommendations;
CREATE POLICY "anon_update_vol_rec" ON volume_recommendations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_vol_rec" ON volume_recommendations;
CREATE POLICY "anon_delete_vol_rec" ON volume_recommendations FOR DELETE
  TO anon, authenticated USING (true);