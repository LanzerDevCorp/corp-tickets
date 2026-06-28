import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const mockAdminFrom = vi.hoisted(() => vi.fn());
const mockStorageFrom = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: mockAdminFrom,
    storage: {
      from: mockStorageFrom,
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------
import {
  registerAttachments,
  rollbackTicket,
  getTicketAttachments,
  createStaffUploadUrls,
  registerStaffAttachments,
  softDeleteAttachment,
  restoreAttachment,
} from "../attachments";
import { createClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createClient);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryChain(result: any) {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: (res: any) => Promise.resolve(result).then(res),
  };
}

function makeServerClient(options: { claims?: any; queryResult?: any }) {
  const queryChain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi
      .fn()
      .mockResolvedValue(options.queryResult ?? { data: null, error: null }),
  };
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: options.claims ? { claims: options.claims } : { claims: null },
      }),
    },
    from: vi.fn().mockReturnValue(queryChain),
  };
}

const VALID_FILES = [
  {
    storage_path: "tickets/t1/f1-a.pdf",
    filename: "a.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024,
  },
  {
    storage_path: "tickets/t1/f2-b.png",
    filename: "b.png",
    mime_type: "image/png",
    size_bytes: 2048,
  },
];

const STAFF_ADMIN_CLAIMS = { app_role: "admin", sub: "admin-1" };
const STAFF_IT_CLAIMS = { app_role: "it", sub: "it-1" };
const CLIENT_CLAIMS = {
  app_role: "client",
  sub: "client-1",
  email: "client@test.com",
};

const VALID_FILE_METAS = [
  { filename: "a.pdf", mime_type: "application/pdf", size_bytes: 1024 },
  { filename: "b.png", mime_type: "image/png", size_bytes: 2048 },
];

function mockStaffSession(claims: Record<string, unknown>) {
  mockCreateClient.mockResolvedValue(makeServerClient({ claims }) as any);
}

// ---------------------------------------------------------------------------
// registerAttachments
// ---------------------------------------------------------------------------

describe("registerAttachments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when more than 5 files are provided", async () => {
    const sixFiles = Array.from({ length: 6 }, (_, i) => ({
      storage_path: `tickets/t1/f${i}-file.pdf`,
      filename: `file${i}.pdf`,
      mime_type: "application/pdf",
      size_bytes: 100,
    }));

    const result = await registerAttachments("ticket-1", sixFiles);

    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/5/); // mentions limit
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("returns error when total size exceeds 50 MiB", async () => {
    const MB_26 = 26 * 1024 * 1024;
    const twoLargeFiles = [
      {
        storage_path: "tickets/t1/f1-a.pdf",
        filename: "a.pdf",
        mime_type: "application/pdf",
        size_bytes: MB_26,
      },
      {
        storage_path: "tickets/t1/f2-b.pdf",
        filename: "b.pdf",
        mime_type: "application/pdf",
        size_bytes: MB_26,
      },
    ];

    const result = await registerAttachments("ticket-1", twoLargeFiles);

    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/50/); // mentions size limit
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("returns error when a file has a disallowed MIME type", async () => {
    const badFiles = [
      {
        storage_path: "tickets/t1/f1-evil.exe",
        filename: "evil.exe",
        mime_type: "application/octet-stream",
        size_bytes: 100,
      },
    ];

    const result = await registerAttachments("ticket-1", badFiles);

    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/mime|type/i);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("inserts attachment rows and returns no error on happy path", async () => {
    const chain = makeQueryChain({ error: null });
    mockAdminFrom.mockReturnValue(chain);

    const result = await registerAttachments("ticket-1", VALID_FILES);

    expect(result.error).toBeNull();
    expect(mockAdminFrom).toHaveBeenCalledWith("ticket_attachments");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ ticket_id: "ticket-1", filename: "a.pdf" }),
        expect.objectContaining({ ticket_id: "ticket-1", filename: "b.png" }),
      ]),
    );
  });

  it("returns db error when insert fails", async () => {
    const chain = makeQueryChain({ error: { message: "insert failed" } });
    mockAdminFrom.mockReturnValue(chain);

    const result = await registerAttachments("ticket-1", VALID_FILES);

    expect(result.error).toBeTruthy();
    expect(result.error).toMatch(/insert failed/);
  });
});

// ---------------------------------------------------------------------------
// rollbackTicket
// ---------------------------------------------------------------------------

