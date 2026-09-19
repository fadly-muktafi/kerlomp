"use server";

import { revalidatePath } from "next/cache";
import { requireAuthedContext } from "@/lib/supabase/authed";
import { commentSchema } from "@/lib/validation/comment";
import type { CommentView } from "@/lib/data/comments";

export type CommentResult =
  | { error?: string; ok?: boolean; comment?: CommentView }
  | undefined;

export async function addComment(
  formData: FormData,
): Promise<CommentResult> {
  const { db, userId } = await requireAuthedContext();

  const parsed = commentSchema.safeParse({
    groupId: formData.get("groupId"),
    subTaskId: formData.get("subTaskId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Komentar tidak valid." };
  }

  const { groupId, subTaskId, body } = parsed.data;

  const { data: member } = await db
    .from("members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) {
    return { error: "Kamu bukan anggota grup ini." };
  }

  const { data: inserted, error } = await db
    .from("comments")
    .insert({
      sub_task_id: subTaskId,
      author_member_id: member.id,
      body,
    })
    .select("id, author_member_id, body, created_at")
    .single();

  if (error || !inserted) {
    console.error("addComment gagal", error?.code, error?.message);
    return { error: "Gagal mengirim komentar. Coba lagi." };
  }

  const { data: author } = await db
    .from("members")
    .select("guest_name, profiles(display_name)")
    .eq("id", member.id)
    .maybeSingle();

  const profile = Array.isArray(author?.profiles)
    ? author?.profiles[0]
    : author?.profiles;

  revalidatePath(`/g/${groupId}/tasks/${subTaskId}`);

  return {
    comment: {
      id: inserted.id,
      authorMemberId: inserted.author_member_id,
      authorName: profile?.display_name ?? author?.guest_name ?? "Kamu",
      isGuest: false,
      body: inserted.body,
      createdAt: inserted.created_at,
    },
  };
}

export async function deleteComment(formData: FormData): Promise<CommentResult> {
  const { db, userId } = await requireAuthedContext();

  const taskId = String(formData.get("subTaskId") ?? "");
  const commentId = String(formData.get("commentId") ?? "");
  const groupId = String(formData.get("groupId") ?? "");

  if (!/^[0-9a-f-]{36}$/i.test(commentId)) {
    return { error: "Komentar tidak valid." };
  }

  const { data: comment } = await db
    .from("comments")
    .select("id, author_member_id")
    .eq("id", commentId)
    .maybeSingle();

  if (!comment) return { error: "Komentar tidak ditemukan." };

  const { data: me } = await db
    .from("members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: group } = await db
    .from("groups")
    .select("leader_id")
    .eq("id", groupId)
    .maybeSingle();

  const isMine = me?.id === comment.author_member_id;
  const isLeader = group?.leader_id === userId;

  if (!isMine && !isLeader) {
    return { error: "Hanya penulis atau leader yang bisa menghapus." };
  }

  const { error } = await db.from("comments").delete().eq("id", commentId);
  if (error) {
    console.error("deleteComment gagal", error.code, error.message);
    return { error: "Gagal menghapus komentar." };
  }

  revalidatePath(`/g/${groupId}/tasks/${taskId}`);
  return { ok: true };
}