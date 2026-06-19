import * as z from "zod";

export const acceptInviteSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { message: "Enter your name (at least 2 characters)." })
      .max(100, { message: "Name must be 100 characters or fewer." }),
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type AcceptInviteData = z.infer<typeof acceptInviteSchema>;
