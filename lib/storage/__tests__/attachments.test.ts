import { describe, it, expect } from "vitest";
import {
  ATTACHMENT_BUCKET,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  ALLOWED_MIME,
  buildStoragePath,
} from "../attachments";

describe("attachments constants", () => {
  it("ATTACHMENT_BUCKET is 'ticket-attachments'", () => {
    expect(ATTACHMENT_BUCKET).toBe("ticket-attachments");
  });

  it("MAX_FILES is 5", () => {
    expect(MAX_FILES).toBe(5);
  });

  it("MAX_TOTAL_BYTES is 50 MiB (52428800 bytes)", () => {
    expect(MAX_TOTAL_BYTES).toBe(50 * 1024 * 1024);
  });

  it("ALLOWED_MIME contains the five required types", () => {
    expect(ALLOWED_MIME).toContain("application/pdf");
    expect(ALLOWED_MIME).toContain("image/jpeg");
    expect(ALLOWED_MIME).toContain("image/png");
    expect(ALLOWED_MIME).toContain("image/webp");
    expect(ALLOWED_MIME).toContain("application/zip");
  });

  it("ALLOWED_MIME contains exactly 5 entries", () => {
    expect(ALLOWED_MIME).toHaveLength(5);
  });
});

describe("buildStoragePath", () => {
  it("returns path in tickets/{ticketId}/{fileId}-{filename} format", () => {
    const result = buildStoragePath("ticket-123", "uuid-abc", "report.pdf");
    expect(result).toBe("tickets/ticket-123/uuid-abc-report.pdf");
  });

  it("includes ticketId, fileId, and filename as distinct segments", () => {
    const result = buildStoragePath("t-001", "f-002", "image.png");
    expect(result).toMatch(/^tickets\/t-001\/f-002-image\.png$/);
  });

  it("handles filenames with spaces or special characters", () => {
    const result = buildStoragePath("t-001", "f-002", "my document.pdf");
    expect(result).toBe("tickets/t-001/f-002-my document.pdf");
  });
});
