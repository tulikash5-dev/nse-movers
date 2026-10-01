/*
# Schedule daily post-market scanner scan via pg_cron

1. Overview
   Registers a cron job that calls the run-scanner-scan edge function every weekday
   after the Indian market closes (5:30 PM IST = 12:00 PM UTC). The edge function
   runs the multi-timeframe rounding bottom scanner across all instruments, stores
   the detected patterns in scanner_pattern_detections, and publishes highlighted
   alerts (high-confidence and breakout patterns) to scanner_alerts.

2. Schedule
   - Primary: 5:30 PM IST (12:00 PM UTC), Monday–Friday
   - Backup: 6:30 PM IST (13:00 PM UTC), Monday–Friday
   - The backup run ensures the scan completes even if the primary attempt fails.

3. Security
   - Uses net.http_post to call the edge function with the anon key.
   - The edge function uses the service role key internally to write results.
*/

-- Remove any existing job with the same name to avoid duplicates
SELECT cron.unschedule('run-scanner-scan-primary')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'run-scanner-scan-primary');

SELECT cron.unschedule('run-scanner-scan-backup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'run-scanner-scan-backup');

-- Primary: 5:30 PM IST = 12:00 PM UTC, weekdays only
SELECT cron.schedule(
  'run-scanner-scan-primary',
  '0 12 * * 1-5',
  $$
    SELECT net.http_post(
      url := 'https://qnfunpjingqmddjmzceu.supabase.co/functions/v1/run-scanner-scan',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuZnVucGppbmdxbWRkam16Y2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjExODcsImV4cCI6MjA5NzE5NzE4N30.cq2QIUD24y4zy9g-H3cxnRhoTcwcmRbJ8mWRq4JCO3Y'
      ),
      body := '{"triggered_by":"scheduler_primary"}'::jsonb
    );
  $$
);

-- Backup: 6:30 PM IST = 13:00 PM UTC, weekdays only
SELECT cron.schedule(
  'run-scanner-scan-backup',
  '0 13 * * 1-5',
  $$
    SELECT net.http_post(
      url := 'https://qnfunpjingqmddjmzceu.supabase.co/functions/v1/run-scanner-scan',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuZnVucGppbmdxbWRkam16Y2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjExODcsImV4cCI6MjA5NzE5NzE4N30.cq2QIUD24y4zy9g-H3cxnRhoTcwcmRbJ8mWRq4JCO3Y'
      ),
      body := '{"triggered_by":"scheduler_backup"}'::jsonb
    );
  $$
);
