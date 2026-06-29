# Proposal: Staging Pipeline — Validate Against Production-Shaped Data Without Touching Prod

> **Status**: Planning. Proposal APPROVED. Spec + Design APPROVED. Tasks breakdown PENDING
> (not yet generated). Implementation not started.
> Artifact trail also lives in engram under topic keys `sdd/staging-pipeline/*`.

## Status & Approved Corrections (post-design)

The design phase corrected two assumptions in this proposal against Supabase reality.
Both corrections are APPROVED and govern implementation:

- **Gate host**: full Supabase local stack via `supabase start` in CI — NOT bare Postgres.
  The app is 100% coupled to the Supabase API layer (PostgREST + GoTrue Auth + custom JWT
  hook `public.custom_access_token_hook`); no `DATABASE_URL` exists.
- **Postgres is 17** (config.toml), not 16.
- **Dump privileges → `restore-fixup.sql` seam** (see design ADR-1): the dump keeps
  `--no-owner --no-privileges --clean --if-exists`; an idempotent fixup script re-applies the
  grants that migrations created (notably `GRANT EXECUTE` on the JWT hook to
  `supabase_auth_admin`) since incremental `migration up` will not re-run already-applied
  migrations. This supersedes the plain `--no-privileges` wording in decision #1 below.

The five design decisions (fixup seam; Storage-scoped bucket key; baseline-derived coverage
ratchet; Chromium-only gate + Firefox/WebKit in shadow; deploy-key for promote push) are all
APPROVED.

## Intent

CI today validates only against an empty local seed, so the bug class that passes empty but
breaks on real schema/volume/constraints — especially DB migrations — reaches `main`. Build a
staging pipeline that runs each PR's migrations + E2E against a production-shaped snapshot,
never touching prod. Greenfield: `.github/` does not exist yet. Part of a broader
DevOps-culture push for an internal company ticketing system.

## Scope

### In Scope

- `.github/workflows/`: PR gate (`dev → staging`), monthly snapshot cron, unit/integration CI
  with coverage, promote automation; plus a non-blocking shadow lane.
- Vitest coverage config + threshold (`vitest.config.ts` has none today).
- Scripts: snapshot dump, no-op masking (wired, identity), restore + restore-fixup.
- One-time `staging` branch creation from `main` (documented).
- Masking as a documented NO-OP with hard trigger.

### Out of Scope

- Real masking rules / anonymization (until first client-PII column lands — hard trigger).
- Paid Supabase preview branches (future swap; snapshot stays portable).
- Vercel deploy changes (Vercel already handles preview=staging, prod=main).
- Any prod write/migration from CI.

## Approach

Flow `dev → staging → main`; promote = fast-forward the EXACT tested commit, never a re-merge.

- Gate host: full Supabase local stack via `supabase start` in CI.
- Gate: `supabase start` → restore golden snapshot → `restore-fixup.sql` → `supabase migration up`
  (applies only the PR's NEW migrations) → `next build && next start` → `pnpm test:e2e`
  (test-owned data on prod-shaped ambient volume) → teardown.
- Three independent cadences: monthly refresh, per-PR blocking gate, periodic non-blocking shadow.

## Decisions on open items

| #   | Item             | Decision                                                                                                                                                                                          | Rationale                                                                                                                                                                                                        |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Dump strategy    | `pg_dump` of `public`, `auth`, `storage`, `supabase_migrations` schemas, `--no-owner --no-privileges --clean --if-exists` → single `golden-snapshot.sql`; grants repaired by `restore-fixup.sql`. | Including `supabase_migrations.schema_migrations` lets the gate apply ONLY new migrations incrementally. `--no-privileges` keeps the dump portable; the fixup seam re-establishes the grants migrations applied. |
| 2   | Object storage   | Private Supabase Storage bucket `golden-snapshots`, accessed from CI with a Storage-scoped key.                                                                                                   | Least resistance, no new vendor. Scoped key over broad service-role.                                                                                                                                             |
| 3   | Gate app build   | `next build && next start` for CI (keep `next dev` local).                                                                                                                                        | Prod-like, catches build errors, stable E2E.                                                                                                                                                                     |
| 4   | Prod dump access | Dedicated read-only role `snapshot_reader` (`pg_read_all_data`); `pg_dump` via secret `SUPABASE_PROD_DB_URL_READONLY` over the DIRECT connection (5432), not the pooler (6543).                   | Least-privilege; bootstrap secrets from scratch.                                                                                                                                                                 |

## Capabilities

### New

- `snapshot-pipeline`: monthly cron dump → no-op masking → upload golden snapshot.
- `pr-gate`: `supabase start`, restore, fixup, incremental migrate, build, E2E; blocking on `dev → staging`.
- `coverage-ci`: Vitest coverage provider + threshold on every push.
- `promote-automation`: enforce fast-forward of the tested commit `staging → main`.
- `shadow-lane`: non-blocking smoke/perf vs full snapshot.
- `data-masking`: wired no-op step with documented hard trigger.

### Modified

- None (greenfield CI; no spec-level behavior changes).

## Affected Areas

| Area                   | Impact            | Description                                                       |
| ---------------------- | ----------------- | ----------------------------------------------------------------- |
| `.github/workflows/`   | New               | snapshot, pr-gate, coverage, promote, shadow                      |
| `scripts/snapshot/`    | New               | dump / mask (no-op) / upload / download / restore / restore-fixup |
| `vitest.config.ts`     | Modified          | Add coverage provider + threshold                                 |
| `playwright.config.ts` | Modified          | CI-aware webServer command                                        |
| `staging` branch       | New               | One-time from `main`                                              |
| Prod Supabase          | New role + bucket | `snapshot_reader` read-only + `golden-snapshots` bucket           |

## Risks

| Risk                                                                                    | Likelihood | Mitigation                                                                           |
| --------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| Restoring Supabase dump into `supabase start` fails (auth/extensions/roles/hook grants) | High       | Restore-validation probe FIRST; `--clean --if-exists`; `restore-fixup.sql` re-grants |
| Read-only role can't read `auth`/`supabase_migrations`                                  | Med        | `pg_read_all_data`; verify dump completeness                                         |
| `supabase start` slow/flaky in CI                                                       | Med        | Cache Docker images; serial workers; chromium-only gate                              |
| Snapshot leaks client data once PII lands                                               | Med        | Hard masking trigger = same PR as first PII column                                   |
| Single oversized PR                                                                     | Med        | exception-ok in effect; size:exception                                               |

## First-Slice Boundary (recommended)

Delivery is **exception-ok** (single PR acceptable, size exception). Recommended first slice if
split: **snapshot producer + Supabase Storage bucket + `snapshot_reader` role + secrets +
`staging` branch + restore-validation probe** — everything downstream depends on a snapshot that
restores cleanly. Gate, coverage CI, promote, and shadow lane follow as slice 2+. Masking stays a
no-op throughout.

## Rollback Plan

All additive: delete `.github/workflows/*`, revert `vitest.config.ts` / `playwright.config.ts`,
drop `staging` branch and `snapshot_reader` role, delete bucket. No prod data/migration changes,
so rollback is config-only with zero prod impact.

## Success Criteria

- [ ] A migration that breaks on prod-shaped data is caught at the gate, never on `main`.
- [ ] `golden-snapshot.sql` regenerated monthly and stored privately.
- [ ] `pnpm test:e2e` runs green against restored snapshot in `supabase start`.
- [ ] Vitest coverage threshold enforced on every push.
- [ ] `staging → main` only ever fast-forwards the tested commit.
- [ ] Masking step present as no-op with trigger documented.
