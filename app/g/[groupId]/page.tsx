import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGroupForViewer } from "@/lib/data/groups";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { TaskBoard } from "@/components/features/tasks/task-board";
import { InvitePanel } from "@/components/features/groups/invite-panel";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Grup" };

/**
 * Halaman grup bisa dibuka member (login) ATAU guest (cookie).
 * Karena itu route ini di luar layout (app) yang mewajibkan login.
 */
export default async function GroupPage({ params }: PageProps<"/g/[groupId]">) {
  const { groupId } = await params;
  const detail = await getGroupForViewer(groupId);

  if (!detail) {
    notFound();
  }

  const { group, members, tasks, viewer } = detail;
  const isLeader = viewer.kind === "member" && viewer.isLeader;
  const canEdit = viewer.kind === "member";
  const viewerMemberId =
    viewer.kind === "member"
      ? (members.find((member) => member.userId === viewer.userId)?.id ?? null)
      : viewer.memberId;
  const homeHref = viewer.kind === "member" ? "/dashboard" : "/";

  return (
    <div className="min-h-[100dvh] bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Link
            href={homeHref}
            className="font-display text-h3 font-bold text-ink"
          >
            Kerlomp
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-h1 font-bold text-ink">
              {group.name}
            </h1>
            {isLeader ? <Badge tone="accent">Leader</Badge> : null}
            {viewer.kind === "guest" ? <Badge tone="warn">Tamu</Badge> : null}
          </div>
          {group.description ? (
            <p className="max-w-[65ch] text-body text-ink-muted">
              {group.description}
            </p>
          ) : null}
          {group.deadline ? (
            <p className="font-mono text-small text-ink-muted">
              Deadline: {formatDate(group.deadline)}
            </p>
          ) : null}
        </header>

        {viewer.kind === "guest" ? (
          <section className="flex flex-col items-start gap-3 rounded-md border border-line bg-surface p-4">
            <p className="text-small text-ink">
              Kamu gabung sebagai tamu. Masuk pakai Google supaya bisa ikut
              mengubah status tugas.
            </p>
            <Link
              href={`/login?next=/g/${group.id}`}
              className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-small font-medium text-accent-ink transition-transform duration-150 active:scale-[0.98]"
            >
              Masuk pakai Google
            </Link>
          </section>
        ) : null}

        <RealtimeProvider
          groupId={group.id}
          initialTasks={tasks}
          live={canEdit}
          broadcast={viewer.kind === "guest"}
        >
          <TaskBoard
            groupId={group.id}
            members={members}
            canEdit={canEdit}
            isLeader={isLeader}
            viewerMemberId={viewerMemberId}
          />
        </RealtimeProvider>

        {isLeader ? (
          <InvitePanel groupId={group.id} inviteToken={group.inviteToken} />
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-h2 text-ink">
            Anggota ({members.length})
          </h2>
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-body text-ink">
                  {member.name}
                  {member.isGuest ? " (tamu)" : ""}
                </span>
                <span className="text-small text-ink-muted">
                  Gabung {formatDate(member.joinedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}