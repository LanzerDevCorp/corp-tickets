import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import {
  getUsers,
  deactivateUser,
  reactivateUser,
  getCategories,
  createCategory,
  updateCategory,
} from "../admin";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const mockCreateClient = vi.mocked(createClient);
const mockSupabaseAdmin = vi.mocked(supabaseAdmin);

function makeAuthMock(role: string, sub = "caller-uuid") {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { app_role: role, sub } },
      }),
    },
  };
}

function makeAdminChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {};
  const terminal = vi.fn().mockResolvedValue(resolvedValue);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = terminal;
  // Make it awaitable for non-single queries
  const mockPromise = Promise.resolve(resolvedValue);
  (chain as Record<string, unknown>).then = (onfulfilled: unknown, onrejected: unknown) =>
    (mockPromise as Promise<unknown>).then(onfulfilled as never, onrejected as never);
  return chain;
}

// ---- getUsers ----

describe("getUsers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all users ordered by created_at desc when caller is admin", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    mockSupabaseAdmin.from.mockReturnValue(
      makeAdminChain({ data: [{ id: "u1", email: "a@b.com", display_name: "A", role: "admin", is_active: true, created_at: "2026-01-01" }], error: null }) as never
    );

    const result = await getUsers();
    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("u1");
    }
  });

  it("returns empty array when no users exist", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    mockSupabaseAdmin.from.mockReturnValue(
      makeAdminChain({ data: null, error: null }) as never
    );

    const result = await getUsers();
    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data).toEqual([]);
    }
  });

  it("returns auth error when caller is not admin", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("it") as never);

    const result = await getUsers();
    expect(result.error).toBeTruthy();
    expect((result as { code?: string }).code).toBe("auth");
  });

  it("returns db error when supabase returns error", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    mockSupabaseAdmin.from.mockReturnValue(
      makeAdminChain({ data: null, error: { message: "DB error" } }) as never
    );

    const result = await getUsers();
    expect(result.error).toBe("DB error");
    if (result.error !== null) {
      expect((result as { code?: string }).code).toBe("db");
    }
  });
});

// ---- deactivateUser ----

describe("deactivateUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets is_active=false on target user", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin", "caller-uuid") as never);
    mockSupabaseAdmin.from.mockReturnValue(
      makeAdminChain({ data: { id: "target-uuid" }, error: null }) as never
    );

    const result = await deactivateUser("target-uuid");
    expect(result.error).toBeNull();
  });

  it("returns error when userId matches caller sub (cannot deactivate self)", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin", "self-uuid") as never);

    const result = await deactivateUser("self-uuid");
    expect(result.error).toBeTruthy();
    if (result.error !== null) {
      expect((result as { code?: string }).code).toBe("auth");
    }
  });

  it("returns auth error when caller is not admin", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("it", "caller-uuid") as never);

    const result = await deactivateUser("target-uuid");
    expect(result.error).toBeTruthy();
    expect((result as { code?: string }).code).toBe("auth");
  });

  it("returns db error when supabase update fails", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin", "caller-uuid") as never);
    mockSupabaseAdmin.from.mockReturnValue(
      makeAdminChain({ data: null, error: { message: "Update failed" } }) as never
    );

    const result = await deactivateUser("target-uuid");
    expect(result.error).toBe("Update failed");
    if (result.error !== null) {
      expect((result as { code?: string }).code).toBe("db");
    }
  });
});

// ---- reactivateUser ----

describe("reactivateUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets is_active=true on target user", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    mockSupabaseAdmin.from.mockReturnValue(
      makeAdminChain({ data: { id: "target-uuid" }, error: null }) as never
    );

    const result = await reactivateUser("target-uuid");
    expect(result.error).toBeNull();
  });

  it("returns auth error when caller is not admin", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("client") as never);

    const result = await reactivateUser("target-uuid");
    expect(result.error).toBeTruthy();
    expect((result as { code?: string }).code).toBe("auth");
  });

  it("returns db error when supabase update fails", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    mockSupabaseAdmin.from.mockReturnValue(
      makeAdminChain({ data: null, error: { message: "Update error" } }) as never
    );

    const result = await reactivateUser("target-uuid");
    expect(result.error).toBe("Update error");
    if (result.error !== null) {
      expect((result as { code?: string }).code).toBe("db");
    }
  });
});

// ---- getCategories (admin) ----

