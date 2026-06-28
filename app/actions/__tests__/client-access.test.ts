import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/auth/client-session", () => ({
  ensureClientUser: vi.fn(),
  establishClientSession: vi.fn(),
}));

import { accessTicketWithReference } from "../client-access";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ensureClientUser,
  establishClientSession,
} from "@/lib/auth/client-session";

const mockFrom = vi.mocked(supabaseAdmin.from);
const mockCreateClient = vi.mocked(createClient);
const mockEnsureClientUser = vi.mocked(ensureClientUser);
const mockEstablishClientSession = vi.mocked(establishClientSession);

describe("accessTicketWithReference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://corp-tickets.test";
    mockCreateClient.mockResolvedValue({ auth: {} } as never);
  });

  it("redirects to track page when email and reference match", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "6087bb67-a0e1-4bca-86d9-568137c7e38f",
            email: "client@test.com",
            created_at: "2026-01-01",
          },
        ],
        error: null,
      }),
    } as never);
    mockEnsureClientUser.mockResolvedValue({ userId: "user-1", error: null });
    mockEstablishClientSession.mockResolvedValue(null);

    await expect(
      accessTicketWithReference("client@test.com", "6087BB67"),
    ).rejects.toThrow("REDIRECT:/track/6087bb67-a0e1-4bca-86d9-568137c7e38f");
  });

  it("returns error when ticket is not found", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as never);

    const result = await accessTicketWithReference(
      "client@test.com",
      "6087BB67",
    );

    expect(result.error).toMatch(/no encontramos/i);
  });

  it("returns validation error for invalid reference", async () => {
    const result = await accessTicketWithReference("client@test.com", "abc");

    expect(result.error).toMatch(/número de ticket/i);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
