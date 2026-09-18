import "server-only";
import { z } from "zod";

/**
 * Validasi env saat boot server (RULES.md §1.5, ARCHITECTURE.md §7).
 * WA vars opsional. Nilai dibersihkan dari komentar inline (mis.
 * `WA_PROVIDER=   # meta | openwa`) karena sebagian loader env tidak
 * membuang komentar, sehingga nilai mentahnya jadi tidak valid.
 */
const cleanOptional = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const withoutComment = value.split(/\s+#/)[0]?.trim() ?? "";
  return withoutComment === "" ? undefined : withoutComment;
};

const optionalString = z.preprocess(
  cleanOptional,
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess(cleanOptional, z.url().optional());

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  WA_PROVIDER: z.preprocess(
    cleanOptional,
    z.enum(["meta", "openwa"]).optional(),
  ),
  META_WA_TOKEN: optionalString,
  META_WA_PHONE_ID: optionalString,
  OPENWA_API_URL: optionalUrl,
  OPENWA_API_KEY: optionalString,
});

export const env = serverEnvSchema.parse(process.env);

export const waEnabled = Boolean(
  env.WA_PROVIDER &&
    (env.WA_PROVIDER === "meta"
      ? env.META_WA_TOKEN && env.META_WA_PHONE_ID
      : env.OPENWA_API_URL && env.OPENWA_API_KEY),
);