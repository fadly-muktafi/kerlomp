import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Elevasi hanya dipakai kalau benar-benar menandakan hierarki (DESIGN.md §4). */
  elevated?: boolean;
};

export function Card({ elevated = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-line bg-surface p-4",
        elevated && "shadow-card",
        className,
      )}
      {...props}
    />
  );
}