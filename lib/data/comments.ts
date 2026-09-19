import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthedContext } from "@/lib/supabase/authed";
import { getGuestToken } from "@/lib/id/guest";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type Db = SupabaseClient<Database>;

export type CommentView = {
  id: string;
  authorMemberId: string;
  authorName: string;
  isGuest: boolean;
  body: string;
  createdAt: string;
};

const COMMENT_COLUMNS = "id, author_member_id, body, created_at";

type CommentRow = {
  id: string;
  author_member_id: string;
  body: string;
  created_at: string;
};

async function authorNames(
  db: Db,
  memberIds: string[],
): Promise<Map<string, { name: string; isGuest: boolean }>> {
  const map = new Map<string, { name: string; isGuest: boolean }>();
  if (memberIds.length === 0) return map;

  const { data } = await db
    .from("members")
    .select("id, user_id, guest_name, profiles(display_name)")
    .in("id", memberIds);

  for (const member of data ?? []) {
    const profile = Array.isArray(member.profiles)
      ? member.profiles[0]
      : member.profiles;
    map.set(member.id, {
      name: profile?.display_name ?? member.guest_name ?? "Anggota",
      isGuest: member.user_id === null,
    });
  }
  return map;
}

function toViews(rows: CommentRow[], names: Map<string, { name: string; isGuest: boolean }>): CommentView[] {
  return rows.map((row) => {
    const author = names.get(row.author_member_id);
    return {
      id: row.id,
      authorMemberId: row.author_member_id,
      authorName: author?.name ?? "Anggota",
      isGuest: author?.isGuest ?? false,
      body: row.body,
      createdAt: row.created_at,
    };
  });
}

/**
 * Komentar satu tugas. `null` = pemanggil tidak punya akses;
 * `[]` = punya akses tapi kosong.
 */
export const getTaskComments = cache(
  async (taskId: string): Promise<CommentView[] | null> => {
    if (!/^[0-9a-f-]{36}$/i.test(taskId)) return null;

    const ctx = await getAuthedContext();
    if (ctx) {
      const { data, error } = await ctx.db
        .from("comments")
        .select(COMMENT_COLUMNS)
        .eq("sub_task_id", taskId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error || data === null) return null;

      const names = await authorNames(
        ctx.db,
        data.map((row) => row.author_member_id),
      );
      return toViews(data, names);
    }

    const guestToken = await getGuestToken();
    if (!guestToken) return null;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("comments")
      .select(COMMENT_COLUMNS)
      .eq("sub_task_id", taskId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error || data === null) return null;

    const names = await authorNames(
      admin,
      data.map((row) => row.author_member_id),
    );
    return toViews(data, names);
  },
);