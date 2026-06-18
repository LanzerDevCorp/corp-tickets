# Product Requirements Document — Corp Tickets

**Version**: 1.0  
**Date**: 2026-06-17  
**Status**: Approved

---

## 1. Overview

A basic internal/external helpdesk system. Clients submit support tickets via a public form. IT staff manage and resolve them. Admins configure the system and manage users.

Inspired by Freshdesk but deliberately minimal — no multitenancy, no SLAs, no asset management, no knowledge base.

---

## 2. Goals

- Allow any client (internal or external) to submit a ticket without an account
- Give IT staff a shared queue to manage and resolve tickets
- Notify all parties via email at key moments
- Let clients track their own ticket via a magic link

---

## 3. Non-Goals (MVP)

- File attachments (Phase 2)
- Multiple organizations / multitenancy
- SLA tracking
- Knowledge base / self-service
- Mobile app

---

## 4. Users & Roles

| Role   | Access                                                             |
|--------|--------------------------------------------------------------------|
| Admin  | Full access: manage users, configure categories, view all tickets  |
| IT     | Work tickets: assign, comment, change status. No system config.    |
| Client | Submit ticket via public form. Track own ticket via magic link.    |

**Notes:**
- All clients are treated as external — no differentiation between internal employees and external customers.
- Admin creates IT users via Supabase invite (no self-registration).
- Admin/IT authenticate with email + password (Supabase password-based auth).
- Clients authenticate via magic link sent at ticket creation (no account required).

---

## 5. Ticket Lifecycle

### States

| State       | Trigger                                                                 |
|-------------|-------------------------------------------------------------------------|
| Open        | Automatic — on ticket creation                                          |
| In Progress | Automatic — when an admin/IT opens the ticket for the first time        |
| Resolved    | Manual — IT marks it. Means the ticket was completed successfully.      |
| Closed      | Manual — IT marks it + must provide a closure reason. Means not done.  |

**Rules:**
- Opening a ticket (viewing it for the first time) auto-assigns it to the opener and moves it to In Progress. Staff should not open tickets they do not intend to work.
- Assigned IT can be changed manually after auto-assignment.
- States can also be changed manually at any time.

### Ticket Fields

| Field    | Set by  | Notes                                      |
|----------|---------|--------------------------------------------|
| Name     | Client  | Required                                   |
| Email    | Client  | Required                                   |
| Subject  | Client  | Required                                   |
| Priority | Client  | Low / Medium / High / Urgent (IT can edit) |
| Category | Client  | Configurable by admin (required)           |
| Body     | Client  | Required                                   |
| Status   | System  | See lifecycle above                        |
| Assigned | System  | Auto on first open, manually editable      |

---

## 6. Comments

- IT and Admin can post comments on any ticket.
- Comment types:
  - **Public**: visible to the client in their tracking view.
  - **Internal**: visible only to Admin/IT. Toggle per comment.
- Clients can post comments from their tracking view (always public).
- Clients can add CC email addresses when commenting. CC recipients receive the email notification only — no ticket access.

### Implementation notes (phasing)

- `comments` table includes `cc_emails TEXT[]` from Phase 5 onwards (defaults to `{}`).
- **Phase 5** (`comments`): staff dashboard comment form does **not** expose the CC field — CC is always `{}` for staff comments in MVP.
- **Phase 8** (`client-tracking`): client comment form exposes the CC field. The `addComment` server action already accepts `cc_emails` — Phase 8 only adds the UI input.
- Comments are append-only (no UPDATE or DELETE for any role) — they serve as audit trail.
- `author_id` is always `NOT NULL` — both staff and clients have a Supabase Auth user record.

---

## 7. Ticket Queue (Admin/IT View)

- Single shared queue — all Admin and IT users see the same tickets.
- Filters: **status**, **priority**, **assigned to**, **creation date**.
- No private queues.

---

## 8. Notifications (Email via Resend)

### To the Client

| Event                    | Content                                      |
|--------------------------|----------------------------------------------|
| Ticket created           | Confirmation + magic link to track ticket    |
| Public comment added     | IT has responded — view ticket               |
| Ticket closed            | Notification with closure reason provided    |

