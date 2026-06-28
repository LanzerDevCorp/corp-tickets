import { z } from "zod";

export const CommentSubmitSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "El comentario no puede estar vacío")
    .max(5000, "El comentario es demasiado largo"),
  is_internal: z.boolean().default(false),
  cc_emails: z
    .array(z.string().email("Ingresa un correo electrónico válido"))
    .default([]),
});

export type CommentSubmitData = z.infer<typeof CommentSubmitSchema>;
