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
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-border border-l-4 border-l-[#1C2438] shadow-sm px-8 py-8 space-y-5 animate-pulse">
        <div className="space-y-2">
          <div className="h-7 w-56 bg-muted rounded" />
          <div className="h-4 w-72 bg-muted rounded" />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-2">
            <div className="h-4 w-16 bg-muted rounded" />
            <div className="h-9 bg-muted rounded-md" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-9 bg-muted rounded-md" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-14 bg-muted rounded" />
          <div className="h-9 bg-muted rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-2">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-9 bg-muted rounded-md" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-9 bg-muted rounded-md" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-36 bg-muted rounded" />
          <div className="h-32 bg-muted rounded-md" />
        </div>
        <div className="h-10 bg-muted rounded-md" />
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
