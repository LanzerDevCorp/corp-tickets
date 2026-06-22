"use client";

import { useRef, useState, useActionState, startTransition, useCallback } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ticketSubmitSchema,
  type TicketSubmitData,
  PRIORITY_LABELS,
} from "@/lib/schemas/ticket-submit";
import {
  submitTicket,
  type TicketSubmitResult,
} from "@/app/actions/tickets";
import { isTurnstileEnabled } from "@/lib/turnstile/config";
import { SubmitSuccess } from "./submit-success";
import { FileUploadZone } from "./file-upload-zone";
import { orchestrateFileUpload } from "./upload-orchestration";

const INITIAL_STATE: TicketSubmitResult = { error: "no-submit" as unknown as string } as unknown as TicketSubmitResult;

const PRIORITY_STYLES: Record<
  "low" | "medium" | "high" | "urgent",
  { base: string; active: string }
> = {
  low: {
    base: "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
    active: "border-slate-700 bg-slate-700 text-white",
  },
  medium: {
    base: "border-border text-muted-foreground hover:border-blue-400 hover:text-blue-600",
    active: "border-blue-600 bg-blue-600 text-white",
  },
  high: {
    base: "border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600",
    active: "border-amber-500 bg-amber-500 text-white",
  },
  urgent: {
    base: "border-border text-muted-foreground hover:border-red-400 hover:text-red-600",
    active: "border-red-600 bg-red-600 text-white",
  },
};

type Category = { id: string; name: string };

interface PublicTicketFormProps {
  categories: Category[];
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const turnstileOn = isTurnstileEnabled();

export function PublicTicketForm({ categories }: PublicTicketFormProps) {
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [turnstileError, setTurnstileError] = useState(false);

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [canRetryWithoutFiles, setCanRetryWithoutFiles] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successTicketId, setSuccessTicketId] = useState<string | null>(null);

  const [actionState, formAction, isPending] = useActionState(
    submitTicket,
    null as unknown as TicketSubmitResult
  );

  const form = useForm<TicketSubmitData>({
    resolver: standardSchemaResolver(ticketSubmitSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      body: "",
      priority: "medium",
      category_id: "",
    },
  });

  // Phase 1 success + files → enter upload phase
  const isPhase1Success = actionState && actionState.error === null && "ticketId" in actionState;

  const isSuccess = isPhase1Success && (selectedFiles.length === 0 || uploadSuccess);

  // Trigger file upload phases after ticket is created
  // We use useCallback to avoid stale closure issues
  const handleFileUploadPhase = useCallback(
    async (ticketId: string) => {
      if (selectedFiles.length === 0) {
        setUploadSuccess(true);
        return;
      }

      setIsUploading(true);
      setUploadError(null);

      const result = await orchestrateFileUpload(ticketId, selectedFiles);

      setIsUploading(false);

      if (result.error) {
        setUploadError(result.error);
        setCanRetryWithoutFiles(result.canRetryWithoutFiles);
      } else {
        setUploadSuccess(true);
      }
    },
    [selectedFiles]
  );

  // When phase 1 succeeds and files are pending, run upload orchestration
  if (isPhase1Success && selectedFiles.length > 0 && !uploadSuccess && !uploadError && !isUploading) {
    handleFileUploadPhase((actionState as { error: null; ticketId: string }).ticketId);
  }

  if (isSuccess) {
    const ticketId =
      successTicketId ??
      (actionState && actionState.error === null && "ticketId" in actionState
        ? (actionState as { error: null; ticketId: string }).ticketId
        : "");
    return <SubmitSuccess ticketId={ticketId} />;
  }

