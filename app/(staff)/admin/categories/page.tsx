import { getCategories } from "@/app/actions/admin";
import { CategoriesTable, NewCategoryDialog } from "./_components";

export default async function CategoriesPage() {
  const result = await getCategories();

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
        <h1 className="text-2xl font-bold">Categories</h1>
        <NewCategoryDialog />
      </div>
      <CategoriesTable categories={result.data} />
    </main>
  );
}
