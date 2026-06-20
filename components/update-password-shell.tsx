"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { establishBrowserSessionFromUrl } from "@/lib/auth/establish-browser-session";
import { UpdatePasswordForm } from "@/components/update-password-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { t } from "@/lib/i18n/t";

type Status = "loading" | "ready" | "invalid";

export function UpdatePasswordShell() {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    establishBrowserSessionFromUrl()
      .then(({ ok, error }) => {
        if (cancelled) return;
        if (ok) {
          setStatus("ready");
          return;
        }
        setErrorMessage(error ?? null);
        setStatus("invalid");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : t("errors.genericError"));
        setStatus("invalid");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.verifyingLink")}</CardTitle>
          <CardDescription>{t("auth.verifyingLinkDescription")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "invalid") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("auth.resetLinkInvalid")}</CardTitle>
          <CardDescription>
            {t("auth.resetLinkInvalidDescription")}
            {errorMessage ? (
              <>
                {" "}
                <span className="block mt-2 text-xs text-muted-foreground">
                  ({errorMessage})
                </span>
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/auth/forgot-password">{t("auth.requestReset")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <UpdatePasswordForm />;
}
