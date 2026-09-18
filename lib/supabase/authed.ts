import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env/client";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

/**
 * Konteks terautentikasi untuk query/mutasi di server.
 *
 * `@supabase/ssr` menyimpan sesi di cookie, tetapi SupabaseClient yang mengeksekusi
 * `.from()` tidak selalu memasang Authorization dari cookie itu, sehingga PostgREST
 * melihat role `anon` dan RLS gagal (42501). Di sini token sesi diambil eksplisit
 * lewat getUser()/getSession(), lalu dipasang sebagai header Authorization pada
 * client supabase-js biasa. Dengan begitu `auth.uid()` di RLS sama dengan userId.
 */
export const getAuthedContext = cache(async () => {
  const supabase = await createClient();

  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return null;

  const db = createJsClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );

  return { db, userId: userData.user.id };
});

/** Varian untuk Server Action: redirect ke /login bila sesi tidak ada. */
export async function requireAuthedContext() {
  const ctx = await getAuthedContext();
  if (!ctx) {
    redirect("/login");
  }
  return ctx;
}