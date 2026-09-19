"use client";

import { useState, useTransition, type FormEvent } from "react";
import { addComment } from "@/lib/groups/comment-actions";
import { useGroupRealtime } from "@/components/realtime/realtime-provider";
import { Button } from "@/components/ui/button";

export function CommentForm({
  groupId,
  subTaskId,
}: {
  groupId: string;
  subTaskId: string;
}) {
  const { addCommentLocally, broadcastChange } = useGroupRealtime();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get("body") ?? "").trim();

    if (body.length === 0) {
      setError("Komentar wajib diisi.");
      return;
    }

    startTransition(async () => {
      const payload = new FormData();
      payload.set("groupId", groupId);
      payload.set("subTaskId", subTaskId);
      payload.set("body", body);

      const result = await addComment(payload);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.comment) {
        addCommentLocally(result.comment);
      }
      broadcastChange("comments");
      form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <label htmlFor="comment-body" className="text-small font-medium text-ink">
        Tambah komentar
      </label>
      <textarea
        id="comment-body"
        name="body"
        rows={2}
        maxLength={2000}
        placeholder="Tulis diskusi tugas ini"
        className="rounded-sm border border-line bg-surface px-3 py-2 text-body text-ink"
      />
      {error ? (
        <p className="text-small text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? "Mengirim..." : "Kirim"}
      </Button>
    </form>
  );
}