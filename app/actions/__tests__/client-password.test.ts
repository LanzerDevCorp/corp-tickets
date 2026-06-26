import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock factories
// ---------------------------------------------------------------------------

const mockAdminFrom = vi.hoisted(() => vi.fn());
const mockUpdateUserById = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: mockAdminFrom,
    auth: { admin: { updateUserById: mockUpdateUserById } },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import {
  setClientPassword,
  dismissPasswordPrompt,
  getPasswordDecision,
} from "../client-password";
import { createClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createClient);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeServerClient(claims: unknown) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: claims ? { claims } : { claims: null },
      }),
    },
  };
}

function makeUpdateChain() {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
}

function makeSelectChain(row: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  };
}

const CLIENT_CLAIMS = { sub: "client-1", email: "c@x.com", app_role: "client" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// setClientPassword
// ---------------------------------------------------------------------------

describe("setClientPassword", () => {
  it("rejects a password shorter than the minimum without touching Supabase", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(CLIENT_CLAIMS) as never);

    const result = await setClientPassword("short");

    expect(result.error).toMatch(/al menos/i);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);

    const result = await setClientPassword("a-strong-password");

    expect(result.error).toMatch(/no autorizado/i);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("sets the password and stamps password_set_at for a client", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(CLIENT_CLAIMS) as never);
    mockUpdateUserById.mockResolvedValue({ data: {}, error: null });
    const updateChain = makeUpdateChain();
    mockAdminFrom.mockReturnValue(updateChain);

    const result = await setClientPassword("a-strong-password");

    expect(result.error).toBeNull();
    expect(mockUpdateUserById).toHaveBeenCalledWith("client-1", {
      password: "a-strong-password",
    });
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ password_set_at: expect.any(String) })
    );
    expect(updateChain.eq).toHaveBeenCalledWith("id", "client-1");
  });

  it("propagates an auth update failure and does not stamp", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(CLIENT_CLAIMS) as never);
    mockUpdateUserById.mockResolvedValue({
      data: null,
      error: { message: "weak password" },
    });
    const updateChain = makeUpdateChain();
    mockAdminFrom.mockReturnValue(updateChain);

    const result = await setClientPassword("a-strong-password");

    expect(result.error).toBe("weak password");
    expect(updateChain.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// dismissPasswordPrompt
// ---------------------------------------------------------------------------

describe("dismissPasswordPrompt", () => {
  it("stamps password_prompt_dismissed_at for a client", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(CLIENT_CLAIMS) as never);
    const updateChain = makeUpdateChain();
    mockAdminFrom.mockReturnValue(updateChain);

    const result = await dismissPasswordPrompt();

    expect(result.error).toBeNull();
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        password_prompt_dismissed_at: expect.any(String),
      })
    );
    expect(updateChain.eq).toHaveBeenCalledWith("id", "client-1");
  });

  it("rejects an unauthenticated caller", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(null) as never);

    const result = await dismissPasswordPrompt();

    expect(result.error).toMatch(/no autorizado/i);
  });
});

// ---------------------------------------------------------------------------
// getPasswordDecision
// ---------------------------------------------------------------------------

describe("getPasswordDecision", () => {
  it("reports not-decided for a fresh client", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(CLIENT_CLAIMS) as never);
    mockAdminFrom.mockReturnValue(
      makeSelectChain({ password_set_at: null, password_prompt_dismissed_at: null })
    );

    const result = await getPasswordDecision();

    expect(result).toEqual({ hasPassword: false, decided: false, error: null });
  });

  it("reports decided + hasPassword once a password is set", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(CLIENT_CLAIMS) as never);
    mockAdminFrom.mockReturnValue(
      makeSelectChain({
        password_set_at: "2026-06-27T00:00:00Z",
        password_prompt_dismissed_at: null,
      })
    );

    const result = await getPasswordDecision();

    expect(result).toEqual({ hasPassword: true, decided: true, error: null });
  });

  it("reports decided but not hasPassword when the prompt was dismissed", async () => {
    mockCreateClient.mockResolvedValue(makeServerClient(CLIENT_CLAIMS) as never);
    mockAdminFrom.mockReturnValue(
      makeSelectChain({
        password_set_at: null,
        password_prompt_dismissed_at: "2026-06-27T00:00:00Z",
      })
    );

    const result = await getPasswordDecision();

    expect(result).toEqual({ hasPassword: false, decided: true, error: null });
  });
});
