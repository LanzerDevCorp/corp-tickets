# Agent Prompt — Flow 3: Client Portal  ·  Tool: Cursor

You are implementing **Flow 3 (Client Portal)** of the *Portal de Clientes* feature in the `corp-tickets` repo. You run cold — everything you need is here plus the two reference docs.

**Read first:**
- `docs/dev/portal-de-clientes-prd.md` — full decisions, user stories, testing seams.
- `docs/dev/orchestration/portal-statemap.md` — coordination, ownership, rules. Update your row there as status changes.

## Mission
Make `/track` a conditional surface: unauthenticated → `/portal`; authenticated client (any auth method) → a list of all their tickets with a "new activity" badge.

## Branch
Create a dedicated git worktree on `feat/portal-client-portal` off `dev`. Never commit on `dev`.

## Scope — build exactly this
1. **Conditional `/track`.** No session → redirect to `/portal`. Session present (magic-link OR password — no distinction) → render the ticket list. One rule: authenticated → list. Do NOT add artificial per-ticket scoping (RLS already scopes by email).
2. **Ticket list.** Columns: `subject`, `status`, `created_at`, + new-activity badge. No filters in v1.
3. **`ticket_views` relation** `(user_id, ticket_id, last_viewed_at)`, written via a `markTicketViewed` server action when a client opens `/track/[ticketId]`.
4. **New-activity badge (server-side).** A ticket shows the badge if any client-visible staff event — public comment, attachment, status change, `resolved_at` change — has a timestamp later than the client's `last_viewed_at` for that ticket, EXCLUDING events authored by the client (`author_id`).
5. **Empty state.** Authenticated client with no tickets → "Aún no tienes tickets" + link to the public form.
6. **Account-menu shell** in the `/track` layout, with the "create password" link **STUBBED** (Flow 2 provides the real component; integration wires it — do not block on it).

## You own (edit freely)
`app/(tracking)/track/**` (routing + list + layout/account-menu shell), a NEW client-list action module (e.g. `app/actions/client-tickets.ts`), `markTicketViewed`, migration `20260627110000_*`.

## Do NOT touch (shared / other agents)
- **`app/actions/tickets.ts` — do NOT extend it.** Put the client list read in the new `client-tickets` module. This is the #1 contention rule.
- `app/actions/attachments.ts` / `getTicketAttachments` — owned by Flow 4. You may READ its output in the ticket view; do not edit it.
- `app/portal/**`, `app/auth/set-password/**` — owned by Flow 2.
- `lib/i18n/es.ts` (frozen), `lib/auth/*` (reuse, don't modify).

## Migration
Create EXACTLY: `supabase/migrations/20260627110000_ticket_views.sql`. No other timestamp.

## Hard rule — UI language
All new UI copy hardcoded in **Mexican Spanish**, directly in components. Do NOT add keys to `lib/i18n/es.ts` or use `t()`/`es.*`.

## Testing — Strict TDD (`npm test`)
Highest seam = **server actions**. Write behavior tests FIRST:
- The client ticket-list read: given session email + ticket/comment/attachment fixtures → correct list + correct badge, **including the "exclude own actions" rule**.
- `markTicketViewed` round-trip.
Prior art: `app/actions/__tests__/tickets.test.ts`, `__tests__/db/resolved-at.integration.test.ts` (DB seam, skips without env).

## Definition of done
- [ ] Tests written first, `npm test` green.
- [ ] Unauthenticated `/track` → `/portal`; authenticated → list.
- [ ] Badge is correct AND ignores the client's own actions.
- [ ] Empty state present.
- [ ] Account-menu password link is a clean STUB (no hard dep on Flow 2).
- [ ] PR opened (split if > ~400 lines).
- [ ] State map row updated to `pr-open`/`merged`.
