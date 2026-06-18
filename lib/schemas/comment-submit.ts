import { z } from "zod";

export const CommentSubmitSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment is too long"),
  is_internal: z.boolean().default(false),
  cc_emails: z.array(z.string().email("Invalid email address")).default([]),
});

export type CommentSubmitData = z.infer<typeof CommentSubmitSchema>;
