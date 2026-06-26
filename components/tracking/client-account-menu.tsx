"use client";

import { useTransition } from "react";
import { User } from "lucide-react";
import { logoutUser } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ClientAccountMenuProps = {
  email?: string;
};

export function ClientAccountMenu({ email }: ClientAccountMenuProps) {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutUser();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-zinc-200 bg-white/90 text-zinc-700 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200"
          aria-label="Menú de cuenta"
        >
          <User className="size-4" aria-hidden />
          <span className="max-w-[140px] truncate text-sm">
            {email ?? "Mi cuenta"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <a href="#" className="cursor-default opacity-60" aria-disabled="true">
            Crear contraseña
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleLogout();
          }}
          disabled={isPending}
        >
          {isPending ? "Cerrando sesión…" : "Cerrar sesión"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
