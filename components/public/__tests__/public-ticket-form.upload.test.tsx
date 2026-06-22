/**
 * Tests for the three-phase upload orchestration in PublicTicketForm.
 *
 * We test the upload orchestration logic extracted as a pure async function
 * following the Extract-Before-Mock rule from strict-tdd.md.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock functions (must be created before vi.mock factories run)
// ---------------------------------------------------------------------------

const mockStorageUpload = vi.hoisted(() => vi.fn());
const mockStorageFrom = vi.hoisted(() => vi.fn(() => ({ upload: mockStorageUpload })));
const mockRegisterAttachments = vi.hoisted(() => vi.fn());
const mockRollbackTicket = vi.hoisted(() => vi.fn());
const mockBuildStoragePath = vi.hoisted(() =>
  vi.fn((ticketId: string, fileId: string, name: string) => `tickets/${ticketId}/${fileId}-${name}`)
);

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    storage: { from: mockStorageFrom },
  })),
}));

vi.mock("@/app/actions/attachments", () => ({
  registerAttachments: mockRegisterAttachments,
  rollbackTicket: mockRollbackTicket,
}));

vi.mock("@/lib/storage/attachments", () => ({
  ATTACHMENT_BUCKET: "ticket-attachments",
  MAX_FILES: 5,
  MAX_TOTAL_BYTES: 50 * 1024 * 1024,
  ALLOWED_MIME: ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/zip"],
  buildStoragePath: mockBuildStoragePath,
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------
import { orchestrateFileUpload } from "../upload-orchestration";
import { rollbackTicket, registerAttachments } from "@/app/actions/attachments";

function makeFile(name: string): File {
  return new File(["x"], name, { type: "application/pdf" });
}

const FILE_A = makeFile("a.pdf");
const FILE_B = makeFile("b.pdf");

describe("orchestrateFileUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageFrom.mockReturnValue({ upload: mockStorageUpload });
  });

  it("happy path — uploads files then calls registerAttachments in order", async () => {
    mockStorageUpload.mockResolvedValue({ data: { path: "tickets/t1/uuid-a.pdf" }, error: null });
    mockRegisterAttachments.mockResolvedValue({ error: null });

    const result = await orchestrateFileUpload("ticket-1", [FILE_A, FILE_B]);

    expect(result.error).toBeNull();
    expect(mockStorageFrom).toHaveBeenCalledWith("ticket-attachments");
    expect(mockStorageUpload).toHaveBeenCalledTimes(2);
    expect(mockRegisterAttachments).toHaveBeenCalledWith(
      "ticket-1",
      expect.arrayContaining([
        expect.objectContaining({ filename: "a.pdf", mime_type: "application/pdf" }),
        expect.objectContaining({ filename: "b.pdf", mime_type: "application/pdf" }),
      ])
    );
  });

  it("zero-files path returns success immediately without upload or register", async () => {
    const result = await orchestrateFileUpload("ticket-1", []);

    expect(result.error).toBeNull();
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(registerAttachments).not.toHaveBeenCalled();
  });

  it("upload failure triggers rollbackTicket and returns error with retry hint", async () => {
    mockStorageUpload.mockResolvedValue({ data: null, error: { message: "storage error" } });
    mockRollbackTicket.mockResolvedValue({ error: null });

    const result = await orchestrateFileUpload("ticket-1", [FILE_A]);

    expect(result.error).toBeTruthy();
    expect(result.canRetryWithoutFiles).toBe(true);
    expect(rollbackTicket).toHaveBeenCalledWith("ticket-1");
    expect(registerAttachments).not.toHaveBeenCalled();
  });

  it("register failure triggers rollbackTicket and returns error with retry hint", async () => {
    mockStorageUpload.mockResolvedValue({ data: { path: "tickets/t1/uuid-a.pdf" }, error: null });
    mockRegisterAttachments.mockResolvedValue({ error: "db insert failed" });
    mockRollbackTicket.mockResolvedValue({ error: null });

    const result = await orchestrateFileUpload("ticket-1", [FILE_A]);

    expect(result.error).toBeTruthy();
    expect(result.canRetryWithoutFiles).toBe(true);
    expect(rollbackTicket).toHaveBeenCalledWith("ticket-1");
  });

  it("rollback failure after upload error returns error with canRetryWithoutFiles=false", async () => {
    mockStorageUpload.mockResolvedValue({ data: null, error: { message: "upload failed" } });
    mockRollbackTicket.mockResolvedValue({ error: "rollback also failed" });

    const result = await orchestrateFileUpload("ticket-1", [FILE_A]);

    expect(result.error).toBeTruthy();
    expect(result.canRetryWithoutFiles).toBe(false);
  });
});
