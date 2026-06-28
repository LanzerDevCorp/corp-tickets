# Proposal: Track Access Entry & Session Recovery

## Intent

When a client's magic link or tracking session expires, `/track/access?error_code=session_expired` renders a blank main area because `TrackSessionBootstrap` hides children without a session. Clients have no discoverable path from the public home page to look up a ticket by email + reference. This change fixes the recovery UX, adds a header entry point, and consolidates all expired-link flows into a single page.

## Scope

### In Scope

- Fix `TrackSessionBootstrap` so `/track/access` always renders `TrackAccessPanel` (skip bootstrap gate on that route)
- Add **Consultar ticket** link in the public home header → `/track/access`
- Remove **Acceso staff** from the public client-facing header (staff uses direct `/auth/login`, invite links, or bookmarks)
- Extract reusable `PublicSiteHeader` (home: Consultar ticket; access page: Enviar ticket → `/`)
- Apply `force-light` styling on `/track/access` only within the tracking layout (visual continuity from home)
- Conditional page copy on `/track/access` by `error_code` query param (neutral vs session/OTP expired)
- Redirect `/auth/error?error_code=session_expired|otp_expired` → `/track/access` with preserved `ref` / `email` params
- Unit/integration tests for bootstrap, auth/error redirect, conditional copy
- E2E: header link visible; form visible on expired access URL
- Update docs and E2E that reference public **Acceso staff** link

### Out of Scope

- Changes to staff login flow, invite emails, or middleware RBAC (already enforced server-side)
- New authentication mechanism (reuse `accessTicketWithReference` + `requestMagicLink`)
- Visual redesign of `/track/[ticketId]` conversation view
- Blocking `/auth/login` at the network level (URL remains reachable; just not linked from public UI)

## Capabilities

### New Capabilities

- `track-access-entry`: public discovery + unified recovery for client ticket tracking via email + ticket reference.

### Modified Capabilities

- Client tracking layout: conditional public styling and header on `/track/access`.
- Auth error handling: expired codes delegate to tracking recovery page.

## Approach

1. **Bootstrap bypass**: When `pathname === '/track/access'`, `TrackSessionBootstrap` renders `children` immediately without session/hash checks.
2. **Single recovery URL**: All expired flows land on `/track/access` with optional `error_code`, `ref`, `email` query params.
3. **Shared header**: `PublicSiteHeader` component used by public layout and tracking layout (access route only).
4. **Conditional copy**: Server component reads `searchParams.error_code` and selects i18n title/description variants.

## Affected Areas

| Area                                              | Impact   | Description                                                                                      |
| ------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `components/tracking/track-session-bootstrap.tsx` | Modified | Skip gate on `/track/access`; fix blank screen bug                                               |
| `components/public/public-site-header.tsx`        | New      | Shared header with configurable right link                                                       |
| `app/(public)/layout.tsx`                         | Modified | Use `PublicSiteHeader`; add Consultar ticket link                                                |
| `app/(tracking)/layout.tsx`                       | Modified | Conditional `force-light` + public header on `/track/access`                                     |
| `app/(tracking)/track/access/page.tsx`            | Modified | Conditional copy by `error_code`                                                                 |
| `app/auth/error/page.tsx`                         | Modified | Redirect expired codes to `/track/access`                                                        |
| `lib/i18n/es.ts`                                  | Modified | Add `public.trackTicket`, `public.submitTicket`, `tracking.accessTitle/Description`, OTP variant |
| `tests/e2e/public-form/submit.spec.ts`            | Modified | Replace staff-link test with Consultar ticket test                                               |
| `docs/phase-4-public-form.md`                     | Modified | Remove Acceso staff from public header spec                                                      |

## Risks

| Risk                                               | Likelihood | Mitigation                                                                         |
| -------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| Redirect loop between `/track` and `/track/access` | Low        | `/track/access` bypasses bootstrap; authenticated users still see form (by design) |
| Header drift between layouts                       | Low        | Single `PublicSiteHeader` component                                                |
| Staff cannot find login from public site           | Low        | Intentional; staff use invite URL or bookmark `/auth/login`                        |

## Rollback Plan

Revert bootstrap change, header component, and redirects. `/auth/error` can temporarily render `TrackAccessPanel` inline again if needed. No migrations or schema changes.

## Dependencies

- Existing `TrackAccessPanel`, `accessTicketWithReference`, `requestMagicLink` server actions.
- Existing `force-light` CSS in `globals.css`.

## Delivery

| Field    | Value                         |
| -------- | ----------------------------- |
| Strategy | Single PR                     |
| Budget   | size:exception (exception-ok) |

## Success Criteria

- [ ] `/track/access?error_code=session_expired` shows email + ticket reference form (not blank)
- [ ] Public home header shows **Consultar ticket** → `/track/access`; no **Acceso staff** link
- [ ] `/track/access` without `error_code` shows neutral copy; with `session_expired` / `otp_expired` shows contextual copy
- [ ] `/auth/error?error_code=session_expired` redirects to `/track/access` preserving query params
- [ ] Unit + E2E tests pass per spec
