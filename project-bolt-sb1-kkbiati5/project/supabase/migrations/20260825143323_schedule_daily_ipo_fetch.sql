/*
# Schedule daily IPO data fetch

1. Overview
   Registers a cron job that calls the fetch-ipo-data edge function every weekday
   after market close (5:00 PM IST = 11:30 AM UTC). The edge function checks for new
   IPOs, updates current prices for existing ones, and marks recently-listed IPOs
   as "new" for highlighting in the UI.

2. Schedule
   - 5:00 PM IST (11:30 AM UTC), Monday–Friday

3. Security
   - Uses net.http_post to call the edge function with the anon key.
*/

SELECT cron.unschedule('fetch-ipo-data-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-ipo-data-daily');

SELECT cron.schedule(
  'fetch-ipo-data-daily',
  '30 11 * * 1-5',
  $$
    SELECT net.http_post(
      url := 'https://qnfunpjingqmddjmzceu.supabase.co/functions/v1/fetch-ipo-data',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuZnVucGppbmdxbWRkam16Y2V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjExODcsImV4cCI6MjA5NzE5NzE4N30.cq2QIUD24y4zy9g-H3cxnRhoTcwcmRbJ8mWRq4JCO3Y'
      ),
      body := '{"triggered_by":"scheduler"}'::jsonb
    );
  $$
);
