# Tasks: Ticket File Upload

## Review Workload Forecast

| Field                   | Value                      |
| ----------------------- | -------------------------- |
| Estimated changed lines | 500–700                    |
| 400-line budget risk    | High                       |
| Chained PRs recommended | No                         |
| Suggested split         | Single PR (size:exception) |
| Delivery strategy       | exception-ok               |
| Chain strategy          | size-exception             |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal            | Likely PR | Notes                                                 |
| ---- | --------------- | --------- | ----------------------------------------------------- |
| 1    | All tasks below | Single PR | size:exception accepted; maintainer approval required |

---

## Phase 1: Foundation — DB, Storage, Shared Constants

- [x] 1.1 Create `supabase/migrations/{ts}_ticket_attachments.sql`: `ticket_attachments` table (id UUID PK, ticket_id FK → tickets ON DELETE CASCADE, storage_path TEXT, filename TEXT, mime_type TEXT, size_bytes BIGINT, created_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ); index on ticket_id; partial index on created_at WHERE deleted_at IS NULL; RLS ENABLED with zero permissive policies (deny-all)
- [x] 1.2 In the same migration, add the private `ticket-attachments` bucket and its storage policies: anon INSERT allowed scoped to `tickets/` prefix only; no anon SELECT/UPDATE/DELETE
- [x] 1.3 Modify `supabase/config.toml`: add `[storage.buckets.ticket-attachments]` section — private bucket, 50 MiB file size limit, allowed MIME types (pdf, jpeg, png, webp, zip)
- [x] 1.4 Create `lib/storage/attachments.ts`: export `ATTACHMENT_BUCKET`, `MAX_FILES`, `MAX_TOTAL_BYTES`, `ALLOWED_MIME` constants, and `buildStoragePath(ticketId: string, fileId: string, filename: string): string` → `tickets/{ticketId}/{fileId}-{filename}`
- [x] 1.5 **TEST (RED)** — Write `lib/storage/__tests__/attachments.test.ts`: assert `buildStoragePath` output format and that constants match spec values; run vitest → confirm tests fail (file not yet complete)
- [x] 1.6 **TEST (GREEN)** — Verify tests pass after 1.4 implementation

---

## Phase 2: Server Actions

- [x] 2.1 **TEST (RED)** — Write `app/actions/__tests__/attachments.test.ts`: unit tests covering (a) `registerAttachments` rejects >5 files, (b) rejects cumulative >50 MB, (c) rejects disallowed MIME type, (d) happy path inserts rows; (e) `rollbackTicket` deletes storage objects then ticket row; (f) `getTicketAttachments` returns signed URLs for owner's ticket, returns error for mismatched ticket. Mock `supabaseAdmin`.
- [x] 2.2 Add `registerAttachments(ticketId, files: {storage_path, filename, mime_type, size_bytes}[])` to `app/actions/attachments.ts` (new dedicated file): re-validate count ≤ 5, total size ≤ 50 MB, each MIME in allowlist; bulk INSERT into `ticket_attachments` via `supabaseAdmin`; return `{error}`
- [x] 2.3 Add `rollbackTicket(ticketId)` to `app/actions/attachments.ts`: delete storage objects at `tickets/{ticketId}/` via `supabaseAdmin`; then DELETE from `tickets` where id = ticketId; return `{error}`
- [x] 2.4 Add `getTicketAttachments(ticketId)` to `app/actions/attachments.ts`: verify caller is staff OR authenticated user whose email matches ticket email; SELECT from `ticket_attachments` where ticket_id = ticketId; for each active row mint 3600s signed URL via `supabaseAdmin.storage`; return `{id, filename, size_bytes, url | null, expired: boolean}[]`
- [x] 2.5 **TEST (GREEN)** — Confirm all tests from 2.1 pass; fix any issues

---

## Phase 3: FileUploadZone Component

- [x] 3.1 **TEST (RED)** — Write `components/public/__tests__/file-upload-zone.test.tsx` using Vitest + RTL: (a) renders drag-drop zone and file input, (b) rejects disallowed MIME with inline error, (c) rejects 6th file with count-limit error, (d) rejects file that pushes total over 50 MB, (e) shows filename + size + remove button per file, (f) progress bar reflects total selected bytes, (g) remove button removes file and updates progress
- [x] 3.2 Create `components/public/file-upload-zone.tsx`: drag-and-drop zone + file picker input; per-file preview (filename, human-readable size, remove button); inline validation errors (type, count, size); total-size progress bar (used MB / 50 MB); exposes `selectedFiles: File[]` and `onFilesChange` callback; no server calls
- [x] 3.3 **TEST (GREEN)** — Confirm all tests from 3.1 pass

