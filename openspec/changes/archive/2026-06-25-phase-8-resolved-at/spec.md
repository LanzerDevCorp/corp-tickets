# Ticket Resolution Tracking Specification

## Purpose

Provide a durable, DB-enforced timestamp recording when a ticket enters the `resolved`
state. The database owns all lifecycle mutations; no application-layer writes are
required. The timestamp is surfaced on the ticket detail page only.

---

## Requirements

### Requirement: resolved_at Column

The `public.tickets` table MUST have a `resolved_at TIMESTAMPTZ NULL` column. The
value MUST be NULL when the ticket is not in `resolved` state. The column MUST default
to NULL on insert.

#### Scenario: Non-resolved ticket has no timestamp

- GIVEN a ticket with status other than `resolved`
- WHEN the row is read
- THEN `resolved_at` is NULL

#### Scenario: Resolved ticket carries a timestamp

- GIVEN a ticket that has transitioned to `resolved`
- WHEN the row is read
- THEN `resolved_at` is a non-NULL TIMESTAMPTZ value

---

### Requirement: DB Trigger — Set on Resolution

A BEFORE UPDATE trigger MUST set `resolved_at = now()` when the ticket status
transitions TO `resolved` — specifically when `NEW.status = 'resolved'` AND
`OLD.status IS DISTINCT FROM NEW.status`.

#### Scenario: Transition to resolved

- GIVEN a ticket with status other than `resolved`
- WHEN the status is updated to `resolved`
- THEN `resolved_at` is set to the current UTC timestamp

#### Scenario: Update within resolved — timestamp preserved

- GIVEN a ticket already in `resolved` state
- WHEN any field is updated but status remains `resolved`
- THEN `resolved_at` is unchanged

---

### Requirement: DB Trigger — Clear on Un-resolution

The same BEFORE UPDATE trigger MUST set `resolved_at = NULL` when the ticket status
transitions OUT OF `resolved` — specifically when `OLD.status = 'resolved'` AND
`NEW.status != 'resolved'`.

#### Scenario: Reopen a resolved ticket

- GIVEN a ticket in `resolved` state with a non-NULL `resolved_at`
- WHEN the status is updated to any non-resolved value
- THEN `resolved_at` is set to NULL

#### Scenario: Repeated close/reopen cycle

- GIVEN a ticket that has been resolved and then reopened (resolved_at cleared)
- WHEN the status is updated to `resolved` again
- THEN `resolved_at` is set to the new current UTC timestamp

---

### Requirement: Backfill for Existing Resolved Tickets

Existing rows where `status = 'resolved'` at migration time MUST be backfilled with
`resolved_at = updated_at`. This proxy is accepted as approximate; the trigger
provides exact timestamps for all future transitions.

#### Scenario: Historical resolved ticket shows a timestamp

- GIVEN a ticket that was in `resolved` state before the migration ran
- WHEN the migration completes
- THEN `resolved_at` is non-NULL (backfilled from `updated_at`)

#### Scenario: Historical non-resolved ticket is unaffected

- GIVEN a ticket that was NOT in `resolved` state before the migration ran
- WHEN the migration completes
- THEN `resolved_at` remains NULL

---

### Requirement: Index on resolved_at

An index named `idx_tickets_resolved_at` MUST be created on `public.tickets(resolved_at)`
after the column and backfill are applied.

#### Scenario: Index exists after migration

- GIVEN the migration has been applied to the database
- WHEN the schema is inspected
- THEN `idx_tickets_resolved_at` exists on `public.tickets`

---

### Requirement: Detail Page Display

The ticket detail page (`/dashboard/tickets/[id]`) MUST display `resolved_at` when the
value is non-NULL. When `resolved_at` is NULL, no resolution timestamp element SHALL
be rendered.

#### Scenario: Resolved ticket detail shows timestamp

- GIVEN a ticket where `resolved_at` is non-NULL
- WHEN the user navigates to `/dashboard/tickets/[id]`
- THEN the resolution timestamp is displayed in a localized human-readable format

#### Scenario: Non-resolved ticket detail shows nothing

- GIVEN a ticket where `resolved_at` is NULL
- WHEN the user navigates to `/dashboard/tickets/[id]`
- THEN no resolution timestamp element is present in the rendered output

---

### Requirement: Queue Table and Kebab Menu Exclusion

`resolved_at` MUST NOT appear as a column in the ticket queue table. The kebab/action
menu MUST NOT be modified by this change.

#### Scenario: Queue table unchanged

- GIVEN any ticket in any status
- WHEN the user views the ticket queue page
- THEN no `resolved_at` column is present in the queue table

#### Scenario: Kebab menu unchanged

- GIVEN any ticket in any status
- WHEN the user opens the ticket action (kebab) menu
- THEN no new actions related to resolution timestamp are present
