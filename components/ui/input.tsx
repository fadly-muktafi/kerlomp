import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helperText?: string;
  error?: string;
};

export function Input({
  label,
  helperText,
  error,
  id,
  className,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  const describedBy = error
    ? `${inputId}-error`
    : helperText
      ? `${inputId}-help`
      : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-small font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-11 rounded-sm border border-line bg-surface px-3 text-body text-ink placeholder:text-ink-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          error && "border-danger",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-small text-danger">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-help`} className="text-small text-ink-muted">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}