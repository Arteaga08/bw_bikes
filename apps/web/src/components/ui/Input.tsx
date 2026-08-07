"use client";

import type { InputHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helper?: string;
}

/**
 * Label always has `htmlFor`/`id` (FRONTEND_GUIDELINES.md §5); the error or
 * helper text is linked via `aria-describedby` so a screen reader announces
 * it, and `aria-invalid` reflects the error state — never just a red border.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helper, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descriptionId = error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined;

  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={inputId} className="font-ui text-ui text-negro">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={descriptionId}
        className={cn(
          "h-11 rounded-control border bg-surface px-md font-body text-body text-negro",
          "transition-colors duration-150",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
          error ? "border-estado-error" : "border-borde",
          "disabled:bg-base disabled:text-negro-disabled-text disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={descriptionId} className="font-body text-caption text-estado-error">
          {error}
        </p>
      ) : helper ? (
        <p id={descriptionId} className="font-body text-caption text-grafito">
          {helper}
        </p>
      ) : null}
    </div>
  );
});
