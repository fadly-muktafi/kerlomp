import "server-only";
import { z } from "zod";

/**
 * Validasi env saat boot server (RULES.md §1.5, ARCHITECTURE.md §7).
 * WA vars opsional - fitur WA dimatikan graceful kalau tidak lengkap.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  WA_PROVIDER: z.enum(["meta", "openwa"]).optional(),
  META_WA_TOKEN: z.string().optional(),
  META_WA_PHONE_ID: z.string().optional(),
  OPENWA_API_URL: z.url().optional(),
  OPENWA_API_KEY: z.string().optional(),
});

export const env = serverEnvSchema.parse(process.env);

export const waEnabled = Boolean(
  env.WA_PROVIDER &&
    (env.WA_PROVIDER === "meta"
      ? env.META_WA_TOKEN && env.META_WA_PHONE_ID
      : env.OPENWA_API_URL && env.OPENWA_API_KEY),
);