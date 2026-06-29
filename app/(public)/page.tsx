import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { PublicTicketForm } from "@/components/public/public-ticket-form";
import { EmptyCategories } from "@/components/public/empty-categories";

async function TicketFormSection() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("is_enabled", true)
    .order("name", { ascending: true });

  const enabledCategories = categories ?? [];

  if (enabledCategories.length === 0) {
    return <EmptyCategories />;
  }

  return <PublicTicketForm categories={enabledCategories} />;
}

function FormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="animate-pulse space-y-5 rounded-xl border border-l-4 border-border border-l-[#1C2438] bg-white px-8 py-8 shadow-sm">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded bg-muted" />
          <div className="h-4 w-72 rounded bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-2">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-9 rounded-md bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-9 rounded-md bg-muted" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-14 rounded bg-muted" />
          <div className="h-9 rounded-md bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-9 rounded-md bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-9 rounded-md bg-muted" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-36 rounded bg-muted" />
          <div className="h-32 rounded-md bg-muted" />
        </div>
        <div className="h-10 rounded-md bg-muted" />
      </div>
    </div>
  );
}

export default function PublicPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <TicketFormSection />
    </Suspense>
  );
}
