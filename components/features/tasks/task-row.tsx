"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Trash } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { deleteSubTask, reassignSubTask } from "@/lib/groups/task-actions";
import { useGroupRealtime } from "@/components/realtime/realtime-provider";
import { StatusChip } from "@/components/features/tasks/status-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { deadlineLabel } from "@/lib/format";
import type { MemberView, TaskView } from "@/lib/data/groups";

export function TaskRow({
  groupId,
  task,
  members,
  canEdit,
  isLeader,
  viewerMemberId,
}: {
  groupId: string;
  task: TaskView;
  members: MemberView[];
  canEdit: boolean;
  isLeader: boolean;
  viewerMemberId: string | null;
}) {
  const { patchTask, broadcastChange } = useGroupRealtime();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const assignee = members.find((member) => member.id === task.assigneeId);
  const isDone = task.status === "done";
  const canToggle =
    canEdit &&
    (isLeader || task.assigneeId === viewerMemberId) &&
    (task.status === "todo" || task.status === "in_progress");
  const chip = task.deadline ? deadlineLabel(task.deadline) : null;

  async function toggle() {
    const next = task.status === "todo" ? "in_progress" : "todo";
    const previous = task.status;
    patchTask(task.id, { status: next });

    const supabase = createClient();
    const { error } = await supabase
      .from("sub_tasks")
      .update({ status: next })
      .eq("id", task.id);

    if (error) {
      patchTask(task.id, { status: previous });
      return;
    }
    broadcastChange("tasks");
  }

  function onDelete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    startTransition(async () => {
      const payload = new FormData();
      payload.set("taskId", task.id);
      await deleteSubTask(payload);

      broadcastChange("tasks");
      setConfirming(false);
      form.reset();
    });
  }

  function onReassign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const assigneeId = String(new FormData(form).get("assigneeId") ?? "");
    if (!assigneeId || assigneeId === task.assigneeId) return;

    startTransition(async () => {
      const payload = new FormData();
      payload.set("taskId", task.id);
      payload.set("assigneeId", assigneeId);
      await reassignSubTask(payload);

      patchTask(task.id, { assigneeId });
      broadcastChange("tasks");
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <button
        type="button"
        onClick={toggle}
        disabled={!canToggle}
        aria-label={
          task.status === "todo"
            ? "Tandai sedang dikerjakan"
            : "Tandai belum dikerjakan"
        }
        aria-pressed={task.status === "in_progress"}
        className={cn(
          "inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
          task.status === "in_progress" && "border-accent bg-accent text-accent-ink",
          isDone && "border-ok bg-ok text-accent-ink",
          task.status === "todo" && "border-line bg-surface text-transparent",
          task.status === "submitted" && "border-warn bg-warn/14 text-warn",
          !canToggle && "opacity-60",
        )}
      >
        <Check size={14} weight="bold" aria-hidden />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/g/${groupId}/tasks/${task.id}`}
          className={cn(
            "text-body text-ink underline-offset-4 hover:underline",
            isDone && "line-through decoration-line",
          )}
        >
          {task.title}
        </Link>
        <span className="flex flex-wrap items-center gap-2 text-small text-ink-muted">
          <span>{assignee?.name ?? "Tanpa assignee"}</span>
          {chip ? (
            <Badge tone={chip.tone} suppressHydrationWarning>
              {chip.label}
            </Badge>
          ) : null}
        </span>
      </div>

      <StatusChip status={task.status} />

      {isLeader ? (
        <div className="flex items-center gap-2">
          <form onSubmit={onReassign}>
            <input type="hidden" name="taskId" value={task.id} />
            <select
              name="assigneeId"
              defaultValue={task.assigneeId}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              aria-label="Ganti assignee"
              className="h-9 rounded-sm border border-line bg-surface px-2 text-small text-ink"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </form>

          {confirming ? (
            <form onSubmit={onDelete} className="flex items-center gap-1">
              <input type="hidden" name="taskId" value={task.id} />
              <Button type="submit" variant="danger" size="sm" disabled={pending}>
                Hapus
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
              >
                Batal
              </Button>
            </form>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Hapus tugas"
              onClick={() => setConfirming(true)}
            >
              <Trash size={16} weight="regular" aria-hidden />
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}