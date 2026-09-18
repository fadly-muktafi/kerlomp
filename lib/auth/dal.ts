import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Data Access Layer (Next.js authentication guide): satu tempat verifikasi sesi
 * dan pengambilan profil. `React.cache` men-dedup per-request.
 * getClaims memverifikasi token; jangan pakai getSession di server.
 */
export const getSession = cache(async (): Promise<{ userId: string } | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? { userId: sub } : null;
});

/** Untuk halaman terproteksi: redirect ke /login bila belum login. */
export const verifySession = cache(async (): Promise<{ userId: string }> => {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
});

export const getCurrentProfile = cache(async () => {
  const { userId } = await verifySession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  return data;
});