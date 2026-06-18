import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/actions/auth", () => ({
  logoutUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { auth: { admin: {} } },
}));

import { AuthButton } from "../auth-button";
import { createClient } from "@/lib/supabase/server";

const mockCreateClient = vi.mocked(createClient);

function makeSupabaseMock(claims: Record<string, unknown> | null) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: claims ? { claims } : { claims: null },
      }),
    },
  };
}

describe("AuthButton", () => {
  it("shows login link when unauthenticated", async () => {
    mockCreateClient.mockResolvedValue(makeSupabaseMock(null) as never);

    const element = await AuthButton();
    render(element);

    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows /dashboard link for staff role (admin)", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ role: "admin", email: "admin@corp.com" }) as never
    );

    const element = await AuthButton();
    render(element);

    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });

  it("shows /track link for client role", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ role: "client", email: "client@corp.com" }) as never
    );

    const element = await AuthButton();
    render(element);

    // Client link points to /track (label is "My tickets")
    const trackLink = screen.getByRole("link", { name: /my tickets/i });
    expect(trackLink).toHaveAttribute("href", "/track");
  });
});
