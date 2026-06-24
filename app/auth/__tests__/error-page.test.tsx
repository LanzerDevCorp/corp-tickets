import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/app/actions/client-provision", () => ({
  requestMagicLink: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { auth: { admin: {} } },
}));

import Page from "../error/page";

describe("auth/error page", () => {
  it("redirects to /track/access for otp_expired error code", async () => {
    const searchParams = Promise.resolve({ error_code: "otp_expired", error: "" });
    await expect(Page({ searchParams })).rejects.toThrow(
      "REDIRECT:/track/access?error_code=otp_expired"
    );
  });

  it("redirects to /track/access for session_expired error code", async () => {
    const searchParams = Promise.resolve({ error_code: "session_expired", error: "" });
    await expect(Page({ searchParams })).rejects.toThrow(
      "REDIRECT:/track/access?error_code=session_expired"
    );
  });

  it("preserves ref and email params when redirecting", async () => {
    const searchParams = Promise.resolve({
      error_code: "session_expired",
      ref: "6087BB67",
      email: "a@b.com",
    });
    await expect(Page({ searchParams })).rejects.toThrow(
      "REDIRECT:/track/access?error_code=session_expired&ref=6087BB67&email=a%40b.com"
    );
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
