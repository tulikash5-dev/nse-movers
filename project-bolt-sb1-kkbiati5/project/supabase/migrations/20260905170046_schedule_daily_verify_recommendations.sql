/*
# Schedule daily verification of volume recommendations

1. Purpose
   Automatically runs the verify-recommendations edge function every weekday
   at 6:00 PM IST (12:30 PM UTC), after NSE market close. This checks pending
   recommendations against the next trading day's closing price and marks
   them as CORRECT, WRONG, or STOPPED — no manual intervention needed.

2. Schedule
   - 6:00 PM IST (12:30 PM UTC), Monday–Friday

3. Security
   - Uses net.http_post with the anon key to call the edge function.
*/

SELECT cron.unschedule('verify-recs-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'verify-recs-daily');

SELECT cron.schedule(
  'verify-recs-daily',
  '30 12 * * 1-5',
  $$
    SELECT net.http_post(
      url := 'https://qnfunpjingqmddjmzceu.supabase.co/functions/v1/verify-recommendations',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuZnVucGppbmdxbWRkam16Y2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjExODcsImV4cCI6MjA5NzE5NzE4N30.cq2QIUD24y4zy9g-H3cxnRhoTcwcmRbJ8mWRq4JCO3Y'
      ),
      body := '{"triggered_by":"scheduler"}'::jsonb
    );
  $$
);