  if (isUploading) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-border shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground animate-pulse">Uploading files...</p>
        </div>
      </div>
    );
  }

  const isTurnstileReady =
    turnstileOn ? turnstileToken.length > 0 && !turnstileError : true;
  const isFormValid = form.formState.isValid && isTurnstileReady;

  async function handleSubmit(data: TicketSubmitData) {
    if (turnstileOn && !turnstileToken) {
      setTurnstileError(true);
      return;
    }

    const fd = new FormData();
    fd.set("name", data.name);
    fd.set("email", data.email);
    fd.set("subject", data.subject);
    fd.set("body", data.body);
    fd.set("priority", data.priority);
    fd.set("category_id", data.category_id);
    if (turnstileOn) {
      fd.set("turnstile_token", turnstileToken);
    }

    startTransition(() => {
      formAction(fd);
    });
  }

  const serverError =
    actionState &&
    "error" in actionState &&
    typeof actionState.error === "string" &&
    actionState.error
      ? actionState.error
      : null;

  const isTurnstileServerError =
    turnstileOn &&
    actionState &&
    "code" in actionState &&
    actionState.code === "turnstile";

  if (isTurnstileServerError && turnstileRef.current) {
    turnstileRef.current.reset();
    setTurnstileToken("");
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Signature element: left navy accent border on the form card */}
      <div className="bg-white rounded-xl border border-border border-l-4 border-l-[#1C2438] shadow-sm">
        <div className="px-8 pt-8 pb-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[#1C2438]">
            Enviar ticket de soporte
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Recibe atención de nuestro equipo de TI. Todos los campos son
            obligatorios.
          </p>
        </div>

        <div className="px-8 pb-8 pt-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-5"
            >
              {/* Name + Email row */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Tu nombre completo"
                          disabled={isPending}
                          autoComplete="name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo electrónico</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="tu@correo.com"
                          disabled={isPending}
                          autoComplete="email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Subject */}
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asunto</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Resume tu problema en una línea"
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category + Priority row */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isPending}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecciona una categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Priority — horizontal toggle (design signature) */}
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridad</FormLabel>
                      <div className="flex gap-1.5" role="group" aria-label="Prioridad">
                        {(
                          ["low", "medium", "high", "urgent"] as const
                        ).map((p) => {
                          const isActive = field.value === p;
                          const styles = PRIORITY_STYLES[p];
                          return (
                            <button
                              key={p}
                              type="button"
                              role="radio"
                              aria-checked={isActive}
                              disabled={isPending}
                              onClick={() => field.onChange(p)}
                              className={cn(
                                "flex-1 h-9 rounded-md border text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed",
                                isActive ? styles.active : styles.base
                              )}
                            >
                              {PRIORITY_LABELS[p]}
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Body */}
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Describe tu problema</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Explica con detalle qué está pasando, desde cuándo, y qué has intentado..."
                        className="min-h-32 resize-none"
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* File attachments */}
              <div>
                <p className="text-sm font-medium mb-2">Archivos adjuntos (opcional)</p>
                <FileUploadZone
                  selectedFiles={selectedFiles}
                  onFilesChange={setSelectedFiles}
                  disabled={isPending}
                />
              </div>

              {/* Upload error + retry without files */}
              {uploadError && (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{uploadError}</p>
                  {canRetryWithoutFiles && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFiles([]);
                        setUploadError(null);
                        setCanRetryWithoutFiles(false);
                        // Re-submit the form without files
                        form.handleSubmit(handleSubmit)();
                      }}
                    >
                      Reintentar sin archivos
                    </Button>
                  )}
                </div>
              )}

              {/* Turnstile invisible + error display (disabled — see docs/technical-debt.md) */}
              {turnstileOn && (
                <div>
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={TURNSTILE_SITE_KEY}
                    options={{
                      size: "invisible",
                      action: "submit-ticket",
                    }}
                    onSuccess={(token) => {
                      setTurnstileToken(token);
                      setTurnstileError(false);
                    }}
                    onError={() => {
                      setTurnstileToken("");
                      setTurnstileError(true);
                    }}
                    onExpire={() => {
                      setTurnstileToken("");
                    }}
                  />
                  {(turnstileError || isTurnstileServerError) && (
                    <p className="text-sm text-destructive mt-1">
                      La verificación de seguridad falló. Intenta de nuevo.
                    </p>
                  )}
                </div>
              )}

              {/* Server error (non-turnstile) */}
              {serverError && !isTurnstileServerError && (
                <p className="text-sm text-destructive">{serverError}</p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full bg-[#1C2438] hover:bg-[#2a3450] text-white transition-colors"
                disabled={!isFormValid || isPending || isUploading}
              >
                {isPending ? "Enviando..." : "Enviar ticket →"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
