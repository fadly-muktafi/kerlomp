"use client";

import { useGroupRealtime } from "@/components/realtime/realtime-provider";
import { CreateTaskForm } from "@/components/features/tasks/create-task-form";
import { TaskRow } from "@/components/features/tasks/task-row";
import type { MemberView } from "@/lib/data/groups";

function ratio(done: number, total: number): number {
  return total === 0 ? 0 : done / total;
}

export function TaskBoard({
  groupId,
  members,
  canEdit,
  isLeader,
  viewerMemberId,
}: {
  groupId: string;
  members: MemberView[];
  canEdit: boolean;
  isLeader: boolean;
  viewerMemberId: string | null;
}) {
  const { tasks, status } = useGroupRealtime();

  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  const percent = Math.round(ratio(done, total) * 100);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-h2 text-ink">Tugas ({total})</h2>
        {canEdit ? (
          <span className="text-small text-ink-muted" aria-live="polite">
            {status === "connected"
              ? "Tersambung"
              : status === "connecting"
                ? "Menyambung..."
                : "Offline"}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-small text-ink-muted">
          <span>
            {done} dari {total} selesai
          </span>
          <span className="font-mono">{percent}%</span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progres grup"
        >
          <div
            className="h-full origin-left rounded-full bg-accent transition-transform duration-300"
            style={{ transform: `scaleX(${ratio(done, total)})` }}
          />
        </div>
      </div>

      {members.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {members.map((member) => {
            const assigned = tasks.filter(
              (task) => task.assigneeId === member.id,
            );
            const memberDone = assigned.filter(
              (task) => task.status === "done",
            ).length;
            const memberPercent = Math.round(
              ratio(memberDone, assigned.length) * 100,
            );
            return (
              <li key={member.id} className="flex items-center gap-3 text-small">
                <span className="w-28 truncate text-ink sm:w-40">
                  {member.name}
                  {member.isGuest ? " (tamu)" : ""}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full origin-left rounded-full bg-accent"
                    style={{ transform: `scaleX(${ratio(memberDone, assigned.length)})` }}
                  />
                </span>
                <span className="w-24 text-right font-mono text-ink-muted">
                  {memberDone}/{assigned.length} ({memberPercent}%)
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {isLeader ? <CreateTaskForm groupId={groupId} members={members} /> : null}

      {total === 0 ? (
        <p className="text-body text-ink-muted">
          {canEdit
            ? "Belum ada tugas. Pecah tugas pertamamu."
            : "Belum ada tugas di grup ini."}
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              groupId={groupId}
              task={task}
              members={members}
              canEdit={canEdit}
              isLeader={isLeader}
              viewerMemberId={viewerMemberId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}