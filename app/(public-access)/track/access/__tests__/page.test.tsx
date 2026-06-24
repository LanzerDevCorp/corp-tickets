import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/actions/client-provision", () => ({
  requestMagicLink: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { auth: { admin: {} } },
}));

import TrackAccessPage from "../page";

describe("TrackAccessPage", () => {
  it("shows neutral copy when no error_code", async () => {
    const searchParams = Promise.resolve({});
    const element = await TrackAccessPage({ searchParams });
    render(element);

    expect(screen.getByText(/consultar tu ticket/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/tu sesión expiró/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/enlace expirado/i)
    ).not.toBeInTheDocument();
  });

  it("shows session_expired copy when error_code=session_expired", async () => {
    const searchParams = Promise.resolve({ error_code: "session_expired" });
    const element = await TrackAccessPage({ searchParams });
    render(element);

    expect(screen.getByText(/continuar seguimiento/i)).toBeInTheDocument();
    expect(screen.getByText(/tu sesión expiró/i)).toBeInTheDocument();
  });

  it("shows otp_expired copy when error_code=otp_expired", async () => {
    const searchParams = Promise.resolve({ error_code: "otp_expired" });
    const element = await TrackAccessPage({ searchParams });
    render(element);

    expect(screen.getByText(/enlace expirado/i)).toBeInTheDocument();
  });

  it("pre-fills ref and email when provided", async () => {
    const searchParams = Promise.resolve({
      ref: "6087BB67",
      email: "test@example.com",
    });
    const element = await TrackAccessPage({ searchParams });
    render(element);

    expect(screen.getByDisplayValue("6087BB67")).toBeInTheDocument();
    expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
  });
});
