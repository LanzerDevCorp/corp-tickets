import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const role = data?.claims?.role as Role | undefined;

  if (role !== "admin") {
    redirect("/403");
  }

  return <>{children}</>;
}
