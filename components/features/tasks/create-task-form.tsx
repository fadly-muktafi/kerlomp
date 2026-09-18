"use client";

import { useActionState } from "react";
import { createSubTask, type CreateTaskState } from "@/lib/groups/task-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MemberView } from "@/lib/data/groups";

export function CreateTaskForm({
  groupId,
  members,
}: {
  groupId: string;
  members: MemberView[];
}) {
  const [state, action, pending] = useActionState<CreateTaskState, FormData>(
    createSubTask,
    undefined,
  );

  return (
    <form
      key={state?.ok ? state.at : "fresh"}
      action={action}
      className="flex flex-col gap-4 rounded-md border border-line bg-surface p-4"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <Input
        label="Judul tugas"
        name="title"
        placeholder="Misal: Susun bab 1"
        required
        maxLength={200}
      />
      <Input label="Deskripsi (opsional)" name="description" maxLength={2000} />
      <label className="flex flex-col gap-2">
        <span className="text-small font-medium text-ink">Pilih anggota</span>
        <select
          name="assigneeId"
          required
          defaultValue=""
          className="h-11 rounded-sm border border-line bg-surface px-3 text-body text-ink"
        >
          <option value="" disabled>
            Pilih anggota
          </option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
              {member.isGuest ? " (tamu)" : ""}
            </option>
          ))}
        </select>
      </label>
      <Input label="Deadline (opsional)" name="deadline" type="datetime-local" />
      {state?.error ? (
        <p className="text-small text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="text-small text-ok" role="status">
          Tugas ditambahkan.
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Menyimpan..." : "Tambah tugas"}
      </Button>
    </form>
  );
}