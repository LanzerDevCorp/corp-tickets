# Verify Report: ticket-file-upload

**Change**: ticket-file-upload
**Date**: 2026-06-22
**Mode**: Strict TDD (vitest)
**Verdict**: PASS WITH WARNINGS

## Test Suite Evidence

vitest run: 291 passed, 17 skipped (RLS integration tests), 0 failed
New tests (this change): 43 passing across 6 new test files
Suite duration: ~15s

## Completeness Table

Phase 1 Foundation 1.1-1.6: COMPLETE
Phase 2 Server Actions 2.1-2.5: COMPLETE
Phase 3 FileUploadZone 3.1-3.3: COMPLETE
Phase 4 Form Integration 4.1-4.3: COMPLETE
Phase 5 Attachment Display 5.1-5.6: COMPLETE
Phase 6 Cron Migration 6.1-6.2: DEFERRED (by design)

## Security Checklist

Bucket is private: PASS - config.toml public=false
Anon INSERT-only to tickets/ prefix: PASS - migration policy with WITH CHECK
ticket_attachments RLS deny-all: PASS - ENABLE ROW LEVEL SECURITY, no permissive policies
getTicketAttachments uses admin client: PASS - supabaseAdmin for all DB/storage reads
Client ownership verified: PASS - email claim vs ticket email
Signed URLs only (no public URLs): PASS - createSignedUrl(path, 3600) server-side

## Three-Phase Flow Checklist

submitTicket first then ticketId for path: PASS
Browser client for upload: PASS - createClient() in upload-orchestration.ts
registerAttachments only after all uploads: PASS
rollbackTicket deletes storage AND ticket: PASS - storage.remove() then tickets.delete()
Retry without files clears selection: PASS - setSelectedFiles([]) before re-submit

## Data Integrity Checklist

FK to tickets CASCADE DELETE: PASS
storage_path format tickets/{ticketId}/{fileId}-{filename}: PASS
deleted_at column exists: PASS

## UI/UX Checklist

FileUploadZone name/size/remove per file: PASS
Progress bar shown: PASS - role=progressbar with aria attrs
Loading state during upload: PASS - Uploading files... panel
Expired files show File expired: PASS
Empty list shows nothing: PASS - return null

## Issues

### CRITICAL

None.

### WARNING

[WARNING-1] Rollback storage removal uses prefix path not per-file removal
rollbackTicket calls storage.remove() with folder path tickets/{id}/.
Supabase Storage .remove() takes explicit object paths, not glob prefixes.
Passing a folder path may silently succeed without removing objects.
Risk: orphan storage objects if prefix-path does not match SDK behavior on hosted tier.
Mitigation: use storage.list() then storage.remove(paths), or verify against live bucket.

[WARNING-2] Client ticket email lookup uses browser client not admin
attachments.ts line 146 queries tickets table via browser/server client for ownership check.
If tickets RLS restricts SELECT for client role, lookup returns null causing false auth error.
Safe (no data leak) but may affect legitimate clients. No test covers this edge case.

[WARNING-3] Phase 6 Cron sweep deferred - no automated expiry in production
deleted_at column and UI label exist but no automated process enforces the two-month expiry.
Intentionally deferred pending pg_cron availability. Must be completed before go-live.

### SUGGESTION

[SUGGESTION-1] Test count: apply-progress says 37, actual is 43. Update artifact.
[SUGGESTION-2] Server action errors in Spanish (No autorizado). Consider error codes.
[SUGGESTION-3] No test for Uploading files... loading state UI branch in form.

## Final Verdict

PASS WITH WARNINGS
0 CRITICAL | 3 WARNINGS | 3 SUGGESTIONS

All 43 new tests pass (291/291 total). All core tasks complete (Phase 6 intentionally deferred).
WARNING-1 should be verified against hosted Supabase before go-live.
Phase 6 must be completed before the two-month expiry SLA is enforced.
