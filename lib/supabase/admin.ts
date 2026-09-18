import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. HANYA untuk route handler / Edge-adjacent server code.
 * RULES.md Aturan Emas #1: tidak pernah diimport dari client components.
 */
export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY tidak terkonfigurasi");
  }
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export { createClient as createSupabaseJsClient } from "@supabase/supabase-js";