import Link from "next/link";
import { StatusChip } from "@/components/features/tasks/status-chip";
import { Badge } from "@/components/ui/badge";
import { deadlineLabel } from "@/lib/format";
import type { MyTask } from "@/lib/data/tasks";

export function MyTaskList({ tasks }: { tasks: MyTask[] }) {
  if (tasks.length === 0) {
    return (
      <p className="text-body text-ink-muted">
        Belum ada tugas yang ditugaskan ke kamu.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-md border border-line bg-surface">
      {tasks.map((task) => {
        const chip = task.deadline ? deadlineLabel(task.deadline) : null;
        return (
          <li
            key={task.id}
            className="flex flex-wrap items-center gap-3 px-4 py-3"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                href={`/g/${task.groupId}/tasks/${task.id}`}
                className="text-body text-ink underline-offset-4 hover:underline"
              >
                {task.title}
              </Link>
              <span className="text-small text-ink-muted">
                {task.groupName}
              </span>
            </div>
            {chip ? (
              <Badge tone={chip.tone} suppressHydrationWarning>
                {chip.label}
              </Badge>
            ) : null}
            <StatusChip status={task.status} />
          </li>
        );
      })}
    </ul>
  );
}