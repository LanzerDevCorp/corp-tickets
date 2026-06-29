import type { Metadata } from "next";
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
    <div
      lang="es-MX"
      className="force-light flex min-h-svh flex-col bg-[#F6F7FB] text-foreground"
    >
      <PublicSiteHeader rightLink={{ href: "/portal", label: "Acceder" }} />

      <main className="flex flex-1 flex-col justify-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}
