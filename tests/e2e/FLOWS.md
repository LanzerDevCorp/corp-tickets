# E2E Flow Map — corp-tickets

Source of truth for end-to-end coverage. **Before extending a flow**: read its
entry, reuse the listed action helpers, add the branch as a tagged test, then
flip its ✅/⬜ here. **Before authoring a new flow**: add a new section.

## Building blocks

| Concern                   | Location                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------- |
| Action helpers ("skills") | `tests/e2e/actions/ticket.ts`                                                       |
| Data + DB fixtures        | `tests/e2e/fixtures/db.ts` (`makeTicket`, `getTicketIdBySubject`, `ensureCategory`) |
| Auth / persisted session  | `tests/e2e/global.setup.ts` → `tests/e2e/.auth/admin.json`                          |

## Tag taxonomy

`@lifecycle` (master flow) · `@create` · `@resolve` · `@status` · `@tooltip` ·
`@detail` · `@closed` · `@negative` · `@rbac` · `@tracking` · `@critical`

## Selective runs

| Want                    | Command                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| Everything              | `npx playwright test --project=chromium`                         |
| Master lifecycle        | `npx playwright test --grep @lifecycle --project=chromium`       |
| All resolve branches    | `npx playwright test --grep @resolve --project=chromium`         |
| Only the tooltip branch | `npx playwright test --grep @tooltip --project=chromium`         |
| Exclude negatives       | `npx playwright test --grep-invert @negative --project=chromium` |
| Watch it slow           | prefix `SLOWMO=800` and add `--headed` (or use `--ui`)           |

## Test data & isolation

- Every test creates its own data with a unique `E2E-<ts>-<rand>` marker
  (`makeTicket`), so parallel tests never collide on data.
- `global.setup.ts` wipes leftover E2E tickets at the start (clean slate), and a
  `cleanup` teardown project (`global.teardown.ts`) wipes them again at the end,
  so the shared local DB does not accumulate test data. Both call
  `cleanupE2ETickets()` (deletes `subject LIKE '%E2E-%'`; FKs cascade).
- Realtime is live: resolving a ticket in one test refetches every open
  dashboard, which can re-render rows mid-interaction. UI actions that depend on
  a transient element (e.g. the hover-card) must retry — see `resolveViaTooltip`
  wrapping its hover in `expect(...).toPass()`.

## Flow: Ticket lifecycle

File: `tests/e2e/ticket-lifecycle.spec.ts`

```
create → (auto in_progress on detail open) → resolve | close → tracking
                              │
        status change branches:
        ├── dashboard tooltip "Mark as resolved" → resolved only
        └── detail <Select> → open | in_progress | resolved | closed
                                                              └── closed requires reason
```

| Step / branch                                   | Affordance                     | Tags                        | Status  |
| ----------------------------------------------- | ------------------------------ | --------------------------- | ------- |
| Visitor creates ticket → visible in dashboard   | public form                    | `@create @critical`         | ✅      |
| Resolve via tooltip quick action                | dashboard HoverCard            | `@resolve @tooltip`         | ✅      |
| Resolve via detail dropdown                     | detail `<Select>`              | `@resolve @detail`          | ✅      |
| Close requires reason (negative) + persists     | detail `<Select>` + dialog     | `@status @closed @negative` | ✅      |
| open→in_progress auto-transition on detail open | detail load                    | `@status`                   | ⬜ TODO |
| Reopen a resolved/closed ticket                 | detail `<Select>` back to open | `@status`                   | ⬜ TODO |
| Non-staff cannot change status                  | server action guard            | `@rbac @negative`           | ⬜ TODO |
| Client sees resolved status in tracking         | `/track`                       | `@tracking`                 | ⬜ TODO |

### Edge cases discovered (backlog)

- Tooltip "Mark as resolved" is hidden once status is resolved/closed.
- `closure_reason` is cleared when status moves away from closed.
- Resolved/closed tickets leave the default open/in_progress queue (needs the
  status filter to assert in the queue; current tests assert via the detail page).