### To the IT Team

| Event                      | Recipients                                      |
|----------------------------|-------------------------------------------------|
| New ticket submitted       | All IT users and Admins                         |
| Client comments on ticket  | Assigned IT only (if unassigned → full team)    |

---

## 9. Client Ticket Tracking

- Clients receive a magic link at ticket creation.
- The link gives access to a read/write view of their specific ticket:
  - View current status, assigned IT, comments (public only).
  - Post new comments (with optional CC).
- No login, no account — access is token-based.

---

## 10. Public Submission Form

**Fields:** Name, Email, Subject, Priority, Category, Body  
**Protection:** Cloudflare Turnstile (invisible CAPTCHA)  
**Authentication required:** None

---

## 11. Admin Panel

- Create and invite IT users (via Supabase invite).
- Manage ticket categories (add, edit, disable).
- View all tickets.

---

## 12. Tech Stack

| Layer            | Technology                                                        |
|------------------|-------------------------------------------------------------------|
| Framework        | Next.js App Router                                                |
| Styling          | Tailwind CSS                                                      |
| Components       | shadcn/ui + Supabase UI blocks                                    |
| Auth             | Supabase Auth (password-based for staff, magic link for clients)  |
| Database         | Supabase (PostgreSQL) + Supabase CLI (migrations in repo)         |
| Email            | Resend + React Email (templates)                                  |
| CAPTCHA          | Cloudflare Turnstile                                              |
| Data fetching    | Server Components (initial load) + TanStack Query (mutations/refetch) |
| Server mutations | Next.js Server Actions                                            |
| Form validation  | react-hook-form + zod (shared schema client + server)             |
| Testing          | Vitest (unit/integration) + Playwright (e2e critical flows)       |

**Scaffold command:** `npx create-next-app -e with-supabase`  
**First step after scaffold:** Audit and update all dependencies to latest versions before writing any feature code.

---

## 13. Infrastructure & Environments

### Environments

| Environment | Supabase Project | Deploy              |
|-------------|-----------------|---------------------|
| Local       | `supabase start` (Docker) | `next dev`     |
| Staging     | Supabase project (staging) | Vercel preview deployments |
| Production  | Supabase project (prod) | Vercel production   |

- Environment variables managed via `vercel env pull` locally.
- Supabase schema managed via CLI migrations (`supabase/migrations/`), versioned in git.

### MCP Servers (AI-assisted development)

| MCP           | Purpose                                                        |
|---------------|----------------------------------------------------------------|
| Supabase MCP  | Read schema, run queries, generate migrations during dev       |
| Vercel MCP    | Inspect deployments, manage env vars, read logs               |

### Project Tracking

- All development state tracked in Engram (persistent memory) + SDD artifacts.
- No external project management tool.

---

## 14. Development Phases (SDD)

Ordered by dependency. Each phase is a standalone SDD change:

| # | Phase              | Description                                              |
|---|--------------------|----------------------------------------------------------|
| 1 | `scaffold`         | Template setup, dep audit, Supabase CLI init, shadcn/ui  |
| 2 | `auth`             | Password auth for admin/IT, magic link flow for clients  |
| 3 | `tickets-core`     | Data model, ticket lifecycle, shared queue with filters  |
| 4 | `public-form`      | Public ticket submission form + Cloudflare Turnstile     |
| 5 | `comments`         | Public/internal comments toggle + CC on client replies   |
| 6 | `notifications`    | Resend + React Email templates for all notification events |
| 7 | `admin-panel`      | User management, category config, Supabase invite flow   |
| 8 | `client-tracking`  | Client ticket view via magic link token                  |

### Development Loop

- Phases run iteratively via `/loop` + SDD.
- **Checkpoint between phases**: after each phase completes, review summary before continuing to the next.
- SDD mode: **interactive** with engram as artifact store.

---

## 15. Phase 2 (Out of Scope for MVP)

- File attachments on tickets and comments (Supabase Storage)
