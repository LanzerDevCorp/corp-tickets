"use client";

import { useActionState, useState } from "react";
import { accessTicketWithReference } from "@/app/actions/client-access";
import { requestMagicLink } from "@/app/actions/client-provision";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  defaultEmail?: string;
  defaultTicketRef?: string;
};

type AccessState = { error: string | null };
type ResendState = { error: string | null; submitted?: boolean };

export function TrackAccessPanel({
  defaultEmail = "",
  defaultTicketRef = "",
}: Props) {
  const [accessState, accessAction, accessPending] = useActionState(
    async (_prev: AccessState, formData: FormData): Promise<AccessState> => {
      const email = formData.get("email") as string;
      const ticketRef = formData.get("ticketRef") as string;
      try {
        return await accessTicketWithReference(email, ticketRef);
      } catch {
        return { error: null };
      }
    },
    { error: null },
  );

  const [resendState, resendAction, resendPending] = useActionState(
    async (_prev: ResendState, formData: FormData): Promise<ResendState> => {
      const email = formData.get("resendEmail") as string;
      const result = await requestMagicLink(email);
      if (result.error) return { error: result.error };
      return { error: null, submitted: true };
    },
    { error: null, submitted: false },
  );

  const [resendOpen, setResendOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <form action={accessAction} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="access-email">{"Correo electrónico"}</Label>
          <Input
            id="access-email"
            name="email"
            type="email"
            defaultValue={defaultEmail}
            required
            disabled={accessPending}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="access-ticket-ref">{"Número de ticket"}</Label>
          <Input
            id="access-ticket-ref"
            name="ticketRef"
            type="text"
            defaultValue={defaultTicketRef}
            placeholder={"Ej. 6087BB67"}
            required
            disabled={accessPending}
            className="font-mono uppercase"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            {
              "Es la referencia de 8 caracteres que aparece en la confirmación o en el correo (#6087BB67)."
            }
          </p>
        </div>

        {accessState.error && (
          <p className="text-sm text-red-500">{accessState.error}</p>
        )}

        <Button type="submit" disabled={accessPending}>
          {accessPending ? "Enviando..." : "Entrar al ticket"}
        </Button>
      </form>

      <div className="border-t pt-4">
        {!resendOpen ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setResendOpen(true)}
          >
            {"¿Prefieres un enlace por correo?"}
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium">
                {"¿Prefieres un enlace por correo?"}
              </p>
              <p className="text-xs text-muted-foreground">
                {
                  "Te enviaremos un enlace reutilizable al correo con el que enviaste el ticket."
                }
              </p>
            </div>

            {resendState.submitted ? (
              <p className="text-sm text-green-600">
                {"Revisa tu correo para obtener un nuevo enlace."}
              </p>
            ) : (
              <form action={resendAction} className="flex flex-col gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="resend-email">{"Correo electrónico"}</Label>
                  <Input
                    id="resend-email"
                    name="resendEmail"
                    type="email"
                    defaultValue={defaultEmail}
                    required
                    disabled={resendPending}
                  />
                </div>
                {resendState.error && (
                  <p className="text-sm text-red-500">{resendState.error}</p>
                )}
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={resendPending}
                >
                  {resendPending ? "Enviando..." : "Solicitar nuevo enlace"}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
