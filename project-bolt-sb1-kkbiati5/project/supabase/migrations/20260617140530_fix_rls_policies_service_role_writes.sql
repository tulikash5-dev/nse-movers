-- Fix RLS on stock_movers: restrict writes to service_role only
DROP POLICY IF EXISTS "anon_insert_stock_movers" ON public.stock_movers;
DROP POLICY IF EXISTS "anon_update_stock_movers" ON public.stock_movers;
DROP POLICY IF EXISTS "anon_delete_stock_movers" ON public.stock_movers;

CREATE POLICY "service_insert_stock_movers" ON public.stock_movers
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "service_update_stock_movers" ON public.stock_movers
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_delete_stock_movers" ON public.stock_movers
  FOR DELETE TO service_role USING (true);

-- Fix RLS on scheduler_runs
DROP POLICY IF EXISTS "anon_insert_scheduler_runs" ON public.scheduler_runs;
DROP POLICY IF EXISTS "anon_update_scheduler_runs" ON public.scheduler_runs;
DROP POLICY IF EXISTS "anon_delete_scheduler_runs" ON public.scheduler_runs;

CREATE POLICY "service_insert_scheduler_runs" ON public.scheduler_runs
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "service_update_scheduler_runs" ON public.scheduler_runs
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_delete_scheduler_runs" ON public.scheduler_runs
  FOR DELETE TO service_role USING (true);

-- Fix RLS on app_settings: only service_role can write
DROP POLICY IF EXISTS "anon_insert_app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "anon_update_app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "anon_delete_app_settings" ON public.app_settings;

CREATE POLICY "service_insert_app_settings" ON public.app_settings
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "service_update_app_settings" ON public.app_settings
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_delete_app_settings" ON public.app_settings
  FOR DELETE TO service_role USING (true);
