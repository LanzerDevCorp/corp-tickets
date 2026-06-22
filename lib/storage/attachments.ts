/**
 * Shared constants and utilities for ticket attachments.
 * Safe to import from both client and server code.
 */

export const ATTACHMENT_BUCKET = "ticket-attachments" as const;

export const MAX_FILES = 5;

/** 50 MiB in bytes */
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/zip",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME)[number];

/**
 * Build the storage object path for a ticket attachment.
 * Format: tickets/{ticketId}/{fileId}-{filename}
 */
export function buildStoragePath(
  ticketId: string,
  fileId: string,
  filename: string
): string {
  return `tickets/${ticketId}/${fileId}-${filename}`;
}
