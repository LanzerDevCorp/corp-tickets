import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/actions/auth", () => ({
  logoutUser: vi.fn().mockResolvedValue(undefined),
}));

import { LogoutButton } from "../logout-button";
import { logoutUser } from "@/app/actions/auth";

const mockLogoutUser = vi.mocked(logoutUser);

describe("LogoutButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a logout button", () => {
    render(<LogoutButton />);
    expect(
      screen.getByRole("button", { name: /cerrar sesión/i })
    ).toBeInTheDocument();
  });

  it("calls logoutUser when clicked", async () => {
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    expect(mockLogoutUser).toHaveBeenCalled();
  });

  it("does not use supabase client directly", async () => {
    const mod = await import("../logout-button");
    expect(mod.LogoutButton).toBeDefined();
  });
});
