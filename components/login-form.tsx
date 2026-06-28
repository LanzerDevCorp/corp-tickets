"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { loginUser } from "@/app/actions/auth";
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

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [state, formAction, isPending] = useActionState(loginUser, {
    error: null,
  });
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.loginTitle")}</CardTitle>
          <CardDescription>{t("auth.loginDescription")}</CardDescription>
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
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">{t("common.password")}</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    {t("auth.forgotPassword")}
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    className="pr-10"
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
              {state.error && (
                <p className="text-sm text-red-500">{state.error}</p>
              )}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? t("auth.loggingIn") : t("auth.login")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
