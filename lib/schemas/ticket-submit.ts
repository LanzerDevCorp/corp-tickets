import { z } from "zod";
import { isTurnstileEnabled } from "@/lib/turnstile/config";

export const ticketSubmitSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  email: z
    .string()
    .trim()
    .email("Ingresa un correo electrónico válido")
    .max(254, "El correo es demasiado largo"),
  subject: z
    .string()
    .trim()
    .min(3, "El asunto debe tener al menos 3 caracteres")
    .max(200, "El asunto no puede exceder 200 caracteres"),
  body: z
    .string()
    .trim()
    .min(10, "Describe tu problema con al menos 10 caracteres")
    .max(5000, "La descripción no puede exceder 5000 caracteres"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category_id: z.string().uuid("Selecciona una categoría válida"),
  turnstile_token: isTurnstileEnabled()
    ? z.string().min(1, "La verificación de seguridad es requerida")
    : z.string().optional(),
});

export type TicketSubmitData = z.infer<typeof ticketSubmitSchema>;

export const PRIORITY_LABELS: Record<
  "low" | "medium" | "high" | "urgent",
  string
> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};
