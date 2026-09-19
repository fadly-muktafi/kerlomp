"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { reviewSubmission } from "@/lib/groups/proof-actions";
import { useGroupRealtime } from "@/components/realtime/realtime-provider";
import { Button } from "@/components/ui/button";

export function ReviewForm({
  groupId,
  submissionId,
}: {
  groupId: string;
  submissionId: string;
}) {
  const router = useRouter();
  const { broadcastChange } = useGroupRealtime();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const decision = String(data.get("decision") ?? "");
    const note = String(data.get("note") ?? "");

    if (decision === "reject" && note.trim().length < 3) {
      setError("Alasan reject wajib, minimal 3 karakter.");
      return;
    }

    startTransition(async () => {
      const payload = new FormData();
      payload.set("groupId", groupId);
      payload.set("submissionId", submissionId);
      payload.set("decision", decision);
      payload.set("note", note);

      const result = await reviewSubmission(undefined, payload);
      if (result?.error) {
        setError(result.error);
        return;
      }

      broadcastChange("tasks");
      form.reset();
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="submissionId" value={submissionId} />
      <label className="flex flex-col gap-2">
        <span className="text-small font-medium text-ink">
          Catatan (wajib bila menolak)
        </span>
        <textarea
          name="note"
          rows={2}
          maxLength={2000}
          className="rounded-sm border border-line bg-surface px-3 py-2 text-body text-ink"
        />
      </label>
      {error ? (
        <p className="text-small text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="submit" name="decision" value="approve" disabled={pending}>
          Setujui
        </Button>
        <Button
          type="submit"
          name="decision"
          value="reject"
          variant="danger"
          disabled={pending}
        >
          Tolak
        </Button>
      </div>
    </form>
  );
}