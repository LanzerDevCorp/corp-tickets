-- Fix: do not overwrite JWT "role" — PostgREST uses it as the Postgres session role
-- (authenticated/anon). Application RBAC uses a separate "app_role" claim and RLS helper.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  app_role text;
BEGIN
  claims := event->'claims';
  app_role := claims->'app_metadata'->>'role';

  IF app_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_role}', to_jsonb(app_role));
    event := jsonb_set(event, '{claims}', claims);
  END IF;

  RETURN event;
END;
$$;

CREATE OR REPLACE FUNCTION public.jwt_app_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    nullif(auth.jwt() ->> 'app_role', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    'client'
  );
$$;

-- public.users
DROP POLICY IF EXISTS "Admin full access on users" ON public.users;
CREATE POLICY "Admin full access on users"
  ON public.users
  FOR ALL
  USING ((select public.jwt_app_role()) = 'admin')
  WITH CHECK ((select public.jwt_app_role()) = 'admin');

DROP POLICY IF EXISTS "IT can select all users" ON public.users;
CREATE POLICY "IT can select all users"
  ON public.users
  FOR SELECT
  USING ((select public.jwt_app_role()) = 'it');

DROP POLICY IF EXISTS "Client can select own user row" ON public.users;
CREATE POLICY "Client can select own user row"
  ON public.users
  FOR SELECT
  USING (
    (select public.jwt_app_role()) = 'client'
    AND auth.uid() = id
  );

-- public.categories
DROP POLICY IF EXISTS "Admin full access on categories" ON public.categories;
CREATE POLICY "Admin full access on categories"
  ON public.categories
  FOR ALL
  TO authenticated
  USING ((select public.jwt_app_role()) = 'admin')
  WITH CHECK ((select public.jwt_app_role()) = 'admin');

DROP POLICY IF EXISTS "IT can select all categories" ON public.categories;
CREATE POLICY "IT can select all categories"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING ((select public.jwt_app_role()) = 'it');

DROP POLICY IF EXISTS "Client can select enabled categories" ON public.categories;
CREATE POLICY "Client can select enabled categories"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    (select public.jwt_app_role()) = 'client'
    AND is_enabled = true
  );

-- public.tickets
DROP POLICY IF EXISTS "Staff full access on tickets" ON public.tickets;
CREATE POLICY "Staff full access on tickets"
  ON public.tickets
  FOR ALL
  TO authenticated
  USING ((select public.jwt_app_role()) IN ('admin', 'it'))
  WITH CHECK ((select public.jwt_app_role()) IN ('admin', 'it'));

DROP POLICY IF EXISTS "Client can select own tickets" ON public.tickets;
CREATE POLICY "Client can select own tickets"
  ON public.tickets
  FOR SELECT
  TO authenticated
  USING (
    (select public.jwt_app_role()) = 'client'
    AND email = auth.jwt() ->> 'email'
  );

DROP POLICY IF EXISTS "Client can insert tickets" ON public.tickets;
CREATE POLICY "Client can insert tickets"
  ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK ((select public.jwt_app_role()) = 'client');

-- public.comments
DROP POLICY IF EXISTS "Staff can select all comments" ON public.comments;
CREATE POLICY "Staff can select all comments"
  ON public.comments
  FOR SELECT
  TO authenticated
  USING ((select public.jwt_app_role()) IN ('admin', 'it'));

DROP POLICY IF EXISTS "Staff can insert comments" ON public.comments;
CREATE POLICY "Staff can insert comments"
  ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select public.jwt_app_role()) IN ('admin', 'it')
    AND author_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Client can select public comments on own tickets" ON public.comments;
CREATE POLICY "Client can select public comments on own tickets"
  ON public.comments
  FOR SELECT
  TO authenticated
  USING (
    (select public.jwt_app_role()) = 'client'
    AND is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = comments.ticket_id
        AND t.email = (select auth.jwt() ->> 'email')
    )
  );

DROP POLICY IF EXISTS "Client can insert public comments on own tickets" ON public.comments;
CREATE POLICY "Client can insert public comments on own tickets"
  ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select public.jwt_app_role()) = 'client'
    AND is_internal = false
    AND author_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = comments.ticket_id
        AND t.email = (select auth.jwt() ->> 'email')
    )
  );
