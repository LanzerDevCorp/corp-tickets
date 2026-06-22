"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ALLOWED_MIME,
  MAX_FILES,
  MAX_TOTAL_BYTES,
} from "@/lib/storage/attachments";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateFiles(
  incoming: File[],
  existing: File[]
): { valid: File[]; error: string | null } {
  const allowedSet = new Set<string>(ALLOWED_MIME);

  for (const file of incoming) {
    if (!allowedSet.has(file.type)) {
      return {
        valid: [],
        error: `File type not allowed: "${file.type}". Accepted formats: PDF, JPEG, PNG, WebP, ZIP.`,
      };
    }
  }

  const combinedCount = existing.length + incoming.length;
  if (combinedCount > MAX_FILES) {
    return {
      valid: [],
      error: `You can attach a maximum of ${MAX_FILES} files per ticket.`,
    };
  }

  const existingBytes = existing.reduce((sum, f) => sum + f.size, 0);
  const incomingBytes = incoming.reduce((sum, f) => sum + f.size, 0);
  if (existingBytes + incomingBytes > MAX_TOTAL_BYTES) {
    return {
      valid: [],
      error: `Total file size exceeds the 50 MB limit.`,
    };
  }

  return { valid: incoming, error: null };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FileUploadZoneProps {
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

export function FileUploadZone({
  selectedFiles,
  onFilesChange,
  disabled = false,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const totalBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const progressPercent = Math.min((totalBytes / MAX_TOTAL_BYTES) * 100, 100);

  function handleFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    const files = Array.from(incoming);
    const { valid, error } = validateFiles(files, selectedFiles);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    onFilesChange([...selectedFiles, ...valid]);
  }

  function removeFile(index: number) {
    const updated = selectedFiles.filter((_, i) => i !== index);
    onFilesChange(updated);
    setValidationError(null);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
          isDragging
            ? "border-[#1C2438] bg-[#1C2438]/5"
            : "border-border hover:border-[#1C2438]/40",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <p className="text-sm text-muted-foreground">
          Arrastra los archivos aquí o{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="font-medium text-[#1C2438] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Choose files to attach"
          >
            elige los archivos
          </button>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, JPEG, PNG, WebP, ZIP — hasta {MAX_FILES} archivos, 50 MB total
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_MIME.join(",")}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
          aria-label="File upload input"
        />
      </div>

      {/* Validation error */}
      {validationError && (
        <p role="alert" className="text-sm text-destructive">
          {validationError}
        </p>
      )}

      {/* File list */}
      {selectedFiles.length > 0 && (
        <ul className="space-y-1.5">
          {selectedFiles.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate font-medium">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(file.size)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                disabled={disabled}
                className="ml-2 shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
                aria-label={`Remove ${file.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Total size progress bar */}
      {selectedFiles.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatBytes(totalBytes)} used</span>
            <span>50 MB limit</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(progressPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progressPercent >= 90 ? "bg-destructive" : "bg-[#1C2438]"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
