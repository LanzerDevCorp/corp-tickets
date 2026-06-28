import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Tag } from "lucide-react";
import { t } from "@/lib/i18n/t";

export default function AdminPage() {
  return (
    <main className="flex min-h-svh flex-col p-8">
      <h1 className="mb-2 text-2xl font-bold">{t("admin.title")}</h1>
      <p className="mb-8 text-muted-foreground">{t("admin.subtitle")}</p>

      <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/admin/users" className="block">
          <Card className="h-full cursor-pointer transition-colors hover:bg-accent">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">{t("admin.users")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("admin.usersDescription")}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/categories" className="block">
          <Card className="h-full cursor-pointer transition-colors hover:bg-accent">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Tag className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                {t("admin.categories")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("admin.categoriesDescription")}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  );
}
