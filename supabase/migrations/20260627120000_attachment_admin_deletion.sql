-- Migration: attachment_admin_deletion (Flow 4)
-- Adds admin-deletion signal on ticket_attachments.
--
-- Semantics:
--   Active:            deleted_at IS NULL
--   Retention-expired: deleted_at set, deleted_by IS NULL  → client "expired ghost"
--   Admin-removed:     deleted_at set, deleted_by set       → hidden from client, restorable by staff

-- ON DELETE RESTRICT (not SET NULL): nulling deleted_by while deleted_at stays
-- set would reclassify an admin-removed attachment as retention-expired and
-- re-expose hidden content to the client. Staff are deactivated (is_active),
-- not hard-deleted, so RESTRICT does not impede normal operations.
ALTER TABLE public.ticket_attachments
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id) ON DELETE RESTRICT;

-- Soft-delete and restore are UPDATEs; prior grant migration omitted UPDATE.
GRANT UPDATE ON public.ticket_attachments TO service_role, authenticated;
