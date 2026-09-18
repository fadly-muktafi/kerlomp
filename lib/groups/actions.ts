"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthedContext } from "@/lib/supabase/authed";
import { createGroupSchema } from "@/lib/validation/group";

export type CreateGroupState = { error: string } | undefined;

export async function createGroup(
  _prev: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const { db, userId } = await requireAuthedContext();

  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    deadline: formData.get("deadline"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data grup tidak valid." };
  }

  const { name, description, deadline } = parsed.data;
  const { data, error } = await db
    .from("groups")
    .insert({
      name,
      description: description ?? null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      leader_id: userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createGroup gagal", error?.code, error?.message);
    return { error: "Gagal membuat grup. Coba lagi." };
  }

  revalidatePath("/dashboard");
  redirect(`/g/${data.id}`);
}

export async function regenerateInvite(formData: FormData) {
  const { db, userId } = await requireAuthedContext();
  const groupId = String(formData.get("groupId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return;

  // RLS: hanya leader yang boleh update grup. Filter leader_id untuk jaga-jaga.
  const { error } = await db
    .from("groups")
    .update({ invite_token: crypto.randomUUID() })
    .eq("id", groupId)
    .eq("leader_id", userId);

  if (!error) {
    revalidatePath(`/g/${groupId}`);
  }
}