"use client";

import { useActionState } from "react";
import { cn } from "@/lib/utils";
import { resetPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { t } from "@/lib/i18n/t";

type State = { error: string | null; submitted?: boolean };

async function resetPasswordAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const email = formData.get("email") as string;
  await resetPassword(email);
  return { error: null, submitted: true };
}

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, {
    error: null,
    submitted: false,
  });

  if (state.submitted) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {t("auth.checkEmailTitle")}
            </CardTitle>
            <CardDescription>{t("auth.checkEmailDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("auth.checkEmailBody")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {t("auth.resetPasswordTitle")}
          </CardTitle>
          <CardDescription>
            {t("auth.resetPasswordDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">{t("common.email")}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                />
              </div>
              {state.error && (
                <p className="text-sm text-red-500">{state.error}</p>
              )}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? t("common.sending") : t("auth.sendResetEmail")}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                {t("auth.login")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
