import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/actions/client-tickets", () => ({
  getClientTickets: vi.fn(),
}));

vi.mock("@/components/tracking/client-ticket-list", () => ({
  default: ({ tickets }: { tickets: unknown[] }) => (
    <div data-testid="ticket-list" data-count={tickets.length} />
  ),
}));

import TrackIndexPage from "../page";
import { createClient } from "@/lib/supabase/server";
import { getClientTickets } from "@/app/actions/client-tickets";

const mockCreateClient = vi.mocked(createClient);
const mockGetClientTickets = vi.mocked(getClientTickets);

describe("TrackIndexPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated visitors to /portal", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null } }),
      },
    } as never);

    await expect(TrackIndexPage()).rejects.toThrow("REDIRECT:/portal");
    expect(mockGetClientTickets).not.toHaveBeenCalled();
  });

  it("renders ticket list for authenticated clients", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "client-1", app_role: "client" } },
        }),
      },
    } as never);
    mockGetClientTickets.mockResolvedValue([
      {
        id: "t1",
        subject: "Test",
        status: "open",
        created_at: "2026-06-01T10:00:00Z",
        hasNewActivity: false,
      },
    ]);

    const result = await TrackIndexPage();
    expect(result).toBeTruthy();
    expect(mockGetClientTickets).toHaveBeenCalled();
  });
});
