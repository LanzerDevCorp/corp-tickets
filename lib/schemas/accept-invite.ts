import * as z from "zod";

export const acceptInviteSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { message: "Ingresa tu nombre (al menos 2 caracteres)." })
      .max(100, { message: "El nombre debe tener 100 caracteres o menos." }),
    password: z
      .string()
      .min(8, { message: "La contraseña debe tener al menos 8 caracteres." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export type AcceptInviteData = z.infer<typeof acceptInviteSchema>;