describe("getCategories (admin)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all categories including disabled ones when caller is admin", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    mockSupabaseAdmin.from.mockReturnValue(
      makeAdminChain({ data: [{ id: "c1", name: "Hardware", is_enabled: false, created_at: "2026-01-01" }], error: null }) as never
    );

    const result = await getCategories();
    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].is_enabled).toBe(false);
    }
  });

  it("returns empty array when no categories exist", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    mockSupabaseAdmin.from.mockReturnValue(
      makeAdminChain({ data: null, error: null }) as never
    );

    const result = await getCategories();
    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data).toEqual([]);
    }
  });

  it("returns auth error when caller is not admin", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("it") as never);

    const result = await getCategories();
    expect(result.error).toBeTruthy();
    expect((result as { code?: string }).code).toBe("auth");
  });

  it("returns db error when supabase returns error", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    mockSupabaseAdmin.from.mockReturnValue(
      makeAdminChain({ data: null, error: { message: "DB error" } }) as never
    );

    const result = await getCategories();
    expect(result.error).toBe("DB error");
    if (result.error !== null) {
      expect((result as { code?: string }).code).toBe("db");
    }
  });
});

// ---- createCategory ----

describe("createCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts category with is_enabled=true and returns row when name is valid", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    const chain = makeAdminChain({ data: { id: "c1", name: "Hardware", is_enabled: true, created_at: "2026-01-01" }, error: null });
    mockSupabaseAdmin.from.mockReturnValue(chain as never);

    const result = await createCategory({ name: "Hardware" });
    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.name).toBe("Hardware");
      expect(result.data.is_enabled).toBe(true);
    }
  });

  it("returns validation error for empty name", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);

    const result = await createCategory({ name: "" });
    expect(result.error).toBeTruthy();
    if (result.error !== null) {
      expect((result as { code?: string }).code).toBe("validation");
    }
  });

  it("returns validation error for name exceeding 100 chars", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);

    const result = await createCategory({ name: "A".repeat(101) });
    expect(result.error).toBeTruthy();
    if (result.error !== null) {
      expect((result as { code?: string }).code).toBe("validation");
    }
  });

  it("returns db error with friendly message on pg 23505 (unique violation)", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    const chain = makeAdminChain({ data: null, error: { message: "duplicate key", code: "23505" } });
    mockSupabaseAdmin.from.mockReturnValue(chain as never);

    const result = await createCategory({ name: "Hardware" });
    expect(result.error).toBe("A category with this name already exists.");
    if (result.error !== null) {
      expect((result as { code?: string }).code).toBe("db");
    }
  });

  it("returns auth error when caller is not admin", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("client") as never);

    const result = await createCategory({ name: "Hardware" });
    expect(result.error).toBeTruthy();
    expect((result as { code?: string }).code).toBe("auth");
  });
});

// ---- updateCategory ----

describe("updateCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates name when only name is provided", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    const chain = makeAdminChain({ data: { id: "c1", name: "New Name", is_enabled: true, created_at: "2026-01-01" }, error: null });
    mockSupabaseAdmin.from.mockReturnValue(chain as never);

    const result = await updateCategory("c1", { name: "New Name" });
    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.name).toBe("New Name");
    }
  });

  it("updates is_enabled when only is_enabled is provided", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    const chain = makeAdminChain({ data: { id: "c1", name: "Hardware", is_enabled: false, created_at: "2026-01-01" }, error: null });
    mockSupabaseAdmin.from.mockReturnValue(chain as never);

    const result = await updateCategory("c1", { is_enabled: false });
    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.is_enabled).toBe(false);
    }
  });

  it("updates both name and is_enabled when both are provided", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    const chain = makeAdminChain({ data: { id: "c1", name: "Renamed", is_enabled: false, created_at: "2026-01-01" }, error: null });
    mockSupabaseAdmin.from.mockReturnValue(chain as never);

    const result = await updateCategory("c1", { name: "Renamed", is_enabled: false });
    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.name).toBe("Renamed");
    }
  });

  it("returns validation error for empty name when name is in input", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);

    const result = await updateCategory("c1", { name: "" });
    expect(result.error).toBeTruthy();
    if (result.error !== null) {
      expect((result as { code?: string }).code).toBe("validation");
    }
  });

  it("returns db error on unique constraint violation (23505) when renaming", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    const chain = makeAdminChain({ data: null, error: { message: "duplicate key", code: "23505" } });
    mockSupabaseAdmin.from.mockReturnValue(chain as never);

    const result = await updateCategory("c1", { name: "Existing" });
    expect(result.error).toBe("A category with this name already exists.");
    if (result.error !== null) {
      expect((result as { code?: string }).code).toBe("db");
    }
  });

  it("returns db error when supabase returns error", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("admin") as never);
    const chain = makeAdminChain({ data: null, error: { message: "Not found" } });
    mockSupabaseAdmin.from.mockReturnValue(chain as never);

    const result = await updateCategory("c1", { is_enabled: true });
    expect(result.error).toBe("Not found");
    if (result.error !== null) {
      expect((result as { code?: string }).code).toBe("db");
    }
  });

  it("returns auth error when caller is not admin", async () => {
    mockCreateClient.mockResolvedValue(makeAuthMock("it") as never);

    const result = await updateCategory("c1", { name: "Test" });
    expect(result.error).toBeTruthy();
    expect((result as { code?: string }).code).toBe("auth");
  });
});
