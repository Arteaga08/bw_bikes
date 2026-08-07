import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "text";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Preserves the button's width and blocks the click — never resize on loading (DESIGN_SYSTEM.md §4). */
  loading?: boolean;
  children: ReactNode;
}

// Every variant defines all six states explicitly (default/hover/active/
// disabled/focus-visible are Tailwind pseudo-classes; `loading` is handled
// separately below) — DESIGN_SYSTEM.md §5's "Precise-and-Contained Rule":
// no component ships with a casual, undefined state.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: cn(
    "bg-dorado text-negro",
    "hover:bg-dorado-hover active:bg-dorado-pressed",
    "disabled:bg-dorado-disabled disabled:text-dorado-disabled-text",
    "focus-visible:outline-negro",
  ),
  secondary: cn(
    "bg-negro text-blanco",
    "hover:bg-negro-hover active:bg-negro-pressed",
    "disabled:bg-negro-disabled disabled:text-negro-disabled-text",
    "focus-visible:outline-dorado",
  ),
  ghost: cn(
    "bg-transparent text-negro border border-negro",
    "hover:bg-base active:bg-borde",
    "disabled:text-negro-disabled-text disabled:border-borde",
    "focus-visible:outline-negro",
  ),
  text: cn(
    "bg-transparent text-negro border-b border-negro rounded-none h-auto px-1",
    "hover:text-dorado hover:border-dorado",
    "disabled:text-negro-disabled-text disabled:border-borde",
    "focus-visible:outline-negro",
  ),
};

const CONTROL_CLASSES =
  "inline-flex items-center justify-center gap-sm font-ui text-ui h-11 px-lg rounded-control transition-colors duration-150 disabled:cursor-not-allowed focus-visible:outline-3 focus-visible:outline-offset-2";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading = false, disabled, className, children, type = "button", ...props },
  ref,
) {
  const isControlSized = variant !== "text";

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        isControlSized && CONTROL_CLASSES,
        !isControlSized && "font-ui text-ui transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2",
        VARIANT_CLASSES[variant],
        loading && "relative text-transparent",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="absolute left-lg inline-block h-[10px] w-[10px] animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
});
