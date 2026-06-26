# Design: Track Ticket Resolution Timestamp (resolved_at)

## Technical Approach

Capture WHEN a ticket entered `resolved` at the database layer via a single
idempotent migration, then surface the value read-only on the detail page. The
DB owns the value through a `BEFORE UPDATE` trigger, so every write path
(server action, SQL console, future automation) is covered without app code.
This mirrors the proposal's "trigger owns value" decision and the existing
`reset_first_seen_on_reopen` precedent (migration `20260625130000`).

## Architecture Decisions

| Decision | Choice | Rejected alternative | Rationale |
|---|---|---|---|
| Where to set the value | Postgres `BEFORE UPDATE` trigger | Write in `updateTicketStatus` server action | Trigger covers ALL write paths; action-only writes drift if status changes elsewhere; matches established `first_seen_at` pattern |
| Set vs clear semantics | Set `now()` on transition TO resolved; NULL on transition OUT | Set-only (never clear) | Reopen/close-out must reflect the ticket is no longer resolved; NULL keeps the field truthful |
| Backfill source | `updated_at` for existing `status='resolved'` rows | Leave historical rows NULL | A best-effort proxy is more useful than NULL for already-resolved tickets; exactness only guaranteed going forward |
| Column type | `TIMESTAMPTZ NULL` | `TIMESTAMP` | Matches `created_at`/`updated_at`/`first_seen_at`; TZ-aware |
| Detail display typing | Read `initialTicket.resolved_at` (already `any`) | Introduce generated DB types | Component prop is already `any`; zero type churn, no new tooling |
| Indexing | `idx_tickets_resolved_at` | No index | Cheap insurance for future SLA/time-to-resolution queries named as out-of-scope; `IF NOT EXISTS` keeps it idempotent |

## Data Flow

```
Status change (any path)
        │
        ▼
UPDATE public.tickets
        │  BEFORE UPDATE
        ▼
set_resolved_at_on_status_change()
   NEW.status='resolved'  & changed → NEW.resolved_at := now()
   OLD.status='resolved'  & moved off → NEW.resolved_at := NULL
        │
        ▼
Row persisted (resolved_at set/cleared)
        │
getTicketDetail select('*')  ──→  TicketDetail (initialTicket.resolved_at)
        │                                   │
        └──── conditional render ───────────┘  formatDateTime() when present
```

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260625140000_ticket_resolved_at.sql` | Create | ADD COLUMN `resolved_at`; trigger fn `set_resolved_at_on_status_change`; `BEFORE UPDATE` trigger; backfill UPDATE; `idx_tickets_resolved_at`. All idempotent. |
| `components/dashboard/ticket-detail.tsx` | Modify | Add a "Resuelto" row in the sidebar Info Summary, rendered only when `ticket.resolved_at` is truthy, using `formatDateTime`. |
| `lib/i18n/es.ts` | Modify | Add `common.resolved: "Resuelto"` label key. |

## Interfaces / Contracts

Trigger function (follows `reset_first_seen_on_reopen` exactly):

```sql
CREATE OR REPLACE FUNCTION public.set_resolved_at_on_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.resolved_at := now();
  ELSIF OLD.status = 'resolved' AND NEW.status <> 'resolved' THEN
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
```

No TypeScript interface changes: `initialTicket` is already `any`, and
`getTicketDetail` uses `select('*')` so `resolved_at` flows through untyped.

UI contract: sidebar gains one conditional row between "Creado" and the
assignee block, matching existing `flex items-center justify-between` styling.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| DB (integration) | Trigger sets `now()` on `open→resolved`; clears on `resolved→open` and `resolved→closed`; untouched on edits that keep `status='resolved'`; backfill populates existing resolved rows | pgTAP/SQL assertions against local `supabase start`, OR a Vitest integration test issuing UPDATEs via the service-role client and asserting `resolved_at` |
| Unit (component) | Sidebar renders formatted `resolved_at` when present; renders NO resolved row when `resolved_at` is null/undefined | Vitest + @testing-library/react, render `TicketDetail` with two `initialTicket` fixtures |
| i18n | `t("common.resolved")` resolves to "Resuelto" | Covered implicitly by component test using real `t` |

Strict TDD: write the failing component test (null vs set fixture) BEFORE
editing `ticket-detail.tsx`. Trigger behavior is verified by the DB test;
since trigger logic cannot run under jsdom, the DB-level test is the
authoritative red/green for the migration.

## Migration / Rollout

Single forward migration, idempotent (`ADD COLUMN IF NOT EXISTS`,
`CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`, `CREATE INDEX IF NOT EXISTS`).
Backfill runs once inside the same migration. Rollback = reverse migration:
DROP TRIGGER, DROP FUNCTION, DROP INDEX, ALTER TABLE DROP COLUMN. Detail render
is null-safe so the UI degrades cleanly if the column is absent.

## Open Questions

- None blocking. Backfill imprecision for historical rows is accepted per
  proposal and documented in a migration comment.
