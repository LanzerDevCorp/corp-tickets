import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/components/tracking/track-session-bootstrap", () => ({
  TrackSessionBootstrap: ({
    children,
    hasServerSession,
  }: {
    children: React.ReactNode;
    hasServerSession: boolean;
  }) => (
    <div data-testid="session-bootstrap" data-has-session={hasServerSession}>
      {children}
    </div>
  ),
}));

vi.mock("@/lib/auth/session-email", () => ({
  getAuthenticatedEmail: vi.fn().mockResolvedValue("client@example.com"),
}));

vi.mock("@/components/tracking/client-account-menu", () => ({
  ClientAccountMenu: ({ email }: { email?: string }) => (
    <div data-testid="account-menu">{email}</div>
  ),
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

  it("renders bootstrap without redirect when unauthenticated (hash fallback)", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null } }),
      },
    } as never);

    const result = await TrackingLayout({ children: <div>child</div> });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });

  it("redirects staff users to dashboard", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { app_role: "it", sub: "staff-1" } },
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
          data: { claims: { app_role: "client", sub: "client-1", email: "client@example.com" } },
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
