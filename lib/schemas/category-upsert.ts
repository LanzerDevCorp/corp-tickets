import * as z from "zod";
import { es } from "@/lib/i18n/es";

export const categoryUpsertSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: es.validation.categoryNameRequired })
    .max(100, { message: es.validation.categoryNameMax }),
  is_enabled: z.boolean().optional(),
});

export type CategoryUpsertData = z.infer<typeof categoryUpsertSchema>;
