import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { getAppRoleFromClaims } from "@/lib/auth/claims";
import { getRedirectPath } from "@/lib/auth/roles";

export async function AuthButton() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    return (
      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/auth/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  const role = getAppRoleFromClaims(claims);
  const homePath = getRedirectPath(role);
  const homeLabel = role === "client" ? "My tickets" : "Dashboard";

  return (
    <div className="flex items-center gap-4">
      <Button asChild size="sm" variant="ghost">
        <Link href={homePath}>{homeLabel}</Link>
      </Button>
      <LogoutButton />
    </div>
  );
}
