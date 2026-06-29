# Design: Staging Pipeline — Validate Against Production-Shaped Data

Implementation-ready design answering the proposal. Scope-locked to the approved decisions.
Greenfield `.github/`. Stack: Next 16, pnpm, Supabase CLI (PG17), full Supabase local stack in CI via `supabase start`.

## Architecture Overview — components & data flow

```
PRODUCER (monthly cron, infra-owned)          ARTIFACT                 CONSUMERS
 prod Supabase ──pg_dump(snapshot_reader)──▶ mask(no-op) ──▶ gzip ──▶ golden-snapshots bucket (prod Storage, private)
                                                                          │ latest/golden-snapshot.sql.gz
   ┌──────────────────────────────────────────────────────────────────────┘
   ▼                                                                   ▼
 PR GATE (per PR, blocking, dev→staging)                         SHADOW LANE (scheduled, non-blocking)
  supabase start → restore → fixup → migration up → build → e2e   restore full snapshot → smoke+perf signal

COVERAGE CI (every push, fast)         PROMOTE (staging→main, FF-only of tested SHA)
  vitest run --coverage (thresholds)    workflow: assert gate-green + FF-ancestor → push staging:main
```

Three INDEPENDENT cadences (never couple): monthly refresh, per-PR gate, periodic shadow.

Component layout:

- `scripts/snapshot/dump.sh` — pg_dump invocation
- `scripts/snapshot/mask.sh` — no-op seam (today `exec cat`), real masking later
- `scripts/snapshot/upload.mjs` — upload to prod Storage bucket (supabase-js service role)
- `scripts/snapshot/download.mjs` — gate pulls `latest` from bucket
- `scripts/snapshot/restore.sh` — restore golden dump into local supabase start DB (54322)
- `scripts/snapshot/restore-fixup.sql` — idempotent re-grant/owner fixup (THE critical seam, see ADR-1)
- `.github/workflows/{snapshot,pr-gate,coverage,promote,shadow}.yml`
- `vitest.config.ts` — add coverage block
- `playwright.config.ts` — CI-aware webServer.command

## 1. RESTORE-VALIDATION PROBE (de-risk #1 first — everything depends on it)

The #1 risk is "Supabase pg_dump won't restore cleanly into a CI supabase start (auth/extensions/roles/JWT hook)." This probe is the EARLIEST, CHEAPEST CI step and MUST go green before any other workflow is built.

KEY DISCOVERY driving the probe design (verified against repo):

1. `supabase start` AUTO-APPLIES all local `supabase/migrations/*` on boot AND seeds `seed.sql`. So a fresh stack already has full public/auth/storage schema + `supabase_migrations` history with ALL migrations marked applied. To make "apply ONLY the PR's new migration on prod history" work, the restore MUST OVERWRITE schema+data+history with prod's state (prod history lacks the new migration).
2. `--no-privileges` STRIPS all GRANT/REVOKE from the dump. Critical grants were applied BY migrations (`20260626120000_grant_table_permissions.sql` → anon/authenticated/service_role on public; `20260619170000_custom_access_token_hook_role_claim.sql` → `GRANT EXECUTE ... TO supabase_auth_admin`). Those migrations are already in the restored history table → `migration up` will NOT re-run them. Result: restored DB has the hook function but supabase_auth_admin can't EXECUTE it → LOGIN BREAKS, and PostgREST table grants vanish → authed reads 403. This is exactly the class of failure the probe must catch and the `restore-fixup.sql` seam must repair.

PROBE — two tiers:

Tier 1 (`probe-restore-roundtrip`, NO prod secrets — cheapest, run first):
Uses the LOCAL stack as a stand-in for prod, proving the dump→restore RECIPE without prod access.
Steps: `supabase start` (stack A) → seed extra rows → `scripts/snapshot/dump.sh` → fresh `supabase db reset`-equivalent target → `scripts/snapshot/restore.sh` → `restore-fixup.sql` → `supabase migration up` (no-op, history complete) → assert GREEN.
GREEN means ALL of:

- restore exits 0 (no fatal psql errors; "already exists" handled by `--clean --if-exists`)
- `select count(*)` on a public table > 0 (data present)
- extensions present: `select extname from pg_extension` includes pgcrypto/uuid-ossp/pg_graphql/etc. matching prod
- AUTH HOOK works: a real login through the app (or a direct GoTrue `/token` call) succeeds AND the issued JWT carries the `role`=app_role claim (proves supabase_auth_admin can EXECUTE the hook → proves fixup restored the grant)
- AUTHED PostgREST read returns rows (proves anon/authenticated/service_role table grants restored)
- `supabase migration up` is a clean no-op (history table matches migrations on disk)

