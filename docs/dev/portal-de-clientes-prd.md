# PRD — Portal de Clientes (corp-tickets)

> Status: ready-for-agent · Source: grill session 2026-06-26 · Scope: Flow 2 (Client Auth), Flow 3 (Client Portal), Flow 4 (Admin Attachments)
> Hard rule: all NEW UI copy is hardcoded in Mexican Spanish, directly in components. Do NOT add keys to `lib/i18n/es.ts` or use `t()`/`es.*` for new UI. Migrating these strings into i18n is a deferred task (engram obs #855).

## Problem Statement

Clients who open support tickets today can only return to a ticket through a magic link that lands them on a single ticket. There is no password option, no consolidated view of all their tickets, and no signal telling them when staff has acted on a ticket. On the staff side, agents cannot attach files to an existing ticket or remove an attachment after the fact — attachments only exist if the client uploaded them at creation time. The result: clients feel blind to ticket progress, and staff cannot share or clean up files.

## Solution

A **Client Portal** with three coordinated capabilities:

- **Flow 2 — Client Auth**: optional password for clients, established securely after they prove inbox possession via the existing ticket magic link. A canonical client login at `/portal` (password primary, passwordless fallback), with passwordless remaining the recovery channel.
- **Flow 3 — Client Portal**: `/track` becomes a conditional surface — unauthenticated visitors are routed to `/portal`; authenticated clients (via either auth method) see a list of all their tickets with a "new activity" badge driven by staff-side events since their last view of each ticket.
- **Flow 4 — Admin Attachments**: staff (admin + IT) can upload attachments to an existing ticket and soft-delete them, with a restore path. Admin-removed attachments disappear from the client's view but remain visible (greyed) to staff.

## User Stories

### Flow 2 — Client Auth
1. As a client who just submitted a ticket, I want to be told (post-submit) that I can set a password for faster future access, so that I understand the option exists without being forced into it.
2. As a client, I want to set my password only after clicking the magic link sent to my email, so that nobody who merely typed my email into the public form can hijack my account.
3. As a first-time authenticated client without a password, I want to see a "create password" screen with a clear "skip" option, so that I can opt in or defer without friction.
4. As a client who already created or explicitly skipped a password, I want to never be nagged by the interstitial again, so that returning is frictionless.
5. As a client who skipped earlier, I want a persistent "create password" entry point in my account menu, so that I can opt in later if I change my mind.
6. As a client, I want to log in at `/portal` with my password, so that I can reach my tickets directly.
7. As a client without a password, I want an "access without password" fallback on `/portal`, so that I can still get in via magic link.
8. As a client who forgot my password, I want to use the passwordless fallback to get in and then change my password from my account menu, so that I never need a separate reset flow.
9. As a visitor on the public landing page, I want a link to `/portal`, so that I can find the client login.

### Flow 3 — Client Portal
10. As an unauthenticated visitor to `/track`, I want to be redirected to `/portal`, so that there is one clear front door.
11. As an authenticated client, I want to see a list of all my tickets (subject, status, created date), so that I can track everything in one place.
12. As an authenticated client, I want a "new activity" badge on tickets where staff acted since I last looked, so that I know which tickets need my attention.
13. As an authenticated client, I want the badge to ignore my own actions, so that it only signals genuinely new staff activity.
14. As a client who reached the portal via a per-ticket magic link, I want to be able to navigate to my full ticket list, so that one login surfaces everything I own.
15. As an authenticated client with no tickets, I want a clear empty state with a link to the public form, so that I can create my first ticket.

### Flow 4 — Admin Attachments
16. As a staff member (admin or IT), I want to upload one or more attachments to an existing ticket from the dashboard, so that I can share files with the client.
17. As a staff member, I want uploaded attachments to be visible to the client on their ticket view, so that sharing actually reaches them.
18. As a staff member, I want to soft-delete an attachment, so that I can remove a file that was a mistake or no longer relevant.
19. As a client, I want admin-removed attachments to simply disappear from my ticket view, so that I am not confused by ghost "expired" files I never lost.
20. As a staff member, I want soft-deleted attachments to remain visible (greyed) to me with a "restore" action, so that I can undo an accidental deletion.
21. As a client, I want a "new activity" badge when staff adds an attachment, so that I notice shared files even without an email.

## Implementation Decisions

### Auth & sessions (Flow 2)
- **A-secure model**: the set-password flow is gated by inbox possession. The public ticket form stays open and unverified, but a real client session is only established by clicking the magic link already sent on ticket creation (`notifyTicketCreated`). No second email. Reuses `establishClientSession()`.
- The post-ticket screen is **informational only** — it does NOT establish a session. It points the client to their email.
- **First-access interstitial**: on the first authenticated access where the client has not yet decided, route to `/auth/set-password` (create or skip). Password setting itself uses the existing `supabase.auth.updateUser({ password })` against the live session.
- **"Decided" signal**: the interstitial is suppressed once the client has either set a password OR skipped. This requires a per-user signal (e.g., `password_decided_at` / `password_set_at` columns on `public.users`, or reading password-identity state via the admin API — design decision deferred to SDD design). Suppression must be based on "decided," not merely "has password," to avoid nagging skippers.
- **Account menu**: a persistent "create / change password" entry point lives in the authenticated `/track` layout for clients who skipped or want to change.
- **`/portal`**: canonical client login. Password primary + "access without password" fallback routing to `/track/access` (existing passwordless panel). No dedicated password-reset flow — passwordless IS the recovery channel.
- Staff (admin/it) landing on `/portal` or `/track` are redirected to `/dashboard` (existing pattern).

### Portal & list (Flow 3)
- `/track` becomes conditional: no session → redirect to `/portal`; session present (regardless of auth method) → render the ticket list. **One rule: authenticated → list.** Magic-link sessions are full sessions; no artificial per-ticket scoping (RLS already scopes by email, and the inbox owner owns all those tickets).
- New **`ticket_views`** relation: `(user_id, ticket_id, last_viewed_at)`, written when a client opens `/track/[ticketId]`.
- **New-activity badge** computed server-side: a ticket shows the badge if any client-visible staff event (public comment, attachment, status change, `resolved_at` change) has a timestamp later than the client's `last_viewed_at` for that ticket, excluding events authored by the client (`author_id`).
- List columns: `subject`, `status`, `created_at`, badge. No filters in v1.
- To minimize cross-flow file contention, the list read should live in a NEW server-action module (e.g., `client-tickets`) rather than extending `app/actions/tickets.ts`.

### Attachments (Flow 4)
- Staff upload reuses the validation constants (`ALLOWED_MIME`, `MAX_FILES`, `MAX_TOTAL_BYTES`) from `lib/storage/attachments.ts` and registers rows via the service-role path (`registerAttachments` pattern). Storage path convention `tickets/{ticketId}/`.
- **Soft-delete** reuses the existing `deleted_at` column but must distinguish admin removal from retention expiry. Add a minimal signal (e.g., `deleted_by` or a `deletion_reason`) so the two intents render differently.
- **Client visibility**: admin-removed attachments are filtered OUT of the client response in `getTicketAttachments`. Retention-expired attachments keep their current "expired ghost" behavior for the client. Staff always see soft-deleted rows greyed.
- **Restore**: a staff action flips `deleted_at` back to `null` (and clears the admin-deletion signal).
- Permissions: both `admin` and `it` may upload, soft-delete, and restore.
- All staff-uploaded attachments are client-visible in v1 — **no `is_internal` flag for attachments** (internal attachments are a future extension; internal comments cover that need today).
- **No email notification** on staff upload — the new-activity badge (Flow 3) is the sole signal. (Diverges deliberately from the public-comment notification pattern to reduce email noise.)

### Schema changes summary
- `public.users`: password-decision signal column(s) (Flow 2).
- `ticket_views` table (Flow 3).
- `ticket_attachments`: admin-deletion signal column, e.g. `deleted_by` (Flow 4).

## Testing Decisions

A good test here asserts **external behavior at the highest available seam**, not implementation details. Prefer existing seams.

- **Primary seam — server actions** (prior art: `app/actions/__tests__/client-provision.test.ts`, `tickets.test.ts`, attachments tests):
  - Flow 2: the password-decision signal action (records set/skip), and interstitial gating logic (given role/email/decision state → show or not).
  - Flow 3: the client-ticket-list read (given session email + ticket/comment/attachment fixtures → correct list + correct badge, including the "exclude own actions" rule), and the `markTicketViewed` action.
  - Flow 4: staff upload, soft-delete, restore, and the modified `getTicketAttachments` (client does NOT see admin-deleted; staff sees greyed).
- **Component seam** (prior art: `components/dashboard/__tests__/*.test.tsx`, `forgot-password-form.test.tsx`): the set-password interstitial (create/skip), the `/track` list rendering (badge present/absent, empty state), the dashboard attachment manager (upload control, greyed + restore affordance).
- **DB/trigger seam** (prior art: `__tests__/db/resolved-at.integration.test.ts`, skipped without Supabase env): `ticket_views` round-trip, soft-delete + restore semantics, admin-deletion vs retention distinction at the row level.
- Strict TDD is active (`npm test`): write the behavior test first at the server-action seam, then implement.

## Out of Scope
- Migrating the new hardcoded Spanish strings into the i18n system (`t()`/`es.*`) — deferred task, tracked separately.
- Internal (`is_internal`) attachments.
- Dedicated password-reset email flow.
- `/track` list filters/search.
- Email notification on staff attachment upload.
- Email-grouping / debounce for notifications.
- Future `/track/[ticketId]` extensions (held in engram `sdd/client-portal-future-extensions`).

## Further Notes — Parallelization Analysis

Goal: run the plan across multiple agentic tools (Claude Code, Cursor, Antigravity, OpenCode) concurrently. Parallelism is bounded by (a) flow dependencies and (b) shared-file contention.

### Dependency graph
```
Flow 4 (Admin Attachments) ───────────────► fully independent, merge anytime
Flow 2 (Client Auth) ──┐
                       ├─► integration: wire Flow 2 set-password entry into Flow 3 account menu
Flow 3 (Client Portal)─┘   (Flow 3 core does NOT need Flow 2 — it runs on the existing magic-link session)
```

- **Flow 4 is fully independent.** Touches `lib/storage/attachments.ts`, `app/actions/attachments.ts`, the dashboard ticket-detail UI, and its own migration. No overlap with Flow 2/3.
- **Flow 3 core is independent of Flow 2.** The list and badge work on the existing magic-link session; only the "create password" account-menu link bridges to Flow 2. Build Flow 3 with that link stubbed, integrate last.
- **Flow 2 → integration** is the only true ordering constraint, and it is a small final wiring step.

### The hard rule HELPS parallelism
Because new UI strings are hardcoded (no `lib/i18n/es.ts` edits), the single biggest shared-file bottleneck is removed. Each agent edits only its own components.

### Suggested partition (3 concurrent agents + 1 integration pass)
| Agent / Tool | Scope | Owns (no overlap) |
|---|---|---|
| A — Claude Code (Strict TDD, complex auth) | Flow 2 | `/portal`, `/auth/set-password`, post-ticket CTA, password-decision action + migration on `public.users` |
| B — Cursor (UI-heavy iteration) | Flow 3 | `/track` (list + conditional routing), `client-tickets` action, `ticket_views` migration, `markTicketViewed`; account-menu link stubbed |
| C — Antigravity / OpenCode (contained, independent) | Flow 4 | attachments action(s), dashboard attachment manager, `ticket_attachments` migration |
| Integration (any) | Wire Flow 2 entry point into Flow 3 account menu | thin |

### Conflict-avoidance rules
- Each agent works on its **own branch / git worktree** off `dev`; merge via PRs (exception-ok; chain if a flow exceeds the 400-line budget).
- **Do not extend `app/actions/tickets.ts`** for the list — put the client list read in a new module so Flow 2 (which may touch the submit action's post-ticket CTA) and Flow 3 don't collide there.
- **Migrations**: each flow ships its own migration file with a coordinated, non-colliding timestamp (assign distinct timestamps up front so ordering is deterministic).
- **`getTicketAttachments`** is owned by Flow 4. Flow 3's ticket view only *reads* its output — no edits to that action from Flow 3.
- Route trees are disjoint (`/portal`+`/auth/*` vs `/track/*` vs `/dashboard/*`) → safe.
- No new dependencies expected → `pnpm-lock.yaml` / `package-lock.json` should not conflict; if a flow must add a dep, serialize that lockfile change.

### Realistic concurrency verdict
- **3-way parallel is achievable** for the bulk of the work (Flows 2, 3-core, 4).
- Only **two synchronization points** exist: (1) the final integration commit wiring Flow 2 → Flow 3's account menu; (2) deterministic migration-timestamp assignment.
- Speedup ceiling ≈ the longest single flow (Flow 2 is the heaviest due to auth/security surface) plus the small integration pass — not the sum of all three.
