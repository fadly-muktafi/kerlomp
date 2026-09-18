import { Badge } from "@/components/ui/badge";
import type { TaskStatus } from "@/lib/data/groups";

const MAP: Record<
  TaskStatus,
  { tone: "neutral" | "accent" | "warn" | "ok"; label: string }
> = {
  todo: { tone: "neutral", label: "Belum" },
  in_progress: { tone: "accent", label: "Dikerjakan" },
  submitted: { tone: "warn", label: "Menunggu Review" },
  done: { tone: "ok", label: "Selesai" },
};

export function StatusChip({ status }: { status: TaskStatus }) {
  const meta = MAP[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}