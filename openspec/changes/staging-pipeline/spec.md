# Spec: Staging Pipeline — Validate Against Production-Shaped Data Without Touching Prod

## Scope Note

Delta spec only. Describes what MUST be true after the change is applied.
No HOW (implementation) is prescribed unless it is an inviolable constraint.
All constraints below are derived from the proposal; no requirements have been added beyond that scope.

---

## Capability 1: snapshot-pipeline

### Requirements

SP-1: The system SHALL produce a single artifact `golden-snapshot.sql` via
`pg_dump` executed against the production Supabase Postgres 17 instance using a
dedicated read-only role `snapshot_reader`.

SP-2: The dump SHALL include schemas: `public`, `auth`, `storage`, and
`supabase_migrations`. No other schemas SHALL be required.

SP-3: The dump SHALL be produced with `--no-owner` and `--no-privileges` flags so
that restored objects are owned by the local Supabase stack's default roles.
(Grants that migrations applied are re-established by the gate's `restore-fixup.sql`.)

SP-4: The dump SHALL pass through a masking step before upload. While the masking
step is a no-op (identity transform), it SHALL exist as an explicit, named script
invocation in the pipeline so it can be activated without structural change.

SP-5: The masked `golden-snapshot.sql` SHALL be uploaded to a private Supabase
Storage bucket named `golden-snapshots`. The bucket SHALL NOT be publicly accessible.

SP-6: The snapshot production workflow SHALL be triggered on a monthly cron
schedule (once per calendar month). It SHALL also support manual trigger for
operational recovery.

SP-7: The role `snapshot_reader` SHALL have USAGE on schemas `public`, `auth`,
`storage`, and `supabase_migrations`, and SELECT on all tables within those
schemas. It SHALL NOT have INSERT, UPDATE, DELETE, or TRUNCATE.

SP-8: The production database URL for `snapshot_reader` SHALL be stored as a
GitHub Actions secret named `SUPABASE_PROD_DB_URL_READONLY` and SHALL NOT appear
in any committed file.

SP-9: If the dump command exits non-zero, the workflow SHALL fail and the upload
step SHALL NOT execute. The previous snapshot SHALL remain in the bucket unmodified.

### Acceptance Scenarios

**Scenario SP-A: Happy-path monthly snapshot**
Given: `snapshot_reader` role exists on prod with correct grants
And: `SUPABASE_PROD_DB_URL_READONLY` secret is set
And: bucket `golden-snapshots` exists and is private
When: the monthly cron fires (or the workflow is triggered manually)
Then: `pg_dump` runs with `--no-owner --no-privileges` covering all four schemas
And: the masking script runs as a no-op producing an identical file
And: `golden-snapshot.sql` is uploaded to the `golden-snapshots` bucket
And: the workflow exits with success

**Scenario SP-B: Dump failure does not overwrite previous snapshot**
Given: `snapshot_reader` cannot connect (wrong credentials or network failure)
When: the monthly cron fires
Then: `pg_dump` exits non-zero
And: the masking and upload steps do NOT execute
And: any prior `golden-snapshot.sql` in the bucket remains intact
And: the workflow exits with failure and emits a clear error message

**Scenario SP-C: Bucket is private**
Given: `golden-snapshot.sql` exists in the `golden-snapshots` bucket
When: an unauthenticated HTTP request is made for the object URL
Then: the request is rejected with 4xx (no public read)

**Scenario SP-D: snapshot_reader cannot mutate prod data**
Given: `snapshot_reader` is granted only SELECT + USAGE
When: any INSERT, UPDATE, DELETE, or DDL statement is attempted with that role
Then: the database rejects the statement with a permission error

---

## Capability 2: pr-gate

### Requirements

PG-1: A GitHub Actions workflow SHALL trigger on every pull request targeting the
`staging` branch from `dev`.

PG-2: The gate SHALL be BLOCKING: the PR cannot be merged until the workflow exits with success.

PG-3: The workflow SHALL start the full Supabase local stack via `supabase start`.
Bare Postgres is NOT acceptable as a substitute.

PG-4: The workflow SHALL restore `golden-snapshot.sql` from the `golden-snapshots`
bucket into the running local Supabase Postgres 17 instance via `psql` (or
equivalent direct SQL import), followed by the idempotent `restore-fixup.sql` seam.

PG-5: After restore + fixup, the workflow SHALL run `supabase migration up`. Because
`supabase_migrations.schema_migrations` is part of the restored snapshot, this
command SHALL apply ONLY migrations whose version does not already appear in the
migration history table — i.e., only the PR's new migrations.

PG-6: After migration, the workflow SHALL run `next build && next start` to produce
a production-like app server before executing E2E tests.

PG-7: The workflow SHALL execute `pnpm test:e2e` against the running app and
Supabase stack. (Browser scope: Chromium in the blocking gate; Firefox/WebKit in shadow lane.)

PG-8: If any step in PG-3 through PG-7 exits non-zero, the workflow SHALL fail and
the PR gate SHALL block the merge.

PG-9: After the workflow completes (success or failure), the Supabase local stack
SHALL be torn down, freeing CI runner resources.

PG-10: If `golden-snapshot.sql` does not exist in the bucket, the workflow SHALL
fail with a descriptive error identifying the missing snapshot as the cause. It
SHALL NOT silently proceed against an empty or seed-only database.

PG-11: If the restore step fails, the workflow SHALL fail with the restore error
surfaced. Migration and test steps SHALL NOT run.

PG-12: If `supabase migration up` detects a migration history conflict (a migration
in the PR's files is older than the most recent entry in `schema_migrations`), the
workflow SHALL fail with a clear migration-history mismatch error.

### Acceptance Scenarios

**Scenario PG-A: Clean PR — migration is valid on prod-shaped data**
Given: `golden-snapshot.sql` exists in the bucket
And: the PR adds one new migration newer than the snapshot's migration history
When: the PR gate runs on a PR from `dev` to `staging`
Then: `supabase start` succeeds; the snapshot is restored + fixed up
And: `supabase migration up` applies only the new migration
And: `next build && next start` succeeds; `pnpm test:e2e` passes
And: the workflow exits with success, unblocking the PR

**Scenario PG-B: Migration breaks on prod-shaped data**
Given: `golden-snapshot.sql` with real production schema + data
And: the PR adds a migration that adds a NOT NULL column without a DEFAULT on a populated table
When: the PR gate runs
Then: `supabase migration up` exits non-zero; the workflow fails; the PR merge is blocked
And: the failure message identifies the migration step as the cause

**Scenario PG-C: Missing snapshot blocks gate**
Given: the `golden-snapshots` bucket is empty
When: the PR gate runs
Then: the workflow fails before attempting restore; no migration or test step runs

**Scenario PG-D: Restore failure blocks gate**
Given: `golden-snapshot.sql` exists but is corrupt or incompatible
When: the restore step runs
Then: the restore step exits non-zero; the workflow fails immediately
And: `supabase migration up` and `pnpm test:e2e` do NOT run

**Scenario PG-E: Migration history mismatch**
Given: the PR contains a migration whose version is earlier than the newest entry in `schema_migrations`
When: `supabase migration up` runs
Then: the command detects the history conflict and exits non-zero; the workflow fails

**Scenario PG-F: Teardown always runs**
Given: the workflow reaches any failure point after `supabase start`
When: the workflow exits
Then: the teardown step runs regardless of the failure; the local Supabase stack is stopped

---

## Capability 3: coverage-ci

### Requirements

CC-1: `vitest.config.ts` SHALL include a coverage provider compatible with Vitest's built-in coverage support.

CC-2: A minimum coverage threshold SHALL be defined and enforced for lines, functions, branches, and statements.

CC-3: A GitHub Actions workflow SHALL run Vitest with coverage enabled on every push to any branch and on every PR.

CC-4: If any coverage metric falls below its threshold, the workflow SHALL fail and the result SHALL be surfaced in the CI output.

CC-5: The coverage threshold values SHALL be committed in `vitest.config.ts` and SHALL NOT be configurable via environment variable.

### Acceptance Scenarios

**Scenario CC-A: Coverage meets threshold**
Given: all coverage metrics are at or above the configured thresholds
When: the coverage CI workflow runs on a push
Then: `vitest run --coverage` exits with success; the workflow exits with success

**Scenario CC-B: Coverage falls below threshold**
Given: a change reduces line coverage below the configured threshold
When: the coverage CI workflow runs
Then: Vitest exits non-zero with a coverage threshold failure; the CI job fails; the failing metric(s) are shown

**Scenario CC-C: Threshold is committed and not bypassable**
Given: the threshold is defined in `vitest.config.ts`
When: a developer pushes without modifying that file
Then: the same threshold applies — no per-run override is possible via env

---

## Capability 4: promote-automation

### Requirements

PA-1: A GitHub Actions workflow SHALL enforce the promotion of `staging` to `main`. This workflow SHALL be the sole supported mechanism for merging staging into main.

PA-2: The promote workflow SHALL verify that the commit being promoted on `staging` is the EXACT commit that passed the PR gate.

PA-3: The promotion SHALL be executed as a fast-forward merge ONLY. Re-merge SHALL NOT be permitted.

PA-4: If `main` has diverged from `staging`'s ancestry, the workflow SHALL fail with a clear message and SHALL NOT perform any merge.

PA-5: The promote workflow SHALL require the PR gate on the current `staging` HEAD to have passed before promotion proceeds.

PA-6: Promotion that bypasses the workflow (e.g., direct push to `main`) SHALL be blocked by branch protection rules on `main`.

### Acceptance Scenarios

**Scenario PA-A: Clean fast-forward promotion**
Given: `staging` is ahead of `main` by N gate-passed commits, and `main` has no commits since `staging` branched
When: the promote workflow is triggered
Then: `main` is fast-forwarded to the exact `staging` HEAD SHA; no merge commit is created
And: the SHA on `main` equals the SHA that ran `pnpm test:e2e`

**Scenario PA-B: Main has diverged — promotion blocked**
Given: `main` has a direct commit not in `staging`'s ancestry
When: the promote workflow is triggered
Then: the workflow detects fast-forward is impossible; it fails with a divergence message; `main` is not modified

**Scenario PA-C: Direct push to main is blocked**
Given: branch protection rules on `main`
When: a developer attempts `git push origin main` directly
Then: the push is rejected; `main` is not modified

**Scenario PA-D: Gate must have passed before promotion**
Given: the current HEAD of `staging` has not passed the PR gate
When: the promote workflow is triggered
Then: the workflow fails before the fast-forward; `main` is not modified

---

## Capability 5: shadow-lane

### Requirements

SL-1: A GitHub Actions workflow SHALL run a non-blocking smoke and performance pass against the full golden snapshot. Its failure SHALL NOT block any PR or promotion.

SL-2: The shadow lane SHALL restore `golden-snapshot.sql` and run a targeted subset of E2E tests (smoke / critical path) AND a performance probe, without running the full E2E suite the gate runs.

SL-3: The shadow lane results SHALL be reported in the CI interface so regressions are visible even though they do not block.

SL-4: The shadow lane SHALL run on a scheduled cadence (not per-PR).

SL-5: If `golden-snapshot.sql` is missing, the shadow lane SHALL fail with a descriptive error but the failure SHALL remain non-blocking.

### Acceptance Scenarios

**Scenario SL-A: Shadow lane passes**
Given: `golden-snapshot.sql` exists
When: the shadow lane triggers on schedule
Then: snapshot is restored; smoke E2E subset passes; perf probe completes within bounds; workflow exits success (informational)

**Scenario SL-B: Shadow lane fails — does not block PR or promote**
Given: the shadow lane exits non-zero
When: a developer opens a PR from `dev` to `staging` and when the promote workflow runs
Then: the gate and promote workflows are unaffected; the shadow failure shows as a separate non-required check

**Scenario SL-C: Missing snapshot in shadow lane**
Given: the `golden-snapshots` bucket is empty
When: the shadow lane triggers
Then: the workflow fails with a "missing snapshot" error; no test steps run; the failure is visible but non-blocking

---

## Capability 6: data-masking

### Requirements

DM-1: A masking script SHALL exist as a named, invocable step in the snapshot-pipeline workflow. Its current behavior SHALL be the identity function (no-op): output byte-for-byte identical to input.

DM-2: The masking script SHALL be the ONLY place where PII scrubbing logic is added when required.

DM-3: The pipeline SHALL invoke the masking script on every snapshot run. The masking step SHALL NOT be skippable via configuration flag.

DM-4: The script file SHALL contain a comment block documenting (a) that the current implementation is a no-op, and (b) the HARD TRIGGER: masking MUST be converted to an active implementation in the SAME pull request that introduces the first client-PII column into any schema covered by the dump.

DM-5: CI SHALL validate that the masking script exists and runs without error (it does NOT test PII rules, since none exist yet).

### Acceptance Scenarios

**Scenario DM-A: No-op masking produces identical output**
Given: a `golden-snapshot.sql` produced by `pg_dump`
When: the masking script runs with that file as input
Then: the output is byte-for-byte identical to the input; the step exits success

**Scenario DM-B: Hard trigger documentation is present**
Given: the masking script file
When: the file is read
Then: it contains a clearly marked comment block naming the hard trigger (real masking mandatory in the same PR as the first client-PII column)

**Scenario DM-C: Masking step is always invoked**
Given: the snapshot-pipeline workflow definition
When: the workflow file is inspected
Then: the masking invocation is present between dump and upload with no conditional that could skip it

---

## Cross-Cutting Requirements

XC-1: All workflows SHALL be defined under `.github/workflows/`.

XC-2: All secrets SHALL be referenced exclusively via GitHub Actions secrets and SHALL NOT appear in any committed file.

XC-3: The `staging` branch SHALL be created from `main` as a one-time bootstrap. After creation, `staging` receives commits only via fast-forward from `dev` PRs that pass the gate.

XC-4: No workflow SHALL perform any write, migration, or DDL operation against the production Supabase instance. The production instance is read-only from CI.

XC-5: All Supabase local stack usage in CI SHALL pin to Postgres 17. A Postgres version mismatch SHALL cause the gate to fail rather than silently proceed.

---

## Out of Scope (explicitly excluded)

- Real PII masking rules (activated only at hard trigger)
- Paid Supabase preview branches
- Vercel deploy configuration changes
- Any prod write, migration, or DDL from CI
- Test data fixtures or seed changes (E2E tests own their data)
