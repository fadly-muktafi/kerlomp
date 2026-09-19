"use client";

import { CommentList } from "@/components/features/comments/comment-list";
import { CommentForm } from "@/components/features/comments/comment-form";
import type { MemberView } from "@/lib/data/groups";

/**
 * Seksi komentar satu tugas. Member bisa menulis; guest hanya membaca.
 * Realtime komentar aktif via provider (subTaskId).
 */
export function TaskComments({
  groupId,
  subTaskId,
  members,
  canWrite,
  isLeader,
}: {
  groupId: string;
  subTaskId: string;
  members: MemberView[];
  canWrite: boolean;
  isLeader: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-h2 text-ink">Diskusi</h2>
      <CommentList
        groupId={groupId}
        subTaskId={subTaskId}
        members={members}
        canDelete={isLeader}
      />
      {canWrite ? (
        <CommentForm groupId={groupId} subTaskId={subTaskId} />
      ) : null}
    </section>
  );
}