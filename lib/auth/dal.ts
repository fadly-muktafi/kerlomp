import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getAuthedContext } from "@/lib/supabase/authed";
import { createClient } from "@/lib/supabase/server";

/**
 * Data Access Layer (Next.js authentication guide).
 * `getSession`/`verifySession` memakai getClaims (verifikasi token) untuk guard halaman.
 * Untuk query/mutasi yang tunduk RLS, pakai `getAuthedContext()`.
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
  const ctx = await getAuthedContext();
  if (!ctx) {
    redirect("/login");
  }
  const { data } = await ctx.db
    .from("profiles")
    .select("id, display_name, avatar_url")
    .eq("id", ctx.userId)
    .maybeSingle();
  return data;
});