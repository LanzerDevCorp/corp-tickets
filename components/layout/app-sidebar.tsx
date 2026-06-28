"use client";

import { LayoutDashboard, Settings2, Tag, Users, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/app/(staff)/actions";
import { t } from "@/lib/i18n/t";

const mainNav = [
  {
    labelKey: "sidebar.dashboard" as const,
    href: "/dashboard",
    icon: LayoutDashboard,
  },
];

const adminNav = [
  { labelKey: "sidebar.overview" as const, href: "/admin", icon: Settings2 },
  {
    labelKey: "sidebar.categories" as const,
    href: "/admin/categories",
    icon: Tag,
  },
  { labelKey: "sidebar.users" as const, href: "/admin/users", icon: Users },
];

interface AppSidebarProps {
  role: string;
  userEmail: string;
  isAdmin: boolean;
}

export function AppSidebar({ userEmail, isAdmin }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <a href={item.href}>
                      <item.icon />
                      <span>{t(item.labelKey)}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("sidebar.admin")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                    >
                      <a href={item.href}>
                        <item.icon />
                        <span>{t(item.labelKey)}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <span className="truncate text-xs text-muted-foreground">
                {userEmail}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={signOut}>
              <SidebarMenuButton type="submit">
                <LogOut />
                <span>{t("sidebar.logOut")}</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
