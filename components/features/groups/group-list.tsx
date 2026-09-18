import Link from "next/link";
import type { GroupSummary } from "@/lib/data/groups";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export function GroupList({ groups }: { groups: GroupSummary[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-body text-ink-muted">
        Belum ada grup. Buat grup pertamamu di bawah.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <li key={group.id}>
          <Link
            href={`/g/${group.id}`}
            className="flex h-full flex-col justify-between gap-3 rounded-md border border-line bg-surface p-4 transition-colors duration-150 hover:bg-surface-2"
          >
            <span className="font-display text-h3 font-medium text-ink">
              {group.name}
            </span>
            <span className="flex flex-wrap items-center gap-2 text-small text-ink-muted">
              <Badge tone={group.isLeader ? "accent" : "neutral"}>
                {group.isLeader ? "Leader" : "Anggota"}
              </Badge>
              {group.deadline ? (
                <span className="font-mono">{formatDate(group.deadline)}</span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}