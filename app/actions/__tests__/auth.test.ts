import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        inviteUserByEmail: vi.fn(),
      },
    },
  },
}));

import { loginUser, logoutUser, inviteUser, resetPassword } from "../auth";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const mockCreateClient = vi.mocked(createClient);

function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getClaims: vi.fn().mockResolvedValue({ data: { claims: { role: "admin" } } }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      ...overrides,
    },
  };
}

describe("loginUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls signInWithPassword and returns no error on valid credentials", async () => {
    const mock = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(mock as never);

    const formData = new FormData();
    formData.set("email", "admin@corp.com");
    formData.set("password", "correctpass");

    // redirect() throws internally in Next.js Server Actions; we catch it
    try {
      await loginUser({ error: null }, formData);
    } catch {
      // redirect throws — expected
    }

    expect(mock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "admin@corp.com",
      password: "correctpass",
    });
  });

  it("returns error on wrong password", async () => {
    const mock = makeSupabaseMock({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: {},
        error: { message: "Invalid login credentials" },
      }),
    });
    mockCreateClient.mockResolvedValue(mock as never);

    const formData = new FormData();
    formData.set("email", "admin@corp.com");
    formData.set("password", "wrongpass");

    const result = await loginUser({ error: null }, formData);
    expect(result.error).toBe("Invalid credentials");
  });
});

describe("logoutUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls signOut", async () => {
    const mock = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(mock as never);

    try {
      await logoutUser();
    } catch {
      // redirect throws — expected
    }

    expect(mock.auth.signOut).toHaveBeenCalled();
  });
});

describe("inviteUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when caller is not admin", async () => {
    const mock = makeSupabaseMock({
      getClaims: vi.fn().mockResolvedValue({ data: { claims: { role: "client" } } }),
    });
    mockCreateClient.mockResolvedValue(mock as never);

    const result = await inviteUser("it@corp.com", "it");
    expect(result.error).toBeTruthy();
    expect(supabaseAdmin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("returns error when role is not it or admin", async () => {
    const result = await inviteUser("test@corp.com", "client" as any);
    expect(result.error).toBeTruthy();
    expect(supabaseAdmin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("calls inviteUserByEmail when caller is admin", async () => {
    const mock = makeSupabaseMock({
      getClaims: vi.fn().mockResolvedValue({ data: { claims: { role: "admin" } } }),
    });
    mockCreateClient.mockResolvedValue(mock as never);
    vi.mocked(supabaseAdmin.auth.admin.inviteUserByEmail).mockResolvedValue({
      data: { user: { id: "invited-user-id" } as any },
      error: null,
    });

    const result = await inviteUser("it@corp.com", "it");
    expect(result.error).toBeNull();
    expect(supabaseAdmin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      "it@corp.com",
      {
        redirectTo: expect.stringContaining("/auth/update-password"),
        data: { role: "it" },
      }
    );
  });

  it("passes role=admin in data payload when inviting admin", async () => {
    const mock = makeSupabaseMock({
      getClaims: vi.fn().mockResolvedValue({ data: { claims: { role: "admin" } } }),
    });
    mockCreateClient.mockResolvedValue(mock as never);
    vi.mocked(supabaseAdmin.auth.admin.inviteUserByEmail).mockResolvedValue({
      data: { user: { id: "invited-admin-id" } as any },
      error: null,
    });

    await inviteUser("admin2@corp.com", "admin");
    expect(supabaseAdmin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      "admin2@corp.com",
      expect.objectContaining({ data: { role: "admin" } })
    );
  });
});

describe("resetPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("always returns null error regardless of email existence", async () => {
    const mock = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(mock as never);

    const result = await resetPassword("anyone@example.com");
    expect(result.error).toBeNull();
  });

  it("returns null error even if supabase returns an error (no enumeration)", async () => {
    const mock = makeSupabaseMock({
      resetPasswordForEmail: vi.fn().mockResolvedValue({
        error: { message: "User not found" },
      }),
    });
    mockCreateClient.mockResolvedValue(mock as never);

    const result = await resetPassword("unknown@example.com");
    expect(result.error).toBeNull();
  });
});
