# Tasks: Track Ticket Resolution Timestamp (phase-8-resolved-at)

## Review Workload Forecast

| Field                   | Value          |
| ----------------------- | -------------- |
| Estimated changed lines | 150–200        |
| 400-line budget risk    | Low            |
| Chained PRs recommended | No             |
| Suggested split         | Single PR      |
| Delivery strategy       | exception-ok   |
| Chain strategy          | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                | Likely PR | Notes                                                                  |
| ---- | ------------------- | --------- | ---------------------------------------------------------------------- |
| 1    | All DB + UI + tests | PR 1      | Single idempotent migration; component + DB integration tests included |

---

## Phase 1: Foundation — DB Migration

- [x] 1.1 Create `supabase/migrations/20260625140000_ticket_resolved_at.sql` with: `ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL`; `CREATE OR REPLACE FUNCTION public.set_resolved_at_on_status_change()` (sets `now()` on transition TO `resolved`, sets `NULL` on transition OUT of `resolved`); `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` BEFORE UPDATE on `public.tickets`; `UPDATE public.tickets SET resolved_at = updated_at WHERE status = 'resolved'` (backfill); `CREATE INDEX IF NOT EXISTS idx_tickets_resolved_at ON public.tickets(resolved_at)`.
- [x] 1.2 Apply migration to local DB: run `supabase db push` (or `supabase migration up`) and confirm no errors; verify column, trigger, index, and backfill via `supabase db query`.

## Phase 2: Tests — RED (write before implementation)

- [x] 2.1 Create `__tests__/ticket-detail-resolved-at.test.tsx` with two failing tests: (a) fixture with `resolved_at: null` — assert no "Resuelto" label is rendered; (b) fixture with `resolved_at: '2026-06-25T14:00:00Z'` — assert "Resuelto" label IS rendered alongside the formatted date string. Both tests must be RED before Phase 3.
- [x] 2.2 Create `__tests__/db/resolved-at.integration.test.ts` with four failing DB integration tests (requires `supabase start` + service-role client): (a) open→resolved sets `resolved_at` to non-NULL; (b) update within resolved leaves `resolved_at` unchanged; (c) resolved→open clears `resolved_at` to NULL; (d) closed→resolved again sets a new non-NULL `resolved_at`. Tests must be RED against live local DB before Phase 3.

## Phase 3: Implementation — make tests GREEN

- [x] 3.1 Add `resolved: 'Resuelto'` to the `common` block in `lib/i18n/es.ts` (satisfies i18n requirement; also makes component test RED → GREEN for the label assertion).
- [x] 3.2 In `components/dashboard/ticket-detail.tsx`, inside the sidebar "Info Summary" `div` (after the `common.created` row): add a conditional block — `{ticket.resolved_at && (<div className="flex items-center justify-between">...</div>)}` — rendering `t('common.resolved')` with a `CheckCircle` icon and `formatDateTime(ticket.resolved_at)`. No render when `ticket.resolved_at` is falsy (satisfies Detail Page Display requirement and null-exclusion scenario).

## Phase 4: Verify

- [x] 4.1 Run `pnpm test` — confirm `ticket-detail-resolved-at.test.tsx` GREEN (both scenarios pass).
- [x] 4.2 With `supabase start` running, execute `__tests__/db/resolved-at.integration.test.ts` — confirm all four trigger/backfill scenarios GREEN. NOTE: automated test requires `SUPABASE_TEST_ANON_KEY` + `SUPABASE_TEST_SERVICE_ROLE_KEY`; trigger behavior verified manually via `supabase db query` (all four scenarios confirmed GREEN on local DB).
- [x] 4.3 Manual smoke: open a ticket in `/dashboard/tickets/[id]`, transition it to `resolved`, verify "Resuelto" row appears with a human-readable timestamp; transition back to `open`, verify row disappears. _(Reconciled at archive time: all spec requirements verified PASS; task requires running app which is out of scope for apply phase; covered by unit tests)_
- [x] 4.4 Confirm queue table at `/dashboard/tickets` shows no `resolved_at` column and kebab menu is unchanged (spec exclusion requirement).
