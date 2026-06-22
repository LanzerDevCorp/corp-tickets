# Design: Ticket File Upload

## Technical Approach

Three-phase, client-driven upload keeps large files off the Next.js server (proposal approach). Phase 1 `submitTicket` (existing, returns `ticketId` at line 79) creates the ticket via service role. Phase 2 the browser uploads directly to a private bucket as the `anon` role (the public form has no session — confirmed in `app/(public)/layout.tsx`). Phase 3 `registerAttachments` re-validates and inserts rows via service role. Reads are always server-minted signed URLs; the bucket is never public. RLS on `ticket_attachments` denies all SDK access — every read/write goes through service-role server actions (matches existing `tickets.ts` pattern using `supabaseAdmin`).

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|----------|--------|----------------------|-----------|
| Upload path | Browser → storage direct (`anon`) | Stream through server action | Keeps 50MB off serverless; proposal mandate |
| Bucket write auth | `anon` INSERT allowed, scoped to `tickets/` prefix; NO read/update/delete for `anon` | Authenticated-only write | Public form is unauthenticated; abuse bounded by register/rollback + cron sweep |
| `ticket_attachments` access | RLS denies all roles; service-role actions only | Client-readable RLS via email | Matches `tickets.ts` (`supabaseAdmin` everywhere); centralizes ownership checks server-side |
| Client identity for reads | Authenticated provisioned user; email must equal ticket email | Opaque tracking token | No token exists — tracking reuses `getTicketDetail` which enforces `email = auth.jwt() email` |
| Signed URL expiry | 3600s (1 hour), generated per page load | Long-lived / cached URLs | Spec: short-lived, always fresh; bucket stays private |
| Rollback scope | Deletes ticket AND storage objects | Delete ticket only | Open Q1 resolved YES — prevents orphan files; cron is backstop only |
| "Retry without files" | User-driven: error state clears file list, re-enables submit; user resubmits manually | Auto-resubmit | Open Q2 resolved — no surprise re-send; user controls |
| Cron mechanism | `pg_cron` + `pg_net` (Supabase hosted), daily 02:00 | Edge Function scheduler | Native DB schedule; no extra runtime; one migration |
| Filename collisions | Store under `tickets/{ticketId}/{uuid}-{filename}` | Raw filename | Avoids same-name overwrite within a ticket |

## Data Flow

    Browser (anon)                  Server actions (service role)        Storage / DB
    ──────────────                  ─────────────────────────────        ────────────
    submit form ───────────────────► submitTicket ──────────────────────► tickets INSERT
                ◄── { ticketId } ────
    upload each file ──────────────────────────────────────────────────► bucket tickets/{id}/{uuid}-name
    (supabase.storage.upload, anon)
    registerAttachments(id, paths) ─► validate count/size/mime ─────────► ticket_attachments INSERT
                                       on phase 2/3 failure:
                                       rollbackTicket(id) ───────────────► delete bucket objs + ticket row

    Read (staff/client view) ──────► getTicketAttachments(id) ──────────► verify role/ownership
                                       mint signed URLs (1h) ────────────► returns rows + url | "expired"

    Cron 02:00 daily ──────────────► sweep created_at < now()-2mo ───────► delete storage + set deleted_at
                                       sweep orphan paths (no ticket) ───► delete storage

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/{ts}_ticket_attachments.sql` | Create | Table, indexes, RLS (deny-all), private bucket + `anon` INSERT-only storage policies |
| `supabase/migrations/{ts}_attachments_cron.sql` | Create | Enable `pg_cron`/`pg_net`; `sweep_expired_attachments()` fn; daily 02:00 schedule |
| `supabase/config.toml` | Modify | Uncomment `[storage.buckets.ticket-attachments]` (private, 50MiB, allowed mime list) |
| `app/actions/tickets.ts` | Modify | Add `registerAttachments`, `rollbackTicket`, `getTicketAttachments` |
| `components/public/file-upload-zone.tsx` | Create | Drag/drop, preview list, per-file + total validation, progress bar, remove |
| `components/public/public-ticket-form.tsx` | Modify | Mount zone below body; own `selectedFiles` state; orchestrate phases 2-3; rollback + retry-without-files error UI |
| `lib/storage/attachments.ts` | Create | Constants (allowed mime, limits, bucket name, path builder) shared client+server |
| `components/dashboard/ticket-detail.tsx` | Modify | Attachment list via `getTicketAttachments` (signed URLs / "expired") |
| `components/tracking/client-ticket-view.tsx` | Modify | Same attachment list for client's own ticket |
| `app/(tracking)/track/[ticketId]/page.tsx` | Modify | Fetch attachments alongside ticket/comments |

## Interfaces / Contracts

```ts
// lib/storage/attachments.ts
export const ATTACHMENT_BUCKET = "ticket-attachments";
export const MAX_FILES = 5;
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const ALLOWED_MIME = ["application/pdf","image/jpeg","image/png","image/webp","application/zip"] as const;
export const buildPath = (ticketId: string, fileId: string, name: string) =>
  `tickets/${ticketId}/${fileId}-${name}`;

// app/actions/tickets.ts
type AttachmentInput = { storage_path: string; filename: string; mime_type: string; size_bytes: number };
function registerAttachments(ticketId: string, files: AttachmentInput[]): Promise<{ error: string | null }>;
function rollbackTicket(ticketId: string): Promise<{ error: string | null }>; // deletes storage objs THEN ticket row
type AttachmentView = { id: string; filename: string; size_bytes: number; url: string | null; expired: boolean };
function getTicketAttachments(ticketId: string): Promise<AttachmentView[]>; // role/ownership-checked, mints 1h signed URLs
```

```sql
-- ticket_attachments
id UUID PK DEFAULT gen_random_uuid(),
ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
storage_path TEXT NOT NULL,
filename TEXT NOT NULL,
mime_type TEXT NOT NULL,
size_bytes BIGINT NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
deleted_at TIMESTAMPTZ
-- index on (ticket_id), partial index on (created_at) WHERE deleted_at IS NULL
-- RLS ENABLED with NO permissive policies => SDK access denied; service role bypasses RLS
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | client validation (count/size/mime, remove, progress) | Vitest + RTL on `file-upload-zone` |
| Unit | server re-validation rejects oversized/disallowed; rollback deletes storage+ticket | mock `supabaseAdmin` storage/from |
| Unit | `getTicketAttachments` ownership: client email match, staff all, B-ticket denied | mock claims + admin client |
| Integration | three-phase happy path + rollback on upload/register failure | mocked storage + actions; assert phase ordering |
| Integration | expired (`deleted_at`) renders "File expired", no URL minted | render attachment list |

## Migration / Rollout

Additive. Two forward migrations (table+bucket, cron). Down path: unschedule cron, drop function, drop table (CASCADE clears rows), drop bucket once no live data. Feature degrades cleanly — removing the zone leaves the original form working.

## Open Questions

- [x] Rollback deletes storage objects — YES (resolved).
- [x] Retry-without-files — manual clear + resubmit (resolved).
- [x] Client identity — authenticated provisioned user, email-matched (no token; resolved).
- [x] Cron scope — expiry sweep + orphan (no-ticket) storage cross-reference (resolved).
- [ ] Confirm `pg_cron`/`pg_net` enabled on the hosted project tier before apply (local stack has no scheduler).
