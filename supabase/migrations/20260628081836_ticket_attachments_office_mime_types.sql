-- Migration: ticket_attachments_office_mime_types
-- Extends the ticket-attachments bucket to accept Word (.docx) and Excel (.xlsx)
-- files, matching the ALLOWED_MIME list in lib/storage/attachments.ts.
--
-- Why: storage.buckets.allowed_mime_types is bootstrapped from
-- supabase/config.toml only on initial bucket creation. Subsequent config.toml
-- changes do NOT propagate via `supabase stop && supabase start`; the bucket
-- keeps its original DB state. This migration is the durable source of truth
-- for the MIME list, applied on every fresh DB / `supabase db reset`.
--
-- Idempotency: the body is wrapped in a DO block that first checks the bucket
-- exists, then runs the UPDATE against the specific bucket name with a fixed
-- array. Re-running this file (locally, in CI, or after a failed apply that
-- left a partial state) converges to the same outcome: the bucket has all 7
-- MIME types, or it is left untouched if the bucket has not been created yet.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'ticket-attachments') THEN
    UPDATE storage.buckets
    SET allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    WHERE name = 'ticket-attachments';
  END IF;
END $$;
