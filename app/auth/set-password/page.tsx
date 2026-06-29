import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPasswordDecision } from "@/app/actions/client-password";
import { isSafeRedirect } from "@/lib/auth/redirect";
import { SetPasswordForm } from "@/components/auth/set-password-form";

type SearchParams = { next?: string; manage?: string };

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { next, manage } = await searchParams;
  const safeNext = next && isSafeRedirect(next) ? next : "/track";
  const isManaging = manage === "1";

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/portal");
  }

  const decision = await getPasswordDecision();

  // Not an authenticated client (e.g. staff) — don't show the interstitial.
  if (decision.error) {
    redirect(safeNext);
  }

  // First-access gate: a client who already created or skipped passes straight
  // through to their destination. Manage mode (account menu) always shows the
  // form so they can create or change a password on demand.
  if (decision.decided && !isManaging) {
    redirect(safeNext);
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SetPasswordForm next={safeNext} hasPassword={decision.hasPassword} />
      </div>
    </div>
  );
}
