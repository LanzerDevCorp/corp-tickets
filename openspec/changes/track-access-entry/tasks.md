# Tasks: Track Access Entry & Session Recovery

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250–400 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (size:exception) |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No

---

## Phase 1: Bootstrap Fix (Bug)

- [ ] 1.1 **TEST (RED)** — Create `components/tracking/__tests__/track-session-bootstrap.test.tsx`: mock `usePathname` → `/track/access`, `hasServerSession=false`; assert `TrackAccessPanel` child content (or test id) is visible; assert NOT null/blank
- [ ] 1.2 Modify `components/tracking/track-session-bootstrap.tsx`: if pathname is `/track/access`, skip hash/session checks and render `children` immediately
- [ ] 1.3 **TEST (GREEN)** — Confirm bootstrap tests pass; add case that `/track/[id]` without session still redirects (mock router.replace)

---

## Phase 2: i18n & Shared Header

- [ ] 2.1 Add to `lib/i18n/es.ts`: `public.trackTicket`, `public.submitTicket`, `tracking.accessTitle`, `tracking.accessDescription`, `tracking.otpExpiredTitle`, `tracking.otpExpiredDescription`
- [ ] 2.2 Create `components/public/public-site-header.tsx` with `rightLink: { href: string; label: string }`
- [ ] 2.3 Modify `app/(public)/layout.tsx`: use `PublicSiteHeader` with Consultar ticket → `/track/access`

---

## Phase 3: Access Page UX

- [ ] 3.1 **TEST (RED)** — Create `app/(tracking)/track/access/__tests__/page.test.tsx`: render page with/without `error_code`; assert correct title strings
- [ ] 3.2 Modify `app/(tracking)/track/access/page.tsx`: conditional title/description; accept `error_code` in searchParams
- [ ] 3.3 Modify `app/(tracking)/layout.tsx`: when rendering access route, apply `force-light`, public background, and `PublicSiteHeader` with Enviar ticket → `/`; keep existing tracking header for `/track/[ticketId]`

---

## Phase 4: Auth Error Consolidation

- [ ] 4.1 **TEST (RED)** — Update `app/auth/__tests__/error-page.test.tsx`: expired codes expect redirect to `/track/access` with params (not inline panel)
- [ ] 4.2 Modify `app/auth/error/page.tsx`: `redirect()` for `session_expired` and `otp_expired` preserving `ref`, `email`, `error_code`
- [ ] 4.3 **TEST (GREEN)** — Confirm auth error tests pass

---

## Phase 5: E2E & Docs

- [ ] 5.1 Modify `tests/e2e/public-form/submit.spec.ts`: replace staff link test with Consultar ticket → `/track/access`
- [ ] 5.2 Create `tests/e2e/tracking/access-recovery.spec.ts`: goto `/track/access?error_code=session_expired`; assert email + ticket ref fields visible
- [ ] 5.3 Update `docs/phase-4-public-form.md`: remove Acceso staff from public header; document Consultar ticket link
- [ ] 5.4 Remove or deprecate unused `sidebar.staffAccess` from public-facing docs only (key may remain for other contexts)

---

## Phase 6: Verify

- [ ] 6.1 Run `pnpm test` (unit/integration)
- [ ] 6.2 Run affected E2E specs
- [ ] 6.3 Manual smoke: home → Consultar ticket → form; expired URL → form; auth/error redirect
