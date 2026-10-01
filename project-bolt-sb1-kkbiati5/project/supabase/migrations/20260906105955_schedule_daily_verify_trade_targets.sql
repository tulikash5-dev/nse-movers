/*
# Schedule daily verification of trade list targets

1. Purpose
   Automatically runs the verify-trade-targets edge function every weekday
   at 6:30 PM IST (13:00 PM UTC), 30 minutes after the verify-recommendations
   job. This checks whether each pending trade's target price or stop-loss
   was hit on the next trading day and updates the target_status accordingly.

2. Schedule
   - 6:30 PM IST (13:00 PM UTC), Monday–Friday

3. Security
   - Uses net.http_post with the anon key to call the edge function.
*/

SELECT cron.unschedule('verify-trade-targets-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'verify-trade-targets-daily');

SELECT cron.schedule(
  'verify-trade-targets-daily',
  '0 13 * * 1-5',
  $$
    SELECT net.http_post(
      url := 'https://qnfunpjingqmddjmzceu.supabase.co/functions/v1/verify-trade-targets',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuZnVucGppbmdxbWRkam16Y2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjExODcsImV4cCI6MjA5NzE5NzE4N30.cq2QIUD24y4zy9g-H3cxnRhoTcwcmRbJ8mWRq4JCO3Y'
      ),
      body := '{"triggered_by":"scheduler"}'::jsonb
    );
  $$
);
