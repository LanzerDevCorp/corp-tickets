-- Migration: allow_authenticated_uploads
-- Updates the RLS policy on storage.objects for the ticket-attachments bucket
-- to allow authenticated users (e.g. logged-in staff or clients) to upload files
-- via the public ticket form, in addition to anonymous users.

ALTER POLICY "anon can upload ticket attachments"
  ON storage.objects
  TO anon, authenticated;
