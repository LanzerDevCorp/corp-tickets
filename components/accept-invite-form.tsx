"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { completeInviteSetup } from "@/app/actions/auth";
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
import { t } from "@/lib/i18n/t";

export function AcceptInviteForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [state, formAction, isPending] = useActionState(completeInviteSetup, {
    error: null,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {t("auth.acceptInviteTitle")}
          </CardTitle>
          <CardDescription>{t("auth.acceptInviteDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="name">{t("auth.fullName")}</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Jane Doe"
                  autoComplete="name"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">{t("common.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className="pr-10"
                    autoComplete="new-password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={
                      showPassword
                        ? t("common.hidePassword")
                        : t("common.showPassword")
                    }
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">
                  {t("auth.confirmPassword")}
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    className="pr-10"
                    autoComplete="new-password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
                    onClick={() =>
                      setShowConfirmPassword((visible) => !visible)
                    }
                    aria-label={
                      showConfirmPassword
                        ? t("common.hidePassword")
                        : t("common.showPassword")
                    }
                  >
                    {showConfirmPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>

              {state.error && (
                <p className="text-sm text-red-500">{state.error}</p>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? t("common.saving") : t("auth.createAccount")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
