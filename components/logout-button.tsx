"use client";

import { useTransition } from "react";
import { logoutUser } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutUser();
    });
  };

  return (
    <Button onClick={handleLogout} disabled={isPending}>
      {isPending ? "Cerrando sesión..." : "Cerrar sesión"}
    </Button>
  );
}
