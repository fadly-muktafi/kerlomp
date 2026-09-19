import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroupForViewer } from "@/lib/data/groups";
import { getTaskComments } from "@/lib/data/comments";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { TaskComments } from "@/components/features/comments/task-comments";
import { StatusChip } from "@/components/features/tasks/status-chip";
import { ProofForm } from "@/components/features/tasks/proof-form";
import { ReviewForm } from "@/components/features/tasks/review-form";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Detail tugas" };

export default async function TaskPage({
  params,
}: PageProps<"/g/[groupId]/tasks/[taskId]">) {
  const { groupId, taskId } = await params;
  const detail = await getGroupForViewer(groupId);

  if (!detail) notFound();

  const task = detail.tasks.find((item) => item.id === taskId);
  if (!task) notFound();

  const { group, members, viewer } = detail;
  const isLeader = viewer.kind === "member" && viewer.isLeader;
  const viewerMemberId =
    viewer.kind === "member"
      ? (members.find((member) => member.userId === viewer.userId)?.id ?? null)
      : viewer.memberId;
  const assignee = members.find((member) => member.id === task.assigneeId);
  const isAssignee = viewer.kind === "member" && viewerMemberId === task.assigneeId;
  const submission = task.submission;
  const comments = await getTaskComments(task.id);

  return (
    <div className="min-h-[100dvh] bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Link
            href={`/g/${group.id}`}
            className="text-small font-medium text-accent"
          >
            Kembali ke {group.name}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-h1 font-bold text-ink">
              {task.title}
            </h1>
            <StatusChip status={task.status} />
            {isLeader ? <Badge tone="accent">Leader</Badge> : null}
            {viewer.kind === "guest" ? <Badge tone="warn">Tamu</Badge> : null}
          </div>
          <p className="text-small text-ink-muted">
            Untuk {assignee?.name ?? "tanpa assignee"}
            {task.deadline ? ` · Deadline ${formatDate(task.deadline)}` : ""}
          </p>
          {task.description ? (
            <p className="max-w-[65ch] text-body text-ink-muted">
              {task.description}
            </p>
          ) : null}
        </div>

        {submission?.decision === "rejected" && submission.leaderNote ? (
          <p
            className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-small text-danger"
            role="alert"
          >
            Ditolak: {submission.leaderNote}
          </p>
        ) : null}

        {submission ? (
          <section className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
            <h2 className="font-display text-h3 font-medium text-ink">
              Bukti yang dikirim
            </h2>
            <p className="text-body whitespace-pre-wrap text-ink">
              {submission.note}
            </p>
            {submission.files.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {submission.files.map((file) => (
                  <li key={file.path}>
                    <a
                      href={`/api/proofs/download?path=${encodeURIComponent(file.path)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-small font-medium text-accent underline-offset-4 hover:underline"
                    >
                      {file.name}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-small text-ink-muted">
              {submission.decision === "pending"
                ? "Menunggu review"
                : submission.decision === "approved"
                  ? "Disetujui"
                  : "Ditolak"}{" "}
              · {formatDate(submission.createdAt)}
            </p>
          </section>
        ) : null}

        {isAssignee && task.status === "in_progress" ? (
          <ProofForm groupId={group.id} subTaskId={task.id} />
        ) : null}

        {isLeader && submission?.decision === "pending" ? (
          <ReviewForm groupId={group.id} submissionId={submission.id} />
        ) : null}

        {viewer.kind === "guest" ? (
          <section className="flex flex-col items-start gap-3 rounded-md border border-line bg-surface p-4">
            <p className="text-small text-ink">
              Kamu gabung sebagai tamu. Masuk pakai Google untuk ikut mengubah
              atau menilai tugas.
            </p>
            <Link
              href={`/login?next=/g/${group.id}/tasks/${task.id}`}
              className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-small font-medium text-accent-ink"
            >
              Masuk pakai Google
            </Link>
          </section>
        ) : null}

        <RealtimeProvider
          groupId={group.id}
          initialTasks={[task]}
          subTaskId={task.id}
          initialComments={comments}
          live={viewer.kind === "member"}
          broadcast={viewer.kind === "guest"}
        >
          <TaskComments
            groupId={group.id}
            subTaskId={task.id}
            members={members}
            canWrite={viewer.kind === "member"}
            isLeader={isLeader}
          />
        </RealtimeProvider>
      </main>
    </div>
  );
}