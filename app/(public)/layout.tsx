import type { Metadata } from "next";
import { t } from "@/lib/i18n/t";
import { PublicSiteHeader } from "@/components/public/public-site-header";

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
      <PublicSiteHeader rightLink={{ href: "/track/access", label: t("public.trackTicket") }} />

      <main className="flex-1 flex flex-col justify-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}
