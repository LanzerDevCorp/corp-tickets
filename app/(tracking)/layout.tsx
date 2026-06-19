import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/auth/roles";
import type { Role } from "@/lib/auth/roles";

export default async function TrackingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    redirect("/auth/error?error_code=otp_expired");
  }

  const role = (claims.role as Role) ?? "client";
  if (isStaff(role)) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-svh bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
              Support
            </p>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Ticket tracking
            </h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
