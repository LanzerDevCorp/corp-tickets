import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/actions/client-provision", () => ({
  requestMagicLink: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { auth: { admin: {} } },
}));

import Page from "../error/page";

describe("auth/error page", () => {
  it("renders track access panel for otp_expired error code", async () => {
    const searchParams = Promise.resolve({ error_code: "otp_expired", error: "" });
    const element = await Page({ searchParams });
    render(element);

    expect(screen.getByLabelText(/^correo electrónico$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/número de ticket/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar al ticket/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /prefieres un enlace por correo/i })
    ).toBeInTheDocument();
  });

  it("renders generic error message for other error codes", async () => {
    const searchParams = Promise.resolve({ error_code: "unknown", error: "Something failed" });
    const element = await Page({ searchParams });
    render(element);

    expect(screen.getByText(/algo salió mal/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/correo/i)).not.toBeInTheDocument();
  });

  it("renders generic message when no error_code is present", async () => {
    const searchParams = Promise.resolve({ error_code: "", error: "" });
    const element = await Page({ searchParams });
    render(element);

    expect(screen.getByText(/algo salió mal/i)).toBeInTheDocument();
  });
});
