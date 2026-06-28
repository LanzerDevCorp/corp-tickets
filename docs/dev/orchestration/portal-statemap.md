# Orchestration State Map — Portal de Clientes

> Single source of truth for the 3-agent parallel build. Every agent reads this BEFORE starting and updates its own row when status changes.
> Companion doc: `docs/dev/portal-de-clientes-prd.md` (full decisions, user stories, testing seams).

## Dependency graph

```
Flow 4 (Admin Attachments) ─────────────────► fully independent · merge anytime
Flow 2 (Client Auth) ──┐
                       ├─► INTEGRATION: wire Flow 2 "create password" entry into Flow 3 account menu
Flow 3 (Client Portal)─┘   (Flow 3 core runs on the EXISTING magic-link session — no hard dep on Flow 2)
```

Only TWO synchronization points exist:

1. **Integration commit** — wire Flow 2's set-password entry point into Flow 3's account menu (after both merge).
2. **Migration timestamps** — pre-assigned below; do not deviate.

## Global rules (all agents)

- Work on your **own branch off `dev`** in a **dedicated git worktree**. Never commit on `dev` directly.
- **Strict TDD** is active. Test runner: `npm test`. Write the behavior test at the server-action seam FIRST, then implement.
- **Hard rule — UI language**: all NEW UI copy is hardcoded in **Mexican Spanish**, directly in components. Do NOT add keys to `lib/i18n/es.ts` and do NOT use `t()`/`es.*` for new UI. (i18n migration is a deferred task — see PRD Out of Scope.)
- Delivery: `exception-ok`. If your flow exceeds the ~400-line review budget, split into a chained PR.
- Touch ONLY the files in your ownership block. If you must touch a shared/forbidden file, STOP and record it in the "Shared-file contention log" below before editing.

## Flow status

| Flow                  | Owner / Tool           | Branch                        | Status               | PR     | Blockers                                                                                                                                                        |
| --------------------- | ---------------------- | ----------------------------- | -------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 — Client Auth       | Claude Code            | `feat/portal-client-auth`     | `merged→integration` | —      | all 6 units; exports `AccountPasswordEntry`                                                                                                                     |
| 3 — Client Portal     | Cursor                 | `feat/portal-client-portal`   | `merged→integration` | #3     | list + badge + `ticket_views`; account-menu stub                                                                                                                |
| 4 — Admin Attachments | Antigravity / OpenCode | `feat/admin-attachments`      | `merged→integration` | #4     | upload + soft-delete + restore                                                                                                                                  |
| Integration           | Claude Code            | `integration/portal-clientes` | `pr-open`            | **#5** | 3 flows merged + stub wired + `uploaded_by` fix; fresh verify → 4 findings fixed → re-verify READY; suite 411 green. PRs #3/#4 closed (superseded). Base: `dev` |

> Status vocabulary: `not-started` → `in-progress` → `tests-green` → `pr-open` → `merged`.

## Migration timestamp registry (DO NOT DEVIATE)

| Flow | File                                                               | Purpose                                                           |
| ---- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 2    | `supabase/migrations/20260627100000_client_password_decision.sql`  | password-decision signal on `public.users`                        |
| 3    | `supabase/migrations/20260627110000_ticket_views.sql`              | `ticket_views (user_id, ticket_id, last_viewed_at)`               |
| 4    | `supabase/migrations/20260627120000_attachment_admin_deletion.sql` | admin-deletion signal (e.g. `deleted_by`) on `ticket_attachments` |

## Ownership / file boundaries

### Flow 2 — Client Auth (OWNS)

- `app/portal/**` (new login route)
- `app/auth/set-password/**` (new interstitial route)
- Post-ticket confirmation UI component (informational CTA only)
- Password-decision server action (new module, e.g. `app/actions/client-password.ts`)
- Migration `20260627100000_*`
- Client account-menu component that EXPORTS a "create/change password" entry (Flow 3 imports it)

### Flow 3 — Client Portal (OWNS)

- `app/(tracking)/track/**` (conditional routing + list + layout/account-menu shell)
- Client ticket-list read (new module, e.g. `app/actions/client-tickets.ts`)
- `markTicketViewed` server action + `ticket_views` writes
- Migration `20260627110000_*`
- **Stub** the "create password" account-menu link (Flow 2 provides the real component; integration wires it)

### Flow 4 — Admin Attachments (OWNS)

- `app/actions/attachments.ts` (admin upload, soft-delete, restore; client-visibility filter in `getTicketAttachments`)
- `lib/storage/attachments.ts` (only if new shared constants needed — append, don't restructure)
- Dashboard attachment-manager UI under `components/dashboard/**` + `/dashboard/tickets/[id]`
- Migration `20260627120000_*`

### SHARED — read-only / coordinate before editing (FORBIDDEN without a log entry)

- `app/actions/tickets.ts` — Flow 3 must NOT extend it (use the new `client-tickets` module). Flow 2 may READ from it but must not restructure the submit action.
- `lib/auth/claims.ts`, `lib/auth/client-session.ts`, `lib/auth/ticket-access.ts` — read/reuse, do not modify.
- `lib/i18n/es.ts` — frozen for this work (hard rule).
- `pnpm-lock.yaml` / `package-lock.json` — no new deps expected; if unavoidable, serialize and log it.

## Shared-file contention log

> Append an entry here BEFORE editing any shared/forbidden file: `[flow] [file] [why] [date]`.

- (none yet)

## Integration checklist (after Flow 2 & Flow 3 merge)

- [ ] Replace Flow 3's stubbed account-menu link with Flow 2's exported "create/change password" entry component.
- [ ] Verify the first-access interstitial → set-password → back-to-list path end to end.
- [ ] Full `npm test` green on the integrated branch.
- [ ] Confirm the new-activity badge fires for a staff attachment (Flow 4 ↔ Flow 3 cross-check).
