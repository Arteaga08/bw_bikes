"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  helper?: string;
  children: ReactNode;
  /** Layout classes for the outer label+select column — see `Input`'s `wrapperClassName` for why these stay off the `<select>` itself. */
  wrapperClassName?: string;
}

/**
 * Native `<select>` — same accessibility contract as `Input` (label with
 * `htmlFor`/`id`, `aria-describedby`, `aria-invalid` reflecting the error
 * state, never just a red border). Options are passed as children so callers
 * control their own `<option>` list instead of this component owning a
 * generic `{value, label}[]` shape that would fight a typed enum like
 * `FulfillmentMode`.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, helper, id, className, wrapperClassName, children, ...props },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const descriptionId = error ? `${selectId}-error` : helper ? `${selectId}-helper` : undefined;

  return (
    <div className={cn("flex flex-col gap-xs", wrapperClassName)}>
      <label htmlFor={selectId} className="font-ui text-ui text-negro">
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={descriptionId}
        className={cn(
          // `text-body-l` (16px) below `sm` — same iOS focus-zoom fix as `Input`.
          "h-11 rounded-control border bg-surface px-md font-body text-body-l text-negro sm:text-body",
          "transition-colors duration-150",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
          error ? "border-estado-error" : "border-borde",
          "disabled:bg-inset disabled:text-negro-disabled-text disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      >
        {children}
      </select>
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
