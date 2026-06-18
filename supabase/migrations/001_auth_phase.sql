-- Migration: 001_auth_phase
-- Creates public.users with role metadata, trigger from auth.users,
-- and RLS policies for users, tickets, comments, categories tables.

-- ============================================================
-- 1. public.users table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'it', 'client')) DEFAULT 'client',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Trigger: auto-insert into public.users on auth.users INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_app_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- 3. RLS policies — public.users
-- ============================================================

-- Admin: full CRUD
CREATE POLICY "Admin full access on users"
  ON public.users
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- IT: SELECT only
CREATE POLICY "IT can select all users"
  ON public.users
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'it');

-- Client: own row only
CREATE POLICY "Client can select own user row"
  ON public.users
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'client'
    AND auth.uid() = id
  );

-- ============================================================
-- 4. RLS policies — public.tickets
-- (Assumes tickets table exists; policies only created if table exists)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
    ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

    -- Admin/IT: full CRUD
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'Staff full access on tickets') THEN
      CREATE POLICY "Staff full access on tickets"
        ON public.tickets
        FOR ALL
        USING (auth.jwt() ->> 'role' IN ('admin', 'it'))
        WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'it'));
    END IF;

    -- Client: SELECT own tickets (by email), INSERT new
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'Client can select own tickets') THEN
      CREATE POLICY "Client can select own tickets"
        ON public.tickets
        FOR SELECT
        USING (
          auth.jwt() ->> 'role' = 'client'
          AND email = auth.jwt() ->> 'email'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'Client can insert tickets') THEN
      CREATE POLICY "Client can insert tickets"
        ON public.tickets
        FOR INSERT
        WITH CHECK (auth.jwt() ->> 'role' = 'client');
    END IF;

    -- Public (unauthenticated): INSERT only — ticket submission is public
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'Public can insert tickets') THEN
      CREATE POLICY "Public can insert tickets"
        ON public.tickets
        FOR INSERT
        WITH CHECK (auth.role() = 'anon');
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- 5. RLS policies — public.comments
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'comments') THEN
    ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

    -- Admin/IT: full CRUD
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Staff full access on comments') THEN
      CREATE POLICY "Staff full access on comments"
        ON public.comments
        FOR ALL
        USING (auth.jwt() ->> 'role' IN ('admin', 'it'))
        WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'it'));
    END IF;

    -- Client: SELECT public (non-internal) comments on own tickets
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Client can select public comments on own tickets') THEN
      CREATE POLICY "Client can select public comments on own tickets"
        ON public.comments
        FOR SELECT
        USING (
          auth.jwt() ->> 'role' = 'client'
          AND is_internal = false
          AND EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = ticket_id
            AND t.email = auth.jwt() ->> 'email'
          )
        );
    END IF;

    -- Client: INSERT public comments only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comments' AND policyname = 'Client can insert public comments') THEN
      CREATE POLICY "Client can insert public comments"
        ON public.comments
        FOR INSERT
        WITH CHECK (
          auth.jwt() ->> 'role' = 'client'
          AND is_internal = false
          AND EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = ticket_id
            AND t.email = auth.jwt() ->> 'email'
          )
        );
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- 6. RLS policies — public.categories
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
    ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

    -- Admin: full CRUD
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Admin full access on categories') THEN
      CREATE POLICY "Admin full access on categories"
        ON public.categories
        FOR ALL
        USING (auth.jwt() ->> 'role' = 'admin')
        WITH CHECK (auth.jwt() ->> 'role' = 'admin');
    END IF;

    -- IT: SELECT all
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'IT can select all categories') THEN
      CREATE POLICY "IT can select all categories"
        ON public.categories
        FOR SELECT
        USING (auth.jwt() ->> 'role' = 'it');
    END IF;

    -- Client: SELECT enabled only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Client can select enabled categories') THEN
      CREATE POLICY "Client can select enabled categories"
        ON public.categories
        FOR SELECT
        USING (
          auth.jwt() ->> 'role' = 'client'
          AND is_enabled = true
        );
    END IF;

    -- Public (anon): SELECT enabled only — ticket submission form
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'Public can select enabled categories') THEN
      CREATE POLICY "Public can select enabled categories"
        ON public.categories
        FOR SELECT
        USING (
          auth.role() = 'anon'
          AND is_enabled = true
        );
    END IF;
  END IF;
END;
$$;

-- ============================================================
-- 7. Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
    CREATE INDEX IF NOT EXISTS idx_tickets_email ON public.tickets(email);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'comments') THEN
    CREATE INDEX IF NOT EXISTS idx_comments_ticket_is_internal ON public.comments(ticket_id, is_internal);
  END IF;
END;
$$;
