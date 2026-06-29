"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  setClientPassword,
  dismissPasswordPrompt,
} from "@/app/actions/client-password";
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

const DEFAULT_NEXT = "/track";

type Props = {
  /** Where to send the client after they decide. Defaults to the portal list. */
  next?: string;
  /** When true, render the "change password" variant without a skip option. */
  hasPassword?: boolean;
};

export function SetPasswordForm({ next, hasPassword = false }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "skip" | null>(null);

  const destination = next ?? DEFAULT_NEXT;

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setPending("save");
    setError(null);

    const result = await setClientPassword(password);
    if (result.error) {
      setError(result.error);
      setPending(null);
      return;
    }

    router.push(destination);
  }

  async function handleSkip() {
    setPending("skip");
    setError(null);
    await dismissPasswordPrompt();
    router.push(destination);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          {hasPassword ? "Cambia tu contraseña" : "Crea una contraseña"}
        </CardTitle>
        <CardDescription>
          {hasPassword
            ? "Actualiza la contraseña de tu cuenta."
            : "Opcional. Te deja entrar a tus tickets con tu correo y contraseña, sin esperar el enlace por correo."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="new-password">Contraseña</Label>
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending !== null}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 8 caracteres.
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full"
              disabled={pending !== null}
            >
              {pending === "save"
                ? "Guardando…"
                : hasPassword
                  ? "Guardar contraseña"
                  : "Crear contraseña"}
            </Button>
            {!hasPassword && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleSkip}
                disabled={pending !== null}
              >
                {pending === "skip" ? "Un momento…" : "Omitir por ahora"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
