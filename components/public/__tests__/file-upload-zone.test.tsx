import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileUploadZone, validateFiles } from "../file-upload-zone";
import { MAX_FILES, MAX_TOTAL_BYTES } from "@/lib/storage/attachments";

// Helper to create a mock File with controllable size
function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

const PDF = makeFile("report.pdf", "application/pdf", 1024);
const PNG = makeFile("photo.png", "image/png", 2048);
const EXE = makeFile("evil.exe", "application/octet-stream", 512);
const MB_20 = makeFile("medium.pdf", "application/pdf", 20 * 1024 * 1024);
const MB_30 = makeFile("large.pdf", "application/pdf", 30 * 1024 * 1024);

// ---------------------------------------------------------------------------
// validateFiles — pure function tests (no component rendering)
// ---------------------------------------------------------------------------

describe("validateFiles (pure logic)", () => {
  it("returns error when incoming file has disallowed MIME type", () => {
    const { valid, error } = validateFiles([EXE], []);
    expect(error).not.toBeNull();
    expect(error).toMatch(/type|mime|format/i);
    expect(valid).toHaveLength(0);
  });

  it("returns error when combined count exceeds MAX_FILES", () => {
    const five = Array.from({ length: MAX_FILES }, (_, i) =>
      makeFile(`f${i}.pdf`, "application/pdf", 100)
    );
    const { valid, error } = validateFiles([PDF], five);
    expect(error).not.toBeNull();
    expect(error).toMatch(new RegExp(String(MAX_FILES)));
    expect(valid).toHaveLength(0);
  });

  it("returns error when total bytes would exceed MAX_TOTAL_BYTES", () => {
    // 30 MB + 30 MB = 60 MB > 50 MiB
    const { valid, error } = validateFiles([MB_30], [MB_30]);
    expect(error).not.toBeNull();
    expect(error).toMatch(/50|size|limit/i);
    expect(valid).toHaveLength(0);
  });

  it("returns valid files when all constraints are satisfied", () => {
    const { valid, error } = validateFiles([PDF, PNG], []);
    expect(error).toBeNull();
    expect(valid).toHaveLength(2);
  });

  it("accepts a file that exactly hits the MAX_TOTAL_BYTES boundary (not exceeded)", () => {
    // 20 MB + 30 MB = 50 MiB exactly — should be accepted (spec says "exceeds")
    const { valid, error } = validateFiles([MB_30], [MB_20]);
    expect(error).toBeNull();
    expect(valid).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// FileUploadZone component tests
// ---------------------------------------------------------------------------

describe("FileUploadZone", () => {
  it("renders the drag-drop zone and a file input", () => {
    const onFilesChange = vi.fn();
    render(<FileUploadZone selectedFiles={[]} onFilesChange={onFilesChange} />);

    expect(screen.getByRole("button", { name: /choose files/i })).toBeInTheDocument();
    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
  });

  it("rejects a disallowed file type via drag-and-drop and shows error alert", () => {
    const onFilesChange = vi.fn();
    render(<FileUploadZone selectedFiles={[]} onFilesChange={onFilesChange} />);

    const dropZone = screen.getByRole("button", { name: /choose files/i }).closest("div")!;

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [EXE],
        types: ["Files"],
      },
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/type|mime|format/i);
    expect(onFilesChange).not.toHaveBeenCalled();
  });

  it("shows count-limit error when 5 files are selected and a 6th is dropped", () => {
    const existing5 = Array.from({ length: 5 }, (_, i) =>
      makeFile(`file${i}.pdf`, "application/pdf", 100)
    );
    const onFilesChange = vi.fn();
    render(<FileUploadZone selectedFiles={existing5} onFilesChange={onFilesChange} />);

    const dropZone = screen.getByRole("button", { name: /choose files/i }).closest("div")!;
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [PDF],
        types: ["Files"],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/5|limit/i);
    expect(onFilesChange).not.toHaveBeenCalled();
  });

  it("shows size error when dropped file pushes total over 50 MiB", () => {
    const onFilesChange = vi.fn();
    render(<FileUploadZone selectedFiles={[MB_30]} onFilesChange={onFilesChange} />);

    const dropZone = screen.getByRole("button", { name: /choose files/i }).closest("div")!;
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [MB_30],
        types: ["Files"],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/50|size|limit/i);
    expect(onFilesChange).not.toHaveBeenCalled();
  });

  it("shows filename and size for each selected file", () => {
    const onFilesChange = vi.fn();
    render(<FileUploadZone selectedFiles={[PDF, PNG]} onFilesChange={onFilesChange} />);

    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("photo.png")).toBeInTheDocument();
    expect(screen.getAllByText(/KB|MB|bytes/i).length).toBeGreaterThan(0);
  });

  it("renders a remove button for each selected file", () => {
    const onFilesChange = vi.fn();
    render(<FileUploadZone selectedFiles={[PDF, PNG]} onFilesChange={onFilesChange} />);

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    expect(removeButtons).toHaveLength(2);
  });

  it("calls onFilesChange without the removed file when remove is clicked", async () => {
    const onFilesChange = vi.fn();
    render(<FileUploadZone selectedFiles={[PDF, PNG]} onFilesChange={onFilesChange} />);

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    await userEvent.click(removeButtons[0]); // remove first file (PDF)

    expect(onFilesChange).toHaveBeenCalledWith([PNG]);
  });

  it("renders a total-size progress bar reflecting selected bytes vs 50 MiB", () => {
    const onFilesChange = vi.fn();
    render(<FileUploadZone selectedFiles={[PDF, PNG]} onFilesChange={onFilesChange} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(progressBar).toHaveAttribute("aria-valuemax", "100");
  });
});
