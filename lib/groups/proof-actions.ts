"use server";

import { revalidatePath } from "next/cache";
import { requireAuthedContext } from "@/lib/supabase/authed";
import { reviewSchema, submitProofSchema } from "@/lib/validation/proof";

export type ProofState = { error?: string; ok?: boolean } | undefined;

export async function submitProof(
  _prev: ProofState,
  formData: FormData,
): Promise<ProofState> {
  const { db } = await requireAuthedContext();

  let files: unknown = [];
  try {
    files = JSON.parse(String(formData.get("files") ?? "[]"));
  } catch {
    files = [];
  }

  const parsed = submitProofSchema.safeParse({
    groupId: formData.get("groupId"),
    subTaskId: formData.get("subTaskId"),
    note: formData.get("note"),
    files,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data bukti tidak valid." };
  }

  // RPC resmi: verifikasi status/assignee + transisi ke `submitted` (SCHEMA.md §6.2).
  const { error } = await db.rpc("submit_proof", {
    p_sub_task: parsed.data.subTaskId,
    p_note: parsed.data.note,
    p_files: parsed.data.files,
  });

  if (error) {
    console.error("submitProof gagal", error.code, error.message);
    return { error: error.message };
  }

  revalidatePath(`/g/${parsed.data.groupId}`);
  revalidatePath(`/g/${parsed.data.groupId}/tasks/${parsed.data.subTaskId}`);
  return { ok: true };
}

export async function reviewSubmission(
  _prev: ProofState,
  formData: FormData,
): Promise<ProofState> {
  const { db } = await requireAuthedContext();

  const parsed = reviewSchema.safeParse({
    groupId: formData.get("groupId"),
    submissionId: formData.get("submissionId"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data review tidak valid." };
  }

  const approve = parsed.data.decision === "approve";
  const note = parsed.data.note?.trim() ?? "";

  if (!approve && note.length < 3) {
    return { error: "Alasan reject wajib, minimal 3 karakter." };
  }

  const { error } = await db.rpc("review_submission", {
    p_submission: parsed.data.submissionId,
    p_approve: approve,
    p_note: approve ? undefined : note,
  });

  if (error) {
    console.error("reviewSubmission gagal", error.code, error.message);
    return { error: error.message };
  }

  revalidatePath(`/g/${parsed.data.groupId}`);
  return { ok: true };
}