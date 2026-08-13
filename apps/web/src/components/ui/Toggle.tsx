"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Hides the visible label text while keeping it for screen readers — a row's own column header already names the field. */
  hideLabel?: boolean;
}

/**
 * Accessible on/off switch (`role="switch"` + `aria-checked`), the control
 * DASHBOARD_GUIDELINES.md §5 specs in place of a bare checkbox. Used for
 * `isActive` on categories and product variants.
 */
export function Toggle({ label, checked, onChange, disabled, hideLabel }: ToggleProps) {
  const labelId = useId();

  return (
    <div className="flex items-center gap-sm">
      <span id={labelId} className={cn("font-ui text-ui text-negro", hideLabel && "sr-only")}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[25px] w-[50px] shrink-0 rounded-full border transition-colors duration-150",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro",
          checked ? "border-dorado bg-dorado" : "border-borde bg-base",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-px left-px h-[23px] w-[23px] rounded-full bg-blanco transition-transform duration-150",
            checked ? "translate-x-[25px]" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
