# Proposal: Track Ticket Resolution Timestamp (resolved_at)

## Intent

`public.tickets` records `created_at`/`updated_at` but has no field capturing WHEN a ticket reached `resolved`. Staff and reporting cannot answer "how long did resolution take" or "when was this resolved", and `updated_at` is unreliable (mutates on every edit). This change adds a durable, DB-enforced resolution timestamp and surfaces it on the ticket detail page.

## Scope

### In Scope

- Add `resolved_at TIMESTAMPTZ` column to `public.tickets`
- BEFORE UPDATE trigger: set `resolved_at = now()` on transition TO `resolved`; clear to NULL on transition OUT of `resolved`
- Backfill existing resolved tickets with `updated_at` as approximate proxy
- Index `idx_tickets_resolved_at` on `resolved_at`
- Display `resolved_at` (formatted) on detail page via `components/dashboard/ticket-detail.tsx`
- i18n label in `lib/i18n/es.ts`

### Out of Scope

- New queue table column (`components/dashboard/ticket-queue.tsx` untouched)
- Kebab / 3-dot menu changes
- Application-level writes in `updateTicketStatus` (trigger owns the value across all code paths)
- SLA / time-to-resolution metrics or reporting (future)

## Capabilities

### New Capabilities

- `ticket-resolution-tracking`: DB-enforced capture of when a ticket entered `resolved`, plus detail-page display.

### Modified Capabilities

- None.

## Approach

Postgres BEFORE UPDATE trigger, mirroring the established `reset_first_seen_on_reopen` pattern (migration `20260625130000_realtime_ticket_queue.sql`). Trigger function `set_resolved_at_on_status_change` has two branches: set `now()` when `NEW.status='resolved' AND OLD.status IS DISTINCT FROM NEW.status`; set NULL when `OLD.status='resolved' AND NEW.status != 'resolved'`. Server actions need no changes; `getTicketDetail` already uses `select('*')`, so the column flows through automatically. Detail component reads `initialTicket.resolved_at` (typed `any`, minimal type work) and renders it conditionally with `formatDateTime`.

## Affected Areas

| Area                                     | Impact   | Description                                          |
| ---------------------------------------- | -------- | ---------------------------------------------------- |
| `supabase/migrations/`                   | New      | ADD COLUMN + backfill + trigger fn + trigger + index |
| `components/dashboard/ticket-detail.tsx` | Modified | Render `resolved_at` when present                    |
| `lib/i18n/es.ts`                         | Modified | New label key (e.g. "Resuelta el")                   |

## Risks

| Risk                                                         | Likelihood | Mitigation                                                              |
| ------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------- |
| Backfill via `updated_at` is approximate for historical rows | High       | Accepted; trigger is exact going forward; document in migration comment |
| Manual types — no generated DB types                         | Low        | `initialTicket: any` already; no type churn                             |

## Rollback Plan

Single reverse migration: `DROP TRIGGER`, `DROP FUNCTION`, `DROP INDEX`, `ALTER TABLE ... DROP COLUMN resolved_at`. Detail-page render is null-safe, harmless if column absent.

## Dependencies

- None (uses existing trigger pattern and select('*') flow).

## Success Criteria

- [ ] Transitioning a ticket to `resolved` sets `resolved_at`; reopening/closing-out clears it
- [ ] Existing resolved tickets show a backfilled `resolved_at`
- [ ] Detail page displays the timestamp; non-resolved tickets show no value
- [ ] Queue table and kebab menu unchanged
