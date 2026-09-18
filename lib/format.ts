/** Format tanggal gaya Indonesia, dipakai server dan client. */
const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export type DeadlineTone = "ok" | "warn" | "danger";

/** Label + tone chip deadline (DESIGN.md §5.3: ok normal, warn H-2, danger H-0). */
export function deadlineLabel(
  iso: string,
  now: Date = new Date(),
): { label: string; tone: DeadlineTone } {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const days = Math.ceil(diffMs / 86_400_000);

  if (diffMs < 0) return { label: "Lewat deadline", tone: "danger" };
  if (days <= 0) return { label: "Hari ini", tone: "danger" };
  if (days === 1) return { label: "Besok", tone: "danger" };
  if (days === 2) return { label: "H-2", tone: "warn" };
  return { label: formatDate(iso), tone: "ok" };
}