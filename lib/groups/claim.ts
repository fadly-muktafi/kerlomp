import "server-only";
import { cookies } from "next/headers";
import { GUEST_COOKIE } from "@/lib/id/guest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Claim guest -> akun Google: isi members.user_id, kosongkan guest_token.
 * Dijalankan transaksional saat OAuth callback (service role).
 * Kalau akun sudah jadi anggota grup yang sama, claim dilewati (cegah impersonasi).
 */
export async function claimGuestSession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(GUEST_COOKIE)?.value;
  if (!token) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (typeof userId !== "string") return null;

  const admin = createAdminClient();
  const { data: guest } = await admin
    .from("members")
    .select("id, group_id")
    .eq("guest_token", token)
    .is("user_id", null)
    .maybeSingle();

  if (!guest) {
    store.delete(GUEST_COOKIE);
    return null;
  }

  const { data: existing } = await admin
    .from("members")
    .select("id")
    .eq("group_id", guest.group_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    store.delete(GUEST_COOKIE);
    return guest.group_id;
  }

  await admin
    .from("members")
    .update({ user_id: userId, guest_token: null })
    .eq("id", guest.id);

  store.delete(GUEST_COOKIE);
  return guest.group_id;
}