describe("rollbackTicket", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists objects then removes each explicit path and deletes ticket row on happy path", async () => {
    const mockList = vi.fn().mockResolvedValue({
      data: [{ name: "f1-a.pdf" }, { name: "f2-b.png" }],
      error: null,
    });
    const mockRemove = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({ list: mockList, remove: mockRemove });

    const deleteChain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (res: any) => Promise.resolve({ error: null }).then(res),
    };
    mockAdminFrom.mockReturnValue(deleteChain);

    const result = await rollbackTicket("ticket-rollback");

    expect(result.error).toBeNull();
    expect(mockStorageFrom).toHaveBeenCalledWith("ticket-attachments");
    // list called with the prefix folder (no trailing slash)
    expect(mockList).toHaveBeenCalledWith("tickets/ticket-rollback");
    // remove called with explicit object paths, not a folder path
    expect(mockRemove).toHaveBeenCalledWith([
      "tickets/ticket-rollback/f1-a.pdf",
      "tickets/ticket-rollback/f2-b.png",
    ]);
    // Ticket deleted from DB
    expect(mockAdminFrom).toHaveBeenCalledWith("tickets");
    expect(deleteChain.eq).toHaveBeenCalledWith("id", "ticket-rollback");
  });

  it("skips storage remove when folder is empty and still deletes ticket row", async () => {
    const mockList = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockRemove = vi.fn();
    mockStorageFrom.mockReturnValue({ list: mockList, remove: mockRemove });

    const deleteChain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (res: any) => Promise.resolve({ error: null }).then(res),
    };
    mockAdminFrom.mockReturnValue(deleteChain);

    const result = await rollbackTicket("ticket-empty");

    expect(result.error).toBeNull();
    // remove must NOT be called when there are no objects
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockAdminFrom).toHaveBeenCalledWith("tickets");
  });

  it("returns storage list error if listing fails", async () => {
    const mockList = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "list error" } });
    const mockRemove = vi.fn();
    mockStorageFrom.mockReturnValue({ list: mockList, remove: mockRemove });

    const result = await rollbackTicket("ticket-rollback");

    expect(result.error).toMatch(/list error/);
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("returns storage remove error if deletion fails", async () => {
    const mockList = vi.fn().mockResolvedValue({
      data: [{ name: "f1-a.pdf" }],
      error: null,
    });
    const mockRemove = vi
      .fn()
      .mockResolvedValue({ error: { message: "storage error" } });
    mockStorageFrom.mockReturnValue({ list: mockList, remove: mockRemove });

    const result = await rollbackTicket("ticket-rollback");

    expect(result.error).toMatch(/storage error/);
    // Ticket delete should NOT be called if storage removal fails
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getTicketAttachments
// ---------------------------------------------------------------------------

describe("getTicketAttachments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns signed URLs for staff viewing any ticket", async () => {
    mockCreateClient.mockResolvedValue(
      makeServerClient({
        claims: { app_role: "it", sub: "staff-1" },
      }) as any,
    );

    const rows = [
      {
        id: "att-1",
        filename: "a.pdf",
        size_bytes: 1024,
        storage_path: "tickets/t1/f1-a.pdf",
        deleted_at: null,
        deleted_by: null,
      },
    ];

    const attachmentsQueryChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: (res: any) =>
        Promise.resolve({ data: rows, error: null }).then(res),
    };
    mockAdminFrom.mockReturnValue(attachmentsQueryChain);

    const mockCreateSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.url/file" },
      error: null,
    });
    mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl });

    const result = await getTicketAttachments("ticket-1");

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("att-1");
    expect(result[0].url).toBe("https://signed.url/file");
    expect(result[0].expired).toBe(false);
  });

  it("marks attachment as expired when deleted_at is not null", async () => {
    mockCreateClient.mockResolvedValue(
      makeServerClient({
        claims: { app_role: "it", sub: "staff-1" },
      }) as any,
    );

    const rows = [
      {
        id: "att-2",
        filename: "b.pdf",
        size_bytes: 512,
        storage_path: "tickets/t1/f2-b.pdf",
        deleted_at: "2026-01-01T00:00:00Z",
        deleted_by: null,
      },
    ];

    const attachmentsQueryChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: (res: any) =>
        Promise.resolve({ data: rows, error: null }).then(res),
    };
    mockAdminFrom.mockReturnValue(attachmentsQueryChain);
    mockStorageFrom.mockReturnValue({ createSignedUrl: vi.fn() });

    const result = await getTicketAttachments("ticket-1");

    expect(result).toHaveLength(1);
    expect(result[0].expired).toBe(true);
    expect(result[0].url).toBeNull();
  });

  it("returns error when caller is client but email does not match ticket email", async () => {
    const serverClient = makeServerClient({
      claims: { app_role: "client", sub: "client-1" },
    });
    // ticket lookup returns different email
    (serverClient.from as any)().single.mockResolvedValue({
      data: { email: "other@test.com" },
      error: null,
    });
    mockCreateClient.mockResolvedValue(serverClient as any);

    await expect(getTicketAttachments("ticket-1")).rejects.toThrow(
      /autorizado|authorized/i,
    );
  });

  it("excludes admin-removed attachments for clients but keeps retention-expired ghosts", async () => {
    mockCreateClient.mockResolvedValue(
      makeServerClient({ claims: CLIENT_CLAIMS }) as any,
    );

    const rows = [
      {
        id: "att-active",
        filename: "active.pdf",
        size_bytes: 100,
        storage_path: "tickets/t1/active.pdf",
        deleted_at: null,
        deleted_by: null,
      },
      {
        id: "att-expired",
        filename: "expired.pdf",
        size_bytes: 100,
        storage_path: "tickets/t1/expired.pdf",
        deleted_at: "2026-01-01T00:00:00Z",
        deleted_by: null,
      },
      {
        id: "att-removed",
        filename: "removed.pdf",
        size_bytes: 100,
        storage_path: "tickets/t1/removed.pdf",
        deleted_at: "2026-02-01T00:00:00Z",
        deleted_by: "staff-1",
      },
    ];

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "tickets") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { email: "client@test.com" },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (res: any) =>
          Promise.resolve({ data: rows, error: null }).then(res),
      };
    });

    const mockCreateSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.url/active" },
      error: null,
    });
    mockStorageFrom.mockReturnValue({ createSignedUrl: mockCreateSignedUrl });

    const result = await getTicketAttachments("ticket-1");

    expect(result).toHaveLength(2);
    expect(result.find((a) => a.id === "att-removed")).toBeUndefined();
    expect(result.find((a) => a.id === "att-expired")?.expired).toBe(true);
    expect(result.find((a) => a.id === "att-active")?.url).toBe(
      "https://signed.url/active",
    );
  });

  it("marks admin-removed attachments as removedByAdmin for staff", async () => {
    mockCreateClient.mockResolvedValue(
      makeServerClient({ claims: STAFF_IT_CLAIMS }) as any,
    );

    const rows = [
      {
        id: "att-removed",
        filename: "removed.pdf",
        size_bytes: 100,
        storage_path: "tickets/t1/removed.pdf",
        deleted_at: "2026-02-01T00:00:00Z",
        deleted_by: "staff-1",
      },
    ];

    const attachmentsQueryChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (res: any) =>
        Promise.resolve({ data: rows, error: null }).then(res),
    };
    mockAdminFrom.mockReturnValue(attachmentsQueryChain);
    mockStorageFrom.mockReturnValue({ createSignedUrl: vi.fn() });

    const result = await getTicketAttachments("ticket-1");

    expect(result).toHaveLength(1);
    expect(result[0].removedByAdmin).toBe(true);
    expect(result[0].url).toBeNull();
    expect(result[0].expired).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createStaffUploadUrls
// ---------------------------------------------------------------------------

describe("createStaffUploadUrls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects client callers", async () => {
    mockStaffSession(CLIENT_CLAIMS);

    await expect(
      createStaffUploadUrls("ticket-1", VALID_FILE_METAS),
    ).rejects.toThrow(/autorizado|authorized/i);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it("returns signed upload URLs for admin", async () => {
    mockStaffSession(STAFF_ADMIN_CLAIMS);

    const mockCreateSignedUploadUrl = vi.fn().mockResolvedValue({
      data: {
        signedUrl: "https://upload.url",
        token: "tok-1",
        path: "tickets/ticket-1/uuid-a.pdf",
      },
      error: null,
    });
    mockStorageFrom.mockReturnValue({
      createSignedUploadUrl: mockCreateSignedUploadUrl,
    });

    const result = await createStaffUploadUrls("ticket-1", [
      VALID_FILE_METAS[0]!,
    ]);

    expect(result.error).toBeNull();
    expect(result.urls).toHaveLength(1);
    expect(result.urls![0]).toMatchObject({
      token: "tok-1",
      filename: "a.pdf",
      mime_type: "application/pdf",
      size_bytes: 1024,
    });
    expect(result.urls![0]!.path).toMatch(/^tickets\/ticket-1\/.+-a\.pdf$/);
  });

  it("returns signed upload URLs for IT", async () => {
    mockStaffSession(STAFF_IT_CLAIMS);

    const mockCreateSignedUploadUrl = vi.fn().mockResolvedValue({
      data: {
        signedUrl: "https://upload.url",
        token: "tok-2",
        path: "tickets/ticket-1/uuid-b.png",
      },
      error: null,
    });
    mockStorageFrom.mockReturnValue({
      createSignedUploadUrl: mockCreateSignedUploadUrl,
    });

    const result = await createStaffUploadUrls("ticket-1", [
      VALID_FILE_METAS[1]!,
    ]);

    expect(result.error).toBeNull();
    expect(result.urls).toHaveLength(1);
  });

  it("returns validation error when more than 5 files are requested", async () => {
    mockStaffSession(STAFF_ADMIN_CLAIMS);

    const sixFiles = Array.from({ length: 6 }, (_, i) => ({
      filename: `file${i}.pdf`,
      mime_type: "application/pdf",
      size_bytes: 100,
    }));

    const result = await createStaffUploadUrls("ticket-1", sixFiles);

    expect(result.error).toMatch(/5/);
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// registerStaffAttachments
// ---------------------------------------------------------------------------

describe("registerStaffAttachments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects client callers", async () => {
    mockStaffSession(CLIENT_CLAIMS);

    await expect(
      registerStaffAttachments("ticket-1", VALID_FILES),
    ).rejects.toThrow(/autorizado|authorized/i);
  });

  it("inserts rows for admin on happy path", async () => {
    mockStaffSession(STAFF_ADMIN_CLAIMS);

    const chain = makeQueryChain({ error: null });
    mockAdminFrom.mockReturnValue(chain);

    const result = await registerStaffAttachments("ticket-1", VALID_FILES);

    expect(result.error).toBeNull();
    expect(mockAdminFrom).toHaveBeenCalledWith("ticket_attachments");
    expect(chain.insert).toHaveBeenCalled();
  });

  it("inserts rows for IT on happy path", async () => {
    mockStaffSession(STAFF_IT_CLAIMS);

    const chain = makeQueryChain({ error: null });
    mockAdminFrom.mockReturnValue(chain);

    const result = await registerStaffAttachments("ticket-1", VALID_FILES);

    expect(result.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// softDeleteAttachment
// ---------------------------------------------------------------------------

describe("softDeleteAttachment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects client callers", async () => {
    mockStaffSession(CLIENT_CLAIMS);

    await expect(softDeleteAttachment("att-1")).rejects.toThrow(
      /autorizado|authorized/i,
    );
  });

  it("sets deleted_at and deleted_by for admin", async () => {
    mockStaffSession(STAFF_ADMIN_CLAIMS);

    const chain = makeQueryChain({ error: null });
    mockAdminFrom.mockReturnValue(chain);

    const result = await softDeleteAttachment("att-1");

    expect(result.error).toBeNull();
    expect(mockAdminFrom).toHaveBeenCalledWith("ticket_attachments");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_by: "admin-1",
        deleted_at: expect.any(String),
      }),
    );
    expect(chain.eq).toHaveBeenCalledWith("id", "att-1");
  });

  it("sets deleted_at and deleted_by for IT", async () => {
    mockStaffSession(STAFF_IT_CLAIMS);

    const chain = makeQueryChain({ error: null });
    mockAdminFrom.mockReturnValue(chain);

    const result = await softDeleteAttachment("att-2");

    expect(result.error).toBeNull();
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_by: "it-1" }),
    );
  });
});

// ---------------------------------------------------------------------------
// restoreAttachment
// ---------------------------------------------------------------------------

describe("restoreAttachment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects client callers", async () => {
    mockStaffSession(CLIENT_CLAIMS);

    await expect(restoreAttachment("att-1")).rejects.toThrow(
      /autorizado|authorized/i,
    );
  });

  it("clears deleted_at and deleted_by for admin", async () => {
    mockStaffSession(STAFF_ADMIN_CLAIMS);

    const chain = makeQueryChain({ error: null });
    mockAdminFrom.mockReturnValue(chain);

    const result = await restoreAttachment("att-1");

    expect(result.error).toBeNull();
    expect(chain.update).toHaveBeenCalledWith({
      deleted_at: null,
      deleted_by: null,
    });
    expect(chain.eq).toHaveBeenCalledWith("id", "att-1");
  });
});
