"use client";

import { useActionState } from "react";
import { reviewSubmission, type ProofState } from "@/lib/groups/proof-actions";
import { Button } from "@/components/ui/button";

export function ReviewForm({
  groupId,
  submissionId,
}: {
  groupId: string;
  submissionId: string;
}) {
  const [state, action, pending] = useActionState<ProofState, FormData>(
    reviewSubmission,
    undefined,
  );

  return (
    <form
      action={action}
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
      {state?.error ? (
        <p className="text-small text-danger" role="alert">
          {state.error}
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