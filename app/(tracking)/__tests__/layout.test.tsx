import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import TrackingLayout from "../layout";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const mockCreateClient = vi.mocked(createClient);
const mockRedirect = vi.mocked(redirect);

describe("TrackingLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to auth error", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null } }),
      },
    } as never);

    await expect(
      TrackingLayout({ children: <div>child</div> })
    ).rejects.toThrow("REDIRECT:/auth/error?error_code=otp_expired");
  });

  it("redirects staff users to dashboard", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { role: "it", sub: "staff-1" } },
        }),
      },
    } as never);

    await expect(
      TrackingLayout({ children: <div>child</div> })
    ).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("renders children for authenticated client users", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { role: "client", sub: "client-1" } },
        }),
      },
    } as never);

    const result = await TrackingLayout({
      children: <div data-testid="tracking-child">content</div>,
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});
