SELECT cron.unschedule('fetch-indian-stock-movers')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-indian-stock-movers');

SELECT cron.unschedule('fetch-indian-stock-movers-primary')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-indian-stock-movers-primary');

SELECT cron.unschedule('fetch-indian-stock-movers-backup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-indian-stock-movers-backup');

SELECT cron.schedule(
  'fetch-indian-stock-movers-primary',
  '0 13 * * 1-5',
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

SELECT cron.schedule(
  'fetch-indian-stock-movers-backup',
  '30 14 * * 1-5',
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
