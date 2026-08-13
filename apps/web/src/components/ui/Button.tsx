import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "text";
export type ButtonSize = "md" | "sm" | "icon";
/**
 * Only meaningful on `variant="ghost"` — the shape row actions already use.
 * `danger` is the reversible tier (Archivar: soft on hover, solid on press);
 * `danger-strong` is the irreversible tier (Eliminar: solid immediately,
 * skipping the soft step). Ignored by every other variant on purpose: this
 * is a color axis on top of `ghost`'s shape, not a fifth variant.
 */
export type ButtonTone = "neutral" | "danger" | "danger-strong";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** `md` (44px, the default) for standalone actions and forms; `sm` (36px) for row actions inside a `DataTable`, where `md` makes rows disproportionately tall; `icon` (36×36, square) for a single glyph with no label — always pair with `aria-label`. Ignored by the `text` variant, which is never control-sized. */
  size?: ButtonSize;
  /** Severity of a `ghost` button — see `ButtonTone`. No effect on other variants. */
  tone?: ButtonTone;
  /** Preserves the button's width and blocks the click — never resize on loading (DESIGN_SYSTEM.md §4). */
  loading?: boolean;
  children: ReactNode;
}

// Every variant defines all six states explicitly (default/hover/active/
// disabled/focus-visible are Tailwind pseudo-classes; `loading` is handled
// separately below) — DESIGN_SYSTEM.md §5's "Precise-and-Contained Rule":
// no component ships with a casual, undefined state.
const VARIANT_CLASSES: Record<Exclude<ButtonVariant, "ghost">, string> = {
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
  // No static border-b: the underline is the animated span rendered below,
  // so it can grow from the center instead of always being on.
  text: cn(
    "relative bg-transparent text-negro rounded-none h-auto px-1",
    "hover:text-dorado",
    "disabled:text-negro-disabled-text",
    "focus-visible:outline-negro",
  ),
};

// `ghost`'s rest-state look never changes with tone — only its interactive
// states do — so the two stay separate rather than three full variants of
// `bg-transparent text-negro border border-negro` repeated.
const GHOST_BASE_CLASSES = "bg-transparent text-negro border border-negro";

// Kept apart from GHOST_BASE_CLASSES for the same reason SIZE_CLASSES is
// kept apart from CONTROL_CLASSES (see below): without tailwind-merge, two
// `hover:bg-*` utilities in the same className fight by generated-CSS order,
// not string order, so exactly one tone's set is ever included.
const GHOST_TONE_CLASSES: Record<ButtonTone, string> = {
  neutral: cn(
    "hover:border-negro hover:bg-negro hover:text-blanco",
    "active:bg-negro-pressed",
    "disabled:text-negro-disabled-text disabled:border-borde",
    "focus-visible:outline-negro",
  ),
  // Archivar: reversible (there's a "Restaurar"), so it earns a warning, not
  // an alarm — soft on hover, only reaching full color on press.
  danger: cn(
    "hover:border-estado-error hover:bg-estado-error-soft hover:text-estado-error",
    "active:border-estado-error active:bg-estado-error active:text-blanco",
    "disabled:text-negro-disabled-text disabled:border-borde",
    "focus-visible:outline-estado-error",
  ),
  // Eliminar: irreversible, so hover skips straight to solid — the two tiers
  // read as different severities without a second red token.
  "danger-strong": cn(
    "hover:border-estado-error hover:bg-estado-error hover:text-blanco",
    "active:border-estado-error active:bg-estado-error active:text-blanco",
    "disabled:text-negro-disabled-text disabled:border-borde",
    "focus-visible:outline-estado-error",
  ),
};

const CONTROL_CLASSES =
  "inline-flex items-center justify-center gap-sm font-ui text-ui rounded-control transition-colors duration-150 disabled:cursor-not-allowed focus-visible:outline-3 focus-visible:outline-offset-2";

// Kept apart from CONTROL_CLASSES so a size never has to fight the base
// classes for the same property without tailwind-merge (see `lib/cn.ts`) —
// `md` matches today's literal `h-11 px-lg` byte-for-byte.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "h-11 px-lg",
  sm: "h-9 px-md",
  icon: "h-9 w-9 p-0",
};

// The `loading` spinner is positioned `left-lg`/`left-md` to match each
// size's own horizontal padding, so it never sits closer to the edge than
// the label it's replacing does. `icon` has no label to make room for, so its
// spinner centers instead.
const SPINNER_POSITION_CLASSES: Record<ButtonSize, string> = {
  md: "left-lg",
  sm: "left-md",
  icon: "left-1/2 -translate-x-1/2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", tone = "neutral", loading = false, disabled, className, children, type = "button", ...props },
  ref,
) {
  const isControlSized = variant !== "text";
  const isText = variant === "text";
  const variantClasses = variant === "ghost" ? cn(GHOST_BASE_CLASSES, GHOST_TONE_CLASSES[tone]) : VARIANT_CLASSES[variant];

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        isControlSized && CONTROL_CLASSES,
        isControlSized && SIZE_CLASSES[size],
        isText && "group font-ui text-ui transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2",
        variantClasses,
        loading && "relative text-transparent",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inline-block h-[10px] w-[10px] animate-spin rounded-full border-2 border-current border-t-transparent",
            isControlSized ? SPINNER_POSITION_CLASSES[size] : "left-1",
          )}
        />
      ) : null}
      {children}
      {isText ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px origin-center scale-x-0 bg-dorado transition-transform duration-150 group-hover:scale-x-100"
        />
      ) : null}
    </button>
  );
});
