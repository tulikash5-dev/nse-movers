/*
# Create IPO Analysis tables

1. Overview
   Stores Indian IPO listings from the last 1+ year with full subscription data,
   listing performance, current price tracking, quarterly results, and promoter
   holding history. Supports daily auto-fetch of new IPOs and current price updates.

2. New Tables
   - `ipo_listings`: Master IPO data — company name, symbol, dates, issue price,
     listing price, lot size, issue size, subscription categories (QIB, NII, RII,
     Total), listing gains, current price, sector, and a "is_new" flag for
     recently-added IPOs that need highlighting.
   - `ipo_quarterly_results`: Quarterly profit/revenue figures per IPO company.
   - `ipo_promoter_holdings`: Promoter holding percentage history per IPO company.

3. Security
   - RLS enabled on every table.
   - Single-tenant (no auth): policies allow anon + authenticated full CRUD since
     the data is intentionally shared/public for this analysis app.
*/

-- IPO Listings
CREATE TABLE IF NOT EXISTS ipo_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL UNIQUE,
  company_name text NOT NULL,
  sector text,
  industry text,
  open_date date,
  close_date date,
  listing_date date,
  issue_price numeric,
  listing_price numeric,
  current_price numeric,
  lot_size integer,
  issue_size_cr numeric,
  issue_size_text text,
  qib_subscription numeric,
  nii_subscription numeric,
  rii_subscription numeric,
  total_subscription numeric,
  listing_gains_pct numeric,
  current_gains_pct numeric,
  listing_gains_amount numeric,
  current_gains_amount numeric,
  market_lot integer,
  face_value numeric,
  ipo_grade text,
  registrar text,
  lead_manager text,
  exchange text DEFAULT 'NSE',
  is_new boolean DEFAULT false,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ipo_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ipos" ON ipo_listings;
CREATE POLICY "anon_select_ipos" ON ipo_listings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ipos" ON ipo_listings;
CREATE POLICY "anon_insert_ipos" ON ipo_listings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_ipos" ON ipo_listings;
CREATE POLICY "anon_update_ipos" ON ipo_listings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_ipos" ON ipo_listings;
CREATE POLICY "anon_delete_ipos" ON ipo_listings FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ipo_listings_listing_date ON ipo_listings (listing_date DESC);
CREATE INDEX IF NOT EXISTS idx_ipo_listings_symbol ON ipo_listings (symbol);
CREATE INDEX IF NOT EXISTS idx_ipo_listings_is_new ON ipo_listings (is_new);

-- IPO Quarterly Results
CREATE TABLE IF NOT EXISTS ipo_quarterly_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ipo_id uuid REFERENCES ipo_listings(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  quarter text NOT NULL,
  quarter_label text,
  revenue_cr numeric,
  profit_cr numeric,
  pat_margin numeric,
  eps numeric,
  revenue_growth_pct numeric,
  profit_growth_pct numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE (symbol, quarter)
);

ALTER TABLE ipo_quarterly_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ipo_qr" ON ipo_quarterly_results;
CREATE POLICY "anon_select_ipo_qr" ON ipo_quarterly_results FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ipo_qr" ON ipo_quarterly_results;
CREATE POLICY "anon_insert_ipo_qr" ON ipo_quarterly_results FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_ipo_qr" ON ipo_quarterly_results;
CREATE POLICY "anon_update_ipo_qr" ON ipo_quarterly_results FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_ipo_qr" ON ipo_quarterly_results;
CREATE POLICY "anon_delete_ipo_qr" ON ipo_quarterly_results FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ipo_qr_symbol ON ipo_quarterly_results (symbol);
CREATE INDEX IF NOT EXISTS idx_ipo_qr_ipo_id ON ipo_quarterly_results (ipo_id);

-- IPO Promoter Holdings
CREATE TABLE IF NOT EXISTS ipo_promoter_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ipo_id uuid REFERENCES ipo_listings(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  quarter text NOT NULL,
  quarter_label text,
  promoter_holding_pct numeric,
  change_pct numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE (symbol, quarter)
);

ALTER TABLE ipo_promoter_holdings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ipo_ph" ON ipo_promoter_holdings;
CREATE POLICY "anon_select_ipo_ph" ON ipo_promoter_holdings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ipo_ph" ON ipo_promoter_holdings;
CREATE POLICY "anon_insert_ipo_ph" ON ipo_promoter_holdings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_ipo_ph" ON ipo_promoter_holdings;
CREATE POLICY "anon_update_ipo_ph" ON ipo_promoter_holdings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_ipo_ph" ON ipo_promoter_holdings;
CREATE POLICY "anon_delete_ipo_ph" ON ipo_promoter_holdings FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ipo_ph_symbol ON ipo_promoter_holdings (symbol);
CREATE INDEX IF NOT EXISTS idx_ipo_ph_ipo_id ON ipo_promoter_holdings (ipo_id);
