"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useId } from "react";
import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label: ReactNode;
  /** Hides the visible label text while keeping it for screen readers — a group heading or swatch name already says what the option is. */
  labelHidden?: boolean;
  /** Layout classes for the outer `<label>` (alignment, spacing in a row) — `className` targets the underlying `<input>`, which is `sr-only` and has no visual layout of its own. Same split as `Input`'s `wrapperClassName`. */
  wrapperClassName?: string;
}

/**
 * `role`-native checkbox: a real `<input type="checkbox">` kept in the DOM
 * (`sr-only`, not `hidden`/`display:none`) so keyboard, screen reader and
 * form semantics stay free, with a styled `<span>` painted from its state
 * via the `peer` selector — same technique the design system uses nowhere
 * else yet, but the only one that doesn't reinvent `aria-checked` by hand
 * the way `Toggle` (`role="switch"`) does for its own, different control.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, labelHidden, id, className, wrapperClassName, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <label
      htmlFor={inputId}
      className={cn("flex items-center gap-sm", !props.disabled && "cursor-pointer", wrapperClassName)}
    >
      <span className="relative inline-flex shrink-0">
        <input ref={ref} type="checkbox" id={inputId} className={cn("peer sr-only", className)} {...props} />
        <span
          aria-hidden="true"
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-control border bg-surface text-blanco",
            "border-borde transition-colors duration-150",
            "peer-checked:border-negro peer-checked:bg-negro",
            // The icon is a descendant of this span, not a direct sibling of
            // `.peer` — `peer-checked:opacity-100` on the icon itself would
            // never match (Tailwind's peer variant only reaches siblings via
            // `~`). Scoping the variant here with `[&_svg]` reaches down into
            // the icon instead.
            "peer-checked:[&_svg]:opacity-100",
            "peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-negro",
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          )}
        >
          <Check aria-hidden="true" size={14} weight="bold" className="opacity-0" />
        </span>
      </span>
      <span className={cn("font-ui text-ui text-negro", labelHidden && "sr-only")}>{label}</span>
    </label>
  );
});
