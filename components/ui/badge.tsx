import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "warn" | "ok" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "border border-line bg-surface-2 text-ink-muted",
  accent: "bg-accent/12 text-accent",
  warn: "bg-warn/14 text-warn",
  ok: "bg-ok/14 text-ok",
  danger: "bg-danger/14 text-danger",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-small font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}