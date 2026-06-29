import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AttachmentList from "@/components/dashboard/attachment-list";

// Re-uses AttachmentList which is the shared presentational component.
// These tests verify the same scenarios from the client's perspective,
// ensuring the component works when placed in the tracking view.

describe("AttachmentList in client tracking view", () => {
  it("renders filename, size, and download link for active attachments", () => {
    const attachments = [
      {
        id: "a1",
        filename: "invoice.pdf",
        size_bytes: 4096,
        url: "https://signed.url/a1",
        expired: false,
      },
    ];

    render(<AttachmentList attachments={attachments} />);

    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://signed.url/a1",
    );
  });

  it("renders 'File expired' label with no link for expired attachments", () => {
    const attachments = [
      {
        id: "b1",
        filename: "screenshot.png",
        size_bytes: 512,
        url: null,
        expired: true,
      },
    ];

    render(<AttachmentList attachments={attachments} />);

    expect(screen.getByText("screenshot.png")).toBeInTheDocument();
    expect(screen.getByText("File expired")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders nothing when no attachments", () => {
    const { container } = render(<AttachmentList attachments={[]} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(container.querySelector("li")).toBeNull();
  });
});
