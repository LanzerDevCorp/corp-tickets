# Design Statemap — Corp Tickets

> Source of truth for design coverage across all screens. Tracks which screens exist in the OpenPencil file, their node IDs, and fidelity status.
> Companion file: `docs/design/corp-tickets.fig` (OpenPencil source).

## Design system tokens

| Token       | Value               | Usage                      |
| ----------- | ------------------- | -------------------------- |
| Primary     | `#2563EB`           | CTAs, links, primary brand |
| Dark        | `#1C2438`           | Headings, dark surfaces    |
| Teal        | `#0D9488`           | Tracking/client accent     |
| Open        | `#10B981` (emerald) | Status badge               |
| In progress | `#6366F1` (indigo)  | Status badge               |
| Resolved    | `#71717A` (zinc)    | Status badge               |
| Closed      | `#F43F5E` (rose)    | Status badge               |
| Low         | `#3B82F6` (blue)    | Priority badge             |
| Medium      | `#EAB308` (yellow)  | Priority badge             |
| High        | `#F97316` (orange)  | Priority badge             |
| Urgent      | `#EF4444` (red)     | Priority badge             |

Fidelity: **medium** — layout and tokens are faithful to the app; no pixel-perfect shadows or micro-interactions.

---

## Happy path flow

```
[Client]
  │
  ▼
Public Ticket Form ──submit──► Submit Success
                                    │
                              (email link or ref#)
                                    │
                                    ▼
                             Track Access ──auth──► Ticket List ──select──► Ticket View (client)

[Staff]
  │
  ▼
Staff Dashboard (Queue) ──select──► Ticket Detail (staff)
```

---

## Screen inventory

### Context: Public (unauthenticated client)

| Screen             | Route               | OpenPencil Node ID     | Status          |
| ------------------ | ------------------- | ---------------------- | --------------- |
| Public Ticket Form | `/(public)`         | `0:501` (page: Public) | `done · hi-fi`  |
| Submit Success     | `/(public)` (state) | `0:109` (page: Public) | `done · mid-fi` |

### Context: Tracking (client self-service)

| Screen               | Route                           | OpenPencil Node ID       | Status |
| -------------------- | ------------------------------- | ------------------------ | ------ |
| Track Access         | `/(public-access)/track/access` | `0:129` (page: Tracking) | `done` |
| Ticket List (client) | `/(tracking)/track`             | `0:148` (page: Tracking) | `done` |
| Ticket View (client) | `/(tracking)/track/[ticketId]`  | `0:190` (page: Tracking) | `done` |

### Context: Staff Dashboard

| Screen                | Route                             | OpenPencil Node ID    | Status |
| --------------------- | --------------------------------- | --------------------- | ------ |
| Ticket Queue          | `/(staff)/dashboard`              | `0:224` (page: Staff) | `done` |
| Ticket Detail (staff) | `/(staff)/dashboard/tickets/[id]` | `0:319` (page: Staff) | `done` |

### Context: Admin

| Screen              | Route                       | OpenPencil Node ID | Status        |
| ------------------- | --------------------------- | ------------------ | ------------- |
| Admin Overview      | `/(staff)/admin`            | —                  | `not-started` |
| Category Management | `/(staff)/admin/categories` | —                  | `not-started` |
| User Management     | `/(staff)/admin/users`      | —                  | `not-started` |

### Context: Auth

| Screen          | Route                   | OpenPencil Node ID | Status        |
| --------------- | ----------------------- | ------------------ | ------------- |
| Login           | `/auth/login`           | —                  | `not-started` |
| Sign Up         | `/auth/sign-up`         | —                  | `not-started` |
| Forgot Password | `/auth/forgot-password` | —                  | `not-started` |
| Set Password    | `/auth/set-password`    | —                  | `not-started` |
| Accept Invite   | `/auth/accept-invite`   | —                  | `not-started` |
| Portal Login    | `/portal`               | —                  | `not-started` |

---

## Coverage summary

| Context         | Total  | Done  | In progress | Not started |
| --------------- | ------ | ----- | ----------- | ----------- |
| Public          | 2      | 2     | 0           | 0           |
| Tracking        | 3      | 3     | 0           | 0           |
| Staff Dashboard | 2      | 2     | 0           | 0           |
| Admin           | 3      | 0     | 0           | 3           |
| Auth            | 6      | 0     | 0           | 6           |
| **Total**       | **16** | **7** | **0**       | **9**       |

> Status vocabulary: `not-started` → `in-progress` → `done`

---

## Parallel execution plan

Once the happy path is validated in OpenPencil, the remaining screens can be designed in parallel across 3 tracks:

| Track               | Screens                                                                    | Dependencies                                 |
| ------------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| **A — Auth**        | Login, Sign Up, Forgot Password, Set Password, Accept Invite, Portal Login | None — all standalone forms                  |
| **B — Admin**       | Admin Overview, Category Management, User Management                       | Requires staff design tokens from happy path |
| **C — Edge states** | Empty states, error states, loading states for all existing screens        | Requires all base screens done               |

Recommended order: **Happy path → Track A + B in parallel → Track C**

---

## OpenPencil file structure (pages)

| Page          | Contents                                            |
| ------------- | --------------------------------------------------- |
| `_Cover`      | Title, date, token reference, flow diagram          |
| `Public`      | Public Ticket Form, Submit Success                  |
| `Tracking`    | Track Access, Ticket List, Ticket View              |
| `Staff`       | Ticket Queue, Ticket Detail                         |
| `Admin`       | Admin Overview, Categories, Users                   |
| `Auth`        | All auth screens                                    |
| `_Components` | Shared design tokens, badge variants, button states |
