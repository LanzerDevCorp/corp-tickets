-- Migration: ticket_views (Flow 3 — Client Portal)
-- Tracks when a client last opened each ticket for new-activity badges.

CREATE TABLE IF NOT EXISTS public.ticket_views (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_views_user_id
  ON public.ticket_views(user_id);

ALTER TABLE public.ticket_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client can select own ticket views"
  ON public.ticket_views
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT auth.jwt() ->> 'role') = 'client'
  );

CREATE POLICY "Client can insert own ticket views"
  ON public.ticket_views
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT auth.jwt() ->> 'role') = 'client'
  );

CREATE POLICY "Client can update own ticket views"
  ON public.ticket_views
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT auth.jwt() ->> 'role') = 'client'
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT auth.jwt() ->> 'role') = 'client'
  );
