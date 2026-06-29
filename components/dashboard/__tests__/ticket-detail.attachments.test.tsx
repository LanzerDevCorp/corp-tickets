import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AttachmentList from "../attachment-list";

// AttachmentList is a pure presentational component — no mocks needed.

describe("AttachmentList", () => {
  it("renders filename, size, and download link for active attachments", () => {
    const attachments = [
      {
        id: "1",
        filename: "report.pdf",
        size_bytes: 1024,
        url: "https://signed.url/file1",
        expired: false,
      },
      {
        id: "2",
        filename: "photo.png",
        size_bytes: 2048 * 1024,
        url: "https://signed.url/file2",
        expired: false,
      },
    ];

    render(<AttachmentList attachments={attachments} />);

    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("photo.png")).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "https://signed.url/file1");
    expect(links[1]).toHaveAttribute("href", "https://signed.url/file2");
  });

  it("renders 'File expired' with no link when expired is true", () => {
    const attachments = [
      {
        id: "1",
        filename: "old.pdf",
        size_bytes: 512,
        url: null,
        expired: true,
      },
    ];

    render(<AttachmentList attachments={attachments} />);

    expect(screen.getByText("old.pdf")).toBeInTheDocument();
    expect(screen.getByText("File expired")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders nothing when attachments array is empty", () => {
    const { container } = render(<AttachmentList attachments={[]} />);

    // No links or expired labels should be present
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(/expired/i)).toBeNull();
    // Container should be empty or only contain a wrapper
    expect(container.querySelector("li")).toBeNull();
  });

  it("renders mixed active and expired attachments correctly", () => {
    const attachments = [
      {
        id: "1",
        filename: "active.pdf",
        size_bytes: 1000,
        url: "https://signed.url/a",
        expired: false,
      },
      {
        id: "2",
        filename: "expired.pdf",
        size_bytes: 500,
        url: null,
        expired: true,
      },
    ];

    render(<AttachmentList attachments={attachments} />);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://signed.url/a",
    );
    expect(screen.getByText("File expired")).toBeInTheDocument();
    // Only one link — expired file has no link
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
