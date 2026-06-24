import { PublicSiteHeader } from "@/components/public/public-site-header";
import { t } from "@/lib/i18n/t";

export default function PublicAccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div lang="es-MX" className="force-light min-h-svh bg-[#F6F7FB] flex flex-col text-foreground">
      <PublicSiteHeader rightLink={{ href: "/", label: t("public.submitTicket") }} />
      <main className="flex-1 flex flex-col justify-center px-4 py-12">
        <div className="w-full max-w-lg mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
