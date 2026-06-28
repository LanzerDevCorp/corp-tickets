# Design: Track Access Entry & Session Recovery

## Technical Approach

The blank-screen bug is caused by `TrackSessionBootstrap` returning `null` when `status === 'expired'`, which also applies to `/track/access` where no session is expected. Fix: early-return `children` when pathname is `/track/access` (or when pathname matches `/track/access` prefix). Redirect logic for expired sessions on `/track/[ticketId]` remains unchanged.

Recovery UI consolidates on `/track/access`. `/auth/error` with `error_code=session_expired|otp_expired` becomes a server redirect preserving `ref` and `email` search params.

## Architecture Decisions

| Decision                               | Choice                                          | Alternatives rejected                                  | Rationale                                             |
| -------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| Entry point                            | Link to `/track/access`                         | Modal on home; new route under `(public)`              | Reuses existing panel + actions; minimal scope        |
| Public staff link                      | Removed from client UI                          | Keep Acceso staff in header                            | User decision: clients must not see staff/admin entry |
| Recovery URL                           | Single `/track/access`                          | Duplicate panel on `/auth/error`                       | One place for copy, header, bootstrap rules           |
| Access page styling                    | `force-light` on `/track/access` only           | Full public route group move; keep tracking dark theme | Continuity from home without restructuring routes     |
| Access page header                     | `PublicSiteHeader` with **Enviar ticket** → `/` | Tracking header (Soporte)                              | User decision: mirror home branding                   |
| Header implementation                  | Shared `PublicSiteHeader` component             | Inline duplicate markup                                | Prevents drift between layouts                        |
| Authenticated visit to `/track/access` | Show form (no redirect)                         | Redirect to last ticket                                | Client may look up different ticket                   |
| Copy                                   | Conditional by `error_code`                     | Single neutral copy always                             | Contextual messaging for expired vs voluntary visit   |
| Tests                                  | Unit + targeted E2E (A)                         | E2E happy path through Supabase auth                   | Balances regression coverage vs flake                 |
| Delivery                               | Single PR, exception-ok                         | Split bugfix vs UX PR                                  | Cohesive functional area                              |

## Data Flow

    Public home (/)
         │
         │ click "Consultar ticket"
         ▼
    /track/access  ──► TrackAccessPanel
         │                  │
         │                  ├─ email + #ref ──► accessTicketWithReference ──► /track/[id]
         │                  └─ resend magic link ──► requestMagicLink
         │
    Magic link expires / no session on /track/[id]
         │
         ▼
    TrackSessionBootstrap ──redirect──► /track/access?error_code=session_expired&ref=...

    /auth/confirm (otp expired) ──redirect──► /track/access?error_code=otp_expired
    /auth/error?error_code=session_expired ──redirect──► /track/access?...

## File Changes

| File                                                             | Action | Description                                                                |
| ---------------------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| `components/public/public-site-header.tsx`                       | Create | `rightLink: { href, label }`; left title "Mesa de ayuda"                   |
| `app/(public)/layout.tsx`                                        | Modify | Render `PublicSiteHeader` with Consultar ticket link                       |
| `app/(tracking)/layout.tsx`                                      | Modify | Detect access route; apply `force-light`, public header, public background |
| `app/(tracking)/track/access/page.tsx`                           | Modify | Resolve title/description from `error_code`; pass defaults to panel        |
| `components/tracking/track-session-bootstrap.tsx`                | Modify | Bypass bootstrap on `/track/access`                                        |
| `app/auth/error/page.tsx`                                        | Modify | `redirect()` for expired error codes                                       |
| `lib/i18n/es.ts`                                                 | Modify | New public + tracking access strings                                       |
| `app/auth/__tests__/error-page.test.tsx`                         | Modify | Assert redirect instead of inline panel                                    |
| `components/tracking/__tests__/track-session-bootstrap.test.tsx` | Create | Assert children render on `/track/access` without session                  |
| `app/(tracking)/track/access/__tests__/page.test.tsx`            | Create | Assert conditional copy variants                                           |
| `tests/e2e/public-form/submit.spec.ts`                           | Modify | Consultar ticket link test; remove staff link test                         |
| `tests/e2e/tracking/access-recovery.spec.ts`                     | Create | Expired URL shows form fields                                              |
| `docs/phase-4-public-form.md`                                    | Modify | Update header documentation                                                |

## i18n Keys (proposed)

```ts
public: {
  trackTicket: "Consultar ticket",
  submitTicket: "Enviar ticket",
},
tracking: {
  accessTitle: "Consultar tu ticket",
  accessDescription: "Ingresa el correo y el número de ticket que recibiste al enviar la solicitud.",
  otpExpiredTitle: "Enlace expirado",  // or reuse sessionExpired variants
  otpExpiredDescription: "...",
}
```

Reuse existing `auth.sessionExpiredTitle/Description` for `session_expired` variant.

## Layout Sketch (access page)

```
┌─────────────────────────────────────────────┐
│ Mesa de ayuda              Enviar ticket → / │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ [Conditional title]                 │    │
│  │ [Conditional description]           │    │
│  │ Email: [___________]                │    │
│  │ Número de ticket: [________]        │    │
│  │ [ Entrar al ticket ]                │    │
│  │ ─────────────────────────────────   │    │
│  │ ¿Prefieres un enlace por correo?    │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```
