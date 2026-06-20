import { Suspense } from "react";
import { getUsers } from "@/app/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { UsersTable, InviteUserDialog } from "./_components";
import { t } from "@/lib/i18n/t";

async function UsersContent() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const currentUserId = claimsData?.claims?.sub as string | undefined;

  const result = await getUsers();

  if (result.error !== null) {
    return <p className="text-destructive">{result.error}</p>;
  }

  return <UsersTable users={result.data} currentUserId={currentUserId} />;
}

export default function UsersPage() {
  return (
    <main className="flex min-h-svh flex-col p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">{t("admin.users")}</h1>
        <InviteUserDialog />
      </div>
      <Suspense fallback={<p className="text-muted-foreground">{t("admin.loading")}</p>}>
        <UsersContent />
      </Suspense>
    </main>
  );
}
