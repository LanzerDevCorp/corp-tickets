"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAppRoleFromClaims } from "@/lib/auth/claims";
import {
  ATTACHMENT_BUCKET,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  ALLOWED_MIME,
  type AllowedMime,
} from "@/lib/storage/attachments";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttachmentInput {
  storage_path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export interface AttachmentItem {
  id: string;
  filename: string;
  size_bytes: number;
  url: string | null;
  expired: boolean;
}

type ActionResult = { error: string | null };

// ---------------------------------------------------------------------------
// registerAttachments
// ---------------------------------------------------------------------------

/**
 * Server action: validate and register uploaded attachment rows.
 * Re-validates count, total size, and MIME types server-side.
 */
export async function registerAttachments(
  ticketId: string,
  files: AttachmentInput[]
): Promise<ActionResult> {
  // Server-side re-validation
  if (files.length > MAX_FILES) {
    return { error: `Too many files — maximum is ${MAX_FILES}.` };
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size_bytes, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return { error: `Total file size exceeds the 50 MiB limit.` };
  }

  const allowedSet = new Set<string>(ALLOWED_MIME);
  for (const file of files) {
    if (!allowedSet.has(file.mime_type)) {
      return { error: `Disallowed MIME type: ${file.mime_type}. Allowed: ${ALLOWED_MIME.join(", ")}.` };
    }
  }

  const rows = files.map((f) => ({
    ticket_id: ticketId,
    storage_path: f.storage_path,
    filename: f.filename,
    mime_type: f.mime_type as AllowedMime,
    size_bytes: f.size_bytes,
  }));

  const { error } = await supabaseAdmin.from("ticket_attachments").insert(rows);
  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// ---------------------------------------------------------------------------
// rollbackTicket
// ---------------------------------------------------------------------------

/**
 * Server action: delete storage objects for a ticket then delete the ticket row.
 * Called on upload or registration failure to prevent orphan tickets.
 *
 * Strategy: list all objects under the tickets/{ticketId} prefix, remove each
 * one by explicit path, then delete the ticket row (ON DELETE CASCADE handles
 * ticket_attachments rows). Explicit paths are required — Supabase Storage
 * .remove() silently no-ops on folder path prefixes.
 */
export async function rollbackTicket(ticketId: string): Promise<ActionResult> {
  // List all objects under the ticket prefix, then remove each one explicitly.
  // Supabase Storage .remove() requires explicit object paths — a folder path prefix
  // is not a valid object path and silently deletes nothing.
  const { data: objects, error: listError } = await supabaseAdmin.storage
    .from(ATTACHMENT_BUCKET)
    .list(`tickets/${ticketId}`);

  if (listError) {
    return { error: listError.message };
  }

  if (objects && objects.length > 0) {
    const paths = objects.map((obj) => `tickets/${ticketId}/${obj.name}`);
    const { error: removeError } = await supabaseAdmin.storage
      .from(ATTACHMENT_BUCKET)
      .remove(paths);

    if (removeError) {
      return { error: removeError.message };
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from("tickets")
    .delete()
    .eq("id", ticketId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  return { error: null };
}

// ---------------------------------------------------------------------------
// getTicketAttachments
// ---------------------------------------------------------------------------

/**
 * Server action: retrieve signed URL list for a ticket's attachments.
 * Staff (admin/it) can access any ticket.
 * Clients can only access their own ticket (email match).
 */
export async function getTicketAttachments(
  ticketId: string
): Promise<AttachmentItem[]> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    throw new Error("No autorizado");
  }

  const role = getAppRoleFromClaims(claims);

  // Client identity check: email must match the ticket's email
  if (role === "client") {
    const claimEmail = typeof claims.email === "string" ? claims.email : null;
    if (!claimEmail) {
      throw new Error("No autorizado");
    }

    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select("email")
      .eq("id", ticketId)
      .single();

    if (!ticket || ticket.email !== claimEmail) {
      throw new Error("No autorizado");
    }
  }

  // Fetch all attachment rows (active + soft-deleted) for display
  const { data: rows, error } = await supabaseAdmin
    .from("ticket_attachments")
    .select("id, filename, size_bytes, storage_path, deleted_at")
    .eq("ticket_id", ticketId);

  if (error) {
    throw new Error(error.message);
  }

  const items: AttachmentItem[] = await Promise.all(
    (rows ?? []).map(async (row) => {
      const expired = row.deleted_at !== null;

      if (expired) {
        return { id: row.id, filename: row.filename, size_bytes: row.size_bytes, url: null, expired: true };
      }

      const { data: signed } = await supabaseAdmin.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(row.storage_path, 3600);

      return {
        id: row.id,
        filename: row.filename,
        size_bytes: row.size_bytes,
        url: signed?.signedUrl ?? null,
        expired: false,
      };
    })
  );

  return items;
}
