"use client";

import type { TextareaHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helper?: string;
}

/** Same accessibility contract as `Input`/`Select` — label, `aria-describedby`, `aria-invalid`. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, helper, id, className, rows = 4, ...props },
  ref,
) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  const descriptionId = error ? `${textareaId}-error` : helper ? `${textareaId}-helper` : undefined;

  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={textareaId} className="font-ui text-ui text-negro">
        {label}
      </label>
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={descriptionId}
        className={cn(
          "rounded-control border bg-surface px-md py-sm font-body text-body text-negro",
          "transition-colors duration-150 resize-y",
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
