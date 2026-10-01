-- Update scheduler to run at 5 PM IST (11:30 UTC) weekdays
-- Also add a backup at 6 PM IST (12:30 UTC) in case first fetch fails

SELECT cron.unschedule('fetch-indian-stock-movers-primary')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-indian-stock-movers-primary');

SELECT cron.unschedule('fetch-indian-stock-movers-backup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-indian-stock-movers-backup');

-- Primary: 5 PM IST = 11:30 AM UTC
SELECT cron.schedule(
  'fetch-indian-stock-movers-primary',
  '30 11 * * 1-5',
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

-- Backup: 6 PM IST = 12:30 PM UTC
SELECT cron.schedule(
  'fetch-indian-stock-movers-backup',
  '30 12 * * 1-5',
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
