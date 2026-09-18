import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { getInviteByToken } from "@/lib/data/groups";
import { requestOrigin } from "@/lib/http/origin";
import { GUEST_COOKIE } from "@/lib/id/guest";
import { createAdminClient } from "@/lib/supabase/admin";
import { guestNameSchema } from "@/lib/validation/group";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const origin = requestOrigin(request);
  const back = `${origin}/join/${encodeURIComponent(token)}`;

  const invite = await getInviteByToken(token);
  if (!invite) {
    return NextResponse.redirect(`${back}?error=invalid`);
  }

  const admin = createAdminClient();
  const session = await getSession();

  // Sudah login: gabung sebagai anggota akun. Trigger DB sudah menambah leader,
  // jadi upsert dengan ignoreDuplicates aman dari duplikasi.
  if (session) {
    const { error } = await admin
      .from("members")
      .upsert(
        { group_id: invite.id, user_id: session.userId },
        { onConflict: "group_id,user_id", ignoreDuplicates: true },
      );
    if (error) {
      return NextResponse.redirect(`${back}?error=join`);
    }
    return NextResponse.redirect(`${origin}/g/${invite.id}`);
  }

  const nameResult = guestNameSchema.safeParse(form.get("name"));
  if (!nameResult.success) {
    return NextResponse.redirect(`${back}?error=${encodeURIComponent(nameResult.error.issues[0]?.message ?? "Nama tidak valid")}`);
  }

  const guestToken = crypto.randomUUID();
  const { error } = await admin.from("members").insert({
    group_id: invite.id,
    guest_name: nameResult.data,
    guest_token: guestToken,
  });
  if (error) {
    return NextResponse.redirect(`${back}?error=join`);
  }

  const response = NextResponse.redirect(`${origin}/g/${invite.id}`);
  response.cookies.set(GUEST_COOKIE, guestToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: THIRTY_DAYS,
    path: "/",
  });
  return response;
}