import { z } from "zod";
import { es } from "@/lib/i18n/es";

export const CommentSubmitSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, es.validation.commentEmpty)
    .max(5000, es.validation.commentTooLong),
  is_internal: z.boolean().default(false),
  cc_emails: z.array(z.string().email(es.validation.invalidEmail)).default([]),
});

export type CommentSubmitData = z.infer<typeof CommentSubmitSchema>;
