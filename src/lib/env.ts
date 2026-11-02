import { z } from "zod";

/**
 * Server-side environment, validated once at import time so a
 * misconfigured deployment fails fast instead of at first request.
 *
 * This module has no `server-only` guard because scripts (seed, migrations)
 * import it outside the React server runtime. It must never be imported from
 * a Client Component: ESLint's `no-restricted-imports` rule enforces that.
 */
const base64Key32 = z.string().refine((v) => {
  try {
    return Buffer.from(v, "base64").length === 32;
  } catch {
    return false;
  }
}, "must be a base64-encoded 32-byte key (openssl rand -base64 32)");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  DATABASE_URL_UNPOOLED: z.url().optional(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_URL: z.url().optional(),
  MFA_ENCRYPTION_KEY: base64Key32,
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SEED_ADMIN_EMAIL: z.email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;
