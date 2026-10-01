-- Fix: The cron jobs used current_setting('app.supabase_url', true) which
-- returns NULL because those GUC settings were never configured.
-- Solution: hardcode the URL and anon key directly in the schedule.

SELECT cron.unschedule('fetch-indian-stock-movers-primary')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-indian-stock-movers-primary');

SELECT cron.unschedule('fetch-indian-stock-movers-backup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-indian-stock-movers-backup');

-- Primary: 5 PM IST = 11:30 AM UTC, weekdays only
SELECT cron.schedule(
  'fetch-indian-stock-movers-primary',
  '30 11 * * 1-5',
  $$
    SELECT net.http_post(
      url := 'https://qnfunpjingqmddjmzceu.supabase.co/functions/v1/fetch-stock-data',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuZnVucGppbmdxbWRkam16Y2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjExODcsImV4cCI6MjA5NzE5NzE4N30.cq2QIUD24y4zy9g-H3cxnRhoTcwcmRbJ8mWRq4JCO3Y'
      ),
      body := '{"triggered_by":"scheduler"}'::jsonb
    );
  $$
);

-- Backup: 6 PM IST = 12:30 PM UTC, weekdays only
SELECT cron.schedule(
  'fetch-indian-stock-movers-backup',
  '30 12 * * 1-5',
  $$
    SELECT net.http_post(
      url := 'https://qnfunpjingqmddjmzceu.supabase.co/functions/v1/fetch-stock-data',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuZnVucGppbmdxbWRkam16Y2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjExODcsImV4cCI6MjA5NzE5NzE4N30.cq2QIUD24y4zy9g-H3cxnRhoTcwcmRbJ8mWRq4JCO3Y'
      ),
      body := '{"triggered_by":"scheduler"}'::jsonb
    );
  $$
);
