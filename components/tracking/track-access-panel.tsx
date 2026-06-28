"use client";

import { useActionState, useState } from "react";
import { accessTicketWithReference } from "@/app/actions/client-access";
import { requestMagicLink } from "@/app/actions/client-provision";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n/t";

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
          <Label htmlFor="access-email">{t("common.email")}</Label>
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
          <Label htmlFor="access-ticket-ref">{t("auth.ticketReference")}</Label>
          <Input
            id="access-ticket-ref"
            name="ticketRef"
            type="text"
            defaultValue={defaultTicketRef}
            placeholder={t("auth.ticketReferencePlaceholder")}
            required
            disabled={accessPending}
            className="font-mono uppercase"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            {t("auth.ticketReferenceHint")}
          </p>
        </div>

        {accessState.error && (
          <p className="text-sm text-red-500">{accessState.error}</p>
        )}

        <Button type="submit" disabled={accessPending}>
          {accessPending ? t("common.sending") : t("auth.enterTicket")}
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
            {t("auth.resendLinkSection")}
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium">
                {t("auth.resendLinkSection")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("auth.resendLinkDescription")}
              </p>
            </div>

            {resendState.submitted ? (
              <p className="text-sm text-green-600">
                {t("auth.magicLinkCheckEmail")}
              </p>
            ) : (
              <form action={resendAction} className="flex flex-col gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="resend-email">{t("common.email")}</Label>
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
                  {resendPending
                    ? t("common.sending")
                    : t("auth.requestNewLink")}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
