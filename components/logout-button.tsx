"use client";

import { useTransition } from "react";
import { logoutUser } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/t";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutUser();
    });
  };

  return (
    <Button onClick={handleLogout} disabled={isPending}>
      {isPending ? t("auth.loggingOut") : t("auth.logout")}
    </Button>
  );
}
