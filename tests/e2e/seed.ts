import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Seed = {
  admin: SupabaseClient;
  userId: string;
  groupId: string;
  inviteToken: string;
  taskId: string;
};

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Env Supabase untuk E2E tidak lengkap. Pastikan .env.local memuat URL + service role key.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Buat grup uji + leader + satu tugas, memakai service role. */
export async function createSeedGroup(): Promise<Seed> {
  const admin = adminClient();
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}@test.local`;

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password: `Pw-${Math.random().toString(36).slice(2)}-Aa1`,
    email_confirm: true,
  });
  if (userError || !userData.user) {
    throw new Error(userError?.message ?? "gagal membuat user e2e");
  }

  const { data: group, error: groupError } = await admin
    .from("groups")
    .insert({ name: "Grup E2E", leader_id: userData.user.id })
    .select("id, invite_token")
    .single();
  if (groupError || !group) {
    throw new Error(groupError?.message ?? "gagal membuat grup e2e");
  }

  const { data: member } = await admin
    .from("members")
    .select("id")
    .eq("group_id", group.id)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!member) {
    throw new Error("leader member tidak terbentuk");
  }

  const { data: task, error: taskError } = await admin
    .from("sub_tasks")
    .insert({
      group_id: group.id,
      title: "Tugas E2E",
      assignee_id: member.id,
      status: "todo",
    })
    .select("id")
    .single();
  if (taskError || !task) {
    throw new Error(taskError?.message ?? "gagal membuat tugas e2e");
  }

  return {
    admin,
    userId: userData.user.id,
    groupId: group.id,
    inviteToken: group.invite_token,
    taskId: task.id,
  };
}

export async function cleanupSeed(seed: Seed): Promise<void> {
  await seed.admin.from("groups").delete().eq("id", seed.groupId);
  await seed.admin.auth.admin.deleteUser(seed.userId).catch(() => undefined);
}