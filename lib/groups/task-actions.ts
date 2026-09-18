"use server";

import { revalidatePath } from "next/cache";
import { requireAuthedContext } from "@/lib/supabase/authed";
import { createSubTaskSchema } from "@/lib/validation/task";
import type { Database } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient<Database>;

export type CreateTaskState =
  | { error?: string; ok?: boolean; at?: number }
  | undefined;

function isUuid(value: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(value);
}

async function isLeaderOf(
  db: Db,
  groupId: string,
  userId: string,
): Promise<boolean> {
  if (!isUuid(groupId)) return false;
  const { data } = await db
    .from("groups")
    .select("leader_id")
    .eq("id", groupId)
    .maybeSingle();
  return data?.leader_id === userId;
}

export async function createSubTask(
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const { db, userId } = await requireAuthedContext();
  const groupId = String(formData.get("groupId") ?? "");

  if (!(await isLeaderOf(db, groupId, userId))) {
    return { error: "Hanya leader yang bisa menambah tugas." };
  }

  const parsed = createSubTaskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    assigneeId: formData.get("assigneeId"),
    deadline: formData.get("deadline"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tugas tidak valid." };
  }

  const { data: assignee } = await db
    .from("members")
    .select("id")
    .eq("id", parsed.data.assigneeId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (!assignee) {
    return { error: "Anggota yang dipilih tidak ada di grup ini." };
  }

  const { error } = await db.from("sub_tasks").insert({
    group_id: groupId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    assignee_id: parsed.data.assigneeId,
    deadline: parsed.data.deadline
      ? new Date(parsed.data.deadline).toISOString()
      : null,
  });

  if (error) {
    console.error("createSubTask gagal", error.code, error.message);
    return { error: "Gagal menambah tugas. Coba lagi." };
  }

  revalidatePath(`/g/${groupId}`);
  return { ok: true, at: Date.now() };
}

export async function deleteSubTask(formData: FormData) {
  const { db, userId } = await requireAuthedContext();
  const taskId = String(formData.get("taskId") ?? "");
  if (!isUuid(taskId)) return;

  const { data: task } = await db
    .from("sub_tasks")
    .select("id, group_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return;
  if (!(await isLeaderOf(db, task.group_id, userId))) return;

  await db.from("sub_tasks").delete().eq("id", taskId);
  revalidatePath(`/g/${task.group_id}`);
}

export async function reassignSubTask(formData: FormData) {
  const { db, userId } = await requireAuthedContext();
  const taskId = String(formData.get("taskId") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "");
  if (!isUuid(taskId) || !isUuid(assigneeId)) return;

  const { data: task } = await db
    .from("sub_tasks")
    .select("id, group_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return;
  if (!(await isLeaderOf(db, task.group_id, userId))) return;

  const { data: assignee } = await db
    .from("members")
    .select("id")
    .eq("id", assigneeId)
    .eq("group_id", task.group_id)
    .maybeSingle();
  if (!assignee) return;

  await db
    .from("sub_tasks")
    .update({ assignee_id: assigneeId })
    .eq("id", taskId);
  revalidatePath(`/g/${task.group_id}`);
}