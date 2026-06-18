import * as z from "zod";

export const categoryUpsertSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Category name is required." })
    .max(100, { message: "Category name must be 100 characters or fewer." }),
  is_enabled: z.boolean().optional(),
});

export type CategoryUpsertData = z.infer<typeof categoryUpsertSchema>;
