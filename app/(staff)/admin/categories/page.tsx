import { Suspense } from "react";
import { getCategories } from "@/app/actions/admin";
import { CategoriesTable, NewCategoryDialog } from "./_components";

async function CategoriesContent() {
  const result = await getCategories();

  if (result.error !== null) {
    return <p className="text-destructive">{result.error}</p>;
  }

  return <CategoriesTable categories={result.data} />;
}

export default function CategoriesPage() {
  return (
    <main className="flex min-h-svh flex-col p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{"Categorías"}</h1>
        <NewCategoryDialog />
      </div>
      <Suspense
        fallback={<p className="text-muted-foreground">{"Cargando..."}</p>}
      >
        <CategoriesContent />
      </Suspense>
    </main>
  );
}
