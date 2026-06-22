# Ticket Attachments Specification

## Purpose

Defines required behavior for attaching files to a support ticket at submission time: client-side selection, validation, upload orchestration, access-controlled retrieval, and 2-month expiry lifecycle.

---

## Requirements

### Requirement: File Selection and Client-Side Validation

The system MUST allow a client to select up to 5 files per ticket submission via drag-and-drop or file picker, below the body textarea.

Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `application/zip`.  
The system MUST reject any file whose type is not in the allowed set.  
The system MUST reject a selection that exceeds 5 files total.  
The system MUST reject a selection whose cumulative size exceeds 50 MB.  
The system MUST display, per file: filename, individual size, and a remove button.  
The system MUST display a total-size progress bar reflecting the current selection.

#### Scenario: Valid selection

- GIVEN the user has not yet submitted the form
- WHEN they add 3 files totalling 20 MB, all of allowed types
- THEN all 3 files appear in the preview list with name, size, and remove button
- AND the progress bar shows ~20 MB used of 50 MB

#### Scenario: File type rejected

- GIVEN the upload zone is visible
- WHEN the user drops a `.exe` file
- THEN the file is rejected with an inline error naming the disallowed type
- AND the file does not appear in the preview list

#### Scenario: Count limit enforced

- GIVEN 5 files are already selected
- WHEN the user attempts to add a 6th file
- THEN the 6th file is rejected with an inline error stating the 5-file limit
- AND the existing 5 files remain unaffected

#### Scenario: Total size limit enforced

- GIVEN files totalling 48 MB are selected
- WHEN the user adds a file of 5 MB
- THEN the addition is rejected with an inline error stating the 50 MB limit
- AND the selection remains at 48 MB

#### Scenario: Individual file removed

- GIVEN 3 files are in the preview list
- WHEN the user clicks the remove button on file 2
- THEN file 2 is removed from the list
- AND the progress bar updates to reflect the remaining 2 files

---

### Requirement: Server-Side Re-Validation

The system MUST re-validate file count, total size, and each file's MIME type server-side when registering attachments.  
The system MUST reject the registration request if any constraint is violated, regardless of client-side state.

#### Scenario: Server rejects oversized batch

- GIVEN a request to register 6 file records arrives at the server action
- WHEN the action validates the payload
- THEN it returns an error and persists no attachment rows

#### Scenario: Server rejects disallowed type

- GIVEN a registration request includes a file with MIME type `application/octet-stream`
- WHEN the action validates the payload
- THEN it returns an error and persists no attachment rows

---

### Requirement: Three-Phase Submit Flow

The system MUST execute submission in three ordered phases:

1. **Create ticket**: call `submitTicket` server action; receive `ticketId`.
2. **Upload files**: browser uploads each file directly to the private bucket at path `tickets/{ticketId}/{filename}`.
3. **Register attachments**: call `registerAttachments` server action with `ticketId` and the list of uploaded storage paths.

The system MUST show a loading / in-progress state across all three phases.  
The system MUST NOT make the submit button active again until all three phases complete or fail.  
If the user selected zero files, the system MUST skip phases 2 and 3 and complete after phase 1.

#### Scenario: Successful submission with files

- GIVEN the form is valid and 2 files are selected
- WHEN the user submits
- THEN the ticket is created, both files are uploaded to `tickets/{ticketId}/`, attachment rows are registered, and the success state is shown

#### Scenario: Submission with no files

- GIVEN the form is valid and no files are selected
- WHEN the user submits
- THEN the ticket is created via `submitTicket` and the success state is shown without invoking upload or registration

---

### Requirement: Upload Failure Rollback

If file upload fails (any file) after the ticket has been created, the system MUST call the `rollbackTicket` server action to delete the ticket.  
The system MUST present a "Retry without files" option that resubmits the form without attachments.  
The system MUST NOT leave an orphan ticket if rollback succeeds.

#### Scenario: Upload fails, rollback succeeds

- GIVEN the ticket was created (phase 1 succeeded)
- WHEN the storage upload fails for any file (phase 2)
- THEN `rollbackTicket` is called and the ticket is deleted
- AND the UI shows an error with a "Retry without files" button

#### Scenario: Upload fails, rollback also fails

- GIVEN the ticket was created and upload failed
- WHEN `rollbackTicket` also fails
- THEN the UI shows an error indicating submission failed and support should be contacted
- AND the orphan ticket is eligible for the cron sweep

