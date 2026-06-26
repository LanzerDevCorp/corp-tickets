import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/actions/client-password", () => ({
  setClientPassword: vi.fn(),
  dismissPasswordPrompt: vi.fn(),
}));

import { SetPasswordForm } from "../set-password-form";
import {
  setClientPassword,
  dismissPasswordPrompt,
} from "@/app/actions/client-password";

const mockSet = vi.mocked(setClientPassword);
const mockDismiss = vi.mocked(dismissPasswordPrompt);

describe("SetPasswordForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a password and navigates to next on success", async () => {
    mockSet.mockResolvedValue({ error: null });
    render(<SetPasswordForm next="/track/abc" />);

    await userEvent.type(
      screen.getByLabelText(/contraseña/i),
      "a-strong-password"
    );
    await userEvent.click(
      screen.getByRole("button", { name: /crear contraseña/i })
    );

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith("a-strong-password");
      expect(mockPush).toHaveBeenCalledWith("/track/abc");
    });
  });

  it("shows the action error and does not navigate", async () => {
    mockSet.mockResolvedValue({
      error: "La contraseña debe tener al menos 8 caracteres.",
    });
    render(<SetPasswordForm />);

    await userEvent.type(screen.getByLabelText(/contraseña/i), "short");
    await userEvent.click(
      screen.getByRole("button", { name: /crear contraseña/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/al menos 8/i)).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("skips via dismiss and navigates to the default destination", async () => {
    mockDismiss.mockResolvedValue({ error: null });
    render(<SetPasswordForm />);

    await userEvent.click(screen.getByRole("button", { name: /omitir/i }));

    await waitFor(() => {
      expect(mockDismiss).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/track");
    });
  });

  it("hides the skip option when the client already has a password", () => {
    render(<SetPasswordForm hasPassword />);

    expect(
      screen.queryByRole("button", { name: /omitir/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /guardar contraseña/i })
    ).toBeInTheDocument();
  });
});
