import * as z from "zod";
import { es } from "@/lib/i18n/es";

export const acceptInviteSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { message: es.validation.nameMin })
      .max(100, { message: es.validation.nameMax }),
    password: z.string().min(8, { message: es.validation.passwordMin }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: es.validation.passwordsMismatch,
    path: ["confirmPassword"],
  });

export type AcceptInviteData = z.infer<typeof acceptInviteSchema>;
