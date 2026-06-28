import { PublicSiteHeader } from "@/components/public/public-site-header";
import { t } from "@/lib/i18n/t";

export default function PublicAccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      lang="es-MX"
      className="force-light flex min-h-svh flex-col bg-[#F6F7FB] text-foreground"
    >
      <PublicSiteHeader
        rightLink={{ href: "/", label: t("public.submitTicket") }}
      />
      <main className="flex flex-1 flex-col justify-center px-4 py-12">
        <div className="mx-auto w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}
