# Phase 5 — `comments`

**Estado:** Acordado (grill-me 2026-06-18)  
**Depende de:** Phase 3 (`tickets-core`), Phase 4 (`public-form`)  
**PRD:** [§14 — Development Phases](./PRD.md#14-development-phases-sdd)  
**Siguiente fase:** Phase 6 (`notifications`)

---

## Problem Statement

IT staff reviewing a ticket in the dashboard has no way to communicate with the client or leave internal notes for colleagues. Every ticket is a read-only snapshot once submitted — there is no conversation thread. This forces support work to happen outside the system (email, chat), breaking traceability and leaving the ticket record incomplete.

---

## Solution

Add a comment thread to every ticket. Staff can post public replies (visible to the client) or internal notes (visible only to Admin/IT). The form visually signals which mode is active to prevent accidental disclosure of internal notes. Client commenting (Phase 8) and email delivery (Phase 6) are structurally prepared but not activated in this phase.

---

## User Stories

### Staff (Admin / IT)

1. As an IT agent, I want to see all comments on a ticket in chronological order, so that I can understand the full support history before responding.
2. As an IT agent, I want to post a public reply to a ticket, so that the client is informed of progress without leaving the dashboard.
3. As an Admin, I want to post a public reply to a ticket, so that I can communicate with clients on tickets I oversee.
4. As an IT agent, I want to post an internal note on a ticket, so that I can share context or questions with colleagues without the client seeing.
5. As an Admin, I want to post an internal note on a ticket, so that I can flag issues or escalation notes for the team.
6. As an IT agent, I want the comment form to visually change between public and internal modes, so that I don't accidentally publish sensitive information.
7. As an IT agent, I want internal comments to be clearly marked in the thread (amber/gold accent + lock icon), so that I know at a glance which messages are private.
8. As an IT agent, I want public comments to appear cleanly without a special mark, so that the thread reads naturally for staff reviewing it.
9. As an IT agent, I want to see the author name and timestamp on each comment, so that I know who said what and when.
10. As an Admin, I want to see comments from all staff members on a ticket, so that I have full visibility of support activity.
11. As an IT agent, I want the comment thread to load as part of the ticket detail page without a separate navigation step, so that my workflow stays in one place.
12. As an IT agent, I want to be unable to edit or delete a posted comment, so that the audit trail remains trustworthy.

### System / Data integrity

13. As the system, I want to enforce that clients can only post public comments (via RLS), so that clients cannot mark a comment as internal even by bypassing the UI.
14. As the system, I want all comments to reference a valid ticket and a valid author, so that orphan records are impossible.
15. As the system, I want the `addComment` server action to call a notification stub after insert, so that Phase 6 can implement email dispatch without changing the action's call site.

### Client (Phase 8 — structural compatibility only, no UI in Phase 5)

16. As a client, I want to see only public comments on my ticket when I access the tracking view (Phase 8), so that internal staff notes remain private.
17. As a client, I want to post a comment from the tracking view (Phase 8), so that I can provide additional information to the support team.
18. As a client, I want to add CC email addresses when posting a comment (Phase 8), so that colleagues are notified of my response.

---

## Implementation Decisions

### Data model

A dedicated `comments` table (not JSONB in `tickets`) with the following shape:

```sql
CREATE TABLE public.comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        NOT NULL REFERENCES public.tickets(id)  ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES public.users(id)    ON DELETE RESTRICT,
  body        TEXT        NOT NULL,
  is_internal BOOLEAN     NOT NULL DEFAULT false,
  cc_emails   TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_ticket_created
  ON public.comments(ticket_id, created_at);
```

- No `updated_at` — comments are immutable (append-only by design).
- `author_id NOT NULL` — both staff and clients have Supabase Auth records; no anonymous authorship.
- `is_internal DEFAULT false` — public reply is the primary flow; internal notes are the exception.
- `cc_emails TEXT[]` — CC recipients are notification targets only, not system entities. A separate `comment_cc` table adds complexity with no MVP benefit; can be migrated later if delivery tracking is required.

### RLS policies

- **Staff (admin/IT):** full `SELECT` + `INSERT` on all comments.
- **Client:** `SELECT` where `is_internal = false` AND ticket belongs to client (by email). `INSERT` where `is_internal = false` AND ticket belongs to client.
- **Anon:** no access.
- **Nobody:** `UPDATE` or `DELETE` — no policies are created for these operations. Comments are permanent record.

Client INSERT policy enforces `is_internal = false` at the database level regardless of what the application sends.

### Application-layer validation (Zod)

A shared `CommentSubmitSchema` (client + server) validates:

- `body`: non-empty string
- `is_internal`: boolean — when the caller is a client, the server action overrides this to `false` before insert (belt-and-suspenders on top of RLS)
- `cc_emails`: array of valid email strings, default `[]`

### Query contract

`getComments(ticketId)` returns comments ordered `ASC` by `created_at`, hard-capped at 500 rows. RLS enforces what the caller can see — the same action works for staff (all comments) and clients (public only) without branching. Phase 8 reuses this action without modification.

### Notification stubs (Phase 6 contract)

`lib/notifications/comments.ts` exports two no-op async functions:

- `notifyPublicComment(commentId, ticketId)` — called after a public comment is inserted. Phase 6 implements: email to client.
- `notifyClientComment(commentId, ticketId)` — called after a client comment is inserted. Phase 6 implements: email to assigned IT (or full team if unassigned).

The `addComment` server action calls these stubs immediately after a successful insert. Phase 6 only fills in the function bodies.

### CC field phasing

- Phase 5 (staff dashboard form): CC field is **not exposed**. `cc_emails` defaults to `[]` for all staff comments in this phase.
- Phase 8 (client tracking form): CC field is exposed. The `addComment` server action already accepts `cc_emails` — Phase 8 only adds the UI input. See also PRD §6 implementation notes.

### UI — signature design element

The comment form is a dual-personality component. A toggle switches between two modes:

- **Public mode** (default): clean white form, submit button labeled "Reply", no special treatment in the thread.
- **Internal mode**: form acquires an amber/gold tint, `Lock` icon appears in the header, submit button labeled "Add Internal Note". Posted internal comments in the thread display with amber background, a `Lock` icon, and an "Internal" badge — visually distinct from public replies.

The visual shift makes accidental disclosure of internal notes difficult: the form has to look visibly different before you can submit.

### Layout

The comment section is embedded in the existing `ticket-detail` layout (2/3 + 1/3 grid) — the thread and form occupy the `lg:col-span-2` column below the ticket body card. No new page or route is required. The existing Phase 3 placeholder (`components/dashboard/ticket-detail.tsx`, lines 175–179) is replaced.

---

## Testing Decisions

### What makes a good test here

Test external behavior at the highest seam possible. For comments, the highest and most valuable seams are:

1. **RLS (database)** — if a policy is wrong, no application code can compensate. Test directly against the Supabase client using different role sessions.
2. **Server action + Zod** — test that the action rejects bad input and calls the DB correctly, without caring about which React component invoked it.

Do not test component internals (toggle state, CSS classes). If the RLS and action are correct, the UI is a detail.

### Modules under test

**RLS — `supabase/tests/rls.test.ts`** (prior art: existing RLS test file)  
Cases:

- Staff can INSERT public comment ✓
- Staff can INSERT internal comment ✓
- Staff can SELECT all comments on any ticket ✓
- Client can SELECT `is_internal = false` on own ticket ✓
- Client cannot SELECT `is_internal = true` comments ✗
- Client cannot SELECT comments on tickets they don't own ✗
- Anon cannot SELECT any comments ✗
- Client INSERT with `is_internal = true` is blocked by RLS ✗
- INSERT without `author_id` fails NOT NULL constraint ✗
- Nobody can UPDATE a comment ✗
- Nobody can DELETE a comment ✗

**Server actions — `app/actions/__tests__/comments.test.ts`** (prior art: `tickets.test.ts` — mock Supabase client, test action logic)  
Cases:

- `getComments` returns comments ordered ASC
- `addComment` with valid staff payload inserts and returns new comment
- `addComment` rejects empty body
- `addComment` called by client role forces `is_internal = false` regardless of input
- `addComment` calls `notifyPublicComment` stub after public insert
- `addComment` calls `notifyClientComment` stub after client insert

**Zod schema — `lib/schemas/comment-submit.test.ts`** (prior art: `ticket-submit.test.ts`)  
Cases:

- Valid payload passes
- Empty body fails
- Invalid email in `cc_emails` fails
- `is_internal` non-boolean fails

### E2E

Deferred to Phase 8. The meaningful end-to-end flow (staff posts public comment → client sees it in tracking view → client replies) requires the client tracking UI, which is built in Phase 8.

---

## Out of Scope

- **CC field in staff form** — deferred to Phase 8 (client tracking). The data model and server action support it; only the UI input is missing.
- **Email delivery** — Phase 6 (`notifications`) implements the `notifyPublicComment` and `notifyClientComment` stubs.
- **Client comment UI** — Phase 8 (`client-tracking`) adds the client-facing comment form and tracking view.
- **Comment editing / deletion** — permanently out of MVP scope. Comments are an audit trail.
- **File attachments on comments** — Phase 2 (post-MVP). See PRD §15.
- **E2E tests** — Phase 8.
- **Comment reactions, threading, mentions** — not in PRD.

---

## Further Notes

- The `author_id` field enables displaying `users.display_name` next to each comment without an additional lookup — join `comments` with `users` in `getComments`.
- Internal comments in the thread should not be rendered in Phase 8's client view at all (not just hidden via CSS) — Phase 8 must use the RLS-filtered result from `getComments`, which already excludes them.
- The `comments` table's `ON DELETE CASCADE` on `ticket_id` means deleting a ticket also deletes its comments. If ticket deletion is ever added, this is intentional.
- Notification stubs are async but Phase 5 does not await their result in a way that blocks the user-visible response — fire-and-forget is acceptable until Phase 6 adds real email sending with proper error handling.
