-- Migration: ticket_attachments
-- Creates ticket_attachments table, indexes, RLS deny-all,
-- and storage bucket + anon upload-only policy.

-- ============================================================
-- 1. ticket_attachments table
-- ============================================================
CREATE TABLE ticket_attachments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  storage_path TEXT       NOT NULL,
  filename    TEXT        NOT NULL,
  mime_type   TEXT        NOT NULL,
  size_bytes  BIGINT      NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- Index for efficient ticket-scoped lookups
CREATE INDEX idx_ticket_attachments_ticket_id
  ON ticket_attachments(ticket_id);

-- Partial index for cron sweep queries (active rows only)
CREATE INDEX idx_ticket_attachments_created_at_active
  ON ticket_attachments(created_at)
  WHERE deleted_at IS NULL;

-- ============================================================
-- 2. RLS — deny-all (all access goes through service-role server actions)
-- ============================================================
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
-- No permissive policies: anon/authenticated SDK reads → zero rows.
-- Service role bypasses RLS by default.

-- ============================================================
-- 3. Storage — anon can INSERT to tickets/ prefix only
-- ============================================================
-- Note: the physical bucket is created via supabase/config.toml for local dev
-- and via the Supabase dashboard / management API for production.
-- The policy below targets the storage.objects table for the bucket.

CREATE POLICY "anon can upload ticket attachments"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND name LIKE 'tickets/%'
  );
