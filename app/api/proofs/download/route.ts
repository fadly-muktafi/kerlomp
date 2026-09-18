import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/authed";
import { getGuestToken } from "@/lib/id/guest";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Signed URL berumur pendek untuk file bukti. Hanya anggota grup terkait
 * (login atau guest cookie) yang diizinkan. Bucket tetap privat.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";
  const parts = path.split("/");
  const groupId = parts[0] ?? "";

  if (parts.length < 3 || !/^[0-9a-f-]{36}$/i.test(groupId)) {
    return new NextResponse("Tidak ditemukan", { status: 404 });
  }

  const ctx = await getAuthedContext();
  let allowed = false;

  if (ctx) {
    const { data } = await ctx.db
      .from("groups")
      .select("id")
      .eq("id", groupId)
      .maybeSingle();
    allowed = Boolean(data);
  } else {
    const guestToken = await getGuestToken();
    if (guestToken) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("members")
        .select("id")
        .eq("group_id", groupId)
        .eq("guest_token", guestToken)
        .is("user_id", null)
        .maybeSingle();
      allowed = Boolean(data);
    }
  }

  if (!allowed) {
    return new NextResponse("Tidak diizinkan", { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("proofs")
    .createSignedUrl(path, 3600);

  if (error || !data) {
    return new NextResponse("Tidak ditemukan", { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}