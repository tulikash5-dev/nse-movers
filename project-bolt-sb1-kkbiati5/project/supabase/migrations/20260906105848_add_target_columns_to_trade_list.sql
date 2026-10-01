/*
# Add target tracking columns to trade_list

1. Purpose
   Adds three new columns to the `trade_list` table so each trade pick can store
   a price target and have it automatically verified the next trading day.

2. Modified Tables
   - `trade_list`
     - `target_price` (numeric, nullable) — the price target for the trade.
       For LONGs, target is above entry; for SHORTs, below entry.
     - `target_status` (text, nullable) — verification result:
       'PENDING' (not yet checked), 'TARGET_HIT' (price reached target),
       'STOP_HIT' (price hit stop before target), 'EXPIRED' (neither hit
       after the holding period), NULL (no target set / not applicable).
     - `target_checked_at` (timestamptz, nullable) — when the verification ran.

3. Security
   - No changes to RLS — existing anon+authenticated full CRUD policies
     already cover the new columns.
*/

ALTER TABLE trade_list
  ADD COLUMN IF NOT EXISTS target_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS target_status text CHECK (target_status IN ('PENDING', 'TARGET_HIT', 'STOP_HIT', 'EXPIRED')),
  ADD COLUMN IF NOT EXISTS target_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_trade_list_target_status ON trade_list(target_status);
