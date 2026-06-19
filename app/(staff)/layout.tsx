import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppRoleFromClaims } from "@/lib/auth/claims";
import { isAdmin, isStaff } from "@/lib/auth/roles";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { AppSidebar } from "@/components/layout/app-sidebar";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) redirect("/auth/login");

  const role = getAppRoleFromClaims(claims);
  if (!isStaff(role)) redirect("/403");

  const { data: userData } = await supabase.auth.getUser();

  return (
    <SidebarProvider>
      <AppSidebar
        role={role}
        userEmail={userData?.user?.email ?? ""}
        isAdmin={isAdmin(role)}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-end">
            <ThemeSwitcher />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
