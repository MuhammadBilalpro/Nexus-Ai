import { z } from "zod";

/** Shared between the login form (client) and the login action (server). Keep free of server imports. */
export const loginSchema = z
  .object({
    email: z.email("Enter a valid email address").max(254),
    password: z.string().min(1, "Enter your password").max(128),
    next: z.string().max(512).optional(),
  })
  .strict();

export const mfaCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(6, "Enter the 6-digit code or a recovery code")
      .max(32)
      .regex(/^[0-9a-fA-F\- ]+$/, "Invalid code format"),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: z.string().min(12, "Password must be at least 12 characters").max(128),
    confirmPassword: z.string().min(1).max(128),
  })
  .strict()
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export type LoginInput = z.infer<typeof loginSchema>;
export type MfaCodeInput = z.infer<typeof mfaCodeSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Only allow same-origin relative paths as post-login destinations (open-redirect protection). */
export function safeNextPath(next: string | undefined | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.startsWith("/api/")) return "/";
  return next;
}
