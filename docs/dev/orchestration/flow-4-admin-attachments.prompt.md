# Agent Prompt — Flow 4: Admin Attachments  ·  Tool: Antigravity / OpenCode

You are implementing **Flow 4 (Admin Attachments)** of the *Portal de Clientes* feature in the `corp-tickets` repo. This flow is **fully independent** — it can run start-to-finish without Flow 2 or Flow 3. You run cold — everything you need is here plus the two reference docs.

**Read first:**
- `docs/dev/portal-de-clientes-prd.md` — full decisions, user stories, testing seams.
- `docs/dev/orchestration/portal-statemap.md` — coordination, ownership, rules. Update your row there as status changes.

## Mission
Let staff (admin + IT) upload attachments to an existing ticket and soft-delete them with a restore path, from `/dashboard/tickets/[id]`.

## Branch
Create a dedicated git worktree on `feat/admin-attachments` off `dev`. Never commit on `dev`.

## Scope — build exactly this
1. **Staff upload.** Admin AND IT can upload one or more attachments to an existing ticket. Reuse validation constants (`ALLOWED_MIME`, `MAX_FILES`, `MAX_TOTAL_BYTES`) from `lib/storage/attachments.ts` and register via the service-role path (`registerAttachments` pattern). Storage path `tickets/{ticketId}/`.
2. **Soft-delete.** Reuse the existing `deleted_at` column but DISTINGUISH admin removal from retention expiry — add a minimal signal (e.g. `deleted_by`). Admin + IT can soft-delete.
3. **Client visibility.** Filter admin-removed attachments OUT of the client response in `getTicketAttachments`. Retention-expired attachments KEEP their current "expired ghost" behavior for the client. Staff always see soft-deleted rows greyed.
4. **Restore.** A staff action flips `deleted_at` back to `null` and clears the admin-deletion signal. Admin + IT.
5. **No internal flag.** All staff-uploaded attachments are client-visible in v1 — do NOT add `is_internal` to attachments.
6. **No email on upload.** Do NOT send a notification email on staff upload. (The Flow 3 new-activity badge is the sole signal — your attachment insert must be visible to that badge logic via timestamp, but you do not call any notify function.)

## You own (edit freely)
`app/actions/attachments.ts` (upload, soft-delete, restore, client-visibility filter), `lib/storage/attachments.ts` (append-only if new constants needed), dashboard attachment-manager UI under `components/dashboard/**` and `/dashboard/tickets/[id]`, migration `20260627120000_*`.

## Do NOT touch (shared / other agents)
- `app/actions/tickets.ts`, `app/(tracking)/track/**`, `app/portal/**`, `app/auth/**` — other flows.
- `lib/i18n/es.ts` (frozen), `lib/auth/*` (reuse, don't modify).

## Migration
Create EXACTLY: `supabase/migrations/20260627120000_attachment_admin_deletion.sql`. No other timestamp.

## Hard rule — UI language
All new UI copy hardcoded in **Mexican Spanish**, directly in components. Do NOT add keys to `lib/i18n/es.ts` or use `t()`/`es.*`.

## Testing — Strict TDD (`npm test`)
Highest seam = **server actions**. Write behavior tests FIRST:
- Staff upload (admin and IT roles), soft-delete, restore.
- Modified `getTicketAttachments`: client does NOT see admin-deleted; staff sees greyed; retention-expired still ghosts for client.
Prior art: `lib/storage/__tests__/attachments.test.ts`, `app/actions/__tests__/*` attachment tests.

## Definition of done
- [ ] Tests written first, `npm test` green.
- [ ] Admin + IT can upload, soft-delete, restore.
- [ ] Client never sees admin-deleted; staff sees greyed + restore.
- [ ] No email sent on upload.
- [ ] PR opened (split if > ~400 lines). Mergeable anytime — no cross-flow dependency.
- [ ] State map row updated to `pr-open`/`merged`.
