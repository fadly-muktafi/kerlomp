import { z } from "zod";

/**
 * Env yang aman dipakai di client (NEXT_PUBLIC_*).
 * Dipakai browser client, server client, dan proxy. Divalidasi sekali saat module dimuat
 * supaya salah konfigurasi gagal jelas, bukan jadi `undefined` diam-diam.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});