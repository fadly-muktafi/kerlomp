"use client";

import { useTransition } from "react";
import { Trash } from "@phosphor-icons/react";
import { deleteComment } from "@/lib/groups/comment-actions";
import { useGroupRealtime } from "@/components/realtime/realtime-provider";
import { Button } from "@/components/ui/button";
import type { MemberView } from "@/lib/data/groups";

export function CommentList({
  groupId,
  subTaskId,
  members,
  canDelete,
}: {
  groupId: string;
  subTaskId: string;
  members: MemberView[];
  canDelete: boolean;
}) {
  const { comments, removeCommentLocally, broadcastChange } = useGroupRealtime();
  const [pending, startTransition] = useTransition();

  if (!comments || comments.length === 0) {
    return (
      <p className="text-small text-ink-muted">
        Belum ada komentar. Diskusi di sini, bukan di grup WhatsApp.
      </p>
    );
  }

  const sorted = comments.toSorted((a, b) =>
    a.createdAt < b.createdAt
      ? -1
      : a.createdAt > b.createdAt
        ? 1
        : a.id < b.id
          ? -1
          : 1,
  );

  function onDelete(
    event: React.FormEvent<HTMLFormElement>,
    commentId: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;

    startTransition(async () => {
      const payload = new FormData();
      payload.set("groupId", groupId);
      payload.set("subTaskId", subTaskId);
      payload.set("commentId", commentId);

      const result = await deleteComment(payload);
      if (result?.error) return;

      removeCommentLocally(commentId);
      broadcastChange("comments");
      form.reset();
    });
  }

  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((comment) => {
        const author = members.find(
          (member) => member.id === comment.authorMemberId,
        );
        const deletable = canDelete || Boolean(author);
        return (
          <li
            key={comment.id}
            className="flex flex-col gap-1 rounded-md border border-line bg-surface p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-small font-medium text-ink">
                {author?.name ?? comment.authorName}
                {author?.isGuest ? " (tamu)" : ""}
              </span>
              {deletable ? (
                <form onSubmit={(event) => onDelete(event, comment.id)}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label="Hapus komentar"
                    disabled={pending}
                  >
                    <Trash size={14} weight="regular" aria-hidden />
                  </Button>
                </form>
              ) : null}
            </div>
            <p className="text-body whitespace-pre-wrap text-ink">
              {comment.body}
            </p>
          </li>
        );
      })}
    </ul>
  );
}