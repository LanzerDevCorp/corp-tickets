import { getUsers } from "@/app/actions/admin";
import { UsersTable, InviteUserDialog } from "./_components";

export default async function UsersPage() {
  const result = await getUsers();

  if (result.error) {
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
      <UsersTable users={result.data} />
    </main>
  );
}
