/* Add target_4 column to snapshots and signals tables for ATR expansion target */
ALTER TABLE oif_scan_snapshots ADD COLUMN IF NOT EXISTS target_4 numeric;
ALTER TABLE oif_signals ADD COLUMN IF NOT EXISTS target_4 numeric;
