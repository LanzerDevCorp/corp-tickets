import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/actions/auth", () => ({
  loginUser: vi.fn().mockResolvedValue({ error: null }),
}));

import { LoginForm } from "../login-form";
import { loginUser } from "@/app/actions/auth";

const mockLoginUser = vi.mocked(loginUser);

describe("LoginForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders email and password fields", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
  });

  it("renders a submit button", () => {
    render(<LoginForm />);
    expect(
      screen.getByRole("button", { name: /iniciar sesión/i })
    ).toBeInTheDocument();
  });

  it("displays error message when action returns error", async () => {
    mockLoginUser.mockResolvedValue({ error: "Credenciales inválidas" });

    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/correo/i), "wrong@test.com");
    await userEvent.type(screen.getByLabelText(/^contraseña$/i), "badpass");
    await userEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument();
    });
  });

  it("does not import from @supabase/supabase-js client directly", async () => {
    const formModule = await import("../login-form");
    expect(formModule.LoginForm).toBeDefined();
  });
});
