-- Migration: 002_tickets_core
-- Creates categories and tickets tables, updates user table/trigger, and configures RLS.

-- ============================================================
-- 1. Alter public.users table to include email & display_name
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- ============================================================
-- 2. Update trigger public.handle_new_auth_user()
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, role, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_app_meta_data->>'role', 'client'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Backfill existing users
-- ============================================================
INSERT INTO public.users (id, role, email, display_name)
SELECT
  id,
  COALESCE(raw_app_meta_data->>'role', 'client'),
  email,
  COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name')
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role;

-- ============================================================
-- 4. public.categories table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Categories RLS policies
CREATE POLICY "Admin full access on categories"
  ON public.categories
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "IT can select all categories"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'it');

CREATE POLICY "Client can select enabled categories"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'client'
    AND is_enabled = true
  );

CREATE POLICY "Public can select enabled categories"
  ON public.categories
  FOR SELECT
  TO anon
  USING (is_enabled = true);

-- ============================================================
-- 5. public.tickets table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  closure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_closure_reason CHECK (
    (status = 'closed' AND closure_reason IS NOT NULL) OR
    (status != 'closed' AND closure_reason IS NULL)
  )
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Tickets RLS policies
CREATE POLICY "Staff full access on tickets"
  ON public.tickets
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'it'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'it'));

CREATE POLICY "Client can select own tickets"
  ON public.tickets
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'client'
    AND email = auth.jwt() ->> 'email'
  );

CREATE POLICY "Client can insert tickets"
  ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' = 'client');

CREATE POLICY "Public can insert tickets"
  ON public.tickets
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ============================================================
-- 6. Trigger for updated_at on tickets
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_tickets_updated_at ON public.tickets;
CREATE TRIGGER set_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ============================================================
-- 7. Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON public.tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at);
