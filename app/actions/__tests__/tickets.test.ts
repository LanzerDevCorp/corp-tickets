import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/actions/client-provision", () => ({
  provisionClient: vi.fn().mockResolvedValue({
    userId: "user-123",
    alreadyExisted: false,
    error: null,
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { submitTicket } from "../tickets";
import { provisionClient } from "@/app/actions/client-provision";
import { createClient } from "@/lib/supabase/server";

const mockProvisionClient = vi.mocked(provisionClient);
const mockCreateClient = vi.mocked(createClient);

function makeInsertMock(insertResult: { data: { id: string } | null; error: null | { message: string } }) {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(insertResult),
        }),
      }),
    }),
  };
}

describe("submitTicket", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls provisionClient with correct email and ticketId after successful insert", async () => {
    mockCreateClient.mockResolvedValue(
      makeInsertMock({ data: { id: "ticket-abc" }, error: null }) as never
    );

    const formData = new FormData();
    formData.set("email", "client@test.com");
    formData.set("subject", "Help me");
    formData.set("description", "Details here");

    await submitTicket({ error: null }, formData);

    expect(mockProvisionClient).toHaveBeenCalledWith("client@test.com", "ticket-abc");
  });

  it("returns success even if provisionClient fails", async () => {
    mockCreateClient.mockResolvedValue(
      makeInsertMock({ data: { id: "ticket-xyz" }, error: null }) as never
    );
    mockProvisionClient.mockResolvedValue({
      userId: null,
      alreadyExisted: false,
      error: "Supabase quota exceeded",
    });

    const formData = new FormData();
    formData.set("email", "client2@test.com");
    formData.set("subject", "Another ticket");
    formData.set("description", "Details");

    const result = await submitTicket({ error: null }, formData);

    expect(result.error).toBeNull();
    expect(result.ticketId).toBe("ticket-xyz");
  });

  it("returns error when DB insert fails", async () => {
    mockCreateClient.mockResolvedValue(
      makeInsertMock({ data: null, error: { message: "DB error" } }) as never
    );

    const formData = new FormData();
    formData.set("email", "fail@test.com");
    formData.set("subject", "Failing ticket");
    formData.set("description", "Fail");

    const result = await submitTicket({ error: null }, formData);

    expect(result.error).toBe("DB error");
    expect(mockProvisionClient).not.toHaveBeenCalled();
  });
});
