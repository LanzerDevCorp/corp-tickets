import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Tag } from "lucide-react";

export default function AdminPage() {
  return (
    <main className="flex min-h-svh flex-col p-8">
      <h1 className="text-2xl font-bold mb-2">Admin</h1>
      <p className="text-muted-foreground mb-8">
        Manage users and ticket categories.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-2xl">
        <Link href="/admin/users" className="block">
          <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Invite and manage staff accounts.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/categories" className="block">
          <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Tag className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Add and configure ticket categories.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  );
}
