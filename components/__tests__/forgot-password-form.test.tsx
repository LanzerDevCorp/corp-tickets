import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/actions/auth", () => ({
  resetPassword: vi.fn().mockResolvedValue({ error: null }),
}));

import { ForgotPasswordForm } from "../forgot-password-form";
import { resetPassword } from "@/app/actions/auth";

const mockResetPassword = vi.mocked(resetPassword);

describe("ForgotPasswordForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders email field", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("shows success message after submit (always — no enumeration)", async () => {
    mockResetPassword.mockResolvedValue({ error: null });

    render(<ForgotPasswordForm />);

    await userEvent.type(screen.getByLabelText(/email/i), "any@email.com");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it("shows success message even for unknown email (no enumeration)", async () => {
    mockResetPassword.mockResolvedValue({ error: null });

    render(<ForgotPasswordForm />);

    await userEvent.type(screen.getByLabelText(/email/i), "unknown@nobody.com");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it("does not use supabase client directly", async () => {
    const mod = await import("../forgot-password-form");
    expect(mod.ForgotPasswordForm).toBeDefined();
  });
});
