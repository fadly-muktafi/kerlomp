"use client";

import { useActionState } from "react";
import { createGroup, type CreateGroupState } from "@/lib/groups/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateGroupForm() {
  const [state, action, pending] = useActionState<CreateGroupState, FormData>(
    createGroup,
    undefined,
  );

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-md border border-line bg-surface p-4"
    >
      <Input
        label="Nama grup"
        name="name"
        placeholder="Misal: Tugas Besar Basis Data"
        required
        maxLength={120}
      />
      <Input
        label="Deskripsi (opsional)"
        name="description"
        placeholder="Tujuan atau catatan singkat"
        maxLength={2000}
      />
      <Input label="Deadline (opsional)" name="deadline" type="datetime-local" />
      {state?.error ? (
        <p className="text-small text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Membuat..." : "Buat grup"}
      </Button>
    </form>
  );
}