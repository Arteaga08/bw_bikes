"use client";

import type { InputHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helper?: string;
  /**
   * Layout classes (`flex-1`, `w-full`, …) for the outer label+input column —
   * `className` targets the `<input>` element itself. Keeping the two
   * separate matters: `flex-1` sets `flex-basis: 0%`, and applying that
   * directly to an element that also has a fixed `h-11` lets `flex-basis`
   * win inside an auto-height `flex-col` parent, collapsing the input to its
   * min-content height instead of 44px.
   */
  wrapperClassName?: string;
}

/**
 * Label always has `htmlFor`/`id` (FRONTEND_GUIDELINES.md §5); the error or
 * helper text is linked via `aria-describedby` so a screen reader announces
 * it, and `aria-invalid` reflects the error state — never just a red border.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helper, id, className, wrapperClassName, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descriptionId = error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined;

  return (
    <div className={cn("flex flex-col gap-xs", wrapperClassName)}>
      <label htmlFor={inputId} className="font-ui text-ui text-negro">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={descriptionId}
        className={cn(
          // `text-body-l` (16px) below `sm` — under 16px, iOS Safari zooms the
          // viewport on focus, which then has to be undone by the user.
          "h-11 rounded-control border bg-surface px-md font-body text-body-l text-negro sm:text-body",
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
