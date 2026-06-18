"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  createCategory,
  updateCategory,
  type CategoryRow,
} from "@/app/actions/admin";
import {
  categoryUpsertSchema,
} from "@/lib/schemas/category-upsert";

// ---------------------------------------------------------------------------
// CategoriesTable
// ---------------------------------------------------------------------------

export function CategoriesTable({ categories }: { categories: CategoryRow[] }) {
  if (categories.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        No categories yet. Create the first one.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((cat) => (
          <TableRow key={cat.id}>
            <TableCell>{cat.name}</TableCell>
            <TableCell>
              {cat.is_enabled ? (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  Enabled
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                  Disabled
                </span>
              )}
            </TableCell>
            <TableCell>
              {new Date(cat.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <CategoryToggleSwitch
                  categoryId={cat.id}
                  isEnabled={cat.is_enabled}
                />
                <EditCategoryDialog category={cat} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// NewCategoryDialog
// ---------------------------------------------------------------------------

export function NewCategoryDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const formId = useId();

  const nameSchema = categoryUpsertSchema.pick({ name: true });
  type NameData = { name: string };

  const form = useForm<NameData>({
    resolver: standardSchemaResolver(nameSchema),
    mode: "onChange",
    defaultValues: { name: "" },
  });

  const onSubmit = async (data: NameData) => {
    const parsed = nameSchema.safeParse(data);
    if (!parsed.success) {
      form.trigger();
      return;
    }

    const result = await createCategory({ name: parsed.data.name });
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Category created.");
    form.reset();
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Category</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Category</DialogTitle>
          <DialogDescription>
            Create a new ticket category.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id={formId}
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g. Hardware"
                      disabled={form.formState.isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="submit"
            form={formId}
            disabled={!form.formState.isValid || form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Creating..." : "Create Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// EditCategoryDialog
// ---------------------------------------------------------------------------

export function EditCategoryDialog({ category }: { category: CategoryRow }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const formId = useId();

  const nameSchema = categoryUpsertSchema.pick({ name: true });
  type NameData = { name: string };

  const form = useForm<NameData>({
    resolver: standardSchemaResolver(nameSchema),
    mode: "onChange",
    defaultValues: { name: category.name },
  });

  const onSubmit = async (data: NameData) => {
    const parsed = nameSchema.safeParse(data);
    if (!parsed.success) {
      form.trigger();
      return;
    }

    const result = await updateCategory(category.id, { name: parsed.data.name });
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Category updated.");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Edit category">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
          <DialogDescription>
            Update the category name.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id={formId}
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={form.formState.isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="submit"
            form={formId}
            disabled={!form.formState.isValid || form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// CategoryToggleSwitch — Optimistic UI
// ---------------------------------------------------------------------------

export function CategoryToggleSwitch({
  categoryId,
  isEnabled,
}: {
  categoryId: string;
  isEnabled: boolean;
}) {
  const [checked, setChecked] = useState(isEnabled);
  const router = useRouter();

  const handleToggle = async (next: boolean) => {
    setChecked(next); // optimistic update
    const result = await updateCategory(categoryId, { is_enabled: next });
    if (result.error) {
      setChecked(!next); // revert on error
      toast.error(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <Switch
      checked={checked}
      onCheckedChange={handleToggle}
      aria-label="Toggle category enabled"
    />
  );
}
