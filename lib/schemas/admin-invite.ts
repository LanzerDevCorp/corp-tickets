import * as z from "zod";

export const adminInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Ingresa un correo electrónico válido." }),
  role: z.enum(["it", "admin"], {
    message: "El rol debe ser TI o Administrador.",
  }),
});

export type AdminInviteData = z.infer<typeof adminInviteSchema>;