---

## Phase 4: Form Integration — Three-Phase Submit Orchestration

- [x] 4.1 **TEST (RED)** — Write `components/public/__tests__/public-ticket-form.upload.test.tsx`: (a) happy path — files uploaded → registerAttachments called in order; (b) zero-files path skips upload+register; (c) upload failure triggers rollbackTicket and canRetryWithoutFiles=true; (d) register failure triggers rollbackTicket and canRetryWithoutFiles=true; (e) rollback failure returns canRetryWithoutFiles=false. Tests the extracted `orchestrateFileUpload` pure function.
- [x] 4.2 Create `components/public/upload-orchestration.ts`: extracted orchestration logic; Modify `components/public/public-ticket-form.tsx`: add `selectedFiles` state; mount `<FileUploadZone>` below body textarea; extend submit handler with three-phase flow; "Uploading files…" loading state; "Retry without files" error recovery
- [x] 4.3 **TEST (GREEN)** — Confirm all tests from 4.1 pass

---

## Phase 5: Attachment Display — Staff and Client Views

- [x] 5.1 **TEST (RED)** — Write `components/dashboard/__tests__/ticket-detail.attachments.test.tsx`: (a) renders attachment list with filename, size, download link; (b) renders "File expired" with no link when `expired: true`; (c) shows nothing when no attachments
- [x] 5.2 Create `components/dashboard/attachment-list.tsx` shared component; Modify `components/dashboard/ticket-detail.tsx`: add `initialAttachments` prop; render AttachmentList; Modify `app/(staff)/dashboard/tickets/[id]/page.tsx`: fetch attachments alongside ticket/comments
- [x] 5.3 **TEST (RED)** — Write `components/tracking/__tests__/client-ticket-view.attachments.test.tsx`: same scenarios as 5.1 for client view
- [x] 5.4 Modify `app/(tracking)/track/[ticketId]/page.tsx`: add `getTicketAttachments(ticketId)` call alongside existing ticket/comments fetches; pass result as prop to client view
- [x] 5.5 Modify `components/tracking/client-ticket-view.tsx`: consume `initialAttachments` prop; render AttachmentList in content area; ownership enforced server-side by `getTicketAttachments`
- [x] 5.6 **TEST (GREEN)** — Confirm all tests from 5.1 and 5.3 pass

---

## Phase 6: Cron Migration (Optional / Deferred)

> **GATE**: confirm pg_cron and pg_net are enabled on the hosted Supabase project tier before running this migration. Skip on local dev stack.
> **STATUS**: DEFERRED — pg_cron availability on hosted tier not yet confirmed.

- [ ] 6.1 Create `supabase/migrations/{ts}_attachments_cron.sql`: enable `pg_cron` and `pg_net` extensions; create `sweep_expired_attachments()` PL/pgSQL function that (a) selects rows WHERE created_at < now() - interval '2 months' AND deleted_at IS NULL, (b) for each row calls `supabase_storage.delete_object(ATTACHMENT_BUCKET, storage_path)`, (c) sets deleted_at = now() on each row; create `sweep_orphan_storage_objects()` that removes objects at `tickets/` with no matching `ticket_attachments` row and no valid ticket; schedule both via `cron.schedule` daily at 02:00 UTC
- [ ] 6.2 Verify migration applies cleanly in local Supabase stack (after confirming pg_cron availability); manual smoke test: insert expired row, run fn manually, assert deleted_at set and object removed from bucket

---

## Spec → Task Coverage

| Spec Requirement                      | Tasks                   |
| ------------------------------------- | ----------------------- |
| File selection + client validation    | 3.1, 3.2, 3.3           |
| Server-side re-validation             | 2.1, 2.2, 2.5           |
| Three-phase submit flow               | 4.1, 4.2, 4.3           |
| Upload failure rollback               | 2.1, 2.3, 4.1, 4.2, 4.3 |
| Registration failure rollback         | 2.1, 2.4, 4.1, 4.2, 4.3 |
| Private storage + signed URLs         | 1.1, 1.2, 2.4           |
| RLS deny-all on ticket_attachments    | 1.1                     |
| Staff attachment display              | 5.1, 5.2, 5.6           |
| Client attachment display + ownership | 5.3, 5.4, 5.5, 5.6      |
| Two-month expiry + cron               | 6.1, 6.2 — DEFERRED     |
| Shared constants + path builder       | 1.4, 1.5, 1.6           |
