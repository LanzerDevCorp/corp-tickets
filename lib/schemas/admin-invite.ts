import * as z from "zod";

export const adminInviteSchema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email address." }),
  role: z.enum(["it", "admin"], { message: "Role must be IT or Admin." }),
});

export type AdminInviteData = z.infer<typeof adminInviteSchema>;
