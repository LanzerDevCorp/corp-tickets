import { redirect } from "next/navigation";
import { getAppRoleFromClaims } from "@/lib/auth/claims";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const role = getAppRoleFromClaims(data?.claims);

  if (role !== "admin") {
    redirect("/403");
  }

  return <>{children}</>;
}
