/*
# Schedule OI Flow Scanner - Every 5 Minutes During Market Hours

Creates a pg_cron job to trigger the OI flow scanner edge function every 5 minutes
during NSE market hours (9:15 AM - 3:30 PM IST, Mon-Fri).

1. Changes
- Adds pg_cron schedule for 'oi-flow-scan' edge function
- Runs every 5 minutes during market hours
- Uses India timezone (IST = UTC+5:30, so 9:15 IST = 3:45 UTC, 3:30 IST = 10:00 UTC)

2. Notes
- The edge function handles its own fallback data sources if NSE is unreachable.
*/

SELECT cron.schedule(
  'oi-flow-scan-5min',
  '*/5 3-10 * * 1-5',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_functions_url') || '/oi-flow-scan',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('triggered_by', 'scheduler')
  );
  $$
);
