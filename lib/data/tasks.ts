import "server-only";
import { cache } from "react";
import { getAuthedContext } from "@/lib/supabase/authed";
import type { TaskStatus } from "@/lib/data/groups";

export type MyTask = {
  id: string;
  title: string;
  status: TaskStatus;
  deadline: string | null;
  groupId: string;
  groupName: string;
};

/**
 * "Tugasku": sub-task milik user lintas grup, terurut deadline terdekat (PRD B3).
 * Render server, tanpa realtime.
 */
export const getMyTasks = cache(async (): Promise<MyTask[]> => {
  const ctx = await getAuthedContext();
  if (!ctx) return [];

  const { data: members } = await ctx.db
    .from("members")
    .select("id")
    .eq("user_id", ctx.userId);

  const memberIds = (members ?? []).map((member) => member.id);
  if (memberIds.length === 0) return [];

  const { data } = await ctx.db
    .from("sub_tasks")
    .select("id, title, status, deadline, group_id, groups(name)")
    .in("assignee_id", memberIds)
    .order("deadline", { ascending: true, nullsFirst: false });

  return (data ?? []).map((task) => {
    const group = Array.isArray(task.groups) ? task.groups[0] : task.groups;
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      deadline: task.deadline,
      groupId: task.group_id,
      groupName: group?.name ?? "Grup",
    };
  });
});