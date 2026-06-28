# Track Access Entry & Session Recovery Specification

## Purpose

Defines required behavior for client discovery of ticket tracking, unified session/link recovery, and the bootstrap fix that prevents a blank screen on `/track/access`.

---

## Requirements

### Requirement: Bootstrap Must Not Hide Access Page

`TrackSessionBootstrap` MUST render its `children` immediately when the current pathname is `/track/access`, regardless of server session state or URL hash presence.

For all other paths under `/track/*`, existing bootstrap behavior MUST be preserved: establish session from legacy hash tokens, redirect expired sessions on `/track/[ticketId]` to `/track/access` with appropriate query params.

#### Scenario: Expired session URL shows form

- GIVEN the user has no active Supabase session
- WHEN they navigate to `/track/access?error_code=session_expired`
- THEN the page MUST display `TrackAccessPanel` with email and ticket reference fields
- AND the main content area MUST NOT be blank

#### Scenario: Voluntary access from header

- GIVEN the user has no active session
- WHEN they navigate to `/track/access` without query params
- THEN the page MUST display `TrackAccessPanel`

#### Scenario: Authenticated user on access page

- GIVEN the user has an active client session
- WHEN they navigate to `/track/access`
- THEN the page MUST still display `TrackAccessPanel` (no automatic redirect)

#### Scenario: Legacy hash bootstrap unchanged

- GIVEN the user opens `/track/[ticketId]#access_token=...` without server session
- WHEN the hash contains a valid access token
- THEN bootstrap MUST establish the session and render the ticket view

---

### Requirement: Public Header Entry Point

The public home page header (`/`) MUST include a link labeled **Consultar ticket** pointing to `/track/access`.

The public home page header MUST NOT include an **Acceso staff** link or any link to `/auth/login`, `/dashboard`, or `/admin`.

#### Scenario: Header link visible on home

- GIVEN the user is on `/`
- WHEN the page renders
- THEN a link with accessible name matching "Consultar ticket" MUST be visible
- AND its `href` MUST be `/track/access`

#### Scenario: No staff entry from public header

- GIVEN the user is on `/`
- WHEN the page renders
- THEN no link with text "Acceso staff" MUST appear in the header

---

### Requirement: Access Page Visual Continuity

The `/track/access` route MUST use the `force-light` CSS scope and public-site background styling (`#F6F7FB` or equivalent) so it visually matches the public submission form.

The `/track/[ticketId]` route MUST retain the existing tracking layout styling (including dark-mode support).

#### Scenario: Light theme on access page

- GIVEN the user's OS prefers dark mode
- WHEN they view `/track/access`
- THEN form labels and text MUST remain readable (force-light active)

---

### Requirement: Shared Public Site Header on Access Page

The `/track/access` page MUST render `PublicSiteHeader` with:

- Left: **Mesa de ayuda**
- Right: link **Enviar ticket** → `/`

The public home page MUST render the same component with:

- Left: **Mesa de ayuda**
- Right: link **Consultar ticket** → `/track/access`

#### Scenario: Back navigation from access page

- GIVEN the user is on `/track/access`
- WHEN they click **Enviar ticket**
- THEN they MUST navigate to `/`

---

### Requirement: Conditional Access Page Copy

The `/track/access` page title and description MUST depend on `error_code` search param:

| `error_code`      | Title key                  | Description key                  |
| ----------------- | -------------------------- | -------------------------------- |
| (absent)          | `tracking.accessTitle`     | `tracking.accessDescription`     |
| `session_expired` | `auth.sessionExpiredTitle` | `auth.sessionExpiredDescription` |
| `otp_expired`     | `tracking.otpExpiredTitle` | `tracking.otpExpiredDescription` |

The form (`TrackAccessPanel`) MUST be identical across all variants.

Query params `ref` and `email` MUST pre-fill the corresponding form fields when present.

#### Scenario: Neutral copy on direct visit

- GIVEN the URL is `/track/access` with no `error_code`
- WHEN the page renders
- THEN the title MUST NOT mention session expiration

#### Scenario: Session expired copy

- GIVEN the URL includes `error_code=session_expired`
- WHEN the page renders
- THEN the title and description MUST reflect session expiration context

#### Scenario: Reference pre-fill

- GIVEN the URL includes `ref=6087BB67`
- WHEN the page renders
- THEN the ticket reference input MUST default to `6087BB67`

---

### Requirement: Unified Auth Error Redirect

When `/auth/error` receives `error_code=session_expired` or `error_code=otp_expired`, the server MUST redirect to `/track/access` preserving `ref` and `email` query parameters.

`/auth/error` MUST NOT render `TrackAccessPanel` inline for those error codes.

Other error codes MUST continue to render the generic auth error page.

#### Scenario: Auth error redirect

- GIVEN a request to `/auth/error?error_code=session_expired&ref=6087BB67&email=a%40b.com`
- WHEN the page handler runs
- THEN the response MUST redirect to `/track/access?error_code=session_expired&ref=6087BB67&email=a%40b.com`

#### Scenario: Generic auth error unchanged

- GIVEN a request to `/auth/error?error=Something+went+wrong`
- WHEN the page handler runs
- THEN the generic error card MUST render (no redirect)

---

### Requirement: Staff Route Protection Unchanged

Removing the public staff link MUST NOT weaken server-side access control.

Unauthenticated requests to `/dashboard` or `/admin` MUST still redirect to `/auth/login`.

Authenticated clients MUST still be blocked from staff routes (403).

#### Scenario: Middleware still protects staff routes

- GIVEN an unauthenticated user
- WHEN they request `/dashboard`
- THEN they MUST be redirected to `/auth/login`

---

## Test Coverage

### Unit / Integration (required)

- `TrackSessionBootstrap` renders children on `/track/access` without session
- `/auth/error` redirect for `session_expired` and `otp_expired`
- `/track/access` page copy variants by `error_code`

### E2E (required)

- Home header shows **Consultar ticket** link to `/track/access`
- `/track/access?error_code=session_expired` shows email and ticket reference inputs
