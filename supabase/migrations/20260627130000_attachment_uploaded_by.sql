-- Migration: attachment_uploaded_by
-- Attributes staff-uploaded attachments so the new-activity badge (Flow 3) can
-- tell them apart from client/anon uploads made at ticket creation.
--
--   NULL          = client/anon upload  → does NOT trigger the badge
--   <staff actor> = staff upload        → triggers the badge
--
-- Set via the service-role registerStaffAttachments path (RLS bypassed), so no
-- additional grants are required. Nullable + no backfill: existing rows stay
-- NULL, which correctly reads as "not a staff upload".

-- ON DELETE SET NULL is safe here (unlike deleted_by): if the uploading staff
-- member is removed, the attachment simply stops counting as "staff activity"
-- for the badge — harmless, since the client has already seen it.
ALTER TABLE public.ticket_attachments
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
