import { getUsers } from "@/app/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { UsersTable, InviteUserDialog } from "./_components";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const currentUserId = claimsData?.claims?.sub as string | undefined;

  const result = await getUsers();

  if (result.error !== null) {
    return (
      <main className="flex min-h-svh flex-col p-8">
        <p className="text-destructive">{result.error}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Users</h1>
        <InviteUserDialog />
      </div>
      <UsersTable users={result.data} currentUserId={currentUserId} />
    </main>
  );
}
