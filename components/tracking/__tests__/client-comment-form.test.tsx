import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/actions/comments", () => ({
  addComment: vi.fn(),
}));

import ClientCommentForm from "../client-comment-form";
import { addComment } from "@/app/actions/comments";

const mockAddComment = vi.mocked(addComment);

describe("ClientCommentForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts a public comment without CC", async () => {
    const user = userEvent.setup();
    mockAddComment.mockResolvedValue({
      id: "comment-1",
      ticket_id: "ticket-1",
      author_id: "user-1",
      body: "Hello team",
      is_internal: false,
      cc_emails: [],
      created_at: new Date().toISOString(),
      author: { display_name: "Client", email: "client@test.com" },
    });

    const onPosted = vi.fn();

    render(<ClientCommentForm ticketId="ticket-1" onPosted={onPosted} />);

    await user.type(
      screen.getByPlaceholderText(/comparte detalles/i),
      "Hello team",
    );
    await user.click(
      screen.getByRole("button", { name: /publicar comentario/i }),
    );

    await waitFor(() => {
      expect(mockAddComment).toHaveBeenCalledWith({
        ticketId: "ticket-1",
        body: "Hello team",
        is_internal: false,
        cc_emails: [],
      });
    });
    expect(onPosted).toHaveBeenCalled();
  });

  it("parses comma-separated CC emails", async () => {
    const user = userEvent.setup();
    mockAddComment.mockResolvedValue({
      id: "comment-2",
      ticket_id: "ticket-1",
      author_id: "user-1",
      body: "Update",
      is_internal: false,
      cc_emails: ["a@test.com", "b@test.com"],
      created_at: new Date().toISOString(),
      author: null,
    });

    render(<ClientCommentForm ticketId="ticket-1" onPosted={vi.fn()} />);

    await user.type(
      screen.getByPlaceholderText(/comparte detalles/i),
      "Update",
    );
    await user.type(
      screen.getByLabelText(/cc \(opcional/i),
      "a@test.com, b@test.com",
    );
    await user.click(
      screen.getByRole("button", { name: /publicar comentario/i }),
    );

    await waitFor(() => {
      expect(mockAddComment).toHaveBeenCalledWith(
        expect.objectContaining({
          cc_emails: ["a@test.com", "b@test.com"],
          is_internal: false,
        }),
      );
    });
  });

  it("shows error for invalid CC email", async () => {
    const user = userEvent.setup();

    render(<ClientCommentForm ticketId="ticket-1" onPosted={vi.fn()} />);

    await user.type(
      screen.getByPlaceholderText(/comparte detalles/i),
      "Valid body",
    );
    await user.type(screen.getByLabelText(/cc \(opcional/i), "not-an-email");
    await user.click(
      screen.getByRole("button", { name: /publicar comentario/i }),
    );

    expect(
      await screen.findByText(/correo electrónico inválido/i),
    ).toBeInTheDocument();
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it("disables form when disabled prop is true", () => {
    render(
      <ClientCommentForm ticketId="ticket-1" disabled onPosted={vi.fn()} />,
    );

    expect(screen.getByPlaceholderText(/comparte detalles/i)).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /publicar comentario/i }),
    ).toBeDisabled();
  });
});
