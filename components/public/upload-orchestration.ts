/**
 * Client-side upload orchestration for the three-phase ticket submit flow.
 *
 * Phase 1: submitTicket (handled by the form's useActionState)
 * Phase 2: browser uploads each file directly to private storage bucket
 * Phase 3: registerAttachments server action inserts DB rows
 *
 * Exported as a pure-ish async function for testability (dependencies injected
 * via module mocks in tests; in production, imports are resolved normally).
 */
import { createClient } from "@/lib/supabase/client";
import { registerAttachments, rollbackTicket } from "@/app/actions/attachments";
import {
  ATTACHMENT_BUCKET,
  buildStoragePath,
} from "@/lib/storage/attachments";

// Use a simple ID generator that works in both browser and test environments
function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export interface OrchestrationResult {
  error: string | null;
  /** When true, the user can retry submission without files */
  canRetryWithoutFiles: boolean;
}

/**
 * Orchestrate the file upload phases after the ticket has been created.
 *
 * - If files is empty, returns success immediately.
 * - On upload failure: calls rollbackTicket, returns error with canRetryWithoutFiles=true.
 * - On register failure: calls rollbackTicket, returns error with canRetryWithoutFiles=true.
 * - If rollback also fails: returns error with canRetryWithoutFiles=false (contact support).
 */
export async function orchestrateFileUpload(
  ticketId: string,
  files: File[]
): Promise<OrchestrationResult> {
  if (files.length === 0) {
    return { error: null, canRetryWithoutFiles: false };
  }

  const supabase = createClient();
  const uploadedFiles: Array<{
    storage_path: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
  }> = [];

  // Phase 2: Upload each file to private bucket
  for (const file of files) {
    const fileId = generateId();
    const storagePath = buildStoragePath(ticketId, fileId, file.name);

    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(storagePath, file);
    console.log("AAAAAAAAAAAAA", uploadError)
    if (uploadError) {
      // Rollback ticket on any upload failure
      const { error: rollbackError } = await rollbackTicket(ticketId);
      if (rollbackError) {
        return {
          error: "File upload failed and the ticket could not be cleaned up. Please contact support.",
          canRetryWithoutFiles: false,
        };
      }
      return {
        error: "El archivo no pudo ser subido. Por favor, inténtalo de nuevo o envía sin archivos.",
        canRetryWithoutFiles: true,
      };
    }

    uploadedFiles.push({
      storage_path: storagePath,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    });
  }

  // Phase 3: Register attachment rows
  const { error: registerError } = await registerAttachments(ticketId, uploadedFiles);
  if (registerError) {
    const { error: rollbackError } = await rollbackTicket(ticketId);
    if (rollbackError) {
      return {
        error: "Attachment registration failed and the ticket could not be cleaned up. Please contact support.",
        canRetryWithoutFiles: false,
      };
    }
    return {
      error: "Attachment registration failed. Please try again or submit without files.",
      canRetryWithoutFiles: true,
    };
  }

  return { error: null, canRetryWithoutFiles: false };
}
