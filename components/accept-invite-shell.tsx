"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { establishBrowserSessionFromUrl } from "@/lib/auth/establish-browser-session";
import { AcceptInviteForm } from "@/components/accept-invite-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Status = "loading" | "ready" | "invalid";

export function AcceptInviteShell() {
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
        setErrorMessage(
          err instanceof Error ? err.message : "Ocurrió un error",
        );
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
          <CardTitle className="text-2xl">
            {"Verificando invitación…"}
          </CardTitle>
          <CardDescription>
            {"Configurando tu sesión desde el enlace de invitación."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "invalid") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {"Enlace de invitación inválido"}
          </CardTitle>
          <CardDescription>
            {
              "Abre el enlace de tu correo de invitación o pide a un administrador que envíe uno nuevo."
            }
            {errorMessage ? (
              <>
                {" "}
                <span className="mt-2 block text-xs text-muted-foreground">
                  ({errorMessage})
                </span>
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/auth/login">{"Ir a iniciar sesión"}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <AcceptInviteForm />;
}
