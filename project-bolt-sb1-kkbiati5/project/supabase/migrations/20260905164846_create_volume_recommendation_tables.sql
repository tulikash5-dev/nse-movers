/*
# Volume Scanner Recommendation Tracking

1. Purpose
   - Store each LONG/SHORT recommendation from the Volume Trade Finder.
   - The next trading day, fetch the closing price and evaluate whether the
     recommendation was correct (price moved in the predicted direction
     without hitting the stop-loss).
   - Maintain a running accuracy history so users can see how well the
     scanner's signals perform over time.

2. New Tables
   - `volume_recommendations`
     - `id` (uuid, PK)
     - `scan_date` (date) — the date the signal was generated
     - `ticker` (text) — stock symbol
     - `action` (text) — LONG or SHORT
     - `signal_type` (text) — uptrend, golden_cross, downtrend, death_cross
     - `entry_price` (numeric) — close price on scan date
     - `suggested_stop` (numeric) — ATR-based stop-loss
     - `volume_ratio` (numeric) — volume / avg volume at signal time
     - `rsi` (numeric) — RSI at signal time
     - `change_pct` (numeric) — % change on scan day
     - `message` (text) — human-readable signal explanation
     - `status` (text) — PENDING, CORRECT, WRONG, STOPPED
     - `verification_date` (date) — next trading day date used for verification
     - `verification_price` (numeric) — close price on verification date
     - `pnl_pct` (numeric) — % gain/loss from entry to verification
     - `created_at` (timestamptz)

3. Security
   - Enable RLS on `volume_recommendations`.
   - Single-tenant app (no auth) → allow anon + authenticated full CRUD.
*/