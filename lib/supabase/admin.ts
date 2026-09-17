import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. HANYA untuk route handler / Edge-adjacent server code.
 * RULES.md Aturan Emas #1: tidak pernah diimport dari client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / URL tidak terkonfigurasi");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
