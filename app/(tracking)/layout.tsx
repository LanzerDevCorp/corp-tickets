import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppRoleFromClaims } from "@/lib/auth/claims";
import { getAuthenticatedEmail } from "@/lib/auth/session-email";
import { isStaff } from "@/lib/auth/roles";
import { TrackSessionBootstrap } from "@/components/tracking/track-session-bootstrap";
import { ClientAccountMenu } from "@/components/tracking/client-account-menu";
import { t } from "@/lib/i18n/t";

export default async function TrackingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (claims) {
    const role = getAppRoleFromClaims(claims);
    if (isStaff(role)) {
      redirect("/dashboard");
    }
  }

  const clientEmail =
    claims && !isStaff(getAppRoleFromClaims(claims))
      ? await getAuthenticatedEmail(supabase, claims)
      : null;

  return (
    <div lang="es-MX" className="min-h-svh bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium tracking-widest text-zinc-400 uppercase">
              {t("tracking.support")}
            </p>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {t("tracking.ticketTracking")}
            </h1>
          </div>
          {clientEmail ? <ClientAccountMenu email={clientEmail} /> : null}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <TrackSessionBootstrap hasServerSession={!!claims}>
          {children}
        </TrackSessionBootstrap>
      </main>
    </div>
  );
}
