import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppRoleFromClaims } from "@/lib/auth/claims";
import { getRedirectPath } from "@/lib/auth/roles";
import { PortalLoginForm } from "@/components/portal/portal-login-form";

export default async function PortalPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Already signed in — route by role (staff → dashboard, client → portal list).
  if (data?.claims) {
    redirect(getRedirectPath(getAppRoleFromClaims(data.claims)));
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <PortalLoginForm />
      </div>
    </div>
  );
}
