
/*
# Schedule daily stock fetch via pg_cron

Registers a cron job that calls the fetch-stock-data edge function
every weekday at 10:30 UTC (4:00 PM IST, 30 min after NSE close).

Notes:
1. Requires pg_cron extension (pre-installed on Supabase).
2. The job is named 'fetch-indian-stock-movers' for easy identification.
3. Runs Monday–Friday only (cron doesn't natively support day-of-week weekday filtering,
   so we run daily and let the edge function handle weekend no-ops gracefully).
4. Uses net.http_post to call the deployed edge function.
*/

-- Enable pg_cron and pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing job with the same name to avoid duplicates
SELECT cron.unschedule('fetch-indian-stock-movers')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'fetch-indian-stock-movers'
);

-- Schedule: 10:30 UTC = 4:00 PM IST, Mon–Fri
SELECT cron.schedule(
  'fetch-indian-stock-movers',
  '30 10 * * 1-5',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/fetch-stock-data',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
      ),
      body := '{"triggered_by":"scheduler"}'::jsonb
    );
  $$
);
