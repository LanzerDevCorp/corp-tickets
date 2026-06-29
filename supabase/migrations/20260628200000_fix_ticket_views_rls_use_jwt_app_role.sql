-- Fix: ticket_views RLS policies use the obsolete `auth.jwt() ->> 'role'` check,
-- which after the 20260619180000_fix_jwt_app_role_claim migration returns the
-- Postgres session role ('authenticated') instead of the app role ('client').
-- The app role now lives in `app_role` (top-level) or `app_metadata.role`.
-- Drop the obsolete policies and recreate them with the `public.jwt_app_role()`
-- helper, matching the pattern used by users, categories, tickets, and comments.

DROP POLICY IF EXISTS "Client can select own ticket views" ON public.ticket_views;
DROP POLICY IF EXISTS "Client can insert own ticket views" ON public.ticket_views;
DROP POLICY IF EXISTS "Client can update own ticket views" ON public.ticket_views;

CREATE POLICY "Client can select own ticket views"
  ON public.ticket_views
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.jwt_app_role()) = 'client'
    AND user_id = (SELECT auth.uid())
  );

CREATE POLICY "Client can insert own ticket views"
  ON public.ticket_views
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.jwt_app_role()) = 'client'
    AND user_id = (SELECT auth.uid())
  );

CREATE POLICY "Client can update own ticket views"
  ON public.ticket_views
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.jwt_app_role()) = 'client'
    AND user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT public.jwt_app_role()) = 'client'
    AND user_id = (SELECT auth.uid())
  );
