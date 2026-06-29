# Agent Prompt — Flow 2: Client Auth · Tool: Claude Code

You are implementing **Flow 2 (Client Auth)** of the _Portal de Clientes_ feature in the `corp-tickets` repo. You run cold — everything you need is here plus the two reference docs.

**Read first:**

- `docs/dev/portal-de-clientes-prd.md` — full decisions, user stories, testing seams.
- `docs/dev/orchestration/portal-statemap.md` — coordination, ownership, rules. Update your row there as status changes.

## Mission

Give clients an OPTIONAL password, established securely after they prove inbox possession via the existing ticket magic link, plus a canonical client login at `/portal`.

## Branch

Create a dedicated git worktree on `feat/portal-client-auth` off `dev`. Never commit on `dev`.

## Scope — build exactly this

1. **Post-ticket screen = informational only.** After ticket submit it tells the client "we emailed you an access link; you can create a password when you enter." It does NOT establish a session (this is what closes the account-takeover hole).
2. **First-access interstitial.** On the first authenticated access where the client has NOT yet decided, route to `/auth/set-password` with "Create password" and "Skip". Password setting uses `supabase.auth.updateUser({ password })` against the live session.
3. **"Decided" signal.** Suppress the interstitial once the client has set a password OR skipped — based on "decided", not merely "has password". Implement via a column on `public.users` (e.g. `password_decided_at` / `password_set_at`) written by a new server action.
4. **Account-menu entry.** Export a persistent "create / change password" component for the authenticated area. Flow 3 imports it; you provide it.
5. **`/portal` login.** Password primary + "Access without password" fallback that routes to `/track/access` (existing passwordless panel). No dedicated password-reset flow — passwordless IS recovery. Staff (admin/it) hitting `/portal` redirect to `/dashboard`.
6. **Header link** to `/portal` from the public landing `/`.

## You own (edit freely)

`app/portal/**`, `app/auth/set-password/**`, the post-ticket confirmation UI component, a new password-decision action module (e.g. `app/actions/client-password.ts`), migration `20260627100000_*`, the exported account-menu password component.

## Do NOT touch (shared / other agents)

- `app/actions/tickets.ts` — you may READ it, do not restructure the submit action.
- `app/(tracking)/track/**` — owned by Flow 3.
- `app/actions/attachments.ts`, dashboard attachment UI — owned by Flow 4.
- `lib/i18n/es.ts` (frozen), `lib/auth/*` (reuse, don't modify).
  Reuse `establishClientSession()` and the existing magic-link machinery — do not fork it.

## Migration

Create EXACTLY: `supabase/migrations/20260627100000_client_password_decision.sql`. No other timestamp.

## Hard rule — UI language

All new UI copy hardcoded in **Mexican Spanish**, directly in components. Do NOT add keys to `lib/i18n/es.ts` or use `t()`/`es.*`.

## Testing — Strict TDD (`npm test`)

Highest seam = **server actions**. Write behavior tests FIRST:

- The password-decision action (records set/skip; idempotent).
- Interstitial gating logic (given role/email/decision state → show or not).
  Prior art: `app/actions/__tests__/client-provision.test.ts`, `components/__tests__/forgot-password-form.test.tsx`.

## Definition of done

- [ ] Tests written first, `npm test` green.
- [ ] Interstitial shows once, never nags after a decision.
- [ ] Post-ticket screen creates NO session.
- [ ] `/portal` both methods work; staff redirected.
- [ ] Account-menu password component exported for Flow 3.
- [ ] PR opened (split if > ~400 lines).
- [ ] State map row updated to `pr-open`/`merged`.
