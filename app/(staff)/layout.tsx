import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth/roles";
import type { Role } from "@/lib/auth/roles";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    redirect("/auth/login");
  }

  const role = (claims.role as Role) ?? "client";
  if (!isStaff(role)) {
    redirect("/403");
  }

  return <>{children}</>;
}
