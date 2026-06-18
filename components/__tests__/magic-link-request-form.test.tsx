import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/actions/client-provision", () => ({
  requestMagicLink: vi.fn().mockResolvedValue({ error: null }),
}));

import { MagicLinkRequestForm } from "../magic-link-request-form";
import { requestMagicLink } from "@/app/actions/client-provision";

const mockRequestMagicLink = vi.mocked(requestMagicLink);

describe("MagicLinkRequestForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders email field", () => {
    render(<MagicLinkRequestForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("pre-fills email from defaultEmail prop", () => {
    render(<MagicLinkRequestForm defaultEmail="pre@filled.com" />);
    expect(screen.getByLabelText(/email/i)).toHaveValue("pre@filled.com");
  });

  it("calls requestMagicLink on submit", async () => {
    render(<MagicLinkRequestForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "client@test.com");
    await userEvent.click(screen.getByRole("button", { name: /request/i }));

    await waitFor(() => {
      expect(mockRequestMagicLink).toHaveBeenCalled();
    });
  });

  it("shows success message after successful submit", async () => {
    mockRequestMagicLink.mockResolvedValue({ error: null });

    render(<MagicLinkRequestForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "client@test.com");
    await userEvent.click(screen.getByRole("button", { name: /request/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it("shows error message when action returns error", async () => {
    mockRequestMagicLink.mockResolvedValue({ error: "Rate limit exceeded" });

    render(<MagicLinkRequestForm />);
    await userEvent.type(screen.getByLabelText(/email/i), "client@test.com");
    await userEvent.click(screen.getByRole("button", { name: /request/i }));

    await waitFor(() => {
      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
    });
  });
});
