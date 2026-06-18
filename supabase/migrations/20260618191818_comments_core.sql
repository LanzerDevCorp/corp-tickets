-- Migration: comments_core
-- Append-only comments table with RLS.
-- No updated_at — comments are immutable by design.

-- ============================================================
-- 1. Create public.comments table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        NOT NULL REFERENCES public.tickets(id)  ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES public.users(id)    ON DELETE RESTRICT,
  body        TEXT        NOT NULL,
  is_internal BOOLEAN     NOT NULL DEFAULT false,
  cc_emails   TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Index for chronological comment queries per ticket
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_comments_ticket_created
  ON public.comments(ticket_id, created_at);

-- ============================================================
-- 3. Enable Row Level Security
-- ============================================================
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS Policies
--
-- Convention: (select auth.jwt()) / (select auth.uid()) wrapping
-- is the Supabase initplan optimization — evaluates the function
-- once per query instead of once per row.
--
-- Role checks follow existing project convention:
--   auth.jwt() ->> 'role' surfaces app_metadata.role from the JWT.
--
-- NO UPDATE and NO DELETE policies — comments are an audit trail.
-- Anon: no policies = no access.
-- ============================================================

-- Staff (admin/IT): SELECT all comments
CREATE POLICY "Staff can select all comments"
  ON public.comments
  FOR SELECT
  TO authenticated
  USING (
    (select auth.jwt() ->> 'role') IN ('admin', 'it')
  );

-- Staff (admin/IT): INSERT any comment (public or internal)
-- author_id must match the authenticated user — prevents spoofing
CREATE POLICY "Staff can insert comments"
  ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.jwt() ->> 'role') IN ('admin', 'it')
    AND author_id = (select auth.uid())
  );

-- Client: SELECT only public (non-internal) comments on own tickets
-- Ownership is determined by tickets.email matching the JWT email claim
CREATE POLICY "Client can select public comments on own tickets"
  ON public.comments
  FOR SELECT
  TO authenticated
  USING (
    (select auth.jwt() ->> 'role') = 'client'
    AND is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = comments.ticket_id
        AND t.email = (select auth.jwt() ->> 'email')
    )
  );

-- Client: INSERT only public comments on own tickets
-- Blocks is_internal=true at DB level regardless of application code
CREATE POLICY "Client can insert public comments on own tickets"
  ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.jwt() ->> 'role') = 'client'
    AND is_internal = false
    AND author_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = comments.ticket_id
        AND t.email = (select auth.jwt() ->> 'email')
    )
  );
