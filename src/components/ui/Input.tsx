"use client";

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Input / Select primitives (design-system.md §5):
 *  - 48px height, ivory bg, 1px line border
 *  - focus border → ink (no glow rings)
 *  - label 13px uppercase above
 *  - error: --error border + message
 */

const fieldBase =
  "h-12 w-full border bg-ivory px-4 text-sm text-ink placeholder:text-ink-soft/60 " +
  "transition-colors duration-[var(--animate-duration-fast)] " +
  "focus:outline-none focus:border-ink";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  id: string;
};

export const Input = forwardRef<
  HTMLInputElement,
  FieldProps & InputHTMLAttributes<HTMLInputElement>
>(function Input({ label, error, hint, id, className, ...rest }, ref) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="text-meta mb-1.5 block">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={!!error}
        className={cn(fieldBase, error ? "border-error" : "border-line", className)}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-xs text-error">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  FieldProps & SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ label, error, hint, id, className, children, ...rest }, ref) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="text-meta mb-1.5 block">
        {label}
      </label>
      <select
        ref={ref}
        id={id}
        aria-invalid={!!error}
        className={cn(fieldBase, "appearance-none", error ? "border-error" : "border-line", className)}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p className="mt-1 text-xs text-error">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
});
