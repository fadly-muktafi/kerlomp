import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthedContext } from "@/lib/supabase/authed";
import { getGuestToken } from "@/lib/id/guest";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type Db = SupabaseClient<Database>;

export type GroupSummary = {
  id: string;
  name: string;
  deadline: string | null;
  isLeader: boolean;
};

export type MemberView = {
  id: string;
  userId: string | null;
  name: string;
  isGuest: boolean;
  joinedAt: string;
};

export type TaskStatus = "todo" | "in_progress" | "submitted" | "done";

export type ProofFile = {
  path: string;
  name: string;
  size: number;
  mime: string;
};

export type SubmissionView = {
  id: string;
  note: string;
  files: ProofFile[];
  decision: "pending" | "approved" | "rejected";
  leaderNote: string | null;
  createdAt: string;
};

export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string;
  status: TaskStatus;
  deadline: string | null;
  updatedAt: string;
  submission: SubmissionView | null;
};

function parseProofFiles(value: unknown): ProofFile[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as ProofFile).path === "string" &&
      typeof (item as ProofFile).name === "string"
    ) {
      return [
        {
          path: (item as ProofFile).path,
          name: (item as ProofFile).name,
          size: Number((item as ProofFile).size) || 0,
          mime: String((item as ProofFile).mime ?? ""),
        },
      ];
    }
    return [];
  });
}

export type GroupDetail = {
  group: {
    id: string;
    name: string;
    description: string | null;
    deadline: string | null;
    inviteToken: string;
    leaderId: string;
  };
  members: MemberView[];
  tasks: TaskView[];
  viewer:
    | { kind: "member"; userId: string; isLeader: boolean }
    | { kind: "guest"; memberId: string; name: string };
};

const GROUP_COLUMNS =
  "id, name, description, deadline, invite_token, leader_id, created_at";

function mapGroup(row: {
  id: string;
  name: string;
  description: string | null;
  deadline: string | null;
  invite_token: string;
  leader_id: string;
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    deadline: row.deadline,
    inviteToken: row.invite_token,
    leaderId: row.leader_id,
  };
}

async function fetchMembers(db: Db, groupId: string): Promise<MemberView[]> {
  const { data } = await db
    .from("members")
    .select("id, user_id, guest_name, joined_at, profiles(display_name, avatar_url)")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });

  return (data ?? []).map((member) => {
    const profile = Array.isArray(member.profiles)
      ? member.profiles[0]
      : member.profiles;
    return {
      id: member.id,
      userId: member.user_id,
      name: profile?.display_name ?? member.guest_name ?? "Anggota",
      isGuest: member.user_id === null,
      joinedAt: member.joined_at,
    };
  });
}

async function fetchTasks(db: Db, groupId: string): Promise<TaskView[]> {
  const { data } = await db
    .from("sub_tasks")
    .select(
      "id, title, description, assignee_id, status, deadline, updated_at, created_at, submissions(id, note, files, decision, leader_note, created_at)",
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((task) => {
    const submissions = Array.isArray(task.submissions) ? task.submissions : [];
    const latest = submissions
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      assigneeId: task.assignee_id,
      status: task.status,
      deadline: task.deadline,
      updatedAt: task.updated_at,
      submission: latest
        ? {
            id: latest.id,
            note: latest.note,
            files: parseProofFiles(latest.files),
            decision: latest.decision,
            leaderNote: latest.leader_note,
            createdAt: latest.created_at,
          }
        : null,
    };
  });
}

/** Grup yang boleh dilihat user login (RLS: hanya grup tempat ia anggota). */
export const getMyGroups = cache(async (): Promise<GroupSummary[]> => {
  const ctx = await getAuthedContext();
  if (!ctx) return [];

  const { data } = await ctx.db
    .from("groups")
    .select("id, name, deadline, leader_id")
    .order("created_at", { ascending: false });

  return (data ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    deadline: group.deadline,
    isLeader: group.leader_id === ctx.userId,
  }));
});

/** Undangan berdasarkan token (route handler/join page, service role). */
export async function getInviteByToken(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("groups")
    .select("id, name, invite_token")
    .eq("invite_token", token)
    .maybeSingle();
  return data ? { id: data.id, name: data.name, token: data.invite_token } : null;
}

/** Detail grup untuk member (RLS, token eksplisit) atau guest (cookie, service role). */
export const getGroupForViewer = cache(
  async (groupId: string): Promise<GroupDetail | null> => {
    if (!/^[0-9a-f-]{36}$/i.test(groupId)) return null;

    const ctx = await getAuthedContext();
    if (ctx) {
      const { data: group } = await ctx.db
        .from("groups")
        .select(GROUP_COLUMNS)
        .eq("id", groupId)
        .maybeSingle();
      if (!group) return null;

      const [members, tasks] = await Promise.all([
        fetchMembers(ctx.db, groupId),
        fetchTasks(ctx.db, groupId),
      ]);

      return {
        group: mapGroup(group),
        members,
        tasks,
        viewer: {
          kind: "member",
          userId: ctx.userId,
          isLeader: group.leader_id === ctx.userId,
        },
      };
    }

    const guestToken = await getGuestToken();
    if (!guestToken) return null;

    const admin = createAdminClient();
    const { data: member } = await admin
      .from("members")
      .select("id, group_id, guest_name")
      .eq("guest_token", guestToken)
      .is("user_id", null)
      .maybeSingle();
    if (!member || member.group_id !== groupId) return null;

    const { data: group } = await admin
      .from("groups")
      .select(GROUP_COLUMNS)
      .eq("id", groupId)
      .maybeSingle();
    if (!group) return null;

    const [members, tasks] = await Promise.all([
      fetchMembers(admin, groupId),
      fetchTasks(admin, groupId),
    ]);

    return {
      group: mapGroup(group),
      members,
      tasks,
      viewer: {
        kind: "guest",
        memberId: member.id,
        name: member.guest_name ?? "Tamu",
      },
    };
  },
);