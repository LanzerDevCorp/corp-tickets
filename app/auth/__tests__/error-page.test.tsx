import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/actions/client-provision", () => ({
  requestMagicLink: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { auth: { admin: {} } },
}));

// Import the page as a default — it's an async server component
import Page from "../error/page";

describe("auth/error page", () => {
  it("renders MagicLinkRequestForm for otp_expired error code", async () => {
    const searchParams = Promise.resolve({ error_code: "otp_expired", error: "" });
    const element = await Page({ searchParams });
    render(element);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request/i })).toBeInTheDocument();
  });

  it("renders generic error message for other error codes", async () => {
    const searchParams = Promise.resolve({ error_code: "unknown", error: "Something failed" });
    const element = await Page({ searchParams });
    render(element);

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("renders generic message when no error_code is present", async () => {
    const searchParams = Promise.resolve({ error_code: "", error: "" });
    const element = await Page({ searchParams });
    render(element);

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
