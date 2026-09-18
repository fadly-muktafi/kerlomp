import { NextResponse } from "next/server";
import { getAuthedContext } from "@/lib/supabase/authed";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROOF_MIME_EXT, uploadMetaSchema } from "@/lib/validation/proof";

/**
 * Validasi (MIME allowlist + ukuran + assignee) lalu kembalikan signed upload URL.
 * Client mengunggah langsung ke Storage; file tidak melewati server.
 */
export async function POST(request: Request) {
  const ctx = await getAuthedContext();
  if (!ctx) {
    return NextResponse.json({ error: "Harus login." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = uploadMetaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data unggahan tidak valid." },
      { status: 400 },
    );
  }

  const ext = PROOF_MIME_EXT[parsed.data.mime];
  if (!ext) {
    return NextResponse.json(
      { error: "Tipe file tidak diizinkan (jpeg, png, webp, pdf, docx, pptx)." },
      { status: 400 },
    );
  }

  const { db, userId } = ctx;

  const { data: task } = await db
    .from("sub_tasks")
    .select("id, group_id, assignee_id, status")
    .eq("id", parsed.data.subTaskId)
    .maybeSingle();

  if (!task || task.group_id !== parsed.data.groupId) {
    return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  }
  if (task.status !== "in_progress") {
    return NextResponse.json(
      { error: "Tugas tidak bisa diserahkan pada status ini." },
      { status: 409 },
    );
  }

  const { data: member } = await db
    .from("members")
    .select("id")
    .eq("group_id", parsed.data.groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member || member.id !== task.assignee_id) {
    return NextResponse.json({ error: "Ini bukan tugasmu." }, { status: 403 });
  }

  const path = `${parsed.data.groupId}/${parsed.data.subTaskId}/${crypto.randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("proofs")
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("sign-upload gagal", error?.message);
    return NextResponse.json({ error: "Gagal menyiapkan unggahan." }, { status: 500 });
  }

  return NextResponse.json({ path, token: data.token });
}