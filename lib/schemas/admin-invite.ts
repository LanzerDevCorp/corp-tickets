import * as z from "zod";
import { es } from "@/lib/i18n/es";

export const adminInviteSchema = z.object({
  email: z.string().trim().email({ message: es.validation.adminInviteEmail }),
  role: z.enum(["it", "admin"], { message: es.validation.adminInviteRole }),
});

export type AdminInviteData = z.infer<typeof adminInviteSchema>;
