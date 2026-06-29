# Feature E2E Commands

Copy-paste commands to run a single feature's end-to-end flow — and to **watch it
run** visually. All commands depend on the `setup` project (seeds the e2e admin
and a fresh session) and a local Supabase with the service-role key.

> Watch it run: append `--headed` to see the browser, and prefix `SLOWMO=800` to
> slow each action down. Drop both for fast headless runs (CI mode).

---

## Queue filter persistence

The four queue filters (status, priority, assignee, category) survive a reload
via `localStorage` (`useQueueFilters`).

```bash
# Watch it run (visual)
SLOWMO=800 npx playwright test --grep @filter-persistence --project=chromium --headed

# Fast (headless)
npx playwright test --grep @filter-persistence --project=chromium
```

## Happy path (ticket lifecycle)

A visitor creates a ticket and it appears in the admin dashboard — the master
critical flow.

```bash
# Watch it run (visual)
SLOWMO=800 npx playwright test --grep @critical --project=chromium --headed

# Full lifecycle (all branches: create → resolve/close)
npx playwright test --grep @lifecycle --project=chromium
```

---

See `FLOWS.md` for the full coverage map and tag taxonomy.
