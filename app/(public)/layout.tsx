import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Enviar ticket · Corp Tickets",
  description:
    "Envía una solicitud de soporte a nuestro equipo de TI. Te responderemos a la brevedad.",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div lang="es-MX" className="force-light min-h-svh bg-[#F6F7FB] flex flex-col text-foreground">
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-2xl px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#1C2438] tracking-tight">
            Mesa de ayuda
          </span>
          <Link
            href="/auth/login"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Acceso staff →
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}
