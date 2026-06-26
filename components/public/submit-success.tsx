"use client";

import { useState } from "react";
import { CheckCircle2Icon, CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatTicketReference } from "@/lib/tickets/reference";

interface SubmitSuccessProps {
  ticketId: string;
}

export function SubmitSuccess({ ticketId }: SubmitSuccessProps) {
  const ref = formatTicketReference(ticketId);
  const displayValue = `#${ref}`;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(displayValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-border border-l-4 border-l-[#2563EB] shadow-sm px-8 py-12 text-center">
        <div className="flex justify-center mb-5">
          <div className="rounded-full bg-blue-50 p-4">
            <CheckCircle2Icon
              className="size-8 text-[#2563EB]"
              strokeWidth={1.5}
            />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-[#1C2438]">Ticket recibido</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          Recibimos tu solicitud. Te enviaremos un correo con el enlace para
          darle seguimiento. Guarda tu número de ticket para volver a entrar si
          caduca la sesión.
        </p>

        <div className="mt-8 mx-auto max-w-sm">
          <div
            className="relative overflow-hidden rounded-lg border border-[#1C2438]/12 bg-linear-to-br from-[#1C2438]/4 to-transparent"
            role="group"
            aria-label="Número de ticket"
          >
            <div
              className="absolute inset-y-3 left-0 w-4 border-r border-dashed border-[#1C2438]/20"
              aria-hidden
            />
            <div className="pl-6 pr-4 py-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Tu número de ticket
              </p>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <p className="font-mono text-2xl font-semibold tracking-[0.18em] text-[#1C2438] tabular-nums">
                  <span className="text-muted-foreground/50 tracking-normal">
                    #
                  </span>
                  {ref}
                </p>
                <TooltipProvider delayDuration={0}>
                  <Tooltip open={copied ? true : undefined}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={handleCopy}
                        aria-label={
                          copied ? "Número copiado" : "Copiar número de ticket"
                        }
                        className="shrink-0 border-[#1C2438]/15 bg-white/80 hover:bg-white"
                      >
                        {copied ? (
                          <CheckIcon className="text-[#2563EB]" />
                        ) : (
                          <CopyIcon />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {copied ? "Copiado" : "Copiar"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground/80">
                Úsalo con tu correo si necesitas volver a entrar sin el enlace.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground/80 max-w-sm mx-auto">
          Cuando abras el enlace del correo, podrás crear una contraseña para
          entrar más rápido la próxima vez.
        </p>

        <p className="mt-8 text-xs text-muted-foreground/70">
          ¿Tienes otro problema?{" "}
          <a
            href="/"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Enviar otro ticket
          </a>
        </p>
      </div>
    </div>
  );
}
