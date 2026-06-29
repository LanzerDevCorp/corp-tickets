# Staging Pipeline Design — Test Against Production-Shaped Data Without Touching Prod

This document is the design (not the implementation) for a staging pipeline whose
job is: **validate changes against production-shaped data before they reach `main`,
without ever putting production at risk.** It catches the class of bug that passes
on an empty seed and explodes on real schema, volume, and constraints — especially
database migrations.

Audience: anyone building or operating CI/CD for this repo (internal ticketing system).

> **Status:** approved design, not yet implemented. Build order is in
> [Implementation order](#implementation-order).

---

## TL;DR

| Decision              | Choice                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Data source for tests | **Raw monthly clone of prod** (internal system, no client PII _yet_)                                              |
| Masking               | **Passthrough no-op today**, wired into the pipeline; becomes mandatory the day the first client-PII column lands |
| Refresh cadence       | **Monthly cron** (1st of the month)                                                                               |
| Branch model          | Permanent `staging` integration branch; flow is `dev → staging → main`                                            |
| Promotion rule        | Promote the **exact commit you tested** (`staging → main`, fast-forward) — never a fresh re-merge                 |
| Gate DB host          | **Postgres in Docker (CI)** now; Supabase branch later (snapshot is host-agnostic)                                |
| E2E determinism       | **Test-owned data** (create + teardown) on top of the clone — already the repo's pattern                          |
| Coverage threshold    | Lives in **Vitest** unit/integration, not in E2E                                                                  |

---

## The flow

```
 feature work ──▶ dev ──PR──▶ staging ──(green gate)──▶ main ──▶ prod (Supabase)
                              │                          ▲
                              │ GATE (per PR)            │ promote = fast-forward
                              │  1. spin Docker Postgres  │ the SAME tested commit
                              │  2. restore monthly snapshot
                              │  3. apply this PR's migrations  ◀── prod-error prevention
                              │  4. run Playwright E2E (test-owned data)
                              ▼
                       red → blocked

 monthly cron (1st):  prod ──db dump──▶ [masking: no-op today]──▶ golden-snapshot.sql ──▶ bucket
 shadow lane (nightly/weekly, non-blocking): full snapshot ──▶ smoke + perf signal
```

Three **independent cadences** — do not couple them:

1. **Data refresh** — monthly, infra-owned, produces one artifact.
2. **PR gate** — per change, ephemeral, blocking.
3. **Shadow lane** — periodic, non-blocking, prod-volume signal.

---

## Branch model

`staging` is created **once** from `main` and lives forever as the integration branch.

| Step | Action                                                             |
| ---- | ------------------------------------------------------------------ |
| 1    | Feature work lands on `dev` (or feature branches → `dev`).         |
| 2    | Open PR `dev → staging`. The **gate** runs here.                   |
| 3    | Gate green → merge to `staging`.                                   |
| 4    | Promote `staging → main` by **fast-forward** of the tested commit. |

### The one rule that makes this real

**Promote what you tested, not a new merge.**

If you test `staging` green, then separately re-merge a feature into `main`, then
`main` never ran through the state you validated. With two changes in flight,
`staging` and `main` silently diverge and your green checkmark stops meaning
anything. So:

- `main` only ever advances **from** `staging` (ideally fast-forward).
- Keep `staging` ahead-or-equal to `main` — never let them diverge.

If you break this rule, you are testing one thing and shipping another, and prod
bugs come back — which is exactly what this pipeline exists to stop.

---

## Data strategy

### Today: raw monthly clone (internal system, no client PII)

This is an internal company tool. There is no customer data, so cloning prod
directly into the test environment is acceptable **right now**.

```
prod (Supabase) ──supabase db dump──▶ [masking step = identity/no-op]──▶ golden-snapshot.sql ──▶ object storage
                                       ▲
                                       └── the hook exists today; it just does nothing yet
```

### Why the masking step still exists today

The masking step is **wired in as a no-op**, not removed. This is deliberate
design-for-change: the day client information arrives, adding masking is _writing
the rules_, not _re-architecting the pipeline_.

> ⚠️ **Masking trigger — non-negotiable.** The moment the **first column holding
> client/customer data** is introduced, the masking step stops being a no-op and
> MUST anonymize that data before the snapshot leaves prod. This is a hard gate,
> not a backlog item. Treat "we now store client info" and "we enable masking" as
> the same pull request.

### Why a clone does NOT run the E2E suite directly

A cloned snapshot is **not deterministic** — its rows change every month. E2E
assertions against cloned rows would be flaky: a test fails because the data
shifted, not because the code broke. A test that fails for reasons you don't
control trains the team to ignore failures, which is worse than no test.

**Resolution (already this repo's pattern):** E2E tests **create their own data
and tear it down** (`tests/e2e` setup/teardown; see the existing "wipe
test-created tickets" hooks). The clone provides realistic _ambient volume,
schema, indexes, and constraints_; assertions only ever touch test-owned rows.
Deterministic tests **and** prod-shaped substrate.

---

## The PR gate (blocking)

Runs on every `dev → staging` PR.

| Phase | What                               | Tool                                                               |
| ----- | ---------------------------------- | ------------------------------------------------------------------ |
| 1     | Spin ephemeral Postgres            | `postgres:16` Docker service in CI                                 |
| 2     | Restore the latest golden snapshot | `psql < golden-snapshot.sql`                                       |
| 3     | **Apply this PR's migrations**     | `supabase db push` / `supabase migration up` against the Docker DB |
| 4     | Run E2E against the prod-shaped DB | `pnpm test:e2e` (Playwright, `tests/e2e`)                          |
| —     | Tear down                          | container discarded                                                |

**Phase 3 is the highest-value step.** Your migrations live in
`supabase/migrations/` (25 and counting). A migration that succeeds on an empty
local DB can fail on real volume or a real constraint. This gate runs every new
migration against a production-shaped database **before** it can reach prod.

> Point Playwright's `webServer`/`PLAYWRIGHT_BASE_URL` at an app instance wired to
> the **Docker DB**, not prod. The app under test must talk only to the ephemeral
> database.

---

## Coverage strategy — the test pyramid

"High coverage" does **not** mean "many E2E tests." E2E is slow and expensive;
keep it few and focused on critical flows. Put the coverage threshold where it's
cheap and fast.

| Layer              | Tool                         | Scope                                                         | Where it runs                | Carries coverage gate? |
| ------------------ | ---------------------------- | ------------------------------------------------------------- | ---------------------------- | ---------------------- |
| Unit / integration | Vitest (`pnpm test`)         | The bulk — logic, components, DB units (`__tests__`, `tests`) | Every push                   | ✅ **Yes**             |
| E2E                | Playwright (`pnpm test:e2e`) | Few critical user flows                                       | PR gate (`dev → staging`)    | ❌ No                  |
| Smoke / perf       | Shadow lane                  | Prod-volume sanity & performance                              | Nightly/weekly, non-blocking | ❌ No                  |

Set the coverage threshold in `vitest.config.ts`. Do not chase a coverage number
with E2E tests — that buys you slow, flaky CI and no extra confidence.

---

## Shadow lane (non-blocking)

A separate scheduled job (nightly or weekly) runs **smoke + performance** checks
against the **full** monthly snapshot. Purpose: catch volume/perf regressions and
real-data edge cases. It **never blocks merges** — it's signal, not a gate, so a
slow query surfaces without freezing the team.

---

## Implementation order

Build in dependency order — each step depends on the one above.

1. **Snapshot job (monthly cron)** — `supabase db dump` of prod → no-op masking
   step → upload `golden-snapshot.sql` to object storage. _Everything depends on
   this artifact existing._ Keep the producer **host-agnostic**: it knows nothing
   about Docker or Supabase branches; it only emits a portable dump.
2. **PR gate workflow** — Docker Postgres → restore snapshot → `supabase migration
up` → `pnpm test:e2e`. Blocking on `dev → staging`.
3. **Unit/integration CI** — `pnpm test` with a coverage threshold in
   `vitest.config.ts`. Runs on every push; fast.
4. **Promote automation** — `staging → main` fast-forward of the tested commit
   (enforce the [promote-what-you-tested rule](#the-one-rule-that-makes-this-real)).
5. **Shadow lane** — scheduled smoke/perf against the full snapshot, non-blocking.

---

## Migration path to Supabase branch (future)

Because the snapshot is a **portable artifact**, moving the gate DB from Docker to
a native Supabase branch later is a swap of the _consumer_, not a rewrite of the
_producer_:

| Stays the same                               | Changes                                                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Snapshot job (step 1)                        | Gate phase 1–2: instead of `docker run postgres` + `psql restore`, provision a Supabase preview branch and seed it from the same `golden-snapshot.sql` |
| Migrations command (`supabase migration up`) | Target connection string points at the branch                                                                                                          |
| E2E suite, coverage gate, promote rule       | —                                                                                                                                                      |

Trade-off when you switch: Supabase branches are paid and slower to provision, but
give you identical engine, extensions, RLS, and `auth` schema as prod. Worth it
once RLS/auth-sensitive bugs start slipping through the Docker approximation.

---

## Checklists

### Design acceptance (this doc)

- [ ] Three cadences are independent (refresh / gate / shadow)
- [ ] Masking step exists as a no-op and has a documented hard trigger
- [ ] Promote-what-you-tested rule is understood by everyone merging
- [ ] Coverage threshold is planned for Vitest, not E2E
- [ ] Snapshot producer is host-agnostic (Docker→Supabase swap is cheap)

### Before the first client-PII column ships

- [ ] Masking rules written for every new client-data column
- [ ] No-op masking step replaced with real anonymization
- [ ] Snapshot verified to contain no raw client data
- [ ] Access to the snapshot bucket reviewed

---

## Open items

- Object storage target for `golden-snapshot.sql` (Supabase Storage bucket vs. S3 vs. GHA artifact).
- Exact Postgres version to match prod (pin the Docker image to it).
- App wiring so the gate's app instance points at the Docker DB (env override for the gate run).
- Secrets handling for the prod `db dump` step (least-privilege, read-only role).
