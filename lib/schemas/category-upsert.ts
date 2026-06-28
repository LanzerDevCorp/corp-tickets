import * as z from "zod";

export const categoryUpsertSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "El nombre de la categoría es obligatorio." })
    .max(100, {
      message: "El nombre de la categoría debe tener 100 caracteres o menos.",
    }),
  is_enabled: z.boolean().optional(),
});

export type CategoryUpsertData = z.infer<typeof categoryUpsertSchema>;