Tier 2 (`probe-restore-prod`, needs prod secrets + bucket): identical assertions but source is the REAL `latest` golden snapshot from the bucket. Confirms prod-specific extensions/roles/volume restore. Runs after secrets bootstrap.

The probe LOCKS the restore recipe. Build hypothesis = recipe in §3/§4; expect 1-2 iterations on the fixup SQL. Nothing downstream is trusted until Tier 1 is green.

## 2. SNAPSHOT PRODUCER (`snapshot.yml`, monthly cron 1st 00:00 UTC + workflow_dispatch)

`scripts/snapshot/dump.sh` — pg_dump invocation (refines locked decision #1; `--clean --if-exists` added so the single artifact restores idempotently over a fresh supabase start — does NOT contradict the locked `--no-owner --no-privileges`):

```
pg_dump "$SUPABASE_PROD_DB_URL_READONLY" \
  --schema=public --schema=auth --schema=storage --schema=supabase_migrations \
  --no-owner --no-privileges --clean --if-exists --quote-all-identifiers \
  --file=golden-snapshot.sql
```

Notes: connect via DIRECT connection (port 5432) or SESSION pooler — NOT the transaction pooler (6543), which breaks pg_dump. `snapshot_reader` authenticates directly in the URL.

Masking seam `scripts/snapshot/mask.sh` (wired, identity today):

```
#!/usr/bin/env bash
set -euo pipefail
exec cat   # NO-OP. HARD TRIGGER: replace with anonymization in the SAME PR as the first client-PII column.
```

Pipeline: `dump.sh | mask.sh | gzip > golden-snapshot.sql.gz` then `upload.mjs`.

Upload (`upload.mjs`, supabase-js against PROD): `storage.from('golden-snapshots').upload('latest/golden-snapshot.sql.gz', ..., {upsert:true})` AND a dated copy `archive/<YYYY-MM-DD>/golden-snapshot.sql.gz`. Bucket `golden-snapshots` is private (locked decision #2); created once via migration or dashboard.

`snapshot_reader` role (run once on prod as postgres) — least privilege incl. auth + supabase_migrations:

```sql
CREATE ROLE snapshot_reader WITH LOGIN PASSWORD '<secret>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT pg_read_all_data TO snapshot_reader;  -- PG14+ predefined: SELECT on all tables + USAGE on all schemas (auth, storage, supabase_migrations, public)
```

Fallback if pg_read_all_data is undesirable: explicit `GRANT USAGE ON SCHEMA public,auth,storage,supabase_migrations` + `GRANT SELECT ON ALL TABLES IN SCHEMA ...` + matching `ALTER DEFAULT PRIVILEGES`. Verify dump completeness: assert dumped file contains `auth.users` INSERTs and `supabase_migrations.schema_migrations` rows.

## 3. RESTORE + FIXUP (consumed by gate + probe)

`scripts/snapshot/restore.sh`: gunzip + `psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=0 -f golden-snapshot.sql` (ON_ERROR_STOP=0 because `--clean` DROP IF EXISTS on a fresh start emits benign notices; capture and grep for FATAL). LOCAL_DB_URL = `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

`scripts/snapshot/restore-fixup.sql` (THE seam that repairs what `--no-privileges` stripped; idempotent, role-guarded) — re-applies:

- `GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;`
- Data API grants on public to anon/authenticated/service_role (mirror of `20260626120000_grant_table_permissions.sql`, written idempotently)
- `ALTER ... OWNER`/`REASSIGN OWNED` for auth/storage objects to supabase_auth_admin / supabase_storage_admin if ownership matters (probe determines necessity)
  Applied AFTER restore, BEFORE `supabase migration up`.

## 4. PR GATE (`pr-gate.yml`, on: pull_request → staging, blocking required check)

Steps:

1. `actions/checkout` (full history if promote needs it; gate itself shallow ok)
2. `pnpm/action-setup` + `actions/setup-node` (node 20, cache pnpm) + `pnpm install --frozen-lockfile`
3. `supabase/setup-cli@v1` (pin CLI version)
4. Docker image cache (fight cold-start): `actions/cache` keyed on `supabase-images-${{ cli_version }}`; restore via `docker load < images.tar.gz`; on miss, after first `supabase start` do `docker save $(docker images --filter=reference='public.ecr.aws/supabase/*' -q) | gzip > images.tar.gz`. Cuts ~2-3 min cold pull.
5. `supabase start`
6. Capture local stack endpoints into env: `supabase status -o env >> "$GITHUB_ENV"` → exports NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. THESE ARE LOCAL DEMO KEYS, NOT SECRETS — the app under test is pointed ONLY at the local stack, never prod.
7. `download.mjs` (pull `latest` from prod bucket) → `restore.sh` → `psql -f restore-fixup.sql`
8. `supabase migration up` — applies ONLY the PR's NEW migrations on top of restored prod history (history table came from prod; on-disk has +N new files)
9. `pnpm build` (next build — locked decision #3, prod-like, catches build errors)
10. `pnpm test:e2e` — Playwright; webServer runs `next start` against local stack (see playwright change). Test-owned data pattern already in repo (E2E- marker + cleanup). Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from step 6), E2E_ADMIN_EMAIL/PASSWORD (secrets), NEXT_PUBLIC_SITE_URL=http://localhost:3000, RESEND_API_KEY/RESEND_FROM_EMAIL (dummy ok), TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA (test key, always passes)
11. teardown: `supabase stop` (container discarded)

Playwright change (`playwright.config.ts`): make webServer CI-aware —
`command: process.env.CI ? "pnpm start" : "npm run dev"` (build done in step 9; `next start` is stable/prod-like vs on-demand dev compilation). `reuseExistingServer: !CI` stays.
DECISION (approved): gate runs `--project=chromium` only for speed (serial workers already set, retries=2); keep firefox/webkit cross-browser in the nightly shadow lane.

## 5. COVERAGE CI (`coverage.yml`, on: push, every branch — fast, no DB)

`vitest.config.ts` add to `test`:

```ts
coverage: {
  provider: "v8",            // add devDep @vitest/coverage-v8 (pin)
  reporter: ["text", "html", "lcov", "json-summary"],
  reportsDirectory: "./coverage",
  exclude: ["node_modules","tests/e2e/**",".next/**",".agents/**","**/*.config.*","**/*.d.ts","**/__tests__/**","scripts/**"],
  thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },  // set from baseline — see below
}
```

Add script `"test:coverage": "vitest run --coverage"`. Workflow: setup pnpm/node → `pnpm test:coverage` → upload `coverage/` artifact + post `json-summary` to job summary.
THRESHOLD STRATEGY (approved — baseline-derived): do NOT guess a number. First PR runs coverage to capture the BASELINE, set each threshold = floor(baseline / 5) * 5 (slightly below baseline so it can't regress). RATCHET: raise the floor in the same PR whenever coverage rises. Starting floor ~60% global is a reasonable target if baseline allows; otherwise baseline-derived.

## 6. PROMOTE AUTOMATION (`promote.yml`, on: push → staging — makes "promote what you tested" MECHANICAL)

Invariant: `main` only ever advances to a `staging` SHA that already passed the gate, and ONLY by fast-forward.
Mechanics (workflow, not just docs):

1. On push to staging, resolve `STAGING_SHA=$GITHUB_SHA`
2. Assert gate-green: query `gh api` check-runs/commit-status for STAGING_SHA; require the pr-gate required check = success. If not green → FAIL, do not promote.
3. Assert fast-forwardable: `git merge-base --is-ancestor origin/main $STAGING_SHA` (main is ancestor of staging). If false → FAIL loudly (divergence = "you'd ship something you didn't test").
4. `git push origin $STAGING_SHA:main` (pure FF; no merge commit, no re-merge).
   Branch protection (configured once, the other half of mechanical enforcement):

- main: require linear history, disallow direct pushes/force, restrict push to the promote workflow's token/deploy key only, require PRs elsewhere.
- staging: require the pr-gate status check to pass before merge.
  This makes re-merging into main IMPOSSIBLE outside the promote path → the tested commit is the only thing that can reach main.
  Promote push identity (approved decision #5): a dedicated deploy key / fine-grained PAT (GITHUB_TOKEN cannot push to protected main).

## 7. SHADOW LANE (`shadow.yml`, on: schedule nightly + workflow_dispatch — NON-BLOCKING)

Never a required check (separate workflow, not referenced by branch protection; steps may `continue-on-error`). Restores the FULL `latest` snapshot into supabase start (reuses restore.sh + fixup), runs:

- smoke: `pnpm test:e2e --grep @smoke` across chromium+firefox+webkit (the cross-browser coverage dropped from the gate)
- perf signal: time key flows / `EXPLAIN ANALYZE` on hot queries against prod-shaped volume; emit p95 to job summary + artifact
  Purpose: catch volume/perf regressions & real-data edge cases as SIGNAL, never freezing merges.

## 8. SECRETS BOOTSTRAP (greenfield `.github/`; full list + where used)

| Secret                        | Used by                                          | Purpose                                 | Notes                                                             |
| ----------------------------- | ------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------- |
| SUPABASE_PROD_DB_URL_READONLY | snapshot.yml                                     | pg_dump connection as snapshot_reader   | DIRECT/session conn (5432), not pooler 6543                       |
| SUPABASE_PROD_URL             | snapshot.yml (upload), pr-gate/shadow (download) | prod project API URL for Storage bucket | kept as secret for parity                                         |
| SUPABASE_PROD_STORAGE_KEY     | snapshot.yml (upload), pr-gate/shadow (download) | auth to private golden-snapshots bucket | SCOPED Storage key (approved decision #2), not broad service-role |
| E2E_ADMIN_EMAIL               | pr-gate, shadow                                  | seed/login e2e admin                    |                                                                   |
| E2E_ADMIN_PASSWORD            | pr-gate, shadow                                  | e2e admin password                      |                                                                   |
| RESEND_API_KEY                | pr-gate, shadow                                  | app boot                                | dummy `re_dummy_local` acceptable (no mail in CI)                 |
| RESEND_FROM_EMAIL             | pr-gate, shadow                                  | app boot                                | dummy acceptable                                                  |
| TURNSTILE_SECRET_KEY          | pr-gate, shadow                                  | captcha verify                          | test key `1x0000000000000000000000000000000AA` (always passes)    |
| PROMOTE_DEPLOY_KEY            | promote.yml                                      | push staging:main + read checks         | dedicated deploy key / fine-grained PAT (approved decision #5)    |

NOT secrets (derived at runtime from `supabase status -o env`): NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321, SUPABASE_SERVICE_ROLE_KEY (local), NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (local), NEXT_PUBLIC_SITE_URL=http://localhost:3000. The app under test is pointed ONLY at the local stack.

One-time bootstrap order: create snapshot_reader on prod → create golden-snapshots bucket → set the secrets → create `staging` branch from `main` → configure branch protection → run Tier 1 probe → run snapshot.yml once (seed `latest`) → run Tier 2 probe → enable gate as required check.

## ADR — Architecture Decision Records

ADR-1 (NEW, design-level): restore-fixup seam. `--no-privileges` (locked) + incremental `migration up` (locked) means migration-applied grants are NOT restored and NOT re-run → idempotent `restore-fixup.sql` re-establishes the auth-hook EXECUTE grant + Data API grants after restore. REJECTED alt: drop `--no-privileges` (would carry prod-only role ACLs like snapshot_reader into CI, causing restore errors for non-existent roles). REJECTED alt: re-run all migrations from scratch (defeats "apply only new on prod-shaped history"). The fixup is the minimal seam.

ADR-2 (refine locked #1): add `--clean --if-exists --quote-all-identifiers` to pg_dump so the single golden-snapshot.sql restores idempotently OVER a fresh supabase start (which already auto-applied migrations + seed). Complements, does not contradict, the locked `--no-owner --no-privileges`.

ADR-3: app pointed at local stack via `supabase status -o env`, never prod. Local demo keys are not secrets. Only dump+bucket touch prod, via least-privilege snapshot_reader + a prod key.

ADR-4 (carry locked #3): `next build && next start` in gate. Plus playwright webServer.command becomes CI-aware.

ADR-5: gate = chromium-only for speed; cross-browser moves to non-blocking shadow lane (approved decision #4).

## Risk → mitigation (every proposal risk addressed)

| Proposal risk                                                         | Mitigation in this design                                                                                                                                            |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase dump won't restore into supabase start (auth/ext/roles/hook) | restore-validation probe Tier1/Tier2 as FIRST CI step; --clean --if-exists; restore-fixup.sql re-grants auth-hook EXECUTE + Data API; GREEN = login+authed-read pass |
| Read-only role can't read auth/supabase_migrations                    | snapshot_reader = pg_read_all_data (covers auth+supabase_migrations); dump-completeness assertion                                                                    |
| supabase start slow/flaky in CI                                       | docker image save/load cache keyed on CLI version; serial workers already set; chromium-only gate                                                                    |
| Snapshot leaks client data once PII lands                             | mask.sh wired no-op seam; HARD TRIGGER documented = same PR as first PII column                                                                                      |
| Single oversized PR                                                   | exception-ok in effect; first-slice = producer+bucket+role+secrets+staging branch, gate/coverage/promote/shadow follow                                               |

## Approved decisions (were flagged for user, now resolved)

1. restore-fixup approach (re-grant script) — APPROVED over relaxing `--no-privileges`.
2. Bucket auth from CI — APPROVED scoped Storage key over broad service-role key.
3. Coverage starting threshold — APPROVED baseline-derived (capture in first coverage PR, ratchet up).
4. Gate browser scope — APPROVED chromium-only gate + cross-browser in shadow.
5. Promote push identity — APPROVED dedicated deploy key/PAT.

Stays within proposal scope: no real masking, no Supabase preview branches, no Vercel changes, no prod writes. All requirements covered.
