"use client";

import { useActionState } from "react";
import { requestMagicLink } from "@/app/actions/client-provision";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n/t";

type Props = {
  defaultEmail?: string;
};

type State = { error: string | null; submitted?: boolean };

export function MagicLinkRequestForm({ defaultEmail }: Props) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      const email = formData.get("email") as string;
      const result = await requestMagicLink(email);
      if (result.error) return { error: result.error };
      return { error: null, submitted: true };
    },
    { error: null, submitted: false },
  );

  if (state.submitted) {
    return (
      <p className="text-sm text-green-600">{t("auth.magicLinkCheckEmail")}</p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="magic-email">{t("common.email")}</Label>
        <Input
          id="magic-email"
          name="email"
          type="email"
          defaultValue={defaultEmail}
          required
        />
      </div>
      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? t("common.sending") : t("auth.requestNewLink")}
      </Button>
    </form>
  );
}
