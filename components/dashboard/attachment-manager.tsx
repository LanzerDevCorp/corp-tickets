"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  type AttachmentItem,
  createStaffUploadUrls,
  registerStaffAttachments,
  softDeleteAttachment,
  restoreAttachment,
  getTicketAttachments,
} from "@/app/actions/attachments";
import {
  ATTACHMENT_BUCKET,
  ALLOWED_MIME,
  MAX_FILES,
  MAX_TOTAL_BYTES,
} from "@/lib/storage/attachments";

interface AttachmentManagerProps {
  ticketId: string;
  initialAttachments: AttachmentItem[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateSelectedFiles(files: File[]): string | null {
  if (files.length === 0) {
    return "Selecciona al menos un archivo.";
  }
  if (files.length > MAX_FILES) {
    return `Máximo ${MAX_FILES} archivos por carga.`;
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return "El tamaño total supera el límite de 50 MiB.";
  }

  const allowedSet = new Set<string>(ALLOWED_MIME);
  for (const file of files) {
    if (!allowedSet.has(file.type)) {
      return `Tipo de archivo no permitido: ${file.name}`;
    }
  }

  return null;
}

export default function AttachmentManager({
  ticketId,
  initialAttachments,
}: AttachmentManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshAttachments = async () => {
    const next = await getTicketAttachments(ticketId);
    setAttachments(next);
  };

  const handleUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const selected = Array.from(files);
    const validationError = validateSelectedFiles(selected);
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    startTransition(async () => {
      setErrorMsg(null);

      try {
        const fileMetas = selected.map((file) => ({
          filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        }));

        const { error, urls } = await createStaffUploadUrls(ticketId, fileMetas);
        if (error || !urls) {
          setErrorMsg(error ?? "No se pudieron preparar las cargas.");
          return;
        }

        const supabase = createClient();
        const registered: Array<{
          storage_path: string;
          filename: string;
          mime_type: string;
          size_bytes: number;
        }> = [];

        for (let i = 0; i < urls.length; i++) {
          const uploadSpec = urls[i]!;
          const file = selected[i]!;

          const { error: uploadError } = await supabase.storage
            .from(ATTACHMENT_BUCKET)
            .uploadToSignedUrl(uploadSpec.path, uploadSpec.token, file);

          if (uploadError) {
            setErrorMsg("No se pudo subir uno o más archivos. Inténtalo de nuevo.");
            return;
          }

          registered.push({
            storage_path: uploadSpec.path,
            filename: uploadSpec.filename,
            mime_type: uploadSpec.mime_type,
            size_bytes: uploadSpec.size_bytes,
          });
        }

        const registerResult = await registerStaffAttachments(ticketId, registered);
        if (registerResult.error) {
          setErrorMsg(registerResult.error);
          return;
        }

        await refreshAttachments();
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      } catch {
        setErrorMsg("Ocurrió un error al subir los archivos.");
      }
    });
  };

  const handleDelete = (attachmentId: string) => {
    startTransition(async () => {
      setErrorMsg(null);
      const result = await softDeleteAttachment(attachmentId);
      if (result.error) {
        setErrorMsg(result.error);
        return;
      }
      await refreshAttachments();
    });
  };

  const handleRestore = (attachmentId: string) => {
    startTransition(async () => {
      setErrorMsg(null);
      const result = await restoreAttachment(attachmentId);
      if (result.error) {
        setErrorMsg(result.error);
        return;
      }
      await refreshAttachments();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_MIME.join(",")}
          className="sr-only"
          aria-label="Seleccionar archivos adjuntos"
          onChange={(event) => handleUpload(event.target.files)}
          disabled={isPending}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Subir archivos
        </Button>
        <span className="text-xs text-muted-foreground">
          Hasta {MAX_FILES} archivos · 50 MiB en total
        </span>
      </div>

      {errorMsg && (
        <p className="text-sm text-rose-500" role="alert">
          {errorMsg}
        </p>
      )}

      {attachments.length > 0 ? (
        <ul className="space-y-1.5">
          {attachments.map((att) => {
            const isGreyed = att.expired || att.removedByAdmin;

            return (
              <li
                key={att.id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                  isGreyed
                    ? "border-zinc-200/60 bg-zinc-100/80 text-zinc-400 dark:border-zinc-800/60 dark:bg-zinc-900/30"
                    : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span
                    className={`truncate font-medium ${
                      isGreyed
                        ? "text-zinc-400 line-through dark:text-zinc-500"
                        : "text-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    {att.filename}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(att.size_bytes)}
                  </span>
                </div>

                <div className="ml-2 flex shrink-0 items-center gap-2">
                  {att.removedByAdmin ? (
                    <>
                      <span className="text-xs italic text-muted-foreground">
                        Eliminado
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={isPending}
                        onClick={() => handleRestore(att.id)}
                      >
                        Restaurar
                      </Button>
                    </>
                  ) : att.expired ? (
                    <span className="text-xs italic text-muted-foreground">
                      Archivo expirado
                    </span>
                  ) : att.url ? (
                    <>
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={att.filename}
                        className="text-xs font-medium text-[#1C2438] hover:underline dark:text-zinc-300"
                      >
                        Descargar
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
                        disabled={isPending}
                        onClick={() => handleDelete(att.id)}
                      >
                        Eliminar
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aún no hay archivos adjuntos en este ticket.
        </p>
      )}
    </div>
  );
}
