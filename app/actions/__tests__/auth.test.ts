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
        updateUserById: vi.fn(),
      },
    },
    from: vi.fn(),
  },
}));

import {
  loginUser,
  logoutUser,
  inviteUser,
  resetPassword,
  completeInviteSetup,
} from "../auth";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const mockCreateClient = vi.mocked(createClient);

function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getClaims: vi
        .fn()
        .mockResolvedValue({ data: { claims: { app_role: "admin" } } }),
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
    expect(result.error).toBe("Credenciales inválidas");
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
      getClaims: vi
        .fn()
        .mockResolvedValue({ data: { claims: { app_role: "client" } } }),
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
      getClaims: vi
        .fn()
        .mockResolvedValue({ data: { claims: { app_role: "admin" } } }),
    });
    mockCreateClient.mockResolvedValue(mock as never);
    vi.mocked(supabaseAdmin.auth.admin.inviteUserByEmail).mockResolvedValue({
      data: { user: { id: "invited-user-id" } as any },
      error: null,
    });
    vi.mocked(supabaseAdmin.auth.admin.updateUserById).mockResolvedValue({
      data: { user: { id: "invited-user-id" } as any },
      error: null,
    });
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabaseAdmin.from).mockReturnValue({ update } as never);

    const result = await inviteUser("it@corp.com", "it");
    expect(result.error).toBeNull();
    expect(supabaseAdmin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      "it@corp.com",
      {
        redirectTo: expect.stringContaining("/auth/accept-invite"),
      },
    );
    expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(
      "invited-user-id",
      { app_metadata: { role: "it" } },
    );
    expect(update).toHaveBeenCalledWith({ role: "it" });
    expect(eq).toHaveBeenCalledWith("id", "invited-user-id");
  });

  it("sets app_metadata.role=admin when inviting admin", async () => {
    const mock = makeSupabaseMock({
      getClaims: vi
        .fn()
        .mockResolvedValue({ data: { claims: { app_role: "admin" } } }),
    });
    mockCreateClient.mockResolvedValue(mock as never);
    vi.mocked(supabaseAdmin.auth.admin.inviteUserByEmail).mockResolvedValue({
      data: { user: { id: "invited-admin-id" } as any },
      error: null,
    });
    vi.mocked(supabaseAdmin.auth.admin.updateUserById).mockResolvedValue({
      data: { user: { id: "invited-admin-id" } as any },
      error: null,
    });

    await inviteUser("admin2@corp.com", "admin");
    expect(supabaseAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(
      "invited-admin-id",
      { app_metadata: { role: "admin" } },
    );
  });
});

describe("completeInviteSetup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns error when session is missing", async () => {
    const mock = makeSupabaseMock({
      getClaims: vi.fn().mockResolvedValue({ data: { claims: null } }),
    });
    mockCreateClient.mockResolvedValue(mock as never);

    const formData = new FormData();
    formData.set("name", "Jane Doe");
    formData.set("password", "SecurePass1!");
    formData.set("confirmPassword", "SecurePass1!");

    const result = await completeInviteSetup({ error: null }, formData);
    expect(result.error).toContain("expiró");
  });

  it("updates auth user and profile then redirects", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const mock = makeSupabaseMock({
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { app_role: "admin", sub: "user-123" } },
      }),
      updateUser,
    });
    mockCreateClient.mockResolvedValue(mock as never);

    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabaseAdmin.from).mockReturnValue({ update } as never);

    const formData = new FormData();
    formData.set("name", "Jane Doe");
    formData.set("password", "SecurePass1!");
    formData.set("confirmPassword", "SecurePass1!");

    try {
      await completeInviteSetup({ error: null }, formData);
    } catch {
      // redirect throws
    }

    expect(updateUser).toHaveBeenCalledWith({
      password: "SecurePass1!",
      data: { name: "Jane Doe", full_name: "Jane Doe" },
    });
    expect(supabaseAdmin.from).toHaveBeenCalledWith("users");
    expect(update).toHaveBeenCalledWith({ display_name: "Jane Doe" });
    expect(eq).toHaveBeenCalledWith("id", "user-123");
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
