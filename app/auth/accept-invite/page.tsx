import Link from "next/link";
import { redirect } from "next/navigation";
import { AcceptInviteForm } from "@/components/accept-invite-form";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirect(
        `/auth/error?error=${encodeURIComponent("Could not verify invitation link.")}`
      );
    }
    redirect("/auth/accept-invite");
  }

  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Invitation link invalid</CardTitle>
              <CardDescription>
                Open the link from your invitation email, or ask an admin to
                send a new one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/auth/login">Go to login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <AcceptInviteForm />
      </div>
    </div>
  );
}
