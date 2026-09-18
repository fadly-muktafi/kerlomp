import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-95",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:brightness-95",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-small",
  md: "h-11 px-5 text-body",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-[transform,background-color,color] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}