# Tasks: Staging Pipeline

> ⚠️ **Status: PENDING formal breakdown.** The `sdd-tasks` phase was not completed this
> session (the agent was stopped). What follows is the planned WORK-UNIT slicing carried from
> the design, ordered by dependency, to be expanded into a checked task list when resumed.
> Strict TDD is active — where a unit changes app/test code, write the test first.
> Delivery: exception-ok (single PR acceptable, `size:exception`).

## Planned work units (dependency order)

### Unit 1 — Restore recipe + probe (de-risk first; everything depends on it)

- [ ] `scripts/snapshot/dump.sh` — pg_dump (4 schemas, `--no-owner --no-privileges --clean --if-exists --quote-all-identifiers`)
- [ ] `scripts/snapshot/mask.sh` — no-op seam (`exec cat`) with HARD-TRIGGER comment block
- [ ] `scripts/snapshot/restore.sh` — gunzip + psql restore into local stack (54322)
- [ ] `scripts/snapshot/restore-fixup.sql` — idempotent re-grant (auth-hook EXECUTE → supabase_auth_admin; Data API grants)
- [ ] `.github/workflows/` Tier-1 probe job (`probe-restore-roundtrip`, NO prod secrets) — GREEN = restore clean + data present + extensions match + login yields role-claim JWT + authed read returns rows + `migration up` no-op
- [ ] Iterate fixup SQL until Tier 1 is green (expect 1–2 iterations)

### Unit 2 — Snapshot producer + bucket + role (the artifact source)

- [ ] `snapshot_reader` read-only role on prod (`pg_read_all_data`) — one-time SQL
- [ ] Private `golden-snapshots` Storage bucket — one-time
- [ ] `scripts/snapshot/upload.mjs` + `download.mjs` (supabase-js, scoped Storage key)
- [ ] `.github/workflows/snapshot.yml` — monthly cron (1st 00:00 UTC) + workflow_dispatch; dump | mask | gzip | upload (`latest` + dated archive)
- [ ] Secrets bootstrap (see design §8 table)
- [ ] Tier-2 probe (`probe-restore-prod`) against the real `latest` snapshot

### Unit 3 — PR gate (the blocking validator)

- [ ] `playwright.config.ts` — CI-aware `webServer.command` (`pnpm start` in CI)
- [ ] `.github/workflows/pr-gate.yml` — `dev → staging`: supabase start (with Docker image cache) → status→env → download+restore+fixup → `migration up` → `next build` → `pnpm test:e2e --project=chromium` → teardown
- [ ] Wire as a required status check on `staging`

### Unit 4 — Coverage CI

- [ ] `vitest.config.ts` — add v8 coverage block + `@vitest/coverage-v8` devDep
- [ ] `package.json` — `test:coverage` script
- [ ] `.github/workflows/coverage.yml` — every push; capture baseline, set baseline-derived thresholds, ratchet

### Unit 5 — Promote automation + staging branch

- [ ] One-time `staging` branch from `main`
- [ ] `.github/workflows/promote.yml` — assert gate-green + `merge-base --is-ancestor` → `git push staging:main` (FF-only) via deploy key
- [ ] Branch protection: `main` linear-history + restricted push; `staging` requires pr-gate check

### Unit 6 — Shadow lane

- [ ] `.github/workflows/shadow.yml` — nightly + dispatch; restore full snapshot → `@smoke` E2E across chromium/firefox/webkit + perf probe; non-blocking (`continue-on-error`, not a required check)

### Unit 7 — Docs + masking governance

- [ ] Update `docs/dev/staging-pipeline-design.md` (PG17, `supabase start`, fixup seam corrections)
- [ ] CI check that `mask.sh` exists and runs (no-op validation)
- [ ] Document the masking HARD TRIGGER in the contributing/docs trail

## Review Workload Forecast (preliminary — pending formal sizing)

- Estimated changed lines: HIGH (greenfield CI: ~5 workflows + ~6 scripts + config changes). Likely > 400 lines.
- Chained PRs: recommended split is Unit 1+2 (producer/probe) as slice 1, Unit 3–6 as slice 2+; but delivery is **exception-ok**, so a single `size:exception` PR is acceptable if preferred.
- Decision before apply: none blocking (exception-ok already chosen). Confirm slice boundary at apply time.
