# Proposal: Ticket File Upload (Public Submission Form)

## Intent

Clients submitting a support ticket have no way to attach evidence (screenshots, PDFs, logs, archives). Staff must request files over email, delaying triage. This adds file upload to the public ticket submission form so clients provide context up front, reducing back-and-forth and time-to-resolution.

## Scope

### In Scope
- File upload UI on the public ticket form (drag & drop + preview, per-file size, remove button, total MB progress bar) below the body textarea
- Allowed types: PDF, JPG, PNG, WEBP, ZIP; max 5 files, 50MB total
- `ticket_attachments` DB table + private Supabase storage bucket
- Direct browser-to-storage upload (post-ticket-creation) with DB registration server action
- Rollback server action (delete ticket on upload failure) + "Retry without files" recovery
- Signed-URL read access (server-side): staff read all, client reads only own ticket's attachments via tracking page
- RLS policies for `ticket_attachments`
- Cron job: after 2 months, delete files from storage and set `deleted_at` (history preserved)

### Out of Scope
- File upload on comments / replies
- Inline image rendering / thumbnails / previews of uploaded content
- Virus/malware scanning
- Resumable / chunked uploads
- Editing or adding files to an already-submitted ticket

## Capabilities

### New Capabilities
- `ticket-attachments`: upload, storage, signed-URL retrieval, access control, and lifecycle (2-month expiry) of files attached to tickets.

### Modified Capabilities
- None (existing `submitTicket` flow is extended via new client-side step + new actions, not a spec-level requirement change to ticket submission itself).

## Approach

Two-phase, client-driven upload to keep large files off the Next.js server:
1. Server action `submitTicket` creates the ticket, returns `ticketId`.
2. Client detects pending files, uploads them directly to the private bucket (browser Supabase client) under `tickets/{ticketId}/{filename}`.
3. On success: client calls a server action to register rows in `ticket_attachments`.
4. On failure: client calls a rollback server action that deletes the ticket; UI offers "Retry without files".

Reads always go through a server action that mints short-lived signed URLs; the bucket is never publicly readable. RLS restricts client reads to their own ticket's attachments; staff read all.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/public/public-ticket-form.tsx` | Modified | Add drag & drop zone, file state, upload orchestration, loading/error states |
| `app/actions/tickets.ts` | Modified | Add `registerAttachments` and `rollbackTicket` server actions; signed-URL action |
| `supabase/migrations/*` | New | `ticket_attachments` table + RLS policies |
| `supabase/config.toml` | Modified | Enable private storage bucket for ticket attachments |
| `lib/supabase/*` | Modified | Helpers for browser upload + server signed-URL generation |
| Tracking page | Modified | List + download client's own attachments via signed URLs |
| Cron / scheduled job | New | 2-month expiry: delete storage objects, set `deleted_at` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Upload succeeds but DB registration fails (orphan files) | Med | Rollback action deletes ticket; cron later sweeps orphaned storage paths |
| Ticket created but upload fails (orphan ticket) | Med | Rollback server action deletes the ticket; "Retry without files" path |
| Client-side limits bypassed | Med | Re-validate type/count/size in storage policy + register action |
| Signed URL leakage | Low | Short expiry, server-side generation only, private bucket |

## Rollback Plan

Feature is additive. To revert: remove the file UI from the public form (form works as before), drop the `registerAttachments`/`rollbackTicket`/signed-URL actions, disable the cron job. The `ticket_attachments` table and bucket can be dropped via a down-migration once no live data depends on them.

## Dependencies

- Supabase Storage enabled (config.toml already allows 50MiB); requires a configured private bucket.
- Scheduled-job mechanism (Supabase cron / pg_cron) for the 2-month expiry sweep.

## Success Criteria

- [ ] Client can attach up to 5 files (≤50MB total, allowed types) on the public form and submit successfully
- [ ] Files land in the private bucket at `tickets/{ticketId}/{filename}` and rows exist in `ticket_attachments`
- [ ] Upload failure rolls back the ticket and the user can retry without files
- [ ] Staff can read all attachments; clients can read only their own ticket's attachments — both via signed URLs, never public access
- [ ] After 2 months, files are removed from storage and rows marked `deleted_at` (record retained)