---

### Requirement: Registration Failure and Orphan Sweep

If `registerAttachments` fails after files were already uploaded to storage, the system MUST call `rollbackTicket` to delete the ticket.  
Orphaned storage objects (files with no corresponding `ticket_attachments` row and no ticket) MUST be swept by the scheduled cron job.

#### Scenario: Registration fails after upload

- GIVEN ticket created and files uploaded (phases 1 and 2 succeeded)
- WHEN `registerAttachments` fails (phase 3)
- THEN `rollbackTicket` is called
- AND the UI shows an error with a "Retry without files" button

#### Scenario: Cron sweeps orphaned storage objects

- GIVEN storage objects exist at `tickets/{ticketId}/` with no matching `ticket_attachments` rows and no valid ticket
- WHEN the cron job runs
- THEN those objects are deleted from storage

---

### Requirement: Private Storage and Signed URL Access

The storage bucket MUST be private; no object may be read via public URL.  
Signed URLs MUST be generated server-side only (never in browser-accessible code).  
Signed URLs MUST have a short expiry (SHOULD be ≤ 60 minutes).  
Staff users MUST be able to retrieve signed URLs for attachments on any ticket.  
A client MUST be able to retrieve signed URLs only for attachments belonging to their own submitted ticket (matched via tracking token or authenticated session).

#### Scenario: Staff retrieves attachment URL

- GIVEN a staff user views a ticket with 2 attachments
- WHEN they request download links
- THEN the server generates 2 signed URLs and returns them
- AND each URL expires after the configured short period

#### Scenario: Client retrieves own attachment URL

- GIVEN a client accesses their tracking page with a valid token
- WHEN they request download links for their ticket's attachments
- THEN the server generates signed URLs only for that ticket's attachments

#### Scenario: Client cannot access another ticket's attachment

- GIVEN a client has a valid tracking token for ticket A
- WHEN they attempt to retrieve signed URLs for ticket B's attachments
- THEN the server returns an authorization error and no URLs are generated

---

### Requirement: Row-Level Security for ticket_attachments

The `ticket_attachments` table MUST enforce RLS.  
Staff roles MUST be able to SELECT all rows.  
Client access MUST be restricted to rows where the ticket belongs to the client (enforced at the server action layer via the service role; RLS prevents direct client SDK access).

#### Scenario: Direct client SDK query blocked

- GIVEN a browser uses the anon/client Supabase key
- WHEN it queries `ticket_attachments` directly
- THEN zero rows are returned (RLS denies access)

---

### Requirement: Two-Month Expiry Lifecycle

The system MUST run a scheduled job that, for each `ticket_attachments` row where `created_at` is older than 2 months and `deleted_at` IS NULL:

1. Deletes the corresponding object from storage.
2. Sets `deleted_at` to the current timestamp on the row.

The row itself MUST NOT be deleted (history is preserved).  
The UI MUST display "File expired" in place of a download link when `deleted_at` IS NOT NULL.

#### Scenario: Cron marks expired attachment

- GIVEN an attachment row with `created_at` 61 days ago and `deleted_at` NULL
- WHEN the cron job runs
- THEN the storage object is deleted
- AND the row's `deleted_at` is set to the current timestamp

#### Scenario: Already-expired row is skipped

- GIVEN an attachment row where `deleted_at` IS NOT NULL
- WHEN the cron job runs
- THEN the row is not processed again

#### Scenario: Expired attachment shown in UI

- GIVEN an attachment row has a non-null `deleted_at`
- WHEN the client or staff views the attachment list
- THEN the attachment shows "File expired" instead of a download link

---

### Requirement: Tracking Page Attachment Display

The client tracking page MUST list all non-deleted attachments for the ticket, showing filename and file size.  
The page MUST show a "File expired" label for attachments where `deleted_at` IS NOT NULL.  
Download links MUST be signed URLs, generated server-side on demand.

#### Scenario: Client views active attachments

- GIVEN a ticket has 2 active attachments
- WHEN the client opens the tracking page
- THEN both filenames and sizes are listed with a download link each

#### Scenario: Client views mixed attachment states

- GIVEN a ticket has 1 active and 1 expired attachment
- WHEN the client opens the tracking page
- THEN the active attachment shows a download link
- AND the expired attachment shows "File expired" with no link
