"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAppRoleFromClaims } from "@/lib/auth/claims";
import {
  ATTACHMENT_BUCKET,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  ALLOWED_MIME,
  buildStoragePath,
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

export interface AttachmentFileMeta {
  filename: string;
  mime_type: string;
  size_bytes: number;
}

export interface StaffUploadUrl {
  path: string;
  token: string;
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
  removedByAdmin?: boolean;
}

type ActionResult = { error: string | null };
type StaffUploadResult = { error: string | null; urls?: StaffUploadUrl[] };

type AttachmentRow = {
  id: string;
  filename: string;
  size_bytes: number;
  storage_path: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateAttachmentFiles(
  files: Pick<AttachmentInput, "mime_type" | "size_bytes">[],
): ActionResult {
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
      return {
        error: `Disallowed MIME type: ${file.mime_type}. Allowed: ${ALLOWED_MIME.join(", ")}.`,
      };
    }
  }

  return { error: null };
}

async function requireStaff(): Promise<{ actorId: string }> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    throw new Error("No autorizado");
  }

  const role = getAppRoleFromClaims(claims);
  if (role !== "admin" && role !== "it") {
    throw new Error("No autorizado");
  }

  const actorId = typeof claims.sub === "string" ? claims.sub : null;
  if (!actorId) {
    throw new Error("No autorizado");
  }

  return { actorId };
}

function generateFileId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function mapRowToAttachmentItem(
  row: AttachmentRow,
  isStaff: boolean,
): Promise<AttachmentItem | null> {
  const isAdminRemoved = row.deleted_at !== null && row.deleted_by !== null;
  const isRetentionExpired = row.deleted_at !== null && row.deleted_by === null;

  if (!isStaff && isAdminRemoved) {
    return null;
  }

  if (isAdminRemoved) {
    return {
      id: row.id,
      filename: row.filename,
      size_bytes: row.size_bytes,
      url: null,
      expired: false,
      removedByAdmin: true,
    };
  }

  if (isRetentionExpired) {
    return {
      id: row.id,
      filename: row.filename,
      size_bytes: row.size_bytes,
      url: null,
      expired: true,
    };
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
}

// ---------------------------------------------------------------------------
// registerAttachments
// ---------------------------------------------------------------------------

/**
 * Server action: validate and register uploaded attachment rows.
 * Re-validates count, total size, and MIME types server-side.
 */
export async function registerAttachments(
  ticketId: string,
  files: AttachmentInput[],
): Promise<ActionResult> {
  const validation = validateAttachmentFiles(files);
  if (validation.error) {
    return validation;
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
 */
export async function rollbackTicket(ticketId: string): Promise<ActionResult> {
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
// Staff attachment actions
// ---------------------------------------------------------------------------

/**
 * Server action: create signed upload URLs for staff to upload attachments.
 * Admin and IT only.
 */
export async function createStaffUploadUrls(
  ticketId: string,
  fileMetas: AttachmentFileMeta[],
): Promise<StaffUploadResult> {
  await requireStaff();

  const validation = validateAttachmentFiles(fileMetas);
  if (validation.error) {
    return validation;
  }

  const urls: StaffUploadUrl[] = [];

  for (const meta of fileMetas) {
    const fileId = generateFileId();
    const path = buildStoragePath(ticketId, fileId, meta.filename);

    const { data, error } = await supabaseAdmin.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data?.token) {
      return { error: error?.message ?? "No se pudo crear la URL de carga." };
    }

    urls.push({
      path,
      token: data.token,
      filename: meta.filename,
      mime_type: meta.mime_type,
      size_bytes: meta.size_bytes,
    });
  }

  return { error: null, urls };
}

/**
 * Server action: register staff-uploaded attachment rows after storage upload.
 * Admin and IT only. Does not send notification email.
 */
export async function registerStaffAttachments(
  ticketId: string,
  files: AttachmentInput[],
): Promise<ActionResult> {
  const { actorId } = await requireStaff();

  const validation = validateAttachmentFiles(files);
  if (validation.error) {
    return validation;
  }

  const rows = files.map((f) => ({
    ticket_id: ticketId,
    storage_path: f.storage_path,
    filename: f.filename,
    mime_type: f.mime_type as AllowedMime,
    size_bytes: f.size_bytes,
    uploaded_by: actorId,
  }));

  const { error } = await supabaseAdmin.from("ticket_attachments").insert(rows);
  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Server action: soft-delete an attachment (admin removal).
 * Admin and IT only.
 */
export async function softDeleteAttachment(
  attachmentId: string,
): Promise<ActionResult> {
  const { actorId } = await requireStaff();

  const { error } = await supabaseAdmin
    .from("ticket_attachments")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: actorId,
    })
    .eq("id", attachmentId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Server action: restore an admin-removed attachment.
 * Admin and IT only.
 */
export async function restoreAttachment(
  attachmentId: string,
): Promise<ActionResult> {
  await requireStaff();

  const { error } = await supabaseAdmin
    .from("ticket_attachments")
    .update({
      deleted_at: null,
      deleted_by: null,
    })
    .eq("id", attachmentId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// ---------------------------------------------------------------------------
// getTicketAttachments
// ---------------------------------------------------------------------------

/**
 * Server action: retrieve signed URL list for a ticket's attachments.
 * Staff (admin/it) can access any ticket and see admin-removed rows greyed.
 * Clients can only access their own ticket; admin-removed attachments are hidden.
 */
export async function getTicketAttachments(
  ticketId: string,
): Promise<AttachmentItem[]> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    throw new Error("No autorizado");
  }

  const role = getAppRoleFromClaims(claims);
  const isStaff = role === "admin" || role === "it";

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

  const { data: rows, error } = await supabaseAdmin
    .from("ticket_attachments")
    .select("id, filename, size_bytes, storage_path, deleted_at, deleted_by")
    .eq("ticket_id", ticketId);

  if (error) {
    throw new Error(error.message);
  }

  const items = await Promise.all(
    (rows ?? []).map((row) =>
      mapRowToAttachmentItem(row as AttachmentRow, isStaff),
    ),
  );

  return items.filter((item): item is AttachmentItem => item !== null);
}
