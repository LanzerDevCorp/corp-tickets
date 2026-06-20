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

    expect(
      screen.getByRole("link", { name: /iniciar sesión/i })
    ).toBeInTheDocument();
  });

  it("shows /dashboard link for staff role (admin)", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ app_role: "admin", email: "admin@corp.com" }) as never
    );

    const element = await AuthButton();
    render(element);

    const dashboardLink = screen.getByRole("link", { name: /panel/i });
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });

  it("shows /track link for client role", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ app_role: "client", email: "client@corp.com" }) as never
    );

    const element = await AuthButton();
    render(element);

    const trackLink = screen.getByRole("link", { name: /mis tickets/i });
    expect(trackLink).toHaveAttribute("href", "/track");
  });
});
