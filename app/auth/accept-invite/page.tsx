import { redirect } from "next/navigation";
import { AcceptInviteShell } from "@/components/accept-invite-shell";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirect(
        `/auth/error?error=${encodeURIComponent("Could not verify invitation link.")}`
      );
    }
    redirect("/auth/accept-invite");
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <AcceptInviteShell />
      </div>
    </div>
  );
